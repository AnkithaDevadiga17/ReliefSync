import logging

import pymysql
from flask import Blueprint, jsonify, request, session

from config.db import get_db_connection


volunteer_bp = Blueprint("volunteers", __name__)

MANAGER_ROLES = {"admin", "coordinator"}
READ_ROLES = {"admin", "coordinator", "ngo"}

VOLUNTEER_AVAILABILITY = {
    "available",
    "assigned",
    "unavailable"
}

ACTIVE_ASSIGNMENT_STATUSES = {
    "assigned",
    "in_progress"
}

ASSIGNMENT_TRANSITIONS = {
    "assigned": ["in_progress", "completed", "cancelled"],
    "in_progress": ["completed", "cancelled"],
    "completed": [],
    "cancelled": []
}


# --------------------------------------------------
# ACCESS CHECKS
# --------------------------------------------------

def check_role(allowed_roles):

    user_id = session.get("user_id")

    role = str(
        session.get("role", "")
    ).strip().lower()

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first."
        }), 401

    if role not in allowed_roles:
        return jsonify({
            "success": False,
            "message": "You do not have permission to perform this action."
        }), 403

    return None


# --------------------------------------------------
# VALIDATE VOLUNTEER DATA
# --------------------------------------------------

def validate_volunteer(data, existing=None):

    if not isinstance(data, dict):
        return None, "Please provide valid volunteer details."

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

    # Every registered volunteer must belong to a location.
    try:

        if values["location_id"] in ("", None):
            return None, "Please select a volunteer location."

        values["location_id"] = int(values["location_id"])

        if values["location_id"] <= 0:
            raise ValueError

    except (ValueError, TypeError):

        return None, "Please select a valid location."


    # Name
    values["full_name"] = str(
        values["full_name"] or ""
    ).strip()

    if not values["full_name"] or len(values["full_name"]) > 120:

        return None, "Name is required and must be within 120 characters."


    # Phone
    values["phone"] = str(
        values["phone"] or ""
    ).strip()

    if not values["phone"] or len(values["phone"]) > 20:

        return None, "A valid phone number is required."


    # Email
    if values["email"] is not None:

        values["email"] = str(
            values["email"]
        ).strip().lower() or None

        if values["email"] and len(values["email"]) > 150:

            return None, "Email cannot exceed 150 characters."


    # Skills
    if values["skills"] is not None:

        values["skills"] = str(
            values["skills"]
        ).strip() or None


    # Availability
    values["availability"] = str(
        values["availability"] or ""
    ).strip().lower()

    if values["availability"] not in VOLUNTEER_AVAILABILITY:

        return None, "Invalid availability status."


    # Assignment status is controlled by assignment operations.
    if (
        "availability" in data
        and values["availability"] == "assigned"
    ):

        return None, (
            "Assigned status is managed automatically when "
            "a volunteer is assigned to a disaster."
        )

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
# LINK VOLUNTEER TO A MATCHING LOGIN ACCOUNT
# --------------------------------------------------

def find_linked_user(cursor, email, exclude_volunteer_id=None):

    if not email:
        return None, None

    cursor.execute("""
        SELECT user_id, role
        FROM users
        WHERE LOWER(email) = LOWER(%s)
        LIMIT 1
    """, (email,))

    account = cursor.fetchone()

    if not account:
        return None, None

    # Only link actual volunteer login accounts.
    if str(account["role"]).strip().lower() != "volunteer":
        return None, None

    user_id = account["user_id"]

    query = """
        SELECT volunteer_id
        FROM volunteers
        WHERE user_id = %s
    """

    parameters = [user_id]

    if exclude_volunteer_id is not None:

        query += " AND volunteer_id != %s"

        parameters.append(exclude_volunteer_id)

    query += " LIMIT 1"

    cursor.execute(query, tuple(parameters))

    existing_profile = cursor.fetchone()

    if existing_profile:

        return None, (
            "This volunteer login account is already linked "
            "to another volunteer profile."
        )

    return user_id, None


# --------------------------------------------------
# LOCATION-WISE VOLUNTEER SUMMARY
# --------------------------------------------------

