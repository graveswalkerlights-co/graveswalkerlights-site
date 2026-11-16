// Confirms a Stripe Checkout session after the customer comes back from paying.
// The website calls this, and only sends the order email once Stripe says the session is paid.
// Uses the same STRIPE_SECRET_KEY (Checkout Sessions: Write also allows reading sessions).

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "not_configured" }, 503);
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "bad_session" }, 400);

  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const s = await r.json();
  if (!r.ok) { console.error("Stripe error", s?.error?.message); return json({ error: "stripe_error" }, 502); }
  if (s.payment_status !== "paid") return json({ paid: false });
  return json({
    paid: true,
    amount_total: s.amount_total,
    email: s.customer_details?.email || s.customer_email || "",
    metadata: s.metadata || {}
  });
};

export const config = { path: "/api/confirm" };
