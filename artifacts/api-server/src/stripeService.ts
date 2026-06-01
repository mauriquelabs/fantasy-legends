import { stripeStorage } from './stripeStorage.js';
import { getUncachableStripeClient } from './stripeClient.js';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: params.customerId,
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }
}

export const stripeService = new StripeService();
