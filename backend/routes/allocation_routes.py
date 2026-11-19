
from flask import Blueprint, jsonify, request
from decimal import Decimal, InvalidOperation

from config.db import get_db_connection


allocation_bp = Blueprint("allocations", __name__)


# -----------------------------------
# GET - VIEW ALL ALLOCATIONS
# -----------------------------------

@allocation_bp.route("/allocations", methods=["GET"])
def get_allocations():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    a.allocation_id,
                    a.resource_id,
                    r.resource_name,
                    r.unit,
                    a.disaster_id,
                    d.disaster_type,
                    l.location_name,
                    a.quantity_allocated,
                    a.allocation_status,
                    a.allocated_at,
                    a.dispatched_at,
                    a.notes
                FROM resource_allocations AS a
                JOIN resources AS r
                    ON a.resource_id = r.resource_id
                JOIN disasters AS d
                    ON a.disaster_id = d.disaster_id
                LEFT JOIN locations AS l
                    ON d.location_id = l.location_id
                ORDER BY a.allocated_at DESC
            """)

            allocations = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(allocations),
            "data": allocations
        })

    except Exception:
        import logging
        logging.exception("Could not retrieve allocations")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve allocations."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - CREATE ALLOCATION REQUEST
# -----------------------------------

@allocation_bp.route("/allocations", methods=["POST"])
def add_allocation():

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Please provide valid JSON."
            }), 400

        required = [
            "resource_id",
            "disaster_id",
            "quantity_allocated"
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

        try:
            resource_id = int(data["resource_id"])
            disaster_id = int(data["disaster_id"])
            quantity = Decimal(str(data["quantity_allocated"]))

            if resource_id <= 0 or disaster_id <= 0 or quantity <= 0:
                raise ValueError()

        except (ValueError, TypeError, InvalidOperation):
            return jsonify({
                "success": False,
                "message": "Enter valid IDs and a positive allocation quantity."
            }), 400

        notes = data.get("notes")

        if notes is not None and not isinstance(notes, str):
            return jsonify({
                "success": False,
                "message": "Notes must be text."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT quantity_available
                FROM resources
                WHERE resource_id = %s
                FOR UPDATE
            """, (resource_id,))

            resource = cursor.fetchone()

            if not resource:
                return jsonify({
                    "success": False,
                    "message": "Resource not found."
                }), 404

            cursor.execute("""
                SELECT disaster_id
                FROM disasters
                WHERE disaster_id = %s
            """, (disaster_id,))

            disaster = cursor.fetchone()

            if not disaster:
                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404

            if quantity > Decimal(str(resource["quantity_available"])):
                return jsonify({
                    "success": False,
                    "message": "Requested quantity exceeds current available stock."
                }), 400

            # New requests remain pending until approved.
            cursor.execute("""
                INSERT INTO resource_allocations (
                    resource_id,
                    disaster_id,
                    quantity_allocated,
                    allocation_status,
                    allocated_by,
                    notes
                )
                VALUES (%s, %s, %s, 'pending', NULL, %s)
            """, (
                resource_id,
                disaster_id,
                quantity,
                notes
            ))

            new_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Allocation request created successfully!",
            "allocation_id": new_id,
            "allocation_status": "pending"
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not create allocation")

        return jsonify({
            "success": False,
            "message": "Unable to create allocation request."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - UPDATE ALLOCATION STATUS
# -----------------------------------

@allocation_bp.route(
    "/allocations/<int:allocation_id>",
    methods=["PUT"]
)
def update_allocation(allocation_id):

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
                FROM resource_allocations
                WHERE allocation_id = %s
                FOR UPDATE
            """, (allocation_id,))

            allocation = cursor.fetchone()

            if not allocation:
                return jsonify({
                    "success": False,
                    "message": "Allocation not found."
                }), 404

            current_status = allocation["allocation_status"]
            new_status = data.get("allocation_status", current_status)

            allowed_statuses = [
                "pending",
                "approved",
                "dispatched",
                "delivered",
                "cancelled"
            ]

            if new_status not in allowed_statuses:
                return jsonify({
                    "success": False,
                    "message": "Invalid allocation status."
                }), 400

            allowed_transitions = {
                "pending": ["approved", "cancelled"],
                "approved": ["dispatched", "cancelled"],
                "dispatched": ["delivered"],
                "delivered": [],
                "cancelled": []
            }

            if (
                new_status != current_status
                and new_status not in allowed_transitions[current_status]
            ):
                return jsonify({
                    "success": False,
                    "message": f"Cannot change allocation from {current_status} to {new_status}."
                }), 400

            # Deduct stock only when allocation is approved.
            if current_status == "pending" and new_status == "approved":

                cursor.execute("""
                    UPDATE resources
                    SET quantity_available = quantity_available - %s
                    WHERE resource_id = %s
                    AND quantity_available >= %s
                """, (
                    allocation["quantity_allocated"],
                    allocation["resource_id"],
                    allocation["quantity_allocated"]
                ))

                if cursor.rowcount == 0:
                    return jsonify({
                        "success": False,
                        "message": "Not enough stock to approve this allocation."
                    }), 400

            # Restore stock if an approved allocation is cancelled.
            if current_status == "approved" and new_status == "cancelled":

                cursor.execute("""
                    UPDATE resources
                    SET quantity_available = quantity_available + %s
                    WHERE resource_id = %s
                """, (
                    allocation["quantity_allocated"],
                    allocation["resource_id"]
                ))

            notes = data.get("notes", allocation["notes"])

            if notes is not None and not isinstance(notes, str):
                return jsonify({
                    "success": False,
                    "message": "Notes must be text."
                }), 400

            if new_status == "dispatched":

                cursor.execute("""
                    UPDATE resource_allocations
                    SET allocation_status = %s,
                        dispatched_at = CURRENT_TIMESTAMP,
                        notes = %s
                    WHERE allocation_id = %s
                """, (new_status, notes, allocation_id))

            else:

                cursor.execute("""
                    UPDATE resource_allocations
                    SET allocation_status = %s,
                        notes = %s
                    WHERE allocation_id = %s
                """, (new_status, notes, allocation_id))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Allocation updated successfully!",
            "allocation_id": allocation_id,
            "allocation_status": new_status
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update allocation")

        return jsonify({
            "success": False,
            "message": "Unable to update allocation."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# DELETE - REMOVE PENDING ALLOCATION
# -----------------------------------

@allocation_bp.route(
    "/allocations/<int:allocation_id>",
    methods=["DELETE"]
)
def delete_allocation(allocation_id):

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT allocation_status
                FROM resource_allocations
                WHERE allocation_id = %s
                FOR UPDATE
            """, (allocation_id,))

            allocation = cursor.fetchone()

            if not allocation:
                return jsonify({
                    "success": False,
                    "message": "Allocation not found."
                }), 404

            if allocation["allocation_status"] != "pending":
                return jsonify({
                    "success": False,
                    "message": "Only pending allocations can be deleted. Cancel approved requests instead."
                }), 409

            cursor.execute("""
                DELETE FROM resource_allocations
                WHERE allocation_id = %s
            """, (allocation_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Pending allocation deleted successfully!",
            "deleted_allocation_id": allocation_id
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not delete allocation")

        return jsonify({
            "success": False,
            "message": "Unable to delete allocation."
        }), 500

    finally:
        if connection:
            connection.close()
