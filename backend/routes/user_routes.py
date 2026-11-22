
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash
from config.db import get_db_connection

user_bp = Blueprint("users", __name__)


# -----------------------------------
# ADMIN AUTHORIZATION
# -----------------------------------
def is_admin():
    return (
        "user_id" in session
        and session.get("role") == "admin"
    )


# -----------------------------------
# GET ALL USERS
# Admin only
# -----------------------------------
@user_bp.route("/users", methods=["GET"])
def get_users():

    if not is_admin():
        return jsonify({
            "success": False,
            "message": "Admin access required."
        }), 403

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    user_id,
                    full_name,
                    email,
                    role,
                    is_active,
                    created_at
                FROM users
                ORDER BY created_at DESC
            """)

            users = cursor.fetchall()

        return jsonify({
            "success": True,
            "users": users
        }), 200

    except Exception:
        return jsonify({
            "success": False,
            "message": "Unable to retrieve users."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# CREATE COORDINATOR OR NGO
# Admin only
# -----------------------------------
@user_bp.route("/users", methods=["POST"])
def create_user():

    if not is_admin():
        return jsonify({
            "success": False,
            "message": "Admin access required."
        }), 403

    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()

    if not full_name or not email or not password or not role:
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if role not in ["coordinator", "ngo"]:
        return jsonify({
            "success": False,
            "message": "Only Coordinator and NGO accounts can be created here."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    if len(full_name) > 100 or len(email) > 150:
        return jsonify({
            "success": False,
            "message": "Name or email exceeds the allowed length."
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

            cursor.execute("""
                INSERT INTO users
                (full_name, email, password_hash, role, is_active)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                full_name,
                email,
                password_hash,
                role,
                1
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": f"{role.capitalize()} account created successfully."
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to create user."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# ACTIVATE / DEACTIVATE USER
# Admin only
# -----------------------------------
@user_bp.route("/users/<int:user_id>/status", methods=["PATCH"])
def update_user_status(user_id):

    if not is_admin():
        return jsonify({
            "success": False,
            "message": "Admin access required."
        }), 403

    data = request.get_json(silent=True) or {}

    if "is_active" not in data or not isinstance(data["is_active"], bool):
        return jsonify({
            "success": False,
            "message": "A valid is_active value is required."
        }), 400

    new_status = data["is_active"]

    # Prevent an admin from deactivating their own account.
    if user_id == session.get("user_id") and not new_status:
        return jsonify({
            "success": False,
            "message": "You cannot deactivate your own account."
        }), 400

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM users WHERE user_id = %s",
                (user_id,)
            )

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "User not found."
                }), 404

            cursor.execute("""
                UPDATE users
                SET is_active = %s
                WHERE user_id = %s
            """, (1 if new_status else 0, user_id))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "User status updated successfully."
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update user status."
        }), 500

    finally:
        if connection:
            connection.close()

