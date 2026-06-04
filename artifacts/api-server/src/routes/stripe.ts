import { Router, type IRouter } from 'express';
import { stripeStorage } from '../stripeStorage.js';
import { stripeService } from '../stripeService.js';
import { optionalAuth, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';

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
    console.error('Failed to load products from Stripe:', err.message);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

router.post('/stripe/checkout', optionalAuth, async (req, res) => {
  try {
    const { priceId } = req.body as { priceId?: string };
    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    const authUser = (req as AuthenticatedRequest).user;
    let customerId: string | undefined;

    if (authUser) {
      const user = await stripeStorage.upsertUser(authUser.id, authUser.email);
      customerId = user.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripeService.createCustomer(authUser.email, authUser.id);
        await stripeStorage.updateUserStripeCustomerId(authUser.id, customer.id);
        customerId = customer.id;
      }
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
    res.status(500).json({ error: 'Checkout failed' });
  }
});

router.post('/stripe/provision', async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const stripe = await stripeService.getClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const email = session.customer_details?.email;
    if (!email) return res.status(400).json({ error: 'No customer email on session' });

    // Create or find Supabase auth user — generateLink creates the user if not exists
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData?.user) {
      console.error('Provision: generateLink failed:', linkError?.message ?? 'no user returned');
      return res.status(500).json({ error: 'Failed to provision user' });
    }

    const userId = linkData.user.id;

    try {
      await stripeStorage.upsertUser(userId, email);
    } catch (dbErr: any) {
      console.error('Provision: upsertUser failed:', dbErr.message);
      throw dbErr;
    }

    // Create order idempotently
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (paymentIntentId) {
      try {
        const existing = await stripeStorage.getOrderByPaymentIntent(paymentIntentId);
        if (!existing) {
          const lineItem = session.line_items?.data[0];
          const priceId = typeof lineItem?.price === 'string' ? lineItem.price : (lineItem?.price?.id ?? '');
          const productId = typeof lineItem?.price?.product === 'string'
            ? lineItem.price.product
            : ((lineItem?.price?.product as any)?.id ?? '');

          await stripeStorage.createOrder({
            userId,
            stripePaymentIntentId: paymentIntentId,
            stripePriceId: priceId,
            stripeProductId: productId,
            amount: session.amount_total ?? 0,
            currency: session.currency ?? 'usd',
            status: 'paid',
          });
        }
      } catch (dbErr: any) {
        console.error('Provision: order creation failed:', dbErr.message);
        throw dbErr;
      }
    }

    res.json({ email });
  } catch (err: any) {
    console.error('Provision failed:', err.message);
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