def get_volunteer_location_summary(cursor, location_id=None):

    query = """
        SELECT
            l.location_id,
            l.location_name,
            l.district,
            l.state,

            COUNT(v.volunteer_id) AS total_volunteers,

            COALESCE(
                SUM(
                    CASE
                        WHEN v.availability = 'available'
                        THEN 1 ELSE 0
                    END
                ), 0
            ) AS available_volunteers,

            COALESCE(
                SUM(
                    CASE
                        WHEN v.availability = 'assigned'
                        THEN 1 ELSE 0
                    END
                ), 0
            ) AS assigned_volunteers,

            COALESCE(
                SUM(
                    CASE
                        WHEN v.availability = 'unavailable'
                        THEN 1 ELSE 0
                    END
                ), 0
            ) AS unavailable_volunteers

        FROM locations AS l

        LEFT JOIN volunteers AS v
            ON l.location_id = v.location_id
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
# GET VOLUNTEER LOCATIONS
# --------------------------------------------------

@volunteer_bp.route("/volunteer-locations", methods=["GET"])
def get_volunteer_locations():

    access_error = check_role(READ_ROLES)

    if access_error:
        return access_error

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    location_id,
                    location_name,
                    district,
                    state
                FROM locations
                ORDER BY location_name
            """)

            locations = cursor.fetchall()

        return jsonify({
            "success": True,
            "data": locations
        }), 200

    except Exception:

        logging.exception("Could not fetch volunteer locations")

        return jsonify({
            "success": False,
            "message": "Unable to fetch volunteer locations."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# GET VOLUNTEERS
# Admin: All locations or selected location
# Coordinator: Must select a monitoring location
# --------------------------------------------------

@volunteer_bp.route("/volunteers", methods=["GET"])
def get_volunteers():

    access_error = check_role(READ_ROLES)

    if access_error:
        return access_error

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

    if role == "coordinator" and selected_location_id is None:

        return jsonify({
            "success": True,
            "count": 0,
            "data": [],
            "location_summary": [],
            "requires_location_selection": True
        }), 200

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if selected_location_id is not None:

                if not location_exists(cursor, selected_location_id):

                    return jsonify({
                        "success": False,
                        "message": "Selected location does not exist."
                    }), 404


            query = """
                SELECT
                    v.volunteer_id,
                    v.user_id,
                    v.location_id,
                    l.location_name,
                    l.district,
                    l.state,
                    v.full_name,
                    v.email,
                    v.phone,
                    v.skills,
                    v.availability,
                    v.registered_at

                FROM volunteers AS v

                LEFT JOIN locations AS l
                    ON v.location_id = l.location_id
            """

            parameters = []

            if selected_location_id is not None:

                query += " WHERE v.location_id = %s"

                parameters.append(selected_location_id)

            query += " ORDER BY v.registered_at DESC"

            cursor.execute(query, tuple(parameters))

            volunteers = cursor.fetchall()


            # Admin gets an overview of every registered location.
            if role in {"admin", "ngo"} and selected_location_id is None:

                location_summary = get_volunteer_location_summary(cursor)

            elif selected_location_id is not None:

                location_summary = get_volunteer_location_summary(
                    cursor,
                    selected_location_id
                )

            else:

                location_summary = []


        return jsonify({
            "success": True,
            "count": len(volunteers),
            "data": volunteers,
            "location_summary": location_summary,
            "selected_location_id": selected_location_id
        }), 200

    except Exception:

        logging.exception("Could not retrieve volunteers")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve volunteers."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# ADD VOLUNTEER
# --------------------------------------------------

@volunteer_bp.route("/volunteers", methods=["POST"])
def add_volunteer():

    access_error = check_role(MANAGER_ROLES)

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Please provide valid JSON."
        }), 400

    required = [
        "location_id",
        "full_name",
        "phone"
    ]

    missing = [
        field
        for field in required
        if field not in data or data[field] in (None, "")
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

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if not location_exists(cursor, values["location_id"]):

                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 404


            user_id, link_error = find_linked_user(
                cursor,
                values["email"]
            )

            if link_error:

                return jsonify({
                    "success": False,
                    "message": link_error
                }), 409


            cursor.execute("""
                INSERT INTO volunteers (
                    user_id,
                    location_id,
                    full_name,
                    email,
                    phone,
                    skills,
                    availability
                )

                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
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
            "message": "Volunteer registered successfully.",
            "volunteer_id": new_id,
            "linked_user_account": user_id is not None
        }), 201

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": (
                "This volunteer may already be linked to another "
                "profile or the submitted details are invalid."
            )
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not add volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to register volunteer."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# UPDATE VOLUNTEER
# --------------------------------------------------

@volunteer_bp.route(
    "/volunteers/<int:volunteer_id>",
    methods=["PUT"]
)
def update_volunteer(volunteer_id):

    access_error = check_role(MANAGER_ROLES)

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:

        return jsonify({
            "success": False,
            "message": "Provide volunteer update details."
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    user_id,
                    location_id,
                    full_name,
                    email,
                    phone,
                    skills,
                    availability

                FROM volunteers

                WHERE volunteer_id = %s

                FOR UPDATE
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


            if not location_exists(cursor, values["location_id"]):

                return jsonify({
                    "success": False,
                    "message": "Selected location does not exist."
                }), 404


            # Do not move a volunteer while they have active assignments.
            if int(existing["location_id"]) != values["location_id"]:

                cursor.execute("""
                    SELECT COUNT(*) AS active_count
                    FROM volunteer_assignments
                    WHERE volunteer_id = %s
                      AND assignment_status IN ('assigned', 'in_progress')
                """, (volunteer_id,))

                active = cursor.fetchone()

                if active["active_count"] > 0:

                    return jsonify({
                        "success": False,
                        "message": (
                            "This volunteer has active disaster assignments. "
                            "Complete or cancel them before changing the location."
                        )
                    }), 409


            user_id, link_error = find_linked_user(
                cursor,
                values["email"],
                exclude_volunteer_id=volunteer_id
            )

            if link_error:

                return jsonify({
                    "success": False,
                    "message": link_error
                }), 409


            cursor.execute("""
                UPDATE volunteers

                SET
                    user_id = %s,
                    location_id = %s,
                    full_name = %s,
                    email = %s,
                    phone = %s,
                    skills = %s,
                    availability = %s

                WHERE volunteer_id = %s
            """, (
                user_id,
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
            "message": "Volunteer updated successfully.",
            "volunteer_id": volunteer_id,
            "linked_user_account": user_id is not None
        }), 200

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid volunteer details or duplicate account link."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not update volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to update volunteer."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# DELETE VOLUNTEER
# --------------------------------------------------

@volunteer_bp.route(
    "/volunteers/<int:volunteer_id>",
    methods=["DELETE"]
)
def delete_volunteer(volunteer_id):

    access_error = check_role(MANAGER_ROLES)

    if access_error:
        return access_error

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT volunteer_id
                FROM volunteers
                WHERE volunteer_id = %s
                FOR UPDATE
            """, (volunteer_id,))

            if not cursor.fetchone():

                return jsonify({
                    "success": False,
                    "message": "Volunteer not found."
                }), 404


            cursor.execute("""
                SELECT COUNT(*) AS active_count
                FROM volunteer_assignments
                WHERE volunteer_id = %s
                  AND assignment_status IN ('assigned', 'in_progress')
            """, (volunteer_id,))

            active = cursor.fetchone()

            if active["active_count"] > 0:

                return jsonify({
                    "success": False,
                    "message": (
                        "This volunteer has active assignments. "
                        "Complete or cancel them before deleting the profile."
                    )
                }), 409


            # Historical assignment rows are protected by the foreign key.
            cursor.execute("""
                DELETE FROM volunteers
                WHERE volunteer_id = %s
            """, (volunteer_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Volunteer deleted successfully.",
            "deleted_volunteer_id": volunteer_id
        }), 200

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": (
                "This volunteer has assignment history and cannot be deleted. "
                "Keep the profile for historical records."
            )
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not delete volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to delete volunteer."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# GET VOLUNTEER ASSIGNMENTS
# --------------------------------------------------

