
from flask import Blueprint, request, jsonify, session
from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)
from config.db import get_db_connection

auth_bp = Blueprint("auth", __name__)


# -------------------------------
# REGISTER VOLUNTEER
# -------------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name or not email or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    password_hash = generate_password_hash(password)

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM users WHERE email = %s",
                (email,)
            )

            if cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "An account with this email already exists."
                }), 409

            cursor.execute(
                """
                INSERT INTO users
                (full_name, email, password_hash, role, is_active)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (full_name, email, password_hash, "volunteer", 1)
            )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Volunteer account created successfully."
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Registration failed. Please try again."
        }), 500

    finally:
        if connection:
            connection.close()


# -------------------------------
# LOGIN
# -------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, full_name, email,
                       password_hash, role, is_active
                FROM users
                WHERE email = %s
                """,
                (email,)
            )

            user = cursor.fetchone()

        if not user:
            return jsonify({
                "success": False,
                "message": "Invalid email or password."
            }), 401

        if not user["is_active"]:
            return jsonify({
                "success": False,
                "message": "Your account is inactive."
            }), 403

        if not check_password_hash(
            user["password_hash"], password
        ):
            return jsonify({
                "success": False,
                "message": "Invalid email or password."
            }), 401

        session.clear()
        session.permanent = True

        session["user_id"] = user["user_id"]
        session["full_name"] = user["full_name"]
        session["email"] = user["email"]
        session["role"] = user["role"]

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "user": {
                "user_id": user["user_id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user["role"]
            }
        }), 200

    except Exception:
        return jsonify({
            "success": False,
            "message": "Login failed due to a server error."
        }), 500

    finally:
        if connection:
            connection.close()


# -------------------------------
# CHECK SESSION
# -------------------------------
@auth_bp.route("/session", methods=["GET"])
def check_session():
    if "user_id" not in session:
        return jsonify({
            "success": False,
            "logged_in": False,
            "message": "Not logged in."
        }), 401

    return jsonify({
        "success": True,
        "logged_in": True,
        "user": {
            "user_id": session["user_id"],
            "full_name": session["full_name"],
            "email": session["email"],
            "role": session["role"]
        }
    }), 200


# -------------------------------
# LOGOUT
# -------------------------------
@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    }), 200
