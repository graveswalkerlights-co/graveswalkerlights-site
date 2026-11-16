// Creates a Stripe Checkout session for an order from the website.
// Needs one environment variable in Netlify: STRIPE_SECRET_KEY (a restricted key with "Checkout Sessions: Write").
// Prices and tax are worked out here, not in the browser, so the customer can't change what they pay.

const PRICE_C = 2500;   // $25.00 per ball
const DELIVERY_C = 1399; // $13.99 per order
const WAKE_BP = 725;    // 7.25%, in hundredths of a percent

// Delivery ZIPs (any part within a 25-minute drive) and the county sales tax rate for each.
const ZIPS = {
  "27601": 725, "27603": 725, "27604": 725, "27605": 725, "27606": 725, "27607": 725, "27608": 725,
  "27609": 725, "27610": 725, "27612": 725, "27613": 725, "27614": 725, "27615": 725, "27616": 725,
  "27617": 725, "27511": 725, "27513": 725, "27518": 725, "27502": 725, "27539": 725, "27529": 725,
  "27545": 725, "27560": 725, "27571": 725
};

// NC G.S. 105-164.10(b): tax per item, carried to the third decimal, rounded up at 5 or more.
const taxC = (cents, bp) => Math.round(Math.floor((cents * bp) / 1000) / 10);
const clip = (v, n = 450) => String(v ?? "").trim().slice(0, n);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "not_configured" }, 503);

  let o;
  try { o = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const qty = Math.floor(Number(o.quantity));
  if (!(qty >= 1 && qty <= 50)) return json({ error: "bad_quantity" }, 400);
  const delivery = o.fulfillment === "Delivery";
  const zip = clip(o.zip, 5);
  if (delivery && !(zip in ZIPS)) return json({ error: "outside_delivery_area" }, 400);
  const bp = delivery ? ZIPS[zip] : WAKE_BP;
  const color = o.wire_color === "White" ? "White" : "Green";
  const tax = qty * taxC(PRICE_C, bp) + (delivery ? taxC(DELIVERY_C, bp) : 0);

  const site = new URL(req.url).origin;
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", `${site}/?paid=1&f=${delivery ? "Delivery" : "Pickup"}#order`);
  p.set("cancel_url", `${site}/?canceled=1#order`);
  let i = 0;
  const item = (name, cents, q) => {
    p.set(`line_items[${i}][price_data][currency]`, "usd");
    p.set(`line_items[${i}][price_data][product_data][name]`, name);
    p.set(`line_items[${i}][price_data][unit_amount]`, String(cents));
    p.set(`line_items[${i}][quantity]`, String(q));
    i++;
  };
  item(`Lighted Christmas ball (${color.toLowerCase()} wire)`, PRICE_C, qty);
  if (delivery) item("Local delivery", DELIVERY_C, 1);
  item(`NC sales tax (${bp / 100}%)`, tax, 1);

  const email = clip(o.email, 200);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) p.set("customer_email", email);

  const meta = {
    name: o.name, phone: o.phone, quantity: qty, wire_color: color,
    fulfillment: delivery ? "Delivery" : "Pickup",
    street: o.street, city: o.city, zip, delivery_notes: o.delivery_notes, notes: o.notes,
    referral: o.referral === "Other" && clip(o.referral_other) ? `Other: ${clip(o.referral_other, 120)}` : o.referral
  };
  for (const [k, v] of Object.entries(meta)) if (clip(v)) {
    p.set(`metadata[${k}]`, clip(v));
    p.set(`payment_intent_data[metadata][${k}]`, clip(v));
  }
  p.set("payment_intent_data[description]",
    `${qty} ball(s), ${color} wire, ${delivery ? "delivery to " + zip : "pickup"} - ${clip(o.name, 80)}`);

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: p
  });
  const s = await r.json();
  if (!r.ok) { console.error("Stripe error", s?.error?.message); return json({ error: "stripe_error" }, 502); }
  return json({ url: s.url });
};

export const config = { path: "/api/checkout" };
