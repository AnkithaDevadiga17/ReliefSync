import logging
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


location_bp = Blueprint("locations", __name__)


# --------------------------------------------------
# HELPER: CHECK USER PERMISSION
# --------------------------------------------------

def has_location_permission():
    return (
        "user_id" in session
        and session.get("role") in ["admin", "coordinator"]
    )


# --------------------------------------------------
# HELPER: VALIDATE LOCATION DATA
# --------------------------------------------------

def validate_location_data(data):

    if not isinstance(data, dict):
        return None, "Please provide valid location details."

    location_name = str(
        data.get("location_name") or ""
    ).strip()

    location_type = str(
        data.get("location_type") or ""
    ).strip()

    district = str(
        data.get("district") or ""
    ).strip()

    state = str(
        data.get("state") or ""
    ).strip()

    country = str(
        data.get("country") or ""
    ).strip()

    pincode = str(
        data.get("pincode") or ""
    ).strip()

    required_fields = {
        "Location name": location_name,
        "Location type": location_type,
        "District": district,
        "State": state,
        "Country": country
    }

    for field, value in required_fields.items():
        if not value:
            return None, f"{field} is required."

    # Match the database column lengths.
    if len(location_name) > 100:
        return None, "Location name must not exceed 100 characters."

    if len(location_type) > 30:
        return None, "Location type must not exceed 30 characters."

    if len(district) > 100:
        return None, "District must not exceed 100 characters."

    if len(state) > 100:
        return None, "State must not exceed 100 characters."

    if len(country) > 100:
        return None, "Country must not exceed 100 characters."

    if len(pincode) > 10:
        return None, "Pincode must not exceed 10 characters."

    try:
        latitude = data.get("latitude")
        longitude = data.get("longitude")

        if latitude in (None, ""):
            latitude = None
        else:
            latitude = Decimal(str(latitude))

            if not latitude.is_finite():
                raise InvalidOperation

            if not Decimal("-90") <= latitude <= Decimal("90"):
                return None, "Latitude must be between -90 and 90."

        if longitude in (None, ""):
            longitude = None
        else:
            longitude = Decimal(str(longitude))

            if not longitude.is_finite():
                raise InvalidOperation

            if not Decimal("-180") <= longitude <= Decimal("180"):
                return None, "Longitude must be between -180 and 180."

    except (InvalidOperation, ValueError, TypeError):
        return None, "Enter valid latitude and longitude values."

    # Coordinates must be supplied together.
    if (latitude is None) != (longitude is None):
        return None, "Enter both latitude and longitude, or leave both empty."

    return {
        "location_name": location_name,
        "location_type": location_type,
        "district": district,
        "state": state,
        "country": country,
        "latitude": latitude,
        "longitude": longitude,
        "pincode": pincode or None
    }, None


# --------------------------------------------------
# HELPER: CHECK DUPLICATE LOCATION
# --------------------------------------------------

def location_exists(cursor, location, exclude_id=None):

    query = """
        SELECT location_id
        FROM locations
        WHERE LOWER(location_name) = LOWER(%s)
          AND LOWER(district) = LOWER(%s)
          AND LOWER(state) = LOWER(%s)
    """

    values = [
        location["location_name"],
        location["district"],
        location["state"]
    ]

    if exclude_id is not None:
        query += " AND location_id != %s"
        values.append(exclude_id)

    query += " LIMIT 1"

    cursor.execute(query, values)

    return cursor.fetchone() is not None


# --------------------------------------------------
# GET: VIEW ALL LOCATIONS
# --------------------------------------------------

