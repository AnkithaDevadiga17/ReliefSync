import logging

import pymysql
from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


shelter_bp = Blueprint("shelters", __name__)

ALLOWED_STATUSES = {
    "operational",
    "full",
    "temporarily_closed"
}


# --------------------------------------------------
# VALIDATE SHELTER DATA
# --------------------------------------------------

def validate_shelter(data, existing=None):

    if not isinstance(data, dict):
        return None, "Please provide valid shelter details."

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

    values["shelter_name"] = str(
        values["shelter_name"] or ""
    ).strip()

    if not values["shelter_name"]:
        return None, "Shelter name is required."

    if len(values["shelter_name"]) > 150:
        return None, "Shelter name cannot exceed 150 characters."

    if values["capacity"] <= 0:
        return None, "Capacity must be greater than zero."

    if values["occupied_count"] < 0:
        return None, "Occupied count cannot be negative."

    if values["occupied_count"] > values["capacity"]:
        return None, "Occupied count cannot exceed shelter capacity."

    values["status"] = str(
        values["status"] or ""
    ).strip().lower()

    if values["status"] not in ALLOWED_STATUSES:
        return None, "Invalid shelter status."

    # Keep status consistent with occupancy.
    # A temporarily closed shelter stays closed,
    # even when its occupancy reaches capacity.

    if (
        values["status"] == "operational"
        and values["occupied_count"] == values["capacity"]
    ):
        values["status"] = "full"

    elif (
        values["status"] == "full"
        and values["occupied_count"] < values["capacity"]
    ):
        if data.get("status") == "full":
            return None, "A shelter can be marked full only when capacity is reached."

        values["status"] = "operational"

    # Validate contact details.
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

    # Validate address.
    if values["address"] is not None:

        if not isinstance(values["address"], str):
            return None, "Address must be text."

        values["address"] = values["address"].strip() or None

    return values, None


# --------------------------------------------------
# CHECK WHETHER LOCATION EXISTS
# --------------------------------------------------

def location_exists(cursor, location_id):

    cursor.execute("""
        SELECT location_id
        FROM locations
        WHERE location_id = %s
    """, (location_id,))

    return cursor.fetchone() is not None


# --------------------------------------------------
# FIND LOGGED-IN VOLUNTEER'S LOCATION
# --------------------------------------------------

def get_volunteer_location(cursor, user_id):

    cursor.execute("""
        SELECT
            v.volunteer_id,
            v.location_id,
            l.location_name,
            l.district,
            l.state

        FROM volunteers AS v

        LEFT JOIN locations AS l
            ON v.location_id = l.location_id

        LEFT JOIN users AS u
            ON u.user_id = %s

        WHERE
            v.user_id = %s
            OR (
                v.user_id IS NULL
                AND u.email IS NOT NULL
                AND LOWER(v.email) = LOWER(u.email)
            )

        ORDER BY
            CASE
                WHEN v.user_id = %s THEN 0
                ELSE 1
            END

        LIMIT 1
    """, (user_id, user_id, user_id))

    return cursor.fetchone()


# --------------------------------------------------
# GET SHELTERS AND LOCATION-WISE SUMMARY
# --------------------------------------------------

