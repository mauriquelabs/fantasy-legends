import { sql } from 'drizzle-orm';
import { db, users, orders } from '@workspace/db';
import { eq } from 'drizzle-orm';

export class StripeStorage {
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
    // Optimistic read — avoids hitting Stripe at all for returning users
    const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId })
      .from(users).where(eq(users.id, userId));
    if (user?.stripeCustomerId) return user.stripeCustomerId;

    // createFn (Stripe HTTP) runs outside any DB transaction so we don't hold
    // a row lock for the duration of a network call.
    const customerId = await createFn();

    // Write only if a concurrent request hasn't already claimed a customer ID.
    await db.execute(
      sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId} AND stripe_customer_id IS NULL`,
    );

    // Re-read to return whichever value won the race.
    const [updated] = await db.select({ stripeCustomerId: users.stripeCustomerId })
      .from(users).where(eq(users.id, userId));
    return updated.stripeCustomerId!;
  }

  async getUserById(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || null;
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
