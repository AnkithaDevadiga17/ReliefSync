import logging
from decimal import Decimal, InvalidOperation

import pymysql
from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


resource_bp = Blueprint("resources", __name__)

RESOURCE_MANAGERS = {"admin", "coordinator", "ngo"}


# --------------------------------------------------
# VALIDATE RESOURCE DATA
# --------------------------------------------------

def validate_resource(data, existing=None):

    if not isinstance(data, dict):
        return None, "Please provide valid resource details."

    values = {
        "location_id": None,
        "resource_name": "",
        "category": "",
        "quantity_available": Decimal("0"),
        "unit": "",
        "minimum_stock": Decimal("0")
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

        values["quantity_available"] = Decimal(
            str(values["quantity_available"])
        )

        values["minimum_stock"] = Decimal(
            str(values["minimum_stock"] or 0)
        )

        if (
            not values["quantity_available"].is_finite()
            or not values["minimum_stock"].is_finite()
        ):
            raise InvalidOperation

    except (ValueError, TypeError, InvalidOperation):
        return None, "Enter valid location and quantity values."

    if values["location_id"] <= 0:
        return None, "Please select a valid location."

    values["resource_name"] = str(
        values["resource_name"] or ""
    ).strip()

    values["category"] = str(
        values["category"] or ""
    ).strip()

    values["unit"] = str(
        values["unit"] or ""
    ).strip()

    if not values["resource_name"] or len(values["resource_name"]) > 120:
        return None, "Resource name is required (maximum 120 characters)."

    if not values["category"] or len(values["category"]) > 60:
        return None, "Category is required (maximum 60 characters)."

    if not values["unit"] or len(values["unit"]) > 30:
        return None, "Unit is required (maximum 30 characters)."

    if values["quantity_available"] < 0:
        return None, "Available quantity cannot be negative."

    if values["minimum_stock"] < 0:
        return None, "Minimum stock cannot be negative."

    return values, None


# --------------------------------------------------
# CHECK LOCATION
# --------------------------------------------------

def location_exists(cursor, location_id):

    cursor.execute("""
        SELECT location_id
        FROM locations
        WHERE location_id = %s
    """, (location_id,))

    return cursor.fetchone() is not None


# --------------------------------------------------
# FIND VOLUNTEER'S LOCATION
# --------------------------------------------------

def get_volunteer_location(cursor, user_id):

    if not user_id:
        return None

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
# LOCATION-WISE INVENTORY SUMMARY
# --------------------------------------------------

def get_location_summary(cursor, location_id=None):

    query = """
        SELECT
            l.location_id,
            l.location_name,
            l.district,
            l.state,

            COUNT(r.resource_id) AS total_items,

            COUNT(
                CASE
                    WHEN r.quantity_available <= 0
                    THEN 1
                END
            ) AS out_of_stock_items,

            COUNT(
                CASE
                    WHEN r.quantity_available > 0
                    AND r.quantity_available <= r.minimum_stock
                    THEN 1
                END
            ) AS low_stock_items,

            COUNT(
                CASE
                    WHEN r.quantity_available > r.minimum_stock
                    THEN 1
                END
            ) AS available_items,

            COUNT(DISTINCT r.category) AS total_categories

        FROM locations AS l

        LEFT JOIN resources AS r
            ON l.location_id = r.location_id
    """

    parameters = []

    if location_id is not None:
        query += " WHERE l.location_id = %s"
        parameters.append(location_id)

    query += """
        GROUP BY
            l.location_id,
            l.location_name,
            l.district,
            l.state

        ORDER BY l.location_name
    """

    cursor.execute(query, tuple(parameters))

    return cursor.fetchall()


# --------------------------------------------------
# GET RESOURCES
# Admin / NGO: All locations or selected location
# Coordinator: Must select a monitoring location
# Volunteer: Automatically restricted to own location
# --------------------------------------------------

@resource_bp.route("/resources", methods=["GET"])
def get_resources():

    connection = None

    try:

        role = str(
            session.get("role", "")
        ).strip().lower()

        user_id = session.get("user_id")

        requested_location = request.args.get("location_id")

        connection = get_db_connection()

        assigned_location = None
        assigned_location_id = None
        selected_location_id = None

        with connection.cursor() as cursor:

            # Volunteers cannot choose another location.
            if role == "volunteer":

                volunteer = get_volunteer_location(
                    cursor,
                    user_id
                )

                if volunteer and volunteer["location_id"] is not None:

                    assigned_location_id = int(
                        volunteer["location_id"]
                    )

                    assigned_location = {
                        "location_id": assigned_location_id,
                        "location_name": volunteer["location_name"],
                        "district": volunteer["district"],
                        "state": volunteer["state"]
                    }

                selected_location_id = assigned_location_id

            # Coordinators must select a monitoring location.
            elif role == "coordinator":

                if requested_location:

                    try:
                        selected_location_id = int(requested_location)

                    except ValueError:
                        return jsonify({
                            "success": False,
                            "message": "Invalid location selection."
                        }), 400

                    if not location_exists(
                        cursor,
                        selected_location_id
                    ):
                        return jsonify({
                            "success": False,
                            "message": "Selected location does not exist."
                        }), 404

            # Admin and NGO can view all or a selected location.
            elif role in {"admin", "ngo"}:

                if requested_location:

                    try:
                        selected_location_id = int(requested_location)

                    except ValueError:
                        return jsonify({
                            "success": False,
                            "message": "Invalid location selection."
                        }), 400

                    if not location_exists(
                        cursor,
                        selected_location_id
                    ):
                        return jsonify({
                            "success": False,
                            "message": "Selected location does not exist."
                        }), 404

            # Build resource query.
            query = """
                SELECT
                    r.resource_id,
                    r.location_id,
                    l.location_name,
                    l.district,
                    l.state,
                    r.resource_name,
                    r.category,
                    r.quantity_available,
                    r.unit,
                    r.minimum_stock,

                    CASE
                        WHEN r.quantity_available <= 0
                            THEN 'out_of_stock'
                        WHEN r.quantity_available <= r.minimum_stock
                            THEN 'low_stock'
                        ELSE 'available'
                    END AS stock_status

                FROM resources AS r

                LEFT JOIN locations AS l
                    ON r.location_id = l.location_id
            """

            parameters = []

            # Volunteer without a registered location sees no inventory.
            if role == "volunteer" and selected_location_id is None:

                resources = []

            else:

                # Coordinator without a selected area sees no inventory.
                if role == "coordinator" and selected_location_id is None:

                    resources = []

                else:

                    if selected_location_id is not None:

                        query += " WHERE r.location_id = %s"
                        parameters.append(selected_location_id)

                    query += " ORDER BY r.updated_at DESC"

                    cursor.execute(query, tuple(parameters))

                    resources = cursor.fetchall()


            # Admin and NGO receive the full location overview.
            if role in {"admin", "ngo"}:

                location_summary = get_location_summary(cursor)

            elif selected_location_id is not None:

                location_summary = get_location_summary(
                    cursor,
                    selected_location_id
                )

            else:

                location_summary = []


        return jsonify({
            "success": True,
            "count": len(resources),
            "data": resources,
            "location_summary": location_summary,
            "scope": {
                "role": role,
                "assigned_location": assigned_location,
                "assigned_location_id": assigned_location_id,
                "selected_location_id": selected_location_id,
                "requires_location_selection": (
                    role == "coordinator"
                    and selected_location_id is None
                )
            }
        }), 200

    except Exception:

        logging.exception("Could not retrieve resources")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve resources."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# ADD RESOURCE
# --------------------------------------------------

@resource_bp.route("/resources", methods=["POST"])
def add_resource():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please provide valid JSON."
        }), 400

    required = [
        "location_id",
        "resource_name",
        "category",
        "quantity_available",
        "unit"
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

    values, error = validate_resource(data)

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
                INSERT INTO resources (
                    location_id,
                    resource_name,
                    category,
                    quantity_available,
                    unit,
                    minimum_stock
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                values["location_id"],
                values["resource_name"],
                values["category"],
                values["quantity_available"],
                values["unit"],
                values["minimum_stock"]
            ))

            new_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Resource added successfully.",
            "resource_id": new_id
        }), 201

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid resource or location."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not add resource")

        return jsonify({
            "success": False,
            "message": "Unable to add resource."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# UPDATE RESOURCE
# --------------------------------------------------

@resource_bp.route(
    "/resources/<int:resource_id>",
    methods=["PUT"]
)
def update_resource(resource_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return jsonify({
            "success": False,
            "message": "Please provide update details."
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT *
                FROM resources
                WHERE resource_id = %s
                FOR UPDATE
            """, (resource_id,))

            existing = cursor.fetchone()

            if not existing:
                return jsonify({
                    "success": False,
                    "message": "Resource not found."
                }), 404

            values, error = validate_resource(data, existing)

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
                UPDATE resources
                SET
                    location_id = %s,
                    resource_name = %s,
                    category = %s,
                    quantity_available = %s,
                    unit = %s,
                    minimum_stock = %s

                WHERE resource_id = %s
            """, (
                values["location_id"],
                values["resource_name"],
                values["category"],
                values["quantity_available"],
                values["unit"],
                values["minimum_stock"],
                resource_id
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Resource updated successfully.",
            "resource_id": resource_id
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not update resource")

        return jsonify({
            "success": False,
            "message": "Unable to update resource."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# DELETE RESOURCE
# --------------------------------------------------

@resource_bp.route(
    "/resources/<int:resource_id>",
    methods=["DELETE"]
)
def delete_resource(resource_id):

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT resource_id
                FROM resources
                WHERE resource_id = %s
                FOR UPDATE
            """, (resource_id,))

            if not cursor.fetchone():

                return jsonify({
                    "success": False,
                    "message": "Resource not found."
                }), 404

            cursor.execute("""
                DELETE FROM resources
                WHERE resource_id = %s
            """, (resource_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Resource deleted successfully.",
            "deleted_resource_id": resource_id
        }), 200

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": (
                "This resource has allocation records and cannot be deleted. "
                "Cancel or resolve its allocations first."
            )
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not delete resource")

        return jsonify({
            "success": False,
            "message": "Unable to delete resource."
        }), 500

    finally:

        if connection:
            connection.close()