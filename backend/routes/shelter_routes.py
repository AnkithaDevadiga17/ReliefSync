
from flask import Blueprint, jsonify, request
import pymysql

from config.db import get_db_connection


shelter_bp = Blueprint("shelters", __name__)


# -----------------------------------
# GET - FETCH LOCATIONS FOR THE FORM
# -----------------------------------

@shelter_bp.route("/locations", methods=["GET"])
def get_locations():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT location_id, location_name, district, state
                FROM locations
                ORDER BY location_name
            """)

            locations = cursor.fetchall()

        return jsonify({
            "success": True,
            "data": locations
        })

    except Exception:
        import logging
        logging.exception("Could not fetch locations")

        return jsonify({
            "success": False,
            "message": "Unable to fetch locations."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# COMMON VALIDATION FUNCTION
# -----------------------------------

def validate_shelter(data, existing=None):

    values = {
        "location_id": None,
        "shelter_name": "",
        "address": None,
        "capacity": 1,
        "occupied_count": 0,
        "contact_person": None,
        "contact_phone": None,
        "status": "operational"
    }

    if existing:
        values.update(existing)

    values.update({
        key: value
        for key, value in data.items()
        if key in values
    })

    try:
        values["location_id"] = int(values["location_id"])
        values["capacity"] = int(values["capacity"])
        values["occupied_count"] = int(values["occupied_count"])

    except (ValueError, TypeError):
        return None, "Location, capacity and occupancy must be valid numbers."

    if values["location_id"] <= 0:
        return None, "Please select a valid location."

    values["shelter_name"] = str(values["shelter_name"]).strip()

    if not values["shelter_name"] or len(values["shelter_name"]) > 150:
        return None, "Shelter name is required and must be within 150 characters."

    if values["capacity"] <= 0:
        return None, "Capacity must be greater than zero."

    if values["occupied_count"] < 0:
        return None, "Occupied count cannot be negative."

    if values["occupied_count"] > values["capacity"]:
        return None, "Occupied count cannot exceed shelter capacity."

    values["status"] = str(values["status"]).lower()

    allowed_statuses = [
        "operational",
        "full",
        "temporarily_closed"
    ]

    if values["status"] not in allowed_statuses:
        return None, "Invalid shelter status."

    if values["status"] == "full" and values["occupied_count"] < values["capacity"]:
        return None, "A shelter can be marked full only when capacity is reached."

    for field, limit in [
        ("contact_person", 100),
        ("contact_phone", 20)
    ]:
        value = values[field]

        if value is not None:
            value = str(value).strip() or None

            if value and len(value) > limit:
                return None, f"{field.replace('_', ' ').title()} is too long."

            values[field] = value

    if values["address"] is not None:
        if not isinstance(values["address"], str):
            return None, "Address must be text."

        values["address"] = values["address"].strip() or None

    return values, None


def location_exists(cursor, location_id):

    cursor.execute(
        "SELECT location_id FROM locations WHERE location_id = %s",
        (location_id,)
    )

    return cursor.fetchone() is not None


# -----------------------------------
# GET - FETCH ALL SHELTERS
# -----------------------------------

@shelter_bp.route("/shelters", methods=["GET"])
def get_shelters():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    s.shelter_id,
                    s.location_id,
                    l.location_name,
                    s.shelter_name,
                    s.address,
                    s.capacity,
                    s.occupied_count,
                    (s.capacity - s.occupied_count) AS available,
                    s.contact_person,
                    s.contact_phone,
                    s.status
                FROM shelters AS s
                LEFT JOIN locations AS l
                    ON s.location_id = l.location_id
                ORDER BY s.created_at DESC
            """)

            shelters = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(shelters),
            "data": shelters
        })

    except Exception:
        import logging
        logging.exception("Could not fetch shelters")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve shelters."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - ADD A SHELTER
# -----------------------------------

@shelter_bp.route("/shelters", methods=["POST"])
def add_shelter():

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Please provide valid JSON data."
            }), 400

        required = ["location_id", "shelter_name", "capacity"]

        missing = [
            field for field in required
            if field not in data or data[field] is None
        ]

        if missing:
            return jsonify({
                "success": False,
                "message": "Missing required fields.",
                "missing_fields": missing
            }), 400

        values, error = validate_shelter(data)

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if not location_exists(cursor, values["location_id"]):
                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 400

            cursor.execute("""
                INSERT INTO shelters (
                    location_id,
                    shelter_name,
                    address,
                    capacity,
                    occupied_count,
                    contact_person,
                    contact_phone,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                values["location_id"],
                values["shelter_name"],
                values["address"],
                values["capacity"],
                values["occupied_count"],
                values["contact_person"],
                values["contact_phone"],
                values["status"]
            ))

            new_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Shelter added successfully!",
            "shelter_id": new_id
        }), 201

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid shelter data or location."
        }), 400

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not add shelter")

        return jsonify({
            "success": False,
            "message": "Unable to add shelter."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - UPDATE A SHELTER
# -----------------------------------

@shelter_bp.route(
    "/shelters/<int:shelter_id>",
    methods=["PUT"]
)
def update_shelter(shelter_id):

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict) or not data:
            return jsonify({
                "success": False,
                "message": "Please provide valid update data."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    location_id,
                    shelter_name,
                    address,
                    capacity,
                    occupied_count,
                    contact_person,
                    contact_phone,
                    status
                FROM shelters
                WHERE shelter_id = %s
            """, (shelter_id,))

            existing = cursor.fetchone()

            if not existing:
                return jsonify({
                    "success": False,
                    "message": "Shelter not found."
                }), 404

            values, error = validate_shelter(data, existing)

            if error:
                return jsonify({
                    "success": False,
                    "message": error
                }), 400

            if not location_exists(cursor, values["location_id"]):
                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 400

            cursor.execute("""
                UPDATE shelters
                SET
                    location_id = %s,
                    shelter_name = %s,
                    address = %s,
                    capacity = %s,
                    occupied_count = %s,
                    contact_person = %s,
                    contact_phone = %s,
                    status = %s
                WHERE shelter_id = %s
            """, (
                values["location_id"],
                values["shelter_name"],
                values["address"],
                values["capacity"],
                values["occupied_count"],
                values["contact_person"],
                values["contact_phone"],
                values["status"],
                shelter_id
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Shelter updated successfully!",
            "shelter_id": shelter_id
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update shelter")

        return jsonify({
            "success": False,
            "message": "Unable to update shelter."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# DELETE - REMOVE A SHELTER
# -----------------------------------

@shelter_bp.route(
    "/shelters/<int:shelter_id>",
    methods=["DELETE"]
)
def delete_shelter(shelter_id):

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT shelter_id FROM shelters WHERE shelter_id = %s",
                (shelter_id,)
            )

            existing = cursor.fetchone()

            if not existing:
                return jsonify({
                    "success": False,
                    "message": "Shelter not found."
                }), 404

            cursor.execute(
                "DELETE FROM shelters WHERE shelter_id = %s",
                (shelter_id,)
            )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Shelter deleted successfully!",
            "deleted_shelter_id": shelter_id
        })

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Cannot delete this shelter because related records exist."
        }), 409

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not delete shelter")

        return jsonify({
            "success": False,
            "message": "Unable to delete shelter."
        }), 500

    finally:
        if connection:
            connection.close()
