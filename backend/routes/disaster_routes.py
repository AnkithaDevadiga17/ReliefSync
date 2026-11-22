from datetime import date
import logging
import math

import pymysql
from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


disaster_bp = Blueprint("disasters", __name__)

ALLOWED_ROLES = {"admin", "coordinator", "ngo", "volunteer"}
MANAGER_ROLES = {"admin", "coordinator"}

SEVERITIES = {"low", "medium", "high", "critical"}

STATUSES = {
    "reported",
    "active",
    "monitoring",
    "resolved",
    "closed"
}


# --------------------------------------------------
# AUTHORIZATION
# --------------------------------------------------

def check_access(allowed_roles):

    if "user_id" not in session:
        return jsonify({
            "success": False,
            "message": "Please log in first."
        }), 401

    role = str(session.get("role", "")).strip().lower()

    if role not in allowed_roles:
        return jsonify({
            "success": False,
            "message": "You do not have permission to perform this action."
        }), 403

    return None


# --------------------------------------------------
# VALIDATE DISASTER DATA
# --------------------------------------------------

def validate_disaster_data(data, partial=False):

    if not isinstance(data, dict):
        return None, "Please provide valid disaster details."

    result = {}

    # Location
    if not partial or "location_id" in data:

        try:
            location_id = int(data.get("location_id"))

            if location_id <= 0:
                raise ValueError

            result["location_id"] = location_id

        except (ValueError, TypeError):
            return None, "Please select a valid location."

    # Disaster type
    if not partial or "disaster_type" in data:

        disaster_type = str(
            data.get("disaster_type") or ""
        ).strip()

        if not disaster_type:
            return None, "Disaster type is required."

        if len(disaster_type) > 60:
            return None, "Disaster type must not exceed 60 characters."

        result["disaster_type"] = disaster_type

    # Severity
    if not partial or "severity" in data:

        severity = str(
            data.get("severity") or ""
        ).strip().lower()

        if severity not in SEVERITIES:
            return None, "Please select a valid severity."

        result["severity"] = severity

    # Status
    if not partial or "status" in data:

        status = str(
            data.get("status") or (
                "reported" if not partial else ""
            )
        ).strip().lower()

        if status not in STATUSES:
            return None, "Please select a valid disaster status."

        result["status"] = status

    # Incident date
    if not partial or "incident_date" in data:

        incident_date = data.get("incident_date")

        if incident_date in (None, ""):
            result["incident_date"] = None

        else:
            try:
                result["incident_date"] = date.fromisoformat(
                    str(incident_date)
                )

            except (ValueError, TypeError):
                return None, "Invalid incident date. Use YYYY-MM-DD."

    # Description
    if not partial or "description" in data:

        description = data.get("description")

        if description is not None and not isinstance(description, str):
            return None, "Description must be valid text."

        description = (description or "").strip()

        result["description"] = description or None

    # Coordinates
    coordinate_fields = {"latitude", "longitude"}

    if not partial or coordinate_fields.intersection(data.keys()):

        latitude = data.get("latitude")
        longitude = data.get("longitude")

        if (latitude in (None, "")) != (longitude in (None, "")):
            return None, "Enter both latitude and longitude, or leave both empty."

        try:

            if latitude in (None, ""):
                latitude = None
                longitude = None

            else:
                latitude = float(latitude)
                longitude = float(longitude)

                if not math.isfinite(latitude) or not -90 <= latitude <= 90:
                    return None, "Latitude must be between -90 and 90."

                if not math.isfinite(longitude) or not -180 <= longitude <= 180:
                    return None, "Longitude must be between -180 and 180."

        except (ValueError, TypeError):
            return None, "Please enter valid coordinates."

        result["latitude"] = latitude
        result["longitude"] = longitude

    return result, None


# --------------------------------------------------
# GET ALL DISASTERS
# All authenticated roles can view
# --------------------------------------------------

