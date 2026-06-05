import { sql } from 'drizzle-orm';
import { db, users, orders } from '@workspace/db';
import { eq } from 'drizzle-orm';

export class StripeStorage {
  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProductsWithPrices(active = true) {
    const result = await db.execute(sql`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        p.images as product_images,
        p.created as product_created,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = ${active}
      ORDER BY p.created DESC, pr.unit_amount
    `);
    return result.rows;
  }

  async getPrice(priceId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }

  async upsertUser(id: string, email: string) {
    // If a stale row exists with the same email but a different Supabase ID
    // (can happen when a user deletes and re-creates their auth account),
    // migrate its orders to the new ID before removing it. All three steps
    // run in a single transaction to prevent interleaving on concurrent logins.
    return db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE orders
        SET user_id = ${id}
        WHERE user_id IN (SELECT id FROM users WHERE email = ${email} AND id <> ${id})
      `);
      await tx.execute(sql`
        DELETE FROM users WHERE email = ${email} AND id <> ${id}
      `);
      const [user] = await tx
        .insert(users)
        .values({ id, email })
        .onConflictDoUpdate({ target: users.id, set: { email } })
        .returning();
      return user;
    });
  }

  async getOrCreateStripeCustomerId(
    userId: string,
    createFn: () => Promise<string>,
  ): Promise<string> {
    // SELECT FOR UPDATE serializes concurrent checkout calls for the same user,
    // preventing duplicate Stripe customer creation.
    return db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT stripe_customer_id FROM users WHERE id = ${userId} FOR UPDATE`,
      );
      const existing = (result.rows[0] as { stripe_customer_id: string | null } | undefined)
        ?.stripe_customer_id;
      if (existing) return existing;
      const customerId = await createFn();
      await tx.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
      return customerId;
    });
  }

  async getUserById(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || null;
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string) {
    const [updated] = await db
      .update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async createOrder(data: {
    userId: string;
    stripePaymentIntentId: string;
    stripePriceId: string;
    stripeProductId: string;
    amount: number;
    currency: string;
    status: string;
  }) {
    const [order] = await db.insert(orders).values(data).returning();
    return order;
  }

  async createOrderIfNotExists(data: {
    userId: string;
    stripePaymentIntentId: string;
    stripePriceId: string;
    stripeProductId: string;
    amount: number;
    currency: string;
    status: string;
  }) {
    // ON CONFLICT DO NOTHING is the atomic idempotency guard — concurrent
    // provision requests both succeed without a 500 unique-violation error.
    await db
      .insert(orders)
      .values(data)
      .onConflictDoNothing({ target: orders.stripePaymentIntentId });
  }

  async getOrdersByUserId(userId: string) {
    const result = await db.execute(sql`
      SELECT o.*, p.name as product_name
      FROM orders o
      LEFT JOIN stripe.products p ON p.id = o.stripe_product_id
      WHERE o.user_id = ${userId}
      ORDER BY o.created_at DESC
    `);
    return result.rows;
  }

  async getOrderByPaymentIntent(paymentIntentId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.stripePaymentIntentId, paymentIntentId));
    return order || null;
  }

  async updateOrderStatus(paymentIntentId: string, status: string) {
    const [updated] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.stripePaymentIntentId, paymentIntentId))
      .returning();
    return updated;
  }
}

export const stripeStorage = new StripeStorage();
