
from flask import Blueprint, request, jsonify, session
import os
import smtplib
from email.message import EmailMessage
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
    phone = (data.get("phone") or "").strip()
    skills = (data.get("skills") or "").strip()
    location_id = data.get("location_id") or None

    if not full_name or not email or not password or not phone:
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    if len(phone) < 7 or len(phone) > 20:
        return jsonify({"success": False, "message": "Enter a valid phone number."}), 400

    if location_id not in (None, ""):
        try:
            location_id = int(location_id)
            if location_id <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Select a valid location."}), 400
    else:
        location_id = None

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

            user_id = cursor.lastrowid
            cursor.execute(
                """
                INSERT INTO volunteers
                    (user_id, location_id, full_name, email, phone, skills, availability)
                VALUES (%s, %s, %s, %s, %s, %s, 'available')
                """,
                (user_id, location_id, full_name, email, phone, skills or None)
            )

        connection.commit()

        email_sent = False
        smtp_host = os.getenv("SMTP_HOST")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        if smtp_host and smtp_user and smtp_password:
            try:
                message = EmailMessage()
                message["Subject"] = "Welcome to ReliefSync volunteer network"
                message["From"] = os.getenv("SMTP_FROM", smtp_user)
                message["To"] = email
                message.set_content(
                    f"Hello {full_name},\n\nYour ReliefSync volunteer account has been created. "
                    "You can now sign in using your registered email and password.\n\nReliefSync Team"
                )
                with smtplib.SMTP(smtp_host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(message)
                email_sent = True
            except Exception:
                email_sent = False

        return jsonify({
            "success": True,
            "message": "Volunteer account and volunteer profile created successfully.",
            "email_sent": email_sent
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


# -------------------------------
# CHANGE PASSWORD (authenticated user)
# -------------------------------
@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    if not session.get("user_id"):
        return jsonify({"success": False, "message": "Please sign in first."}), 401
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    if len(new_password) < 8:
        return jsonify({"success": False, "message": "New password must contain at least 8 characters."}), 400
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT password_hash FROM users WHERE user_id=%s", (session["user_id"],))
            row = cursor.fetchone()
            if not row or not check_password_hash(row["password_hash"], current_password):
                return jsonify({"success": False, "message": "Current password is incorrect."}), 400
            cursor.execute(
                "UPDATE users SET password_hash=%s WHERE user_id=%s",
                (generate_password_hash(new_password), session["user_id"])
            )
        connection.commit()
        return jsonify({"success": True, "message": "Password changed successfully."}), 200
    except Exception:
        if connection:
            connection.rollback()
        return jsonify({"success": False, "message": "Could not change password."}), 500
    finally:
        if connection:
            connection.close()
