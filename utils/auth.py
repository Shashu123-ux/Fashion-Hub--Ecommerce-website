from functools import wraps

from flask import jsonify, redirect, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(plain_password: str) -> str:
    return generate_password_hash(plain_password)


def verify_password(password_hash: str, plain_password: str) -> bool:
    return check_password_hash(password_hash, plain_password)


def _is_api_request() -> bool:
    return request.path.startswith("/api/")


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            if _is_api_request():
                return jsonify({"error": "Login required"}), 401
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)

    return wrapped


def admin_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            if _is_api_request():
                return jsonify({"error": "Login required"}), 401
            return redirect(url_for("login"))

        if session.get("role") != "admin":
            if _is_api_request():
                return jsonify({"error": "Admin access required"}), 403
            return redirect(url_for("index"))

        return view_func(*args, **kwargs)

    return wrapped

