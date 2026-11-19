
from flask import Blueprint, jsonify, request
import pymysql

from config.db import get_db_connection


volunteer_bp = Blueprint("volunteers", __name__)


# -----------------------------------
# VALIDATE VOLUNTEER DATA
# -----------------------------------

def validate_volunteer(data, existing=None):

    values = {
        "location_id": None,
        "full_name": "",
        "email": None,
        "phone": "",
        "skills": None,
        "availability": "available"
    }

    if existing:
        values.update(existing)

    values.update({
        key: value
        for key, value in data.items()
        if key in values
    })

    try:
        if values["location_id"] in ("", None):
            values["location_id"] = None
        else:
            values["location_id"] = int(values["location_id"])

    except (ValueError, TypeError):
        return None, "Invalid location."

    values["full_name"] = str(values["full_name"]).strip()
    values["phone"] = str(values["phone"]).strip()

    if not values["full_name"] or len(values["full_name"]) > 120:
        return None, "Name is required and must be within 120 characters."

    if not values["phone"] or len(values["phone"]) > 20:
        return None, "Valid phone number is required."

    if values["email"] is not None:
        values["email"] = str(values["email"]).strip() or None

        if values["email"] and len(values["email"]) > 150:
            return None, "Email is too long."

    if values["skills"] is not None:
        values["skills"] = str(values["skills"]).strip() or None

    values["availability"] = str(values["availability"]).lower()

    allowed = ["available", "assigned", "unavailable"]

    if values["availability"] not in allowed:
        return None, "Invalid availability status."

    if values["location_id"] is not None and values["location_id"] <= 0:
        return None, "Invalid location."

    return values, None


# -----------------------------------
# GET - FETCH LOCATIONS
# -----------------------------------

@volunteer_bp.route("/volunteer-locations", methods=["GET"])
def get_volunteer_locations():

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
# GET - VIEW VOLUNTEERS
# -----------------------------------

@volunteer_bp.route("/volunteers", methods=["GET"])
def get_volunteers():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    v.volunteer_id,
                    v.user_id,
                    v.location_id,
                    l.location_name,
                    v.full_name,
                    v.email,
                    v.phone,
                    v.skills,
                    v.availability,
                    v.registered_at
                FROM volunteers AS v
                LEFT JOIN locations AS l
                    ON v.location_id = l.location_id
                ORDER BY v.registered_at DESC
            """)

            volunteers = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(volunteers),
            "data": volunteers
        })

    except Exception:
        import logging
        logging.exception("Could not fetch volunteers")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve volunteers."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - ADD VOLUNTEER
# -----------------------------------

@volunteer_bp.route("/volunteers", methods=["POST"])
def add_volunteer():

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Please provide valid JSON."
            }), 400

        required = ["full_name", "phone"]

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

        values, error = validate_volunteer(data)

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if values["location_id"] is not None:
                cursor.execute(
                    "SELECT location_id FROM locations WHERE location_id = %s",
                    (values["location_id"],)
                )

                if not cursor.fetchone():
                    return jsonify({
                        "success": False,
                        "message": "Selected location does not exist."
                    }), 400

            cursor.execute("""
                INSERT INTO volunteers (
                    location_id,
                    full_name,
                    email,
                    phone,
                    skills,
                    availability
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                values["location_id"],
                values["full_name"],
                values["email"],
                values["phone"],
                values["skills"],
                values["availability"]
            ))

            new_id = cursor.lastrowid

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Volunteer added successfully!",
            "volunteer_id": new_id
        }), 201

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid volunteer or location details."
        }), 400

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not add volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to add volunteer."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - UPDATE VOLUNTEER
# -----------------------------------

@volunteer_bp.route(
    "/volunteers/<int:volunteer_id>",
    methods=["PUT"]
)
def update_volunteer(volunteer_id):

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict) or not data:
            return jsonify({
                "success": False,
                "message": "Provide volunteer update details."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    location_id,
                    full_name,
                    email,
                    phone,
                    skills,
                    availability
                FROM volunteers
                WHERE volunteer_id = %s
            """, (volunteer_id,))

            existing = cursor.fetchone()

            if not existing:
                return jsonify({
                    "success": False,
                    "message": "Volunteer not found."
                }), 404

            values, error = validate_volunteer(data, existing)

            if error:
                return jsonify({
                    "success": False,
                    "message": error
                }), 400

            if values["location_id"] is not None:
                cursor.execute(
                    "SELECT location_id FROM locations WHERE location_id = %s",
                    (values["location_id"],)
                )

                if not cursor.fetchone():
                    return jsonify({
                        "success": False,
                        "message": "Selected location does not exist."
                    }), 400

            cursor.execute("""
                UPDATE volunteers
                SET
                    location_id = %s,
                    full_name = %s,
                    email = %s,
                    phone = %s,
                    skills = %s,
                    availability = %s
                WHERE volunteer_id = %s
            """, (
                values["location_id"],
                values["full_name"],
                values["email"],
                values["phone"],
                values["skills"],
                values["availability"],
                volunteer_id
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Volunteer updated successfully!",
            "volunteer_id": volunteer_id
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to update volunteer."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# DELETE - REMOVE VOLUNTEER
# -----------------------------------

@volunteer_bp.route(
    "/volunteers/<int:volunteer_id>",
    methods=["DELETE"]
)
def delete_volunteer(volunteer_id):

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT volunteer_id FROM volunteers WHERE volunteer_id = %s",
                (volunteer_id,)
            )

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Volunteer not found."
                }), 404

            cursor.execute(
                "DELETE FROM volunteers WHERE volunteer_id = %s",
                (volunteer_id,)
            )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Volunteer deleted successfully!",
            "deleted_volunteer_id": volunteer_id
        })

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "This volunteer has assignment records and cannot be deleted."
        }), 409

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not delete volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to delete volunteer."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# GET - VIEW VOLUNTEER ASSIGNMENTS
# -----------------------------------

@volunteer_bp.route("/volunteer-assignments", methods=["GET"])
def get_assignments():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    a.assignment_id,
                    a.volunteer_id,
                    v.full_name,
                    a.disaster_id,
                    d.disaster_type,
                    l.location_name,
                    a.assigned_role,
                    a.assignment_status,
                    a.assigned_at,
                    a.notes
                FROM volunteer_assignments AS a
                JOIN volunteers AS v
                    ON a.volunteer_id = v.volunteer_id
                JOIN disasters AS d
                    ON a.disaster_id = d.disaster_id
                LEFT JOIN locations AS l
                    ON d.location_id = l.location_id
                ORDER BY a.assigned_at DESC
            """)

            assignments = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(assignments),
            "data": assignments
        })

    except Exception:
        import logging
        logging.exception("Could not fetch assignments")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve assignments."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# POST - ASSIGN VOLUNTEER TO DISASTER