@location_bp.route("/locations", methods=["GET"])
def get_locations():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    location_id,
                    location_name,
                    location_type,
                    district,
                    state,
                    country,
                    latitude,
                    longitude,
                    pincode,
                    created_at
                FROM locations
                ORDER BY location_name ASC
            """)

            locations = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(locations),
            "data": locations
        }), 200

    except Exception:
        logging.exception("Could not retrieve locations")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve locations."
        }), 500

    finally:
        if connection:
            connection.close()


# --------------------------------------------------
# POST: ADD NEW LOCATION
# --------------------------------------------------

@location_bp.route("/locations", methods=["POST"])
def add_location():

    if not has_location_permission():
        return jsonify({
            "success": False,
            "message": "Only administrators and coordinators can add locations."
        }), 403

    data = request.get_json(silent=True)

    location, error = validate_location_data(data)

    if error:
        return jsonify({
            "success": False,
            "message": error
        }), 400

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            if location_exists(cursor, location):
                return jsonify({
                    "success": False,
                    "message": "This location already exists."
                }), 409

            cursor.execute("""
                INSERT INTO locations (
                    location_name,
                    location_type,
                    district,
                    state,
                    country,
                    latitude,
                    longitude,
                    pincode
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                location["location_name"],
                location["location_type"],
                location["district"],
                location["state"],
                location["country"],
                location["latitude"],
                location["longitude"],
                location["pincode"]
            ))

            new_location_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Location added successfully.",
            "data": {
                "location_id": new_location_id,
                **location
            }
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        logging.exception("Could not add location")

        return jsonify({
            "success": False,
            "message": "Unable to add location."
        }), 500

    finally:
        if connection:
            connection.close()


# --------------------------------------------------
# PUT: UPDATE EXISTING LOCATION
# --------------------------------------------------

@location_bp.route(
    "/locations/<int:location_id>",
    methods=["PUT"]
)
def update_location(location_id):

    if not has_location_permission():
        return jsonify({
            "success": False,
            "message": "Only administrators and coordinators can edit locations."
        }), 403

    data = request.get_json(silent=True)

    location, error = validate_location_data(data)

    if error:
        return jsonify({
            "success": False,
            "message": error
        }), 400

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT location_id
                FROM locations
                WHERE location_id = %s
                FOR UPDATE
            """, (location_id,))

            existing_location = cursor.fetchone()

            if not existing_location:
                return jsonify({
                    "success": False,
                    "message": "Location not found."
                }), 404

            if location_exists(
                cursor,
                location,
                exclude_id=location_id
            ):
                return jsonify({
                    "success": False,
                    "message": "Another location with these details already exists."
                }), 409

            cursor.execute("""
                UPDATE locations
                SET
                    location_name = %s,
                    location_type = %s,
                    district = %s,
                    state = %s,
                    country = %s,
                    latitude = %s,
                    longitude = %s,
                    pincode = %s
                WHERE location_id = %s
            """, (
                location["location_name"],
                location["location_type"],
                location["district"],
                location["state"],
                location["country"],
                location["latitude"],
                location["longitude"],
                location["pincode"],
                location_id
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Location updated successfully.",
            "data": {
                "location_id": location_id,
                **location
            }
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        logging.exception("Could not update location")

        return jsonify({
            "success": False,
            "message": "Unable to update location."
        }), 500

    finally:
        if connection:
            connection.close()


# --------------------------------------------------
# DELETE: DELETE LOCATION
# --------------------------------------------------

@location_bp.route(
    "/locations/<int:location_id>",
    methods=["DELETE"]
)
def delete_location(location_id):

    if not has_location_permission():
        return jsonify({
            "success": False,
            "message": "Only administrators and coordinators can delete locations."
        }), 403

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT location_id, location_name
                FROM locations
                WHERE location_id = %s
                FOR UPDATE
            """, (location_id,))

            location = cursor.fetchone()

            if not location:
                return jsonify({
                    "success": False,
                    "message": "Location not found."
                }), 404

            # Do not delete locations already used by other modules.
            linked_tables = [
                ("disasters", "location_id"),
                ("shelters", "location_id"),
                ("resources", "location_id"),
                ("volunteers", "location_id"),
                ("donations", "location_id"),
                ("risk_predictions", "location_id"),
                ("donation_distributions", "location_id")
            ]

            linked_records = []

            for table_name, column_name in linked_tables:

                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM {table_name}
                    WHERE {column_name} = %s
                    """,
                    (location_id,)
                )

                result = cursor.fetchone()

                if result["total"] > 0:
                    linked_records.append(table_name)

            if linked_records:
                return jsonify({
                    "success": False,
                    "message": (
                        "This location is already connected to other "
                        "modules and cannot be deleted."
                    ),
                    "linked_modules": linked_records
                }), 409

            cursor.execute("""
                DELETE FROM locations
                WHERE location_id = %s
            """, (location_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Location deleted successfully.",
            "deleted_location_id": location_id
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        logging.exception("Could not delete location")

        return jsonify({
            "success": False,
            "message": "Unable to delete location."
        }), 500

    finally:
        if connection:
            connection.close()