@volunteer_bp.route("/volunteer-assignments", methods=["GET"])
def get_assignments():

    access_error = check_role(READ_ROLES)

    if access_error:
        return access_error

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

    if role == "coordinator" and selected_location_id is None:

        return jsonify({
            "success": True,
            "count": 0,
            "data": [],
            "requires_location_selection": True
        }), 200

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            if selected_location_id is not None:

                if not location_exists(cursor, selected_location_id):

                    return jsonify({
                        "success": False,
                        "message": "Selected location does not exist."
                    }), 404


            query = """
                SELECT
                    a.assignment_id,
                    a.volunteer_id,
                    v.full_name,
                    v.location_id AS volunteer_location_id,

                    a.disaster_id,
                    d.disaster_type,
                    d.severity,
                    d.status AS disaster_status,

                    d.location_id AS disaster_location_id,
                    l.location_name,
                    l.district,
                    l.state,

                    a.assigned_role,
                    a.assignment_status,
                    a.assigned_by,
                    u.full_name AS assigned_by_name,
                    a.assigned_at,
                    a.notes

                FROM volunteer_assignments AS a

                INNER JOIN volunteers AS v
                    ON a.volunteer_id = v.volunteer_id

                INNER JOIN disasters AS d
                    ON a.disaster_id = d.disaster_id

                LEFT JOIN locations AS l
                    ON d.location_id = l.location_id

                LEFT JOIN users AS u
                    ON a.assigned_by = u.user_id
            """

            parameters = []

            if selected_location_id is not None:

                query += " WHERE d.location_id = %s"

                parameters.append(selected_location_id)

            query += " ORDER BY a.assigned_at DESC"

            cursor.execute(query, tuple(parameters))

            assignments = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(assignments),
            "data": assignments,
            "selected_location_id": selected_location_id
        }), 200

    except Exception:

        logging.exception("Could not retrieve volunteer assignments")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve volunteer assignments."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# ASSIGN VOLUNTEER TO A DISASTER
# --------------------------------------------------

