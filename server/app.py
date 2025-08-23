import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import stripe

app = Flask(__name__)
# allow your site + local testing
CORS(app, resources={r"/*": {"origins": [
    "https://toppocketfind.ca",
    "https://slickr98.github.io",
    "http://localhost:8080"
]}})

# use TEST key for now; we'll flip to live later
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY_TEST", "")

@app.get("/")
def root(): return "ok", 200

@app.post("/create-checkout-session")
def create_checkout_session():
    data = request.get_json(force=True) or {}
    items = data.get("items", [])

    # build line items from cart payload
    line_items = []
    for it in items:
        title = it.get("title", "Item")
        price_cents = int(it.get("priceCents", 500))  # default $5
        qty = int(it.get("qty", 1))
        line_items.append({
            "price_data": {
                "currency": "cad",
                "product_data": {"name": title},
                "unit_amount": price_cents
            },
            "quantity": qty
        })

    ship_cents = int(os.environ.get("SHIP_CENTS", "0"))  # $0 for now
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=line_items,
        shipping_address_collection={"allowed_countries": ["CA"]},
        shipping_options=[{
            "shipping_rate_data": {
                "display_name": "Flat rate",
                "type": "fixed_amount",
                "fixed_amount": {"amount": ship_cents, "currency": "cad"}
            }
        }],
        success_url="https://toppocketfind.ca/success.html?sid={CHECKOUT_SESSION_ID}",
        cancel_url="https://toppocketfind.ca/cart.html",
    )
    return jsonify({"url": session.url})
