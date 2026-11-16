# GravesWalkerLights & Co. website

Static site (`index.html`, `img/`) hosted on Netlify, with one Netlify Function for card checkout.

- **Edit text:** change `index.html` and commit. Netlify redeploys automatically.
- **Prices, delivery ZIPs, tax rates:** set in two places that must match: the `<script>` at the bottom of `index.html` and `netlify/functions/checkout.mjs`.
- **Card payments:** Stripe Checkout. Netlify needs the environment variable `STRIPE_SECRET_KEY`.
- **Orders:** every order is also saved as a Netlify Form submission ("order") and emailed to GravesWalkerLights@gmail.com.
