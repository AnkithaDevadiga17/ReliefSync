
from flask import Blueprint, jsonify, request
import pymysql

from config.db import get_db_connection


resource_bp = Blueprint("resources", __name__)


def validate_resource(data, existing=None):

    values = {
        "location_id": None,
        "resource_name": "",
        "category": "",
        "quantity_available": 0,
        "unit": "",
        "minimum_stock": 0
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
        values["quantity_available"] = float(
            values["quantity_available"]
        )
        values["minimum_stock"] = float(
            values["minimum_stock"] or 0
        )
    except (ValueError, TypeError):
        return None, "Enter valid location and quantity values."

    if values["location_id"] <= 0:
        return None, "Select a valid location."

    values["resource_name"] = str(values["resource_name"]).strip()
    values["category"] = str(values["category"]).strip()
    values["unit"] = str(values["unit"]).strip()

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


def location_exists(cursor, location_id):

    cursor.execute(
        "SELECT location_id FROM locations WHERE location_id = %s",
        (location_id,)
    )

    return cursor.fetchone() is not None


# -----------------------------------
# GET - VIEW ALL RESOURCES
# -----------------------------------

@resource_bp.route("/resources", methods=["GET"])
def get_resources():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    r.resource_id,
                    r.location_id,
                    l.location_name,
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
                ORDER BY r.updated_at DESC
            """)

            resources = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(resources),
            "data": resources
        })

    except Exception:
        import logging
        logging.exception("Could not retrieve resources")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve resources."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - ADD A RESOURCE
# -----------------------------------

@resource_bp.route("/resources", methods=["POST"])
def add_resource():

    connection = None

    try:
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
            field for field in required
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

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if not location_exists(cursor, values["location_id"]):
                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 400

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
            "message": "Resource added successfully!",
            "resource_id": new_id
        }), 201

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid resource or location."
        }), 400

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not add resource")

        return jsonify({
            "success": False,
            "message": "Unable to add resource."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - UPDATE A RESOURCE
# -----------------------------------

@resource_bp.route(
    "/resources/<int:resource_id>",
    methods=["PUT"]
)
def update_resource(resource_id):

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict) or not data:
            return jsonify({
                "success": False,
                "message": "Provide update details."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT *
                FROM resources
                WHERE resource_id = %s
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
                }), 400

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
            "message": "Resource updated successfully!",
            "resource_id": resource_id
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update resource")

        return jsonify({
            "success": False,
            "message": "Unable to update resource."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# DELETE - REMOVE A RESOURCE
# -----------------------------------

@resource_bp.route(
    "/resources/<int:resource_id>",
    methods=["DELETE"]
)
def delete_resource(resource_id):

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT resource_id FROM resources WHERE resource_id = %s",
                (resource_id,)
            )

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Resource not found."
                }), 404

            cursor.execute(
                "DELETE FROM resources WHERE resource_id = %s",
                (resource_id,)
            )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Resource deleted successfully!",
            "deleted_resource_id": resource_id
        })

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "This resource has allocation records and cannot be deleted."
        }), 409

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not delete resource")

        return jsonify({
            "success": False,
            "message": "Unable to delete resource."
        }), 500

    finally:
        if connection:
            connection.close()
