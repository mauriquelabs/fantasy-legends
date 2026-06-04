import { Router, type IRouter } from 'express';
import { stripeStorage } from '../stripeStorage.js';
import { stripeService } from '../stripeService.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router: IRouter = Router();

router.get('/stripe/products', async (_req, res) => {
  try {
    const stripe = await stripeService.getClient();
    const [productsResponse, pricesResponse] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    const pricesByProduct = new Map<string, any[]>();
    for (const price of pricesResponse.data) {
      const productId = typeof price.product === 'string' ? price.product : price.product.id;
      if (!pricesByProduct.has(productId)) pricesByProduct.set(productId, []);
      pricesByProduct.get(productId)!.push({
        id: price.id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring,
      });
    }

    const products = productsResponse.data.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      images: p.images,
      prices: pricesByProduct.get(p.id) ?? [],
    }));

    res.json({ data: products });
  } catch (err: any) {
    logger.error({ err }, 'Failed to load products from Stripe');
    res.status(500).json({ error: 'Failed to load products' });
  }
});

router.post('/stripe/checkout', requireAuth, async (req, res) => {
  try {
    const { priceId } = req.body as { priceId?: string };
    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    const authUser = (req as AuthenticatedRequest).user;
    const user = await stripeStorage.upsertUser(authUser.id, authUser.email);
    let customerId = user.stripeCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripeService.createCustomer(authUser.email, authUser.id);
      await stripeStorage.updateUserStripeCustomerId(authUser.id, customer.id);
      customerId = customer.id;
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const baseUrl = domain ? `https://${domain}` : (process.env.BASE_URL ?? 'http://localhost:5173');
    const session = await stripeService.createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err }, 'Checkout failed');
    res.status(500).json({ error: 'Checkout failed' });
  }
});

router.post('/stripe/provision', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const authUser = (req as AuthenticatedRequest).user;
    const stripe = await stripeService.getClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    // Idempotent — return success if order already recorded
    if (paymentIntentId) {
      const existing = await stripeStorage.getOrderByPaymentIntent(paymentIntentId);
      if (existing) return res.json({ success: true });
    }

    if (paymentIntentId) {
      const lineItem = session.line_items?.data[0];
      const priceId = typeof lineItem?.price === 'string' ? lineItem.price : (lineItem?.price?.id ?? '');
      const productId = typeof lineItem?.price?.product === 'string'
        ? lineItem.price.product
        : ((lineItem?.price?.product as any)?.id ?? '');

      await stripeStorage.createOrder({
        userId: authUser.id,
        stripePaymentIntentId: paymentIntentId,
        stripePriceId: priceId,
        stripeProductId: productId,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'paid',
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Provision failed');
    res.status(500).json({ error: 'Failed to provision' });
  }
});

router.get('/stripe/orders', requireAuth, async (req, res) => {
  try {
    const { id: userId } = (req as AuthenticatedRequest).user;
    const orders = await stripeStorage.getOrdersByUserId(userId);
    res.json({ data: orders });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

export default router;
