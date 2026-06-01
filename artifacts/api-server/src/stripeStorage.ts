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
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active, images
        FROM stripe.products
        WHERE active = ${active}
        ORDER BY created DESC
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        p.images as product_images,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
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

  async findOrCreateUser(email: string) {
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing[0]) return existing[0];

    const [newUser] = await db.insert(users).values({ email }).returning();
    return newUser;
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

  async getOrdersByEmail(email: string) {
    const result = await db.execute(sql`
      SELECT o.*, p.name as product_name
      FROM orders o
      JOIN users u ON u.id = o.user_id
      LEFT JOIN stripe.products p ON p.id = o.stripe_product_id
      WHERE u.email = ${email}
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
