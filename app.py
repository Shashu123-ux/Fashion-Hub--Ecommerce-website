import os
import sqlite3
from datetime import datetime

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from utils.auth import admin_required, hash_password, login_required, verify_password


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev_secret_key_change_me")

    def get_db():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_db():
        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user'
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            description TEXT,
            details TEXT,
            discount INTEGER DEFAULT 0
            );

            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS product_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                size TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                size TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                payment_mode TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                street TEXT NOT NULL,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                pincode TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )

        conn.commit()

        _seed_admin(conn)
        _seed_products(conn)

        conn.close()

    def _seed_admin(conn):
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1", ("admin@fashionhub.com",)
        ).fetchone()
        if existing:
            return

        conn.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Admin", "admin@fashionhub.com", hash_password("admin123"), "admin"),
        )
        conn.commit()

    def _seed_products(conn):
        row = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()
        if row["c"] > 0:
            return

        placeholder = "/static/images/placeholder.svg"
        items = [
            (
                "Ivory Banarasi Saree",
                "Ethnic Elegance",
                2999,
                10,
                "Fabric: Banarasi silk\nFit: Classic drape\nOccasion: Wedding & Festive\nCare: Dry clean only\nDiscount: 10%",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Rose Gold Lehengha Set",
                "Ethnic Elegance",
                5499,
                6,
                "Fabric: Net + satin lining\nFit: Flared\nOccasion: Party & Sangeet\nCare: Dry clean only",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Teal Anarkali Kurta",
                "Ethnic Elegance",
                2199,
                12,
                "Fabric: Rayon\nFit: Regular\nOccasion: Festive daywear\nCare: Gentle machine wash",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Indo-Western Kurti Dress",
                "Fusion Wear",
                1799,
                15,
                "Fabric: Cotton blend\nFit: A-line\nOccasion: Brunch & Office\nCare: Machine wash cold\nDiscount: 15%",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Mint Palazzo Co-ord Set",
                "Fusion Wear",
                2499,
                8,
                "Fabric: Linen blend\nFit: Relaxed\nOccasion: Travel & Casual\nCare: Hand wash recommended",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Workwear Solid Kurti",
                "Everyday Kurtis",
                999,
                20,
                "Fabric: Cotton\nFit: Straight\nOccasion: Office & Daily\nCare: Machine wash\nDiscount: 5%",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Printed Casual Kurti",
                "Everyday Kurtis",
                899,
                18,
                "Fabric: Cotton\nFit: Regular\nOccasion: Daily wear\nCare: Machine wash",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Black Satin Slip Dress",
                "Western Chic",
                1599,
                9,
                "Fabric: Satin\nFit: Slim\nOccasion: Date night\nCare: Hand wash cold",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Olive Jumpsuit",
                "Western Chic",
                1999,
                0,
                "Fabric: Crepe\nFit: Regular\nOccasion: Evening\nCare: Dry clean suggested",
                [placeholder, placeholder, placeholder],
            ),
            (
                "High-Waist Wide-Leg Jeans",
                "Bottom Wear",
                1899,
                14,
                "Fabric: Denim\nFit: Wide leg\nOccasion: Everyday\nCare: Machine wash\nDiscount: 12%",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Ivory Sharara Pants",
                "Bottom Wear",
                1399,
                5,
                "Fabric: Georgette\nFit: Flared\nOccasion: Festive\nCare: Dry clean only",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Soft Lounge Co-ord Set",
                "Active & Lounge Wear",
                1299,
                16,
                "Fabric: Terry cotton\nFit: Relaxed\nOccasion: Home & Travel\nCare: Machine wash",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Athleisure Zip Top",
                "Active & Lounge Wear",
                1199,
                11,
                "Fabric: Polyester blend\nFit: Slim\nOccasion: Workout\nCare: Machine wash cold",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Chiffon Dupatta - Pastel",
                "Seasonal & Layering",
                699,
                25,
                "Fabric: Chiffon\nFit: Free\nOccasion: Festive layering\nCare: Hand wash",
                [placeholder, placeholder, placeholder],
            ),
            (
                "Neutral Long Shrug",
                "Seasonal & Layering",
                1499,
                7,
                "Fabric: Knit\nFit: Regular\nOccasion: Layering\nCare: Gentle wash\nDiscount: 8%",
                [placeholder, placeholder, placeholder],
            ),
        ]

        for name, category, price, stock, description, images in items:
            cur = conn.execute(
                "INSERT INTO products (name, category, price, stock, description) VALUES (?, ?, ?, ?, ?)",
                (name, category, price, stock, description),
            )
            product_id = cur.lastrowid
            for img in images:
                conn.execute(
                    "INSERT INTO product_images (product_id, image_url) VALUES (?, ?)",
                    (product_id, img),
                )

        conn.commit()

    def _session_user():
        if not session.get("user_id"):
            return None
        return {
            "id": session.get("user_id"),
            "name": session.get("name"),
            "email": session.get("email"),
            "role": session.get("role"),
        }

    def _product_to_dict(row, image_urls=None):
        if row is None:
            return None
        item = dict(row)
        item["price"] = float(item["price"])
        item["stock"] = int(item["stock"])
        item["discount"] = int(item.get("discount") or 0)
        item["details"] = item.get("details") or ""
        item["images"] = image_urls or []
        return item


    def _get_product_images(conn, product_id):
        rows = conn.execute(
            "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY id ASC",
            (product_id,),
        ).fetchall()
        return [r["image_url"] for r in rows]

    # Initialize database and seed demo data once at startup.
    init_db()

    # -------------------------
    # Pages
    # -------------------------
    @app.get("/")
    def index():
        return render_template("index.html", user=_session_user())

    @app.get("/login")
    def login():
        return render_template("login.html", user=_session_user())

    @app.get("/register")
    def register():
        return render_template("register.html", user=_session_user())

    @app.get("/products")
    def products_page():
        category = request.args.get("category", "").strip()
        return render_template("products.html", user=_session_user(), category=category)

    @app.get("/product/<int:product_id>")
    def product_detail_page(product_id):
        return render_template(
            "product_detail.html", user=_session_user(), product_id=product_id
        )

    @app.get("/cart")
    @login_required
    def cart_page():
        return render_template("cart.html", user=_session_user())

    @app.get("/checkout")
    @login_required
    def checkout_page():
        return render_template("checkout.html", user=_session_user())

    @app.get("/orders")
    @login_required
    def orders_page():
        return render_template("orders.html", user=_session_user())

    @app.get("/profile")
    @login_required
    def profile_page():
        return render_template("profile.html", user=_session_user())

    @app.get("/admin")
    @admin_required
    def admin_page():
        return render_template("admin.html", user=_session_user())

    # -------------------------
    # Auth API
    # -------------------------
    @app.post("/api/register")
    def api_register():
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not email or not password:
            return jsonify({"error": "Name, email, and password are required"}), 400

        conn = get_db()
        try:
            existing = conn.execute(
                "SELECT id FROM users WHERE email = ? LIMIT 1", (email,)
            ).fetchone()
            if existing:
                return jsonify({"error": "Email already registered"}), 400

            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                (name, email, hash_password(password), "user"),
            )
            conn.commit()

            user_id = cur.lastrowid
            session["user_id"] = user_id
            session["name"] = name
            session["email"] = email
            session["role"] = "user"

            return jsonify({"message": "Registered successfully"})
        finally:
            conn.close()

    @app.post("/api/login")
    def api_login():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        conn = get_db()
        try:
            user = conn.execute(
                "SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1",
                (email,),
            ).fetchone()
            if not user or not verify_password(user["password_hash"], password):
                return jsonify({"error": "Invalid email or password"}), 401

            session["user_id"] = user["id"]
            session["name"] = user["name"]
            session["email"] = user["email"]
            session["role"] = user["role"]

            return jsonify({"message": "Login successful", "role": user["role"]})
        finally:
            conn.close()

    @app.post("/api/logout")
    def api_logout():
        session.clear()
        return jsonify({"message": "Logged out"})

    @app.get("/api/me")
    def api_me():
        user = _session_user()
        if not user:
            return jsonify({"logged_in": False})
        return jsonify({"logged_in": True, "user": user})

    # -------------------------
    # Products API
    # -------------------------
    @app.get("/api/categories")
    def api_categories():
        categories = [
            "Ethnic Elegance",
            "Fusion Wear",
            "Everyday Kurtis",
            "Western Chic",
            "Bottom Wear",
            "Active & Lounge Wear",
            "Seasonal & Layering",
        ]
        return jsonify({"categories": categories})

    @app.get("/api/products")
    def api_products():
        category = (request.args.get("category") or "").strip()
        q = (request.args.get("q") or "").strip()

        conn = get_db()
        try:
            sql = "SELECT * FROM products"
            params = []
            where = []

            if category:
                where.append("category = ?")
                params.append(category)

            if q:
                where.append("(name LIKE ? OR description LIKE ?)")
                params.append(f"%{q}%")
                params.append(f"%{q}%")

            if where:
                sql += " WHERE " + " AND ".join(where)

            sql += " ORDER BY id DESC"

            rows = conn.execute(sql, params).fetchall()
            items = []
            for r in rows:
                imgs = _get_product_images(conn, r["id"])
                items.append(_product_to_dict(r, imgs[:1]))
            return jsonify({"products": items})
        finally:
            conn.close()

    @app.get("/api/products/<int:product_id>")
    def api_product_detail(product_id):
        conn = get_db()
        try:
            row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not row:
                return jsonify({"error": "Product not found"}), 404
            images = _get_product_images(conn, product_id)
            return jsonify({"product": _product_to_dict(row, images)})
        finally:
            conn.close()

    # -------------------------
    # Cart API
    # -------------------------
    @app.get("/api/cart")
    @login_required
    def api_cart():
        user_id = session["user_id"]
        conn = get_db()
        try:
            rows = conn.execute(
                """
                SELECT
                    cart.id AS cart_item_id,
                    cart.size,
                    cart.quantity,
                    products.id AS product_id,
                    products.name,
                    products.price,
                    products.stock,
                    products.category
                FROM cart
                JOIN products ON products.id = cart.product_id
                WHERE cart.user_id = ?
                ORDER BY cart.id DESC
                """,
                (user_id,),
            ).fetchall()

            items = []
            total = 0.0
            for r in rows:
                imgs = _get_product_images(conn, r["product_id"])
                item = dict(r)
                item["price"] = float(item["price"])
                item["stock"] = int(item["stock"])
                item["line_total"] = float(item["price"]) * int(item["quantity"])
                item["image_url"] = imgs[0] if imgs else ""
                total += item["line_total"]
                items.append(item)

            return jsonify({"items": items, "total": round(total, 2)})
        finally:
            conn.close()

    @app.post("/api/cart/add")
    @login_required
    def api_cart_add():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}
        product_id = int(data.get("product_id") or 0)
        size = (data.get("size") or "").strip().upper()
        quantity = int(data.get("quantity") or 1)

        if product_id <= 0 or size not in ["XS", "S", "M", "L", "XL", "XXL"]:
            return jsonify({"error": "Valid product and size are required"}), 400
        if quantity <= 0:
            return jsonify({"error": "Quantity must be at least 1"}), 400

        conn = get_db()
        try:
            product = conn.execute(
                "SELECT id, stock FROM products WHERE id = ?",
                (product_id,),
            ).fetchone()
            if not product:
                return jsonify({"error": "Product not found"}), 404

            stock = int(product["stock"])
            if stock <= 0:
                return jsonify({"error": "Out of stock"}), 400

            existing = conn.execute(
                "SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? AND size = ?",
                (user_id, product_id, size),
            ).fetchone()

            if existing:
                new_qty = int(existing["quantity"]) + quantity
                if new_qty > stock:
                    new_qty = stock
                conn.execute(
                    "UPDATE cart SET quantity = ? WHERE id = ?",
                    (new_qty, existing["id"]),
                )
            else:
                if quantity > stock:
                    quantity = stock
                conn.execute(
                    "INSERT INTO cart (user_id, product_id, size, quantity) VALUES (?, ?, ?, ?)",
                    (user_id, product_id, size, quantity),
                )

            conn.commit()
            return jsonify({"message": "Added to cart"})
        finally:
            conn.close()

    @app.post("/api/cart/update")
    @login_required
    def api_cart_update():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}
        cart_item_id = int(data.get("cart_item_id") or 0)
        quantity = int(data.get("quantity") or 1)

        if cart_item_id <= 0:
            return jsonify({"error": "Cart item is required"}), 400
        if quantity <= 0:
            return jsonify({"error": "Quantity must be at least 1"}), 400

        conn = get_db()
        try:
            row = conn.execute(
                """
                SELECT cart.id, cart.product_id, products.stock
                FROM cart
                JOIN products ON products.id = cart.product_id
                WHERE cart.id = ? AND cart.user_id = ?
                """,
                (cart_item_id, user_id),
            ).fetchone()
            if not row:
                return jsonify({"error": "Cart item not found"}), 404

            stock = int(row["stock"])
            if stock <= 0:
                return jsonify({"error": "Item is out of stock"}), 400

            if quantity > stock:
                quantity = stock

            conn.execute(
                "UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?",
                (quantity, cart_item_id, user_id),
            )
            conn.commit()
            return jsonify({"message": "Cart updated"})
        finally:
            conn.close()

    @app.post("/api/cart/remove")
    @login_required
    def api_cart_remove():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}
        cart_item_id = int(data.get("cart_item_id") or 0)

        if cart_item_id <= 0:
            return jsonify({"error": "Cart item is required"}), 400

        conn = get_db()
        try:
            conn.execute(
                "DELETE FROM cart WHERE id = ? AND user_id = ?",
                (cart_item_id, user_id),
            )
            conn.commit()
            return jsonify({"message": "Removed from cart"})
        finally:
            conn.close()

    # -------------------------
    # Orders + Checkout API
    # -------------------------
    @app.post("/api/checkout")
    @login_required
    def api_checkout():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}
        payment_mode = (data.get("payment_mode") or "COD").strip().upper()
        if payment_mode not in ["COD", "UPI", "CARD", "NETBANKING"]:
            payment_mode = "COD"

        conn = get_db()
        try:
            cart_rows = conn.execute(
                """
                SELECT
                    cart.id AS cart_item_id,
                    cart.product_id,
                    cart.size,
                    cart.quantity,
                    products.price,
                    products.stock,
                    products.name
                FROM cart
                JOIN products ON products.id = cart.product_id
                WHERE cart.user_id = ?
                """,
                (user_id,),
            ).fetchall()

            if not cart_rows:
                return jsonify({"error": "Your cart is empty"}), 400

            # validate stock
            for r in cart_rows:
                if int(r["stock"]) <= 0:
                    return jsonify({"error": f"Out of stock: {r['name']}"}), 400
                if int(r["quantity"]) > int(r["stock"]):
                    return jsonify({"error": f"Not enough stock: {r['name']}"}), 400

            total = 0.0
            for r in cart_rows:
                total += float(r["price"]) * int(r["quantity"])
            total = round(total, 2)

            created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
            cur = conn.execute(
                "INSERT INTO orders (user_id, total_amount, status, created_at) VALUES (?, ?, ?, ?)",
                (user_id, total, "Placed", created_at),
            )
            order_id = cur.lastrowid

            for r in cart_rows:
                conn.execute(
                    """
                    INSERT INTO order_items (order_id, product_id, size, quantity, price)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        order_id,
                        int(r["product_id"]),
                        r["size"],
                        int(r["quantity"]),
                        float(r["price"]),
                    ),
                )

                conn.execute(
                    "UPDATE products SET stock = stock - ? WHERE id = ?",
                    (int(r["quantity"]), int(r["product_id"])),
                )

            conn.execute(
                """
                INSERT INTO transactions (order_id, payment_mode, amount, status)
                VALUES (?, ?, ?, ?)
                """,
                (order_id, payment_mode, total, "Success"),
            )

            conn.execute("DELETE FROM cart WHERE user_id = ?", (user_id,))
            conn.commit()

            return jsonify(
                {
                    "message": "Order placed",
                    "order_id": order_id,
                    "total_amount": total,
                    "payment_mode": payment_mode,
                }
            )
        finally:
            conn.close()

    @app.get("/api/orders")
    @login_required
    def api_orders():
        user_id = session["user_id"]
        conn = get_db()
        try:
            orders = conn.execute(
                """
                SELECT id, total_amount, status, created_at
                FROM orders
                WHERE user_id = ?
                ORDER BY id DESC
                """,
                (user_id,),
            ).fetchall()

            result = []
            for o in orders:
                items = conn.execute(
                    """
                    SELECT
                        order_items.product_id,
                        order_items.size,
                        order_items.quantity,
                        order_items.price,
                        products.name
                    FROM order_items
                    JOIN products ON products.id = order_items.product_id
                    WHERE order_items.order_id = ?
                    """,
                    (o["id"],),
                ).fetchall()
                tx = conn.execute(
                    """
                    SELECT payment_mode, amount, status
                    FROM transactions
                    WHERE order_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (o["id"],),
                ).fetchone()

                result.append(
                    {
                        "id": o["id"],
                        "total_amount": float(o["total_amount"]),
                        "status": o["status"],
                        "created_at": o["created_at"],
                        "items": [dict(i) for i in items],
                        "transaction": dict(tx) if tx else None,
                    }
                )

            return jsonify({"orders": result})
        finally:
            conn.close()

    @app.get("/api/transactions")
    @login_required
    def api_transactions():
        user_id = session["user_id"]
        conn = get_db()
        try:
            rows = conn.execute(
                """
                SELECT
                    transactions.id,
                    transactions.order_id,
                    transactions.payment_mode,
                    transactions.amount,
                    transactions.status,
                    orders.created_at
                FROM transactions
                JOIN orders ON orders.id = transactions.order_id
                WHERE orders.user_id = ?
                ORDER BY transactions.id DESC
                """,
                (user_id,),
            ).fetchall()
            items = []
            for r in rows:
                d = dict(r)
                d["amount"] = float(d["amount"])
                items.append(d)
            return jsonify({"transactions": items})
        finally:
            conn.close()

    # -------------------------
    # Profile + Addresses API
    # -------------------------
    @app.post("/api/profile/name")
    @login_required
    def api_profile_update_name():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400
        if len(name) < 2:
            return jsonify({"error": "Name must be at least 2 characters"}), 400

        conn = get_db()
        try:
            conn.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
            conn.commit()
            session["name"] = name
            return jsonify({"message": "Name updated"})
        finally:
            conn.close()

    @app.post("/api/profile/password")
    @login_required
    def api_profile_change_password():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}
        current_password = data.get("current_password") or ""
        new_password = data.get("new_password") or ""
        confirm_password = data.get("confirm_password") or ""

        if not current_password or not new_password or not confirm_password:
            return jsonify({"error": "All password fields are required"}), 400
        if new_password != confirm_password:
            return jsonify({"error": "New password and confirm password do not match"}), 400
        if len(new_password) < 4:
            return jsonify({"error": "New password must be at least 4 characters"}), 400

        conn = get_db()
        try:
            row = conn.execute(
                "SELECT password_hash FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if not row:
                return jsonify({"error": "User not found"}), 404

            if not verify_password(row["password_hash"], current_password):
                return jsonify({"error": "Current password is incorrect"}), 400

            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(new_password), user_id),
            )
            conn.commit()
            return jsonify({"message": "Password updated"})
        finally:
            conn.close()

    def _only_digits(text: str) -> str:
        return "".join([c for c in (text or "") if c.isdigit()])

    @app.get("/api/addresses")
    @login_required
    def api_addresses_list():
        user_id = session["user_id"]
        conn = get_db()
        try:
            rows = conn.execute(
                """
                SELECT id, full_name, phone, street, city, state, pincode, is_default, created_at
                FROM addresses
                WHERE user_id = ?
                ORDER BY is_default DESC, id DESC
                """,
                (user_id,),
            ).fetchall()
            items = []
            for r in rows:
                d = dict(r)
                d["is_default"] = bool(d["is_default"])
                items.append(d)
            return jsonify({"addresses": items})
        finally:
            conn.close()

    @app.post("/api/addresses")
    @login_required
    def api_addresses_create():
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}

        full_name = (data.get("full_name") or "").strip()
        phone = _only_digits(data.get("phone") or "")
        street = (data.get("street") or "").strip()
        city = (data.get("city") or "").strip()
        state = (data.get("state") or "").strip()
        pincode = _only_digits(data.get("pincode") or "")
        is_default = bool(data.get("is_default"))

        if not full_name or not phone or not street or not city or not state or not pincode:
            return jsonify({"error": "All address fields are required"}), 400
        if len(phone) != 10:
            return jsonify({"error": "Phone must be 10 digits"}), 400
        if len(pincode) != 6:
            return jsonify({"error": "Pincode must be 6 digits"}), 400

        created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        conn = get_db()
        try:
            existing_count = conn.execute(
                "SELECT COUNT(*) AS c FROM addresses WHERE user_id = ?",
                (user_id,),
            ).fetchone()["c"]

            if int(existing_count) == 0:
                is_default = True

            if is_default:
                conn.execute(
                    "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
                    (user_id,),
                )

            cur = conn.execute(
                """
                INSERT INTO addresses (user_id, full_name, phone, street, city, state, pincode, is_default, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, full_name, phone, street, city, state, pincode, 1 if is_default else 0, created_at),
            )
            conn.commit()
            return jsonify({"message": "Address saved", "address_id": cur.lastrowid})
        finally:
            conn.close()

    @app.put("/api/addresses/<int:address_id>")
    @login_required
    def api_addresses_update(address_id):
        user_id = session["user_id"]
        data = request.get_json(silent=True) or {}

        full_name = (data.get("full_name") or "").strip()
        phone = _only_digits(data.get("phone") or "")
        street = (data.get("street") or "").strip()
        city = (data.get("city") or "").strip()
        state = (data.get("state") or "").strip()
        pincode = _only_digits(data.get("pincode") or "")
        is_default = bool(data.get("is_default"))

        if not full_name or not phone or not street or not city or not state or not pincode:
            return jsonify({"error": "All address fields are required"}), 400
        if len(phone) != 10:
            return jsonify({"error": "Phone must be 10 digits"}), 400
        if len(pincode) != 6:
            return jsonify({"error": "Pincode must be 6 digits"}), 400

        conn = get_db()
        try:
            row = conn.execute(
                "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
                (address_id, user_id),
            ).fetchone()
            if not row:
                return jsonify({"error": "Address not found"}), 404

            if is_default:
                conn.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", (user_id,))

            conn.execute(
                """
                UPDATE addresses
                SET full_name = ?, phone = ?, street = ?, city = ?, state = ?, pincode = ?, is_default = ?
                WHERE id = ? AND user_id = ?
                """,
                (full_name, phone, street, city, state, pincode, 1 if is_default else 0, address_id, user_id),
            )
            conn.commit()
            return jsonify({"message": "Address updated"})
        finally:
            conn.close()

    @app.delete("/api/addresses/<int:address_id>")
    @login_required
    def api_addresses_delete(address_id):
        user_id = session["user_id"]
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?",
                (address_id, user_id),
            ).fetchone()
            if not row:
                return jsonify({"error": "Address not found"}), 404

            was_default = bool(row["is_default"])
            conn.execute("DELETE FROM addresses WHERE id = ? AND user_id = ?", (address_id, user_id))

            if was_default:
                next_row = conn.execute(
                    "SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                    (user_id,),
                ).fetchone()
                if next_row:
                    conn.execute(
                        "UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
                        (next_row["id"], user_id),
                    )

            conn.commit()
            return jsonify({"message": "Address deleted"})
        finally:
            conn.close()

    # -------------------------
    # Admin API
    # -------------------------
    @app.get("/api/admin/stats")
    @admin_required
    def api_admin_stats():
        conn = get_db()
        try:
            total_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
            total_orders = conn.execute("SELECT COUNT(*) AS c FROM orders").fetchone()["c"]
            revenue = conn.execute(
                "SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE status = 'Success'"
            ).fetchone()["s"]
            return jsonify(
                {
                    "total_users": int(total_users),
                    "total_orders": int(total_orders),
                    "revenue": round(float(revenue), 2),
                }
            )
        finally:
            conn.close()

    @app.get("/api/admin/users")
    @admin_required
    def api_admin_users():
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT id, name, email, role FROM users ORDER BY id DESC"
            ).fetchall()
            return jsonify({"users": [dict(r) for r in rows]})
        finally:
            conn.close()

    @app.get("/api/admin/orders")
    @admin_required
    def api_admin_orders():
        conn = get_db()
        try:
            rows = conn.execute(
                """
                SELECT
                    orders.id,
                    orders.total_amount,
                    orders.status,
                    orders.created_at,
                    users.name AS user_name,
                    users.email AS user_email
                FROM orders
                JOIN users ON users.id = orders.user_id
                ORDER BY orders.id DESC
                """
            ).fetchall()
            return jsonify({"orders": [dict(r) for r in rows]})
        finally:
            conn.close()

    @app.post("/api/admin/products")
    @admin_required
    def api_admin_add_product():
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        category = (data.get("category") or "").strip()
        price = float(data.get("price") or 0)
        stock = int(data.get("stock") or 0)
        description = (data.get("description") or "").strip()
        details = (data.get("details") or "").strip()
        discount = int(data.get("discount") or 0)
        discount = max(0, min(90, discount))
        image_urls = data.get("image_urls") or []
        image_urls = [str(u).strip() for u in image_urls if str(u).strip()]

        if not name or not category or price <= 0 or stock < 0 or not description:
            return jsonify({"error": "Name, category, price, stock and description are required"}), 400

        if not image_urls:
            image_urls = ["/static/images/placeholder.svg"]

        conn = get_db()
        try:
            cur = conn.execute(
            """
            INSERT INTO products
            (name, category, price, stock, description, details, discount)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (name, category, price, stock, description, details, discount),
            )

            product_id = cur.lastrowid
            for img in image_urls:
                conn.execute(
                    "INSERT INTO product_images (product_id, image_url) VALUES (?, ?)",
                    (product_id, img),
                )
            conn.commit()
            return jsonify({"message": "Product added", "product_id": product_id})
        finally:
            conn.close()

    @app.put("/api/admin/products/<int:product_id>")
    @admin_required
    def api_admin_update_product(product_id):
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        category = (data.get("category") or "").strip()
        price = float(data.get("price") or 0)
        stock = int(data.get("stock") or 0)
        description = (data.get("description") or "").strip()
        details = (data.get("details") or "").strip()
        discount = int(data.get("discount") or 0)
        discount = max(0, min(90, discount))

        image_urls = data.get("image_urls") or []
        image_urls = [str(u).strip() for u in image_urls if str(u).strip()]

        if not name or not category or price <= 0 or stock < 0 or not description:
            return jsonify({"error": "Name, category, price, stock and description are required"}), 400

        conn = get_db()
        try:
            existing = conn.execute(
                "SELECT id FROM products WHERE id = ?",
                (product_id,),
            ).fetchone()
            if not existing:
                return jsonify({"error": "Product not found"}), 404

            conn.execute(
                """
                UPDATE products
                SET name = ?, category = ?, price = ?, stock = ?, description = ?, details = ?, discount = ?
                WHERE id = ?
                """,
                (name, category, price, stock, description, details, discount, product_id),
            )


            if image_urls:
                conn.execute("DELETE FROM product_images WHERE product_id = ?", (product_id,))
                for img in image_urls:
                    conn.execute(
                        "INSERT INTO product_images (product_id, image_url) VALUES (?, ?)",
                        (product_id, img),
                    )

            conn.commit()
            return jsonify({"message": "Product updated"})
        finally:
            conn.close()

    @app.delete("/api/admin/products/<int:product_id>")
    @admin_required
    def api_admin_delete_product(product_id):
        conn = get_db()
        try:
            used = conn.execute(
                "SELECT id FROM order_items WHERE product_id = ? LIMIT 1",
                (product_id,),
            ).fetchone()
            if used:
                return (
                    jsonify(
                        {
                            "error": "This product exists in past orders. Set stock to 0 instead of deleting."
                        }
                    ),
                    400,
                )

            conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
            conn.commit()
            return jsonify({"message": "Product deleted"})
        finally:
            conn.close()

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)

