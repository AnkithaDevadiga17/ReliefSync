
from decimal import Decimal, InvalidOperation

import pymysql
from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


donation_bp = Blueprint("donations", __name__)

MANAGER_ROLES = {"admin", "coordinator"}

def manager_access_error():
    if not session.get("user_id"):
        return jsonify({"success": False, "message": "Please log in first."}), 401
    if str(session.get("role", "")).strip().lower() not in MANAGER_ROLES:
        return jsonify({"success": False, "message": "You do not have permission to manage donations."}), 403
    return None



# -----------------------------------
# HELPER FUNCTIONS
# -----------------------------------

def get_optional_location(value):

    if value in (None, ""):
        return None

    try:
        location_id = int(value)
        return location_id if location_id > 0 else None
    except (ValueError, TypeError):
        return None


def check_location(cursor, location_id):

    if location_id is None:
        return True

    cursor.execute(
        "SELECT location_id FROM locations WHERE location_id = %s",
        (location_id,)
    )

    return cursor.fetchone() is not None


# -----------------------------------
# GET - VIEW LOCATIONS
# -----------------------------------

@donation_bp.route("/donation-locations", methods=["GET"])
def get_donation_locations():

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
        logging.exception("Could not fetch donation locations")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve locations."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# GET - VIEW DONATIONS
# -----------------------------------

