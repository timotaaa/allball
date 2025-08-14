// Minimal billing server for AllBall (Stripe + Express)
// Env required: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTH, STRIPE_PRICE_ORG_MONTH, CLIENT_URL
// Optional: STRIPE_WEBHOOK_SECRET
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());

// Create checkout session for user or org
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, customerEmail, metadata = {} } = req.body;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/?checkout=success`,
      cancel_url: `${process.env.CLIENT_URL}/?checkout=cancel`,
      metadata
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Create Stripe portal link for customer
app.post('/create-portal-link', async (req, res) => {
  try {
    const { customerId } = req.body;
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.CLIENT_URL
    });
    res.json({ url: portal.url });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Webhook to handle subscription lifecycle
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event = req.body;
  const sig = req.headers['stripe-signature'];
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed', err.message);
      return res.sendStatus(400);
    }
  }
  // TODO: call Supabase to update user/org subscription status using metadata/customer id
  // Example events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
  res.json({ received: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Billing server listening on :${port}`));


