# server/app.py
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import stripe

app = Flask(__name__)

# Read Stripe secret from env (test or live)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY_TEST") or os.getenv("STRIPE_SECRET_KEY")

# Allow your site (and localhost for quick testing) to call the API
CORS(
    app,
    resources={r"/create-checkout-session": {"origins": [
        "https://toppocketfind.ca",
        "http://localhost:8000", "http://127.0.0.1:8000",
        "http://localhost:8080"
    ]}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

@app.after_request
def add_cors_headers(resp):
    # Helpful for some proxies; harmless if duplicated with flask-cors
    resp.headers["Access-Control-Allow-Origin"] = "https://toppocketfind.ca"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

@app.route("/", methods=["GET"])
def health():
    return "ok"

@app.route("/create-checkout-session", methods=["POST", "OPTIONS"])
def create_checkout_session():
    # Handle browser CORS preflight
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(silent=True) or {}
    items = data.get("items", [])

    # Build Stripe line items
    line_items = []
    for it in items:
        title = it.get("title", "Item")
        unit_amount = int(it.get("priceCents", 0))
        qty = max(1, int(it.get("qty", 1) or 1))
        line_items.append({
            "price_data": {
                "currency": "cad",
                "product_data": {"name": title},
                "unit_amount": unit_amount,
            },
            "quantity": qty,
        })

    # Optional flat shipping (from env)
    ship_cents = int(os.getenv("SHIP_CENTS", "0") or 0)
    if ship_cents:
        line_items.append({
            "price_data": {
                "currency": "cad",
                "product_data": {"name": "Shipping"},
                "unit_amount": ship_cents,
            },
            "quantity": 1,
        })

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=line_items,
            success_url="https://toppocketfind.ca/cart/success.html",
            cancel_url="https://toppocketfind.ca/cart/cart.html",
        )
        return jsonify({"url": session.url})
    except Exception as e:
        # Log server-side for debugging
        print("Stripe error:", repr(e))
        return jsonify({"error": "stripe"}), 500

# Gunicorn entry point: app:app
