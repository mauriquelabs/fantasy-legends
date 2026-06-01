import { Router, type IRouter } from 'express';
import { stripeStorage } from '../stripeStorage.js';
import { stripeService } from '../stripeService.js';

const router: IRouter = Router();

router.get('/stripe/products', async (_req, res) => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();
    const productsMap = new Map<string, any>();
    for (const row of rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          images: row.product_images ?? [],
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }
    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/checkout', async (req, res) => {
  try {
    const { email, priceId } = req.body as { email?: string; priceId?: string };
    if (!email || !priceId) {
      return res.status(400).json({ error: 'email and priceId are required' });
    }

    const price = await stripeStorage.getPrice(priceId);
    if (!price) {
      return res.status(404).json({ error: 'Price not found' });
    }

    const user = await stripeStorage.findOrCreateUser(email);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(email, user.id);
      await stripeStorage.updateUserStripeCustomerId(user.id, customer.id);
      customerId = customer.id;
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripeService.createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stripe/orders', async (req, res) => {
  try {
    const { email } = req.query as { email?: string };
    if (!email) {
      return res.status(400).json({ error: 'email query param required' });
    }
    const orders = await stripeStorage.getOrdersByEmail(email);
    res.json({ data: orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
