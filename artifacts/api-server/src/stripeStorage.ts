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
    // If a stale row exists with the same email but a different Supabase ID,
    // migrate its orders to the new ID then remove the stale row.
    // All three statements run in a transaction to prevent races on concurrent logins.
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE orders
        SET user_id = ${id}
        WHERE user_id IN (SELECT id FROM users WHERE email = ${email} AND id <> ${id})
      `);
      await tx.execute(sql`
        DELETE FROM users WHERE email = ${email} AND id <> ${id}
      `);
      return tx.execute(sql`
        INSERT INTO users (id, email)
        VALUES (${id}, ${email})
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
        RETURNING *
      `);
    });
    return result.rows[0] as typeof users.$inferSelect;
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