@shelter_bp.route("/shelters", methods=["GET"])
def get_shelters():

    connection = None

    try:

        connection = get_db_connection()

        role = str(
            session.get("role", "")
        ).strip().lower()

        user_id = session.get("user_id")

        assigned_location = None
        assigned_location_id = None

        with connection.cursor() as cursor:

            # Volunteers should see only their registered area.
            if role == "volunteer":

                volunteer = get_volunteer_location(
                    cursor,
                    user_id
                )

                if volunteer and volunteer["location_id"] is not None:

                    assigned_location_id = volunteer["location_id"]

                    assigned_location = {
                        "location_id": volunteer["location_id"],
                        "location_name": volunteer["location_name"],
                        "district": volunteer["district"],
                        "state": volunteer["state"]
                    }

            # Fetch shelter records.
            if role == "volunteer" and assigned_location_id is None:

                shelters = []

            else:

                query = """
                    SELECT
                        s.shelter_id,
                        s.location_id,
                        l.location_name,
                        l.district,
                        l.state,
                        s.shelter_name,
                        s.address,
                        s.capacity,
                        s.occupied_count,
                        (s.capacity - s.occupied_count) AS available,
                        s.contact_person,
                        s.contact_phone,
                        s.status,
                        s.created_at,
                        s.updated_at

                    FROM shelters AS s

                    INNER JOIN locations AS l
                        ON s.location_id = l.location_id
                """

                if role == "volunteer":

                    query += " WHERE s.location_id = %s"

                    cursor.execute(
                        query + " ORDER BY s.created_at DESC",
                        (assigned_location_id,)
                    )

                else:

                    cursor.execute(
                        query + " ORDER BY s.created_at DESC"
                    )

                shelters = cursor.fetchall()

            # Location-wise summary.
            summary_query = """
                SELECT
                    l.location_id,
                    l.location_name,
                    l.district,
                    l.state,

                    COUNT(s.shelter_id) AS total_shelters,

                    COALESCE(
                        SUM(s.capacity), 0
                    ) AS total_capacity,

                    COALESCE(
                        SUM(s.occupied_count), 0
                    ) AS total_occupied,

                    COALESCE(
                        SUM(s.capacity - s.occupied_count), 0
                    ) AS total_available,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN s.status = 'operational'
                                THEN 1 ELSE 0
                            END
                        ), 0
                    ) AS operational_shelters,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN s.status = 'full'
                                THEN 1 ELSE 0
                            END
                        ), 0
                    ) AS full_shelters,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN s.status = 'temporarily_closed'
                                THEN 1 ELSE 0
                            END
                        ), 0
                    ) AS closed_shelters

                FROM locations AS l

                LEFT JOIN shelters AS s
                    ON l.location_id = s.location_id
            """

            if role == "volunteer":

                if assigned_location_id is None:

                    location_summary = []

                else:

                    cursor.execute(
                        summary_query + """
                            WHERE l.location_id = %s

                            GROUP BY
                                l.location_id,
                                l.location_name,
                                l.district,
                                l.state
                        """,
                        (assigned_location_id,)
                    )

                    location_summary = cursor.fetchall()

            else:

                cursor.execute(
                    summary_query + """
                        GROUP BY
                            l.location_id,
                            l.location_name,
                            l.district,
                            l.state

                        ORDER BY l.location_name
                    """
                )

                location_summary = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(shelters),
            "data": shelters,
            "location_summary": location_summary,
            "scope": {
                "role": role,
                "assigned_location": assigned_location,
                "assigned_location_id": assigned_location_id
            }
        }), 200

    except Exception:

        logging.exception("Could not retrieve shelters")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve shelter information."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# ADD A NEW SHELTER
# --------------------------------------------------

@shelter_bp.route("/shelters", methods=["POST"])
def add_shelter():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please provide valid JSON data."
        }), 400

    required = [
        "location_id",
        "shelter_name",
        "capacity"
    ]

    missing = [
        field
        for field in required
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

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if not location_exists(cursor, values["location_id"]):

                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 404

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

            shelter_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Shelter added successfully.",
            "shelter_id": shelter_id
        }), 201

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid shelter information or location."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not add shelter")

        return jsonify({
            "success": False,
            "message": "Unable to add shelter."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# UPDATE EXISTING SHELTER
# --------------------------------------------------

@shelter_bp.route("/shelters/<int:shelter_id>", methods=["PUT"])
def update_shelter(shelter_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:

        return jsonify({
            "success": False,
            "message": "Please provide valid update details."
        }), 400

    connection = None

    try:

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

                FOR UPDATE
            """, (shelter_id,))

            existing = cursor.fetchone()

            if not existing:

                return jsonify({
                    "success": False,
                    "message": "Shelter not found."
                }), 404

            values, error = validate_shelter(
                data,
                existing
            )

            if error:

                return jsonify({
                    "success": False,
                    "message": error
                }), 400

            if not location_exists(cursor, values["location_id"]):

                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 404

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
            "message": "Shelter updated successfully."
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not update shelter")

        return jsonify({
            "success": False,
            "message": "Unable to update shelter."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# DELETE SHELTER
# --------------------------------------------------

@shelter_bp.route("/shelters/<int:shelter_id>", methods=["DELETE"])
def delete_shelter(shelter_id):

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT shelter_id
                FROM shelters
                WHERE shelter_id = %s
                FOR UPDATE
            """, (shelter_id,))

            if not cursor.fetchone():

                return jsonify({
                    "success": False,
                    "message": "Shelter not found."
                }), 404

            cursor.execute("""
                DELETE FROM shelters
                WHERE shelter_id = %s
            """, (shelter_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Shelter deleted successfully."
        }), 200

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

        logging.exception("Could not delete shelter")

        return jsonify({
            "success": False,
            "message": "Unable to delete shelter."
        }), 500

    finally:

        if connection:
            connection.close()