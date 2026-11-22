import logging

from flask import Blueprint, jsonify, session

from config.db import get_db_connection


volunteer_dashboard_bp = Blueprint(
    "volunteer_dashboard",
    __name__
)


@volunteer_dashboard_bp.route(
    "/volunteer/my-dashboard",
    methods=["GET"]
)
def get_my_volunteer_dashboard():

    # Only volunteers can access their personal dashboard.
    if not session.get("user_id"):

        return jsonify({
            "success": False,
            "message": "Please log in first."
        }), 401

    role = str(
        session.get("role", "")
    ).strip().lower()

    if role != "volunteer":

        return jsonify({
            "success": False,
            "message": "This dashboard is available only to volunteers."
        }), 403


    user_id = session.get("user_id")

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            # Find the volunteer profile linked to this login.
            # Prefer user_id; use email only for older, unlinked profiles.
            cursor.execute("""
                SELECT
                    v.volunteer_id,
                    v.user_id,
                    v.full_name,
                    v.email,
                    v.phone,
                    v.skills,
                    v.location_id,
                    v.availability,
                    v.registered_at,

                    l.location_name,
                    l.district,
                    l.state,
                    l.country

                FROM volunteers AS v

                INNER JOIN users AS u
                    ON u.user_id = %s

                LEFT JOIN locations AS l
                    ON l.location_id = v.location_id

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
                    END,

                    v.registered_at DESC

                LIMIT 1
            """, (user_id, user_id, user_id))

            volunteer = cursor.fetchone()


            # The volunteer account may exist without a profile.
            if not volunteer:

                return jsonify({
                    "success": True,
                    "profile": None,
                    "assignments": [],
                    "stats": {
                        "total_assignments": 0,
                        "active_assignments": 0,
                        "completed_assignments": 0,
                        "cancelled_assignments": 0
                    },
                    "message": (
                        "Your volunteer profile is not linked to this "
                        "login account. Please contact your coordinator."
                    )
                }), 200


            # Retrieve only this volunteer's assignments.
            cursor.execute("""
                SELECT
                    a.assignment_id,
                    a.volunteer_id,
                    a.disaster_id,
                    a.assigned_role,
                    a.assignment_status,
                    a.assigned_at,
                    a.notes,

                    d.disaster_type,
                    d.severity,
                    d.status AS disaster_status,
                    d.description AS disaster_description,
                    d.incident_date,

                    l.location_name,
                    l.district,
                    l.state,

                    u.full_name AS assigned_by_name

                FROM volunteer_assignments AS a

                INNER JOIN disasters AS d
                    ON d.disaster_id = a.disaster_id

                LEFT JOIN locations AS l
                    ON l.location_id = d.location_id

                LEFT JOIN users AS u
                    ON u.user_id = a.assigned_by

                WHERE a.volunteer_id = %s

                ORDER BY a.assigned_at DESC
            """, (volunteer["volunteer_id"],))

            assignments = cursor.fetchall()


        # Calculate statistics from this volunteer's own records.
        total = len(assignments)

        active = sum(
            1 for item in assignments
            if item["assignment_status"] in {
                "assigned",
                "in_progress"
            }
        )

        completed = sum(
            1 for item in assignments
            if item["assignment_status"] == "completed"
        )

        cancelled = sum(
            1 for item in assignments
            if item["assignment_status"] == "cancelled"
        )


        return jsonify({
            "success": True,

            "profile": volunteer,

            "assignments": assignments,

            "stats": {
                "total_assignments": total,
                "active_assignments": active,
                "completed_assignments": completed,
                "cancelled_assignments": cancelled
            }

        }), 200


    except Exception:

        logging.exception(
            "Could not load volunteer dashboard"
        )

        return jsonify({
            "success": False,
            "message": "Unable to load your volunteer dashboard."
        }), 500

    finally:

        if connection:
            connection.close()