@disaster_bp.route("/disasters", methods=["GET"])
def get_disasters():

    access_error = check_access(ALLOWED_ROLES)

    if access_error:
        return access_error

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    d.disaster_id,
                    d.location_id,
                    l.location_name,
                    l.district,
                    l.state,
                    l.country,
                    d.disaster_type,
                    d.severity,
                    d.status,
                    d.description,
                    d.incident_date,
                    d.latitude,
                    d.longitude,
                    d.reported_by,
                    u.full_name AS reporter_name,
                    d.reported_at,
                    d.resolved_at

                FROM disasters d

                LEFT JOIN locations l
                    ON d.location_id = l.location_id

                LEFT JOIN users u
                    ON d.reported_by = u.user_id

                ORDER BY d.reported_at DESC
            """)

            disasters = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(disasters),
            "data": disasters
        }), 200

    except Exception:

        logging.exception("Could not retrieve disasters")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve disaster reports."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# CREATE DISASTER
# Admin and Coordinator
# --------------------------------------------------

@disaster_bp.route("/disasters", methods=["POST"])
def create_disaster():

    access_error = check_access(MANAGER_ROLES)

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    disaster, error = validate_disaster_data(data)

    if error:
        return jsonify({
            "success": False,
            "message": error
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            # Verify that the selected location exists.
            cursor.execute("""
                SELECT location_id
                FROM locations
                WHERE location_id = %s
            """, (disaster["location_id"],))

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 404

            cursor.execute("""
                INSERT INTO disasters (
                    location_id,
                    reported_by,
                    disaster_type,
                    severity,
                    status,
                    description,
                    incident_date,
                    latitude,
                    longitude
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                disaster["location_id"],
                session.get("user_id"),
                disaster["disaster_type"],
                disaster["severity"],
                disaster["status"],
                disaster["description"],
                disaster["incident_date"],
                disaster["latitude"],
                disaster["longitude"]
            ))

            disaster_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Disaster report created successfully.",
            "disaster_id": disaster_id
        }), 201

    except pymysql.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid location or related database record."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not create disaster")

        return jsonify({
            "success": False,
            "message": "Unable to create disaster report."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# UPDATE DISASTER
# Admin and Coordinator
# --------------------------------------------------

@disaster_bp.route(
    "/disasters/<int:disaster_id>",
    methods=["PUT"]
)
def update_disaster(disaster_id):

    access_error = check_access(MANAGER_ROLES)

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return jsonify({
            "success": False,
            "message": "Please provide fields to update."
        }), 400

    disaster, error = validate_disaster_data(
        data,
        partial=True
    )

    if error:
        return jsonify({
            "success": False,
            "message": error
        }), 400

    allowed_fields = {
        "location_id",
        "disaster_type",
        "severity",
        "status",
        "description",
        "incident_date",
        "latitude",
        "longitude"
    }

    update_fields = {
        key: value
        for key, value in disaster.items()
        if key in allowed_fields
    }

    if not update_fields:
        return jsonify({
            "success": False,
            "message": "No valid fields provided for update."
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT disaster_id
                FROM disasters
                WHERE disaster_id = %s
                FOR UPDATE
            """, (disaster_id,))

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404

            # Verify a new location if one was selected.
            if "location_id" in update_fields:

                cursor.execute("""
                    SELECT location_id
                    FROM locations
                    WHERE location_id = %s
                """, (update_fields["location_id"],))

                if not cursor.fetchone():
                    return jsonify({
                        "success": False,
                        "message": "Selected location does not exist."
                    }), 404

            assignments = [
                f"{field} = %s"
                for field in update_fields
            ]

            values = list(update_fields.values())

            if "status" in update_fields:

                if update_fields["status"] in {"resolved", "closed"}:
                    assignments.append("resolved_at = CURRENT_TIMESTAMP")

                else:
                    assignments.append("resolved_at = NULL")

            query = f"""
                UPDATE disasters
                SET {", ".join(assignments)}
                WHERE disaster_id = %s
            """

            values.append(disaster_id)

            cursor.execute(query, tuple(values))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Disaster report updated successfully."
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not update disaster")

        return jsonify({
            "success": False,
            "message": "Unable to update disaster report."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# DELETE DISASTER
# Admin and Coordinator
# --------------------------------------------------

@disaster_bp.route(
    "/disasters/<int:disaster_id>",
    methods=["DELETE"]
)
def delete_disaster(disaster_id):

    access_error = check_access(MANAGER_ROLES)

    if access_error:
        return access_error

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT disaster_id
                FROM disasters
                WHERE disaster_id = %s
                FOR UPDATE
            """, (disaster_id,))

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404

            # Do not delete disasters connected to transactions.
            linked_tables = [
                "resource_allocations",
                "volunteer_assignments",
                "donation_distributions",
                "risk_predictions"
            ]

            linked_modules = []

            for table in linked_tables:

                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM {table}
                    WHERE disaster_id = %s
                    """,
                    (disaster_id,)
                )

                if cursor.fetchone()["total"] > 0:
                    linked_modules.append(table)

            if linked_modules:
                return jsonify({
                    "success": False,
                    "message": (
                        "This disaster is linked to other records "
                        "and cannot be deleted."
                    ),
                    "linked_modules": linked_modules
                }), 409

            cursor.execute("""
                DELETE FROM disasters
                WHERE disaster_id = %s
            """, (disaster_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Disaster report deleted successfully."
        }), 200

    except pymysql.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Cannot delete this disaster because related records exist."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not delete disaster")

        return jsonify({
            "success": False,
            "message": "Unable to delete disaster report."
        }), 500

    finally:

        if connection:
            connection.close()