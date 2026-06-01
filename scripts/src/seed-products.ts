import { getUncachableStripeClient } from './stripeClient.js';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Creating products in Stripe (sandbox)...');

    const existing = await stripe.products.search({
      query: "name:'Pro Scout Report' AND active:'true'",
    });
    if (existing.data.length > 0) {
      console.log('Products already exist. Listing current products:');
      const prices = await stripe.prices.list({ limit: 20, active: true, expand: ['data.product'] });
      for (const price of prices.data) {
        const product = price.product as any;
        console.log(`  ${product.name}: $${(price.unit_amount! / 100).toFixed(2)} (price: ${price.id})`);
      }
      return;
    }

    const scoutReport = await stripe.products.create({
      name: 'Pro Scout Report',
      description: 'Detailed AI-powered scouting analysis for a player of your choice — SO5 form, injury risk, fixture difficulty, and value rating.',
      images: [],
      metadata: { type: 'report' },
    });
    const scoutReportPrice = await stripe.prices.create({
      product: scoutReport.id,
      unit_amount: 499,
      currency: 'usd',
    });
    console.log(`Created: ${scoutReport.name} — $4.99 (${scoutReportPrice.id})`);

    const marketAlert = await stripe.products.create({
      name: 'Market Alert Pack',
      description: 'Get 30 days of deal alerts — cards priced significantly below their rarity average, delivered to your inbox.',
      images: [],
      metadata: { type: 'subscription_pack' },
    });
    const marketAlertPrice = await stripe.prices.create({
      product: marketAlert.id,
      unit_amount: 999,
      currency: 'usd',
    });
    console.log(`Created: ${marketAlert.name} — $9.99 (${marketAlertPrice.id})`);

    const proBundle = await stripe.products.create({
      name: 'Pro Bundle',
      description: 'Everything: 5 scout reports, 30-day market alerts, and priority fixture analysis for the full World Cup group stage.',
      images: [],
      metadata: { type: 'bundle' },
    });
    const proBundlePrice = await stripe.prices.create({
      product: proBundle.id,
      unit_amount: 2499,
      currency: 'usd',
    });
    console.log(`Created: ${proBundle.name} — $24.99 (${proBundlePrice.id})`);

    console.log('\nAll products created. Webhooks will sync them to your database automatically.');
  } catch (err: any) {
    console.error('Error creating products:', err.message);
    process.exit(1);
  }
}

createProducts();