# -----------------------------------

@volunteer_bp.route("/volunteer-assignments", methods=["POST"])
def add_assignment():

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Please provide valid JSON."
            }), 400

        required = ["volunteer_id", "disaster_id", "assigned_role"]

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
            volunteer_id = int(data["volunteer_id"])
            disaster_id = int(data["disaster_id"])
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Invalid volunteer or disaster ID."
            }), 400

        assigned_role = str(data["assigned_role"]).strip()

        if not assigned_role:
            return jsonify({
                "success": False,
                "message": "Assignment role is required."
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
                SELECT volunteer_id, availability
                FROM volunteers
                WHERE volunteer_id = %s
                FOR UPDATE
            """, (volunteer_id,))

            volunteer = cursor.fetchone()

            if not volunteer:
                return jsonify({
                    "success": False,
                    "message": "Volunteer not found."
                }), 404

            if volunteer["availability"] != "available":
                return jsonify({
                    "success": False,
                    "message": "Volunteer is not currently available."
                }), 400

            cursor.execute("""
                SELECT disaster_id
                FROM disasters
                WHERE disaster_id = %s
            """, (disaster_id,))

            if not cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404

            cursor.execute("""
                INSERT INTO volunteer_assignments (
                    volunteer_id,
                    disaster_id,
                    assigned_role,
                    assignment_status,
                    assigned_by,
                    notes
                )
                VALUES (%s, %s, %s, 'assigned', NULL, %s)
            """, (
                volunteer_id,
                disaster_id,
                assigned_role,
                notes
            ))

            new_id = cursor.lastrowid

            cursor.execute("""
                UPDATE volunteers
                SET availability = 'assigned'
                WHERE volunteer_id = %s
            """, (volunteer_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Volunteer assigned successfully!",
            "assignment_id": new_id
        }), 201

    except pymysql.err.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid volunteer or disaster details."
        }), 400

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not assign volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to create volunteer assignment."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# PUT - UPDATE ASSIGNMENT STATUS
# -----------------------------------

@volunteer_bp.route(
    "/volunteer-assignments/<int:assignment_id>",
    methods=["PUT"]
)
def update_assignment(assignment_id):

    connection = None

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Provide valid update data."
            }), 400

        new_status = data.get("assignment_status")

        allowed_statuses = [
            "assigned",
            "in_progress",
            "completed",
            "cancelled"
        ]

        if new_status not in allowed_statuses:
            return jsonify({
                "success": False,
                "message": "Invalid assignment status."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT volunteer_id, assignment_status
                FROM volunteer_assignments
                WHERE assignment_id = %s
                FOR UPDATE
            """, (assignment_id,))

            assignment = cursor.fetchone()

            if not assignment:
                return jsonify({
                    "success": False,
                    "message": "Assignment not found."
                }), 404

            old_status = assignment["assignment_status"]

            allowed_transitions = {
                "assigned": ["in_progress", "completed", "cancelled"],
                "in_progress": ["completed", "cancelled"],
                "completed": [],
                "cancelled": []
            }

            if (
                new_status != old_status
                and new_status not in allowed_transitions[old_status]
            ):
                return jsonify({
                    "success": False,
                    "message": "Invalid assignment status change."
                }), 400

            cursor.execute("""
                UPDATE volunteer_assignments
                SET assignment_status = %s
                WHERE assignment_id = %s
            """, (new_status, assignment_id))

            if new_status in ("completed", "cancelled"):

                cursor.execute("""
                    SELECT COUNT(*) AS active_count
                    FROM volunteer_assignments
                    WHERE volunteer_id = %s
                    AND assignment_id != %s
                    AND assignment_status IN ('assigned', 'in_progress')
                """, (
                    assignment["volunteer_id"],
                    assignment_id
                ))

                active = cursor.fetchone()

                if active["active_count"] == 0:
                    cursor.execute("""
                        UPDATE volunteers
                        SET availability = 'available'
                        WHERE volunteer_id = %s
                    """, (assignment["volunteer_id"],))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Assignment status updated successfully!",
            "assignment_id": assignment_id,
            "assignment_status": new_status
        })

    except Exception:
        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update assignment")

        return jsonify({
            "success": False,
            "message": "Unable to update assignment."
        }), 500

    finally:
        if connection:
            connection.close()
