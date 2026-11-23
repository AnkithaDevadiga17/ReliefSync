from decimal import Decimal, InvalidOperation
import re
import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request, session, send_from_directory
from werkzeug.utils import secure_filename
from config.db import get_db_connection

public_bp = Blueprint("public", __name__)
MANAGERS = {"admin", "coordinator"}
ALLOWED_PROOF_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "donation_proofs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ACTIVE_STATUSES = ("reported", "active", "monitoring")


def manager_required():
    if not session.get("user_id"):
        return jsonify({"success": False, "message": "Please sign in."}), 401
    if str(session.get("role", "")).lower() not in MANAGERS:
        return jsonify({"success": False, "message": "Access denied."}), 403
    return None


@public_bp.get("/public/disasters")
def public_disasters():
    """Return current, non-resolved disaster records, newest incident first."""
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    d.disaster_id, d.disaster_type, d.severity, d.status,
                    d.description, d.incident_date, d.latitude, d.longitude,
                    d.reported_at, l.location_id, l.location_name,
                    l.district, l.state, l.country,
                    l.latitude AS location_latitude,
                    l.longitude AS location_longitude
                FROM disasters d
                INNER JOIN locations l ON l.location_id = d.location_id
                WHERE LOWER(d.status) IN ('reported', 'active', 'monitoring')
                ORDER BY COALESCE(d.incident_date, DATE(d.reported_at)) DESC,
                         d.reported_at DESC, d.disaster_id DESC
            """)
            rows = cursor.fetchall()
        return jsonify({"success": True, "count": len(rows), "data": rows}), 200
    except Exception:
        return jsonify({"success": False, "message": "Could not load public disaster information."}), 500
    finally:
        if connection:
            connection.close()


@public_bp.get("/public/locations")
def public_locations():
    """Only locations linked to a currently reported/active/monitored disaster."""
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT
                    l.location_id, l.location_name, l.district, l.state, l.country,
                    l.latitude, l.longitude
                FROM locations l
                INNER JOIN disasters d ON d.location_id = l.location_id
                WHERE LOWER(d.status) IN ('reported', 'active', 'monitoring')
                ORDER BY l.state, l.district, l.location_name
            """)
            rows = cursor.fetchall()
        return jsonify({"success": True, "count": len(rows), "data": rows}), 200
    except Exception:
        return jsonify({"success": False, "message": "Could not load affected locations."}), 500
    finally:
        if connection:
            connection.close()


@public_bp.get("/public/donors/lookup")
def donor_lookup():
    email = (request.args.get("email") or "").strip().lower()
    phone = re.sub(r"\s+", "", request.args.get("phone") or "")
    if not email and not phone:
        return jsonify({"success": False, "message": "Enter an email or phone number."}), 400
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            if email and phone:
                cursor.execute("""SELECT donor_id, full_name, email, phone FROM donors
                    WHERE email=%s OR phone=%s ORDER BY (email=%s) DESC LIMIT 1""", (email, phone, email))
            elif email:
                cursor.execute("SELECT donor_id, full_name, email, phone FROM donors WHERE email=%s LIMIT 1", (email,))
            else:
                cursor.execute("SELECT donor_id, full_name, email, phone FROM donors WHERE phone=%s LIMIT 1", (phone,))
            donor = cursor.fetchone()
        return jsonify({"success": True, "found": bool(donor), "donor": donor}), 200
    except Exception:
        return jsonify({"success": False, "message": "Donor lookup failed. Please try again."}), 500
    finally:
        if connection:
            connection.close()