@donation_bp.route("/donations", methods=["GET"])
def get_donations():

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    d.donation_id,
                    d.location_id,
                    l.location_name,
                    d.donor_name,
                    d.donor_contact,
                    d.donor_email,
                    d.payment_method,
                    d.transaction_reference,
                    d.payment_proof,
                    d.donation_source,
                    d.donation_type,
                    d.amount,
                    d.item_description,
                    d.quantity,
                    d.unit,
                    d.donation_status,
                    d.received_at,
                    d.notes,

                    COALESCE(
                        (
                            SELECT SUM(dd.amount_allocated)
                            FROM donation_distributions AS dd
                            WHERE dd.donation_id = d.donation_id
                        ), 0
                    ) AS distributed_amount,

                    COALESCE(
                        (
                            SELECT SUM(dd.quantity_allocated)
                            FROM donation_distributions AS dd
                            WHERE dd.donation_id = d.donation_id
                        ), 0
                    ) AS distributed_quantity

                FROM donations AS d

                LEFT JOIN locations AS l
                    ON d.location_id = l.location_id

                ORDER BY d.received_at DESC
            """)

            donations = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(donations),
            "data": donations
        })

    except Exception:
        import logging
        logging.exception("Could not retrieve donations")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve donations."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - ADD DONATION
# -----------------------------------

@donation_bp.route("/donations", methods=["POST"])
def add_donation():

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Please provide valid JSON data."
            }), 400

        donation_type = str(data.get("donation_type", "")).lower()

        if donation_type not in ["cash", "items"]:
            return jsonify({
                "success": False,
                "message": "Donation type must be cash or items."
            }), 400

        location_id = get_optional_location(data.get("location_id"))

        if data.get("location_id") not in (None, "") and location_id is None:
            return jsonify({
                "success": False,
                "message": "Invalid location ID."
            }), 400

        donor_name = data.get("donor_name")
        donor_contact = data.get("donor_contact")
        notes = data.get("notes")

        for value, field, limit in [
            (donor_name, "Donor name", 120),
            (donor_contact, "Donor contact", 30)
        ]:
            if value is not None:
                if not isinstance(value, str) or len(value.strip()) > limit:
                    return jsonify({
                        "success": False,
                        "message": f"Invalid {field}."
                    }), 400

        if notes is not None and not isinstance(notes, str):
            return jsonify({
                "success": False,
                "message": "Notes must be text."
            }), 400

        amount = None
        item_description = None
        quantity = None
        unit = None

        if donation_type == "cash":

            try:
                amount = Decimal(str(data.get("amount")))

                if not amount.is_finite() or amount <= 0:
                    raise ValueError()

            except (ValueError, TypeError, InvalidOperation):
                return jsonify({
                    "success": False,
                    "message": "Enter a valid cash donation amount."
                }), 400

        else:

            item_description = data.get("item_description")

            if not isinstance(item_description, str) or not item_description.strip():
                return jsonify({
                    "success": False,
                    "message": "Item description is required."
                }), 400

            try:
                quantity = Decimal(str(data.get("quantity")))

                if not quantity.is_finite() or quantity <= 0:
                    raise ValueError()

            except (ValueError, TypeError, InvalidOperation):
                return jsonify({
                    "success": False,
                    "message": "Enter a valid item quantity."
                }), 400

            unit = data.get("unit")

            if not isinstance(unit, str) or not unit.strip() or len(unit.strip()) > 30:
                return jsonify({
                    "success": False,
                    "message": "Enter a valid unit."
                }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if not check_location(cursor, location_id):
                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 400

            cursor.execute("""
                INSERT INTO donations (
                    location_id,
                    donor_name,
                    donor_contact,
                    donation_type,
                    amount,
                    item_description,
                    quantity,
                    unit,
                    donation_status,
                    notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)
            """, (
                location_id,
                donor_name.strip() if donor_name else None,
                donor_contact.strip() if donor_contact else None,
                donation_type,
                amount,
                item_description.strip() if item_description else None,
                quantity,
                unit.strip() if unit else None,
                notes
            ))

            new_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Donation recorded successfully!",
            "donation_id": new_id
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not add donation")

        return jsonify({
            "success": False,
            "message": "Unable to record donation."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - UPDATE DONATION DETAILS
# -----------------------------------

@donation_bp.route(
    "/donations/<int:donation_id>",
    methods=["PUT"]
)
def update_donation(donation_id):

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict) or not data:
            return jsonify({
                "success": False,
                "message": "Provide donation update details."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT *
                FROM donations
                WHERE donation_id = %s
                FOR UPDATE
            """, (donation_id,))

            existing = cursor.fetchone()

            if not existing:
                return jsonify({
                    "success": False,
                    "message": "Donation not found."
                }), 404

            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM donation_distributions
                WHERE donation_id = %s
            """, (donation_id,))

            has_distributions = cursor.fetchone()["total"] > 0

            donation_type = existing["donation_type"]

            if "donation_type" in data and data["donation_type"] != donation_type:
                return jsonify({
                    "success": False,
                    "message": "Donation type cannot be changed after creation."
                }), 400

            location_id = existing["location_id"]

            if "location_id" in data:
                location_id = get_optional_location(data["location_id"])

                if data["location_id"] not in (None, "") and location_id is None:
                    return jsonify({
                        "success": False,
                        "message": "Invalid location ID."
                    }), 400

            if not check_location(cursor, location_id):
                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 400

            donor_name = data.get("donor_name", existing["donor_name"])
            donor_contact = data.get("donor_contact", existing["donor_contact"])
            notes = data.get("notes", existing["notes"])

            if donor_name is not None:
                if not isinstance(donor_name, str) or len(donor_name.strip()) > 120:
                    return jsonify({
                        "success": False,
                        "message": "Invalid donor name."
                    }), 400

            if donor_contact is not None:
                if not isinstance(donor_contact, str) or len(donor_contact.strip()) > 30:
                    return jsonify({
                        "success": False,
                        "message": "Invalid donor contact."
                    }), 400

            if notes is not None and not isinstance(notes, str):
                return jsonify({
                    "success": False,
                    "message": "Notes must be text."
                }), 400

            amount = existing["amount"]
            item_description = existing["item_description"]
            quantity = existing["quantity"]
            unit = existing["unit"]

            if has_distributions and any(
                field in data
                for field in ["amount", "quantity", "item_description", "unit"]
            ):
                return jsonify({
                    "success": False,
                    "message": "Donation value or quantity cannot be changed after distribution."
                }), 409

            if donation_type == "cash" and "amount" in data:

                try:
                    amount = Decimal(str(data["amount"]))

                    if not amount.is_finite() or amount <= 0:
                        raise ValueError()

                except (ValueError, TypeError, InvalidOperation):
                    return jsonify({
                        "success": False,
                        "message": "Invalid donation amount."
                    }), 400

            if donation_type == "items":

                if "quantity" in data:

                    try:
                        quantity = Decimal(str(data["quantity"]))

                        if not quantity.is_finite() or quantity <= 0:
                            raise ValueError()

                    except (ValueError, TypeError, InvalidOperation):
                        return jsonify({
                            "success": False,
                            "message": "Invalid item quantity."
                        }), 400

                if "item_description" in data:
                    item_description = data["item_description"]

                    if not isinstance(item_description, str) or not item_description.strip():
                        return jsonify({
                            "success": False,
                            "message": "Item description is required."
                        }), 400

                if "unit" in data:
                    unit = data["unit"]

                    if not isinstance(unit, str) or not unit.strip() or len(unit.strip()) > 30:
                        return jsonify({
                            "success": False,
                            "message": "Invalid unit."
                        }), 400

            cursor.execute("""
                UPDATE donations
                SET
                    location_id = %s,
                    donor_name = %s,
                    donor_contact = %s,
                    amount = %s,
                    item_description = %s,
                    quantity = %s,
                    unit = %s,
                    notes = %s
                WHERE donation_id = %s
            """, (
                location_id,
                donor_name.strip() if donor_name else None,
                donor_contact.strip() if donor_contact else None,
                amount,
                item_description,
                quantity,
                unit,
                notes,
                donation_id
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Donation updated successfully!",
            "donation_id": donation_id
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update donation")

        return jsonify({
            "success": False,
            "message": "Unable to update donation."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - VERIFY OR REJECT DONATION
# -----------------------------------

@donation_bp.route(
    "/donations/<int:donation_id>/status",
    methods=["PUT"]
)
def update_donation_status(donation_id):

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Provide a status."
            }), 400

        new_status = data.get("donation_status")

        if new_status not in ["verified", "rejected"]:
            return jsonify({
                "success": False,
                "message": "Only verified or rejected status can be selected here."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT donation_status
                FROM donations
                WHERE donation_id = %s
                FOR UPDATE
            """, (donation_id,))

            donation = cursor.fetchone()

            if not donation:
                return jsonify({
                    "success": False,
                    "message": "Donation not found."
                }), 404

            if donation["donation_status"] != "pending":
                return jsonify({
                    "success": False,
                    "message": "Only pending donations can be verified or rejected."
                }), 400

            cursor.execute("""
                UPDATE donations
                SET donation_status = %s
                WHERE donation_id = %s
            """, (new_status, donation_id))

        connection.commit()

        return jsonify({
            "success": True,
            "message": f"Donation {new_status} successfully!",
            "donation_id": donation_id,
            "donation_status": new_status
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update donation status")

        return jsonify({
            "success": False,
            "message": "Unable to update donation status."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# DELETE - REMOVE DONATION
# -----------------------------------

@donation_bp.route(
    "/donations/<int:donation_id>",
    methods=["DELETE"]
)
def delete_donation(donation_id):

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT donation_id FROM donations WHERE donation_id = %s",
                (donation_id,)
            )

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Donation not found."
                }), 404

            cursor.execute(
                "DELETE FROM donations WHERE donation_id = %s",
                (donation_id,)
            )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Donation deleted successfully!",
            "deleted_donation_id": donation_id
        })

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "This donation has distribution records and cannot be deleted."
        }), 409

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not delete donation")

        return jsonify({
            "success": False,
            "message": "Unable to delete donation."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# GET - VIEW DONATION DISTRIBUTIONS
# -----------------------------------

@donation_bp.route(
    "/donation-distributions",
    methods=["GET"]
)
def get_donation_distributions():

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    dd.distribution_id,
                    dd.donation_id,
                    d.donation_type,
                    d.donor_name,
                    dd.disaster_id,
                    ds.disaster_type,
                    dd.location_id,
                    l.location_name,
                    dd.amount_allocated,
                    dd.quantity_allocated,
                    d.unit,
                    dd.distributed_at,
                    dd.distribution_notes
                FROM donation_distributions AS dd
                JOIN donations AS d
                    ON dd.donation_id = d.donation_id
                LEFT JOIN disasters AS ds
                    ON dd.disaster_id = ds.disaster_id
                JOIN locations AS l
                    ON dd.location_id = l.location_id
                ORDER BY dd.distributed_at DESC
            """)

            distributions = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(distributions),
            "data": distributions
        })

    except Exception:
        import logging
        logging.exception("Could not retrieve donation distributions")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve distributions."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - DISTRIBUTE A DONATION
# -----------------------------------

@donation_bp.route(
    "/donation-distributions",
    methods=["POST"]
)
def add_donation_distribution():

    access_error = manager_access_error()
    if access_error:
        return access_error

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Provide valid JSON data."
            }), 400

        try:
            donation_id = int(data["donation_id"])
            location_id = int(data["location_id"])

            disaster_id = data.get("disaster_id")

            if disaster_id in (None, ""):
                disaster_id = None
            else:
                disaster_id = int(disaster_id)

            if donation_id <= 0 or location_id <= 0:
                raise ValueError()

            if disaster_id is not None and disaster_id <= 0:
                raise ValueError()

        except (ValueError, TypeError, KeyError):
            return jsonify({
                "success": False,
                "message": "Invalid donation, location or disaster ID."
            }), 400

        notes = data.get("distribution_notes")

        if notes is not None and not isinstance(notes, str):
            return jsonify({
                "success": False,
                "message": "Distribution notes must be text."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    donation_type,
                    amount,
                    quantity,
                    donation_status
                FROM donations
                WHERE donation_id = %s
                FOR UPDATE
            """, (donation_id,))

            donation = cursor.fetchone()

            if not donation:
                return jsonify({
                    "success": False,
                    "message": "Donation not found."
                }), 404

            if donation["donation_status"] not in [
                "verified",
                "partially_distributed"
            ]:
                return jsonify({
                    "success": False,
                    "message": "Only verified donations can be distributed."
                }), 400

            if not check_location(cursor, location_id):
                return jsonify({
                    "success": False,
                    "message": "Distribution location does not exist."
                }), 400

            if disaster_id is not None:
                cursor.execute(
                    "SELECT disaster_id FROM disasters WHERE disaster_id = %s",
                    (disaster_id,)
                )

                if not cursor.fetchone():
                    return jsonify({
                        "success": False,
                        "message": "Selected disaster does not exist."
                    }), 400

            amount_allocated = Decimal("0.00")
            quantity_allocated = Decimal("0.00")

            if donation["donation_type"] == "cash":

                try:
                    amount_allocated = Decimal(
                        str(data.get("amount_allocated"))
                    )

                    if not amount_allocated.is_finite() or amount_allocated <= 0:
                        raise ValueError()

                except (ValueError, TypeError, InvalidOperation):
                    return jsonify({
                        "success": False,
                        "message": "Enter a valid distribution amount."
                    }), 400

                cursor.execute("""
                    SELECT COALESCE(SUM(amount_allocated), 0) AS used_amount
                    FROM donation_distributions
                    WHERE donation_id = %s
                """, (donation_id,))

                used = Decimal(str(cursor.fetchone()["used_amount"]))
                total = Decimal(str(donation["amount"] or 0))

                if used + amount_allocated > total:
                    return jsonify({
                        "success": False,
                        "message": "Distribution amount exceeds the remaining cash donation."
                    }), 400

                fully_distributed = (used + amount_allocated) == total

            else:

                try:
                    quantity_allocated = Decimal(
                        str(data.get("quantity_allocated"))
                    )

                    if not quantity_allocated.is_finite() or quantity_allocated <= 0:
                        raise ValueError()

                except (ValueError, TypeError, InvalidOperation):
                    return jsonify({
                        "success": False,
                        "message": "Enter a valid distribution quantity."
                    }), 400

                cursor.execute("""
                    SELECT COALESCE(SUM(quantity_allocated), 0) AS used_quantity
                    FROM donation_distributions
                    WHERE donation_id = %s
                """, (donation_id,))

                used = Decimal(str(cursor.fetchone()["used_quantity"]))
                total = Decimal(str(donation["quantity"] or 0))

                if used + quantity_allocated > total:
                    return jsonify({
                        "success": False,
                        "message": "Distribution quantity exceeds the remaining donated items."
                    }), 400

                fully_distributed = (used + quantity_allocated) == total

            cursor.execute("""
                INSERT INTO donation_distributions (
                    donation_id,
                    disaster_id,
                    location_id,
                    amount_allocated,
                    quantity_allocated,
                    distributed_by,
                    distribution_notes
                )
                VALUES (%s, %s, %s, %s, %s, NULL, %s)
            """, (
                donation_id,
                disaster_id,
                location_id,
                amount_allocated,
                quantity_allocated,
                notes
            ))

            new_id = cursor.lastrowid

            new_status = (
                "distributed"
                if fully_distributed
                else "partially_distributed"
            )

            cursor.execute("""
                UPDATE donations
                SET donation_status = %s
                WHERE donation_id = %s
            """, (new_status, donation_id))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Donation distributed successfully!",
            "distribution_id": new_id,
            "donation_status": new_status
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not distribute donation")

        return jsonify({
            "success": False,
            "message": "Unable to distribute donation."
        }), 500

    finally:
        if connection:
            connection.close()
