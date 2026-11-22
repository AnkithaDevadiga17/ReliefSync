import logging
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


allocation_bp = Blueprint("allocations", __name__)

OPERATOR_ROLES = {"admin", "coordinator", "ngo"}

ALLOCATION_STATUSES = {
    "pending",
    "approved",
    "dispatched",
    "delivered",
    "cancelled"
}

ALLOWED_TRANSITIONS = {
    "pending": ["approved", "cancelled"],
    "approved": ["dispatched", "cancelled"],
    "dispatched": ["delivered"],
    "delivered": [],
    "cancelled": []
}


# --------------------------------------------------
# CHECK ACCESS
# --------------------------------------------------

def check_allocation_access():

    if not session.get("user_id"):
        return jsonify({
            "success": False,
            "message": "Please log in first."
        }), 401

    role = str(
        session.get("role", "")
    ).strip().lower()

    if role not in OPERATOR_ROLES:
        return jsonify({
            "success": False,
            "message": "You do not have permission to manage resource allocations."
        }), 403

    return None


# --------------------------------------------------
# GET ALL ALLOCATIONS
# --------------------------------------------------

@allocation_bp.route("/allocations", methods=["GET"])
def get_allocations():

    access_error = check_allocation_access()

    if access_error:
        return access_error

    connection = None

    role = str(
        session.get("role", "")
    ).strip().lower()

    location_param = request.args.get("location_id")

    selected_location_id = None

    if location_param:

        try:
            selected_location_id = int(location_param)

            if selected_location_id <= 0:
                raise ValueError

        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Invalid location selection."
            }), 400

    # Coordinators must select the area they are monitoring.
    if role == "coordinator" and selected_location_id is None:

        return jsonify({
            "success": True,
            "count": 0,
            "data": [],
            "requires_location_selection": True
        }), 200

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            query = """
                SELECT
                    a.allocation_id,

                    a.resource_id,
                    r.resource_name,
                    r.unit,
                    r.quantity_available,

                    r.location_id AS resource_location_id,
                    rl.location_name AS resource_location_name,

                    a.disaster_id,
                    d.disaster_type,
                    d.severity,
                    d.status AS disaster_status,

                    d.location_id AS disaster_location_id,
                    dl.location_name,
                    dl.district,
                    dl.state,

                    a.quantity_allocated,
                    a.allocation_status,

                    a.allocated_by,
                    u.full_name AS allocated_by_name,

                    a.allocated_at,
                    a.dispatched_at,
                    a.notes

                FROM resource_allocations AS a

                INNER JOIN resources AS r
                    ON a.resource_id = r.resource_id

                INNER JOIN disasters AS d
                    ON a.disaster_id = d.disaster_id

                LEFT JOIN locations AS rl
                    ON r.location_id = rl.location_id

                LEFT JOIN locations AS dl
                    ON d.location_id = dl.location_id

                LEFT JOIN users AS u
                    ON a.allocated_by = u.user_id
            """

            parameters = []

            if selected_location_id is not None:

                query += " WHERE d.location_id = %s"

                parameters.append(selected_location_id)

            query += " ORDER BY a.allocated_at DESC"

            cursor.execute(query, tuple(parameters))

            allocations = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(allocations),
            "data": allocations,
            "selected_location_id": selected_location_id
        }), 200

    except Exception:

        logging.exception("Could not retrieve allocations")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve allocation records."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# CREATE ALLOCATION REQUEST
# --------------------------------------------------