@public_bp.post("/public/donations")
def public_donation():
    data = request.get_json(silent=True) or {}
    name = str(data.get("donor_name") or "").strip()
    email = str(data.get("donor_email") or "").strip().lower()
    phone = re.sub(r"\s+", "", str(data.get("donor_contact") or ""))
    location_id = data.get("location_id")
    reference = str(data.get("transaction_reference") or "").strip()
    upi_method = str(data.get("payment_method") or "upi").strip().lower()
    try:
        amount = Decimal(str(data.get("amount")))
        location_id = int(location_id)
        if not amount.is_finite() or amount <= 0 or amount > Decimal("10000000"):
            raise ValueError
    except (ValueError, TypeError, InvalidOperation):
        return jsonify({"success": False, "message": "Enter a valid amount and affected location."}), 400
    if not name or len(name) > 120 or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) or len(email) > 150:
        return jsonify({"success": False, "message": "Enter a valid name and email address."}), 400
    if not phone or len(phone) < 7 or len(phone) > 30:
        return jsonify({"success": False, "message": "Enter a valid contact number."}), 400
    if not reference or len(reference) > 120:
        return jsonify({"success": False, "message": "Enter the UPI transaction/reference ID."}), 400
    if upi_method != "upi":
        return jsonify({"success": False, "message": "Only UPI QR submissions are enabled in this version."}), 400

    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""SELECT location_id FROM locations WHERE location_id=%s
                AND EXISTS (SELECT 1 FROM disasters d WHERE d.location_id=locations.location_id
                AND LOWER(d.status) IN ('reported','active','monitoring'))""", (location_id,))
            if not cursor.fetchone():
                return jsonify({"success": False, "message": "Choose a location with a current active disaster."}), 400
            cursor.execute("""INSERT INTO donors (full_name,email,phone) VALUES (%s,%s,%s)
                ON DUPLICATE KEY UPDATE donor_id=LAST_INSERT_ID(donor_id),
                full_name=VALUES(full_name), phone=VALUES(phone)""", (name, email, phone))
            donor_id = cursor.lastrowid
            cursor.execute("""INSERT INTO donations (
                donor_id, location_id, donor_name, donor_contact, donor_email,
                donation_type, amount, donation_status, payment_method,
                transaction_reference, donation_source, notes
            ) VALUES (%s,%s,%s,%s,%s,'cash',%s,'pending','upi',%s,'public',
                'Public UPI donation submitted; awaiting coordinator verification.')""",
                (donor_id, location_id, name, phone, email, amount, reference))
            donation_id = cursor.lastrowid
        connection.commit()
        return jsonify({"success": True, "message": "Donation submitted. It will remain pending until the coordinator verifies the payment.", "donation_id": donation_id, "donor_id": donor_id}), 201
    except Exception:
        if connection:
            connection.rollback()
        return jsonify({"success": False, "message": "Could not save donation. Please contact the ReliefSync team."}), 500
    finally:
        if connection:
            connection.close()


@public_bp.post("/public/donations/<int:donation_id>/proof")
def upload_donation_proof(donation_id):
    file = request.files.get("proof")
    if not file or not file.filename:
        return jsonify({"success": False, "message": "Choose a payment screenshot or PDF."}), 400
    original = secure_filename(file.filename)
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in ALLOWED_PROOF_EXTENSIONS:
        return jsonify({"success": False, "message": "Allowed formats: PNG, JPG, WEBP or PDF."}), 400
    connection = None
    saved_name = f"{uuid.uuid4().hex}.{ext}"
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT donation_id FROM donations WHERE donation_id=%s AND donation_source='public'", (donation_id,))
            if not cursor.fetchone():
                return jsonify({"success": False, "message": "Donation record not found."}), 404
            file.save(UPLOAD_DIR / saved_name)
            cursor.execute("UPDATE donations SET payment_proof=%s WHERE donation_id=%s", (saved_name, donation_id))
        connection.commit()
        return jsonify({"success": True, "message": "Payment proof uploaded."}), 200
    except Exception:
        if connection:
            connection.rollback()
        (UPLOAD_DIR / saved_name).unlink(missing_ok=True)
        return jsonify({"success": False, "message": "Could not upload payment proof."}), 500
    finally:
        if connection:
            connection.close()


@public_bp.get("/donations/<int:donation_id>/proof")
def get_donation_proof(donation_id):
    error = manager_required()
    if error:
        return error
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT payment_proof FROM donations WHERE donation_id=%s", (donation_id,))
            row = cursor.fetchone()
        if not row or not row.get("payment_proof"):
            return jsonify({"success": False, "message": "Proof not found."}), 404
        return send_from_directory(UPLOAD_DIR, row["payment_proof"], as_attachment=False)
    finally:
        if connection:
            connection.close()