@volunteer_bp.route(
    "/volunteer-assignments",
    methods=["POST"]
)
def add_assignment():

    access_error = check_role(MANAGER_ROLES)

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Please provide valid JSON."
        }), 400

    required = [
        "volunteer_id",
        "disaster_id",
        "assigned_role"
    ]

    missing = [
        field
        for field in required
        if field not in data or data[field] in (None, "")
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

        if volunteer_id <= 0 or disaster_id <= 0:
            raise ValueError

    except (ValueError, TypeError):

        return jsonify({
            "success": False,
            "message": "Invalid volunteer or disaster ID."
        }), 400


    assigned_role = str(
        data["assigned_role"]
    ).strip()

    if not assigned_role or len(assigned_role) > 100:

        return jsonify({
            "success": False,
            "message": "Assignment role is required and cannot exceed 100 characters."
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

            # Lock volunteer to prevent simultaneous assignment.
            cursor.execute("""
                SELECT
                    volunteer_id,
                    location_id,
                    availability
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


            if volunteer["location_id"] is None:

                return jsonify({
                    "success": False,
                    "message": (
                        "This volunteer has no registered location. "
                        "Assign a location before creating a disaster assignment."
                    )
                }), 400


            if volunteer["availability"] != "available":

                return jsonify({
                    "success": False,
                    "message": "Volunteer is not currently available."
                }), 409


            # Get disaster location and status.
            cursor.execute("""
                SELECT
                    disaster_id,
                    location_id,
                    disaster_type,
                    status
                FROM disasters
                WHERE disaster_id = %s
            """, (disaster_id,))

            disaster = cursor.fetchone()

            if not disaster:

                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404


            if disaster["status"] in {"resolved", "closed"}:

                return jsonify({
                    "success": False,
                    "message": (
                        "Volunteers cannot be assigned to a "
                        "resolved or closed disaster."
                    )
                }), 400


            # CRITICAL LOCATION VALIDATION.
            if int(volunteer["location_id"]) != int(disaster["location_id"]):

                return jsonify({
                    "success": False,
                    "message": (
                        "Volunteer and disaster must belong to the same "
                        "location. Select a volunteer registered in the "
                        "affected disaster area."
                    )
                }), 400


            # Prevent duplicate active assignment records.
            cursor.execute("""
                SELECT assignment_id
                FROM volunteer_assignments
                WHERE volunteer_id = %s
                  AND disaster_id = %s
                  AND assignment_status IN ('assigned', 'in_progress')
                LIMIT 1
            """, (volunteer_id, disaster_id))

            if cursor.fetchone():

                return jsonify({
                    "success": False,
                    "message": "This volunteer already has an active assignment for this disaster."
                }), 409


            cursor.execute("""
                INSERT INTO volunteer_assignments (
                    volunteer_id,
                    disaster_id,
                    assigned_role,
                    assignment_status,
                    assigned_by,
                    notes
                )

                VALUES (%s, %s, %s, 'assigned', %s, %s)
            """, (
                volunteer_id,
                disaster_id,
                assigned_role,
                session.get("user_id"),
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
            "message": "Volunteer assigned successfully.",
            "assignment_id": new_id,
            "assignment_status": "assigned"
        }), 201

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid volunteer or disaster assignment details."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not assign volunteer")

        return jsonify({
            "success": False,
            "message": "Unable to create volunteer assignment."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# UPDATE ASSIGNMENT STATUS
# --------------------------------------------------

@volunteer_bp.route(
    "/volunteer-assignments/<int:assignment_id>",
    methods=["PUT"]
)
def update_assignment(assignment_id):

    access_error = check_role(MANAGER_ROLES)

    if access_error:
        return access_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Provide valid update data."
        }), 400

    new_status = data.get("assignment_status")

    allowed_statuses = {
        "assigned",
        "in_progress",
        "completed",
        "cancelled"
    }

    if new_status not in allowed_statuses:

        return jsonify({
            "success": False,
            "message": "Invalid assignment status."
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    assignment_id,
                    volunteer_id,
                    assignment_status

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

            allowed_next = ASSIGNMENT_TRANSITIONS[old_status]

            if (
                new_status != old_status
                and new_status not in allowed_next
            ):

                return jsonify({
                    "success": False,
                    "message": (
                        f"Cannot change assignment from "
                        f"{old_status} to {new_status}."
                    )
                }), 400


            cursor.execute("""
                UPDATE volunteer_assignments
                SET assignment_status = %s
                WHERE assignment_id = %s
            """, (new_status, assignment_id))


            # Release volunteer when no active assignments remain.
            if new_status in {"completed", "cancelled"}:

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
            "message": "Assignment status updated successfully.",
            "assignment_id": assignment_id,
            "assignment_status": new_status
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        logging.exception("Could not update assignment")

        return jsonify({
            "success": False,
            "message": "Unable to update assignment."
        }), 500

    finally:

        if connection:
            connection.close()