@allocation_bp.route("/allocations", methods=["POST"])
def add_allocation():

    access_error = check_allocation_access()

    if access_error:
        return access_error

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

    try:

        resource_id = int(data["resource_id"])

        disaster_id = int(data["disaster_id"])

        quantity = Decimal(
            str(data["quantity_allocated"])
        )

        if (
            resource_id <= 0
            or disaster_id <= 0
            or not quantity.is_finite()
            or quantity <= 0
        ):
            raise ValueError

        # Database column is DECIMAL(12,2).
        if quantity != quantity.quantize(Decimal("0.01")):
            return jsonify({
                "success": False,
                "message": "Allocation quantity can have at most two decimal places."
            }), 400

        if quantity > Decimal("9999999999.99"):
            raise ValueError

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

    notes = notes.strip() if notes else None

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            # Lock resource to prevent simultaneous stock overbooking.
            cursor.execute("""
                SELECT
                    resource_id,
                    location_id,
                    quantity_available
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


            # Find disaster and its location.
            cursor.execute("""
                SELECT
                    disaster_id,
                    location_id,
                    disaster_type
                FROM disasters
                WHERE disaster_id = %s
            """, (disaster_id,))

            disaster = cursor.fetchone()

            if not disaster:
                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404


            # A resource must belong to the disaster's location.
            if int(resource["location_id"]) != int(disaster["location_id"]):

                return jsonify({
                    "success": False,
                    "message": (
                        "The selected resource and disaster belong to "
                        "different locations. Choose a resource from "
                        "the disaster's affected location."
                    )
                }), 400


            available_stock = Decimal(
                str(resource["quantity_available"])
            )


            # Pending requests have not deducted stock yet.
            # Include them so multiple requests cannot overbook inventory.
            cursor.execute("""
                SELECT
                    COALESCE(SUM(quantity_allocated), 0) AS pending_quantity
                FROM resource_allocations
                WHERE resource_id = %s
                  AND allocation_status = 'pending'
            """, (resource_id,))

            pending_result = cursor.fetchone()

            pending_quantity = Decimal(
                str(pending_result["pending_quantity"])
            )


            remaining_stock = available_stock - pending_quantity

            if quantity > remaining_stock:

                return jsonify({
                    "success": False,
                    "message": (
                        f"Only {remaining_stock} units remain available "
                        "after existing pending requests."
                    )
                }), 400


            # Create request. Stock is deducted only on approval.
            cursor.execute("""
                INSERT INTO resource_allocations (
                    resource_id,
                    disaster_id,
                    quantity_allocated,
                    allocation_status,
                    allocated_by,
                    notes
                )

                VALUES (%s, %s, %s, 'pending', %s, %s)
            """, (
                resource_id,
                disaster_id,
                quantity,
                session.get("user_id"),
                notes
            ))

            allocation_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Allocation request created successfully.",
            "allocation_id": allocation_id,
            "allocation_status": "pending"
        }), 201

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not create allocation")

        return jsonify({
            "success": False,
            "message": "Unable to create allocation request."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# UPDATE ALLOCATION STATUS
# --------------------------------------------------

@allocation_bp.route(
    "/allocations/<int:allocation_id>",
    methods=["PUT"]
)
def update_allocation(allocation_id):

    access_error = check_allocation_access()

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return jsonify({
            "success": False,
            "message": "Provide update details."
        }), 400

    unexpected_fields = set(data.keys()) - {
        "allocation_status",
        "notes"
    }

    if unexpected_fields:
        return jsonify({
            "success": False,
            "message": "Only allocation status and notes can be updated."
        }), 400

    connection = None

    try:

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

            new_status = data.get(
                "allocation_status",
                current_status
            )

            if new_status not in ALLOCATION_STATUSES:

                return jsonify({
                    "success": False,
                    "message": "Invalid allocation status."
                }), 400


            # Enforce allowed workflow transitions.
            if (
                new_status != current_status
                and new_status not in ALLOWED_TRANSITIONS[current_status]
            ):

                return jsonify({
                    "success": False,
                    "message": (
                        f"Cannot change allocation from "
                        f"{current_status} to {new_status}."
                    )
                }), 400


            notes = data.get(
                "notes",
                allocation["notes"]
            )

            if notes is not None and not isinstance(notes, str):

                return jsonify({
                    "success": False,
                    "message": "Notes must be text."
                }), 400

            notes = notes.strip() if notes else None


            # APPROVE: deduct inventory.
            if (
                current_status == "pending"
                and new_status == "approved"
            ):

                cursor.execute("""
                    SELECT quantity_available
                    FROM resources
                    WHERE resource_id = %s
                    FOR UPDATE
                """, (
                    allocation["resource_id"],
                ))

                resource = cursor.fetchone()

                if not resource:

                    return jsonify({
                        "success": False,
                        "message": "Resource no longer exists."
                    }), 404

                quantity = Decimal(
                    str(allocation["quantity_allocated"])
                )

                available = Decimal(
                    str(resource["quantity_available"])
                )

                if quantity > available:

                    return jsonify({
                        "success": False,
                        "message": "Not enough stock to approve this allocation."
                    }), 400

                cursor.execute("""
                    UPDATE resources
                    SET quantity_available = quantity_available - %s
                    WHERE resource_id = %s
                      AND quantity_available >= %s
                """, (
                    quantity,
                    allocation["resource_id"],
                    quantity
                ))

                if cursor.rowcount == 0:

                    return jsonify({
                        "success": False,
                        "message": "Stock changed. Refresh and try again."
                    }), 409


            # CANCEL APPROVED REQUEST: restore inventory.
            if (
                current_status == "approved"
                and new_status == "cancelled"
            ):

                cursor.execute("""
                    UPDATE resources
                    SET quantity_available = quantity_available + %s
                    WHERE resource_id = %s
                """, (
                    allocation["quantity_allocated"],
                    allocation["resource_id"]
                ))


            # Mark dispatch time when status becomes dispatched.
            if new_status == "dispatched":

                cursor.execute("""
                    UPDATE resource_allocations
                    SET
                        allocation_status = %s,
                        dispatched_at = CURRENT_TIMESTAMP,
                        notes = %s
                    WHERE allocation_id = %s
                """, (
                    new_status,
                    notes,
                    allocation_id
                ))

            else:

                cursor.execute("""
                    UPDATE resource_allocations
                    SET
                        allocation_status = %s,
                        notes = %s
                    WHERE allocation_id = %s
                """, (
                    new_status,
                    notes,
                    allocation_id
                ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Allocation updated successfully.",
            "allocation_id": allocation_id,
            "allocation_status": new_status
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not update allocation")

        return jsonify({
            "success": False,
            "message": "Unable to update allocation."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# DELETE PENDING ALLOCATION
# --------------------------------------------------

@allocation_bp.route(
    "/allocations/<int:allocation_id>",
    methods=["DELETE"]
)
def delete_allocation(allocation_id):

    access_error = check_allocation_access()

    if access_error:
        return access_error

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
                    "message": (
                        "Only pending allocations can be deleted. "
                        "Cancel approved requests instead."
                    )
                }), 409

            cursor.execute("""
                DELETE FROM resource_allocations
                WHERE allocation_id = %s
            """, (allocation_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Pending allocation deleted successfully.",
            "deleted_allocation_id": allocation_id
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not delete allocation")

        return jsonify({
            "success": False,
            "message": "Unable to delete allocation."
        }), 500

    finally:

        if connection:
            connection.close()