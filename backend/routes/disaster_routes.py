
from datetime import date

import pymysql
from flask import Blueprint, jsonify, request

from config.db import get_db_connection


# -----------------------------------
# CREATE DISASTER BLUEPRINT
# -----------------------------------

disaster_bp = Blueprint(
    "disasters",
    __name__
)


# -----------------------------------
# 1. GET API - VIEW ALL DISASTERS
# -----------------------------------

@disaster_bp.route("/disasters", methods=["GET"])
def get_disasters():

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            # JOIN disasters and locations tables
            cursor.execute("""
                SELECT
                    d.disaster_id,
                    d.location_id,
                    l.location_name,
                    d.disaster_type,
                    d.severity,
                    d.status,
                    d.description,
                    d.incident_date,
                    d.latitude,
                    d.longitude
                FROM disasters AS d
                LEFT JOIN locations AS l
                    ON d.location_id = l.location_id
                ORDER BY d.reported_at DESC
            """)

            disasters = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(disasters),
            "data": disasters
        })

    except Exception:

        # Print detailed error in Flask terminal
        import logging
        logging.exception("Could not retrieve disasters")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve disaster records."
        }), 500

    finally:

        if connection:
            connection.close()


# -----------------------------------
# 2. POST API - ADD A NEW DISASTER
# -----------------------------------

@disaster_bp.route("/disasters", methods=["POST"])
def add_disaster():

    connection = None

    try:

        # Receive JSON data
        data = request.get_json(silent=True)

        if not isinstance(data, dict):

            return jsonify({
                "success": False,
                "message": "Please provide valid JSON data."
            }), 400

        # Check required fields
        required_fields = [
            "location_id",
            "disaster_type",
            "severity"
        ]

        missing_fields = [
            field for field in required_fields
            if field not in data or data[field] is None
        ]

        if missing_fields:

            return jsonify({
                "success": False,
                "message": "Missing required fields.",
                "missing_fields": missing_fields
            }), 400

        # Validate location ID
        try:

            location_id = int(data["location_id"])

            if location_id <= 0:
                raise ValueError()

        except (ValueError, TypeError):

            return jsonify({
                "success": False,
                "message": "Invalid location ID."
            }), 400

        # Validate disaster type
        disaster_type = str(data["disaster_type"]).strip()

        if not disaster_type or len(disaster_type) > 60:

            return jsonify({
                "success": False,
                "message": "Disaster type must be between 1 and 60 characters."
            }), 400

        # Validate severity
        severity = str(data["severity"]).lower()

        allowed_severities = [
            "low",
            "medium",
            "high",
            "critical"
        ]

        if severity not in allowed_severities:

            return jsonify({
                "success": False,
                "message": "Invalid severity value."
            }), 400

        # Validate status
        status = str(data.get("status") or "reported").lower()

        allowed_statuses = [
            "reported",
            "active",
            "monitoring",
            "resolved",
            "closed"
        ]

        if status not in allowed_statuses:

            return jsonify({
                "success": False,
                "message": "Invalid disaster status."
            }), 400

        # Validate incident date
        incident_date = data.get("incident_date")

        if incident_date:

            try:
                incident_date = date.fromisoformat(
                    str(incident_date)
                )

            except ValueError:

                return jsonify({
                    "success": False,
                    "message": "Incident date must use YYYY-MM-DD format."
                }), 400

        # Validate coordinates
        try:

            latitude = (
                float(data["latitude"])
                if data.get("latitude") is not None
                else None
            )

            longitude = (
                float(data["longitude"])
                if data.get("longitude") is not None
                else None
            )

        except (ValueError, TypeError):

            return jsonify({
                "success": False,
                "message": "Coordinates must be valid numbers."
            }), 400

        if latitude is not None and not -90 <= latitude <= 90:

            return jsonify({
                "success": False,
                "message": "Invalid latitude."
            }), 400

        if longitude is not None and not -180 <= longitude <= 180:

            return jsonify({
                "success": False,
                "message": "Invalid longitude."
            }), 400

        # Validate description
        description = data.get("description")

        if description is not None and not isinstance(description, str):

            return jsonify({
                "success": False,
                "message": "Description must be text."
            }), 400

        # Connect to MySQL
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # Insert disaster into database
            cursor.execute("""
                INSERT INTO disasters (
                    location_id,
                    reported_by,
                    disaster_type,
                    severity,
                    status,
                    description,
                    incident_date,
                    latitude,
                    longitude
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                location_id,
                None,
                disaster_type,
                severity,
                status,
                description,
                incident_date,
                latitude,
                longitude
            ))

            new_disaster_id = cursor.lastrowid

        # Save changes
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Disaster added successfully!",
            "disaster_id": new_disaster_id
        }), 201

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Invalid location ID. Please select an existing location."
        }), 400

    except Exception:

        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not add disaster")

        return jsonify({
            "success": False,
            "message": "Unable to add disaster."
        }), 500

    finally:

        if connection:
            connection.close()


# -----------------------------------
# 3. PUT API - UPDATE A DISASTER
# -----------------------------------

@disaster_bp.route(
    "/disasters/<int:disaster_id>",
    methods=["PUT"]
)
def update_disaster(disaster_id):

    connection = None

    try:

        data = request.get_json(silent=True)

        if not isinstance(data, dict):

            return jsonify({
                "success": False,
                "message": "Please provide valid JSON data."
            }), 400

        connection = get_db_connection()

        with connection.cursor() as cursor:

            # Check whether disaster exists
            cursor.execute(
                "SELECT disaster_id FROM disasters WHERE disaster_id = %s",
                (disaster_id,)
            )

            existing = cursor.fetchone()

            if not existing:

                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404

            updates = []
            values = []

            # Update severity
            if "severity" in data:

                severity = str(data["severity"]).lower()

                allowed_severities = [
                    "low",
                    "medium",
                    "high",
                    "critical"
                ]

                if severity not in allowed_severities:

                    return jsonify({
                        "success": False,
                        "message": "Invalid severity value."
                    }), 400

                updates.append("severity = %s")
                values.append(severity)

            # Update status
            if "status" in data:

                status = str(data["status"]).lower()

                allowed_statuses = [
                    "reported",
                    "active",
                    "monitoring",
                    "resolved",
                    "closed"
                ]

                if status not in allowed_statuses:

                    return jsonify({
                        "success": False,
                        "message": "Invalid disaster status."
                    }), 400

                updates.append("status = %s")
                values.append(status)

            # Update description
            if "description" in data:

                description = data["description"]

                if description is not None and not isinstance(description, str):

                    return jsonify({
                        "success": False,
                        "message": "Description must be text or null."
                    }), 400

                updates.append("description = %s")
                values.append(description)

            if not updates:

                return jsonify({
                    "success": False,
                    "message": "No update fields provided."
                }), 400

            # Execute UPDATE query
            sql = (
                "UPDATE disasters SET "
                + ", ".join(updates)
                + " WHERE disaster_id = %s"
            )

            values.append(disaster_id)

            cursor.execute(sql, tuple(values))

            # Retrieve updated record
            cursor.execute("""
                SELECT
                    disaster_id,
                    location_id,
                    disaster_type,
                    severity,
                    status,
                    description,
                    incident_date
                FROM disasters
                WHERE disaster_id = %s
            """, (disaster_id,))

            updated_disaster = cursor.fetchone()

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Disaster updated successfully!",
            "data": updated_disaster
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not update disaster")

        return jsonify({
            "success": False,
            "message": "Unable to update disaster."
        }), 500

    finally:

        if connection:
            connection.close()


# -----------------------------------
# 4. DELETE API - REMOVE A DISASTER
# -----------------------------------

@disaster_bp.route(
    "/disasters/<int:disaster_id>",
    methods=["DELETE"]
)
def delete_disaster(disaster_id):

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            # Check whether disaster exists
            cursor.execute(
                "SELECT disaster_id FROM disasters WHERE disaster_id = %s",
                (disaster_id,)
            )

            existing = cursor.fetchone()

            if not existing:

                return jsonify({
                    "success": False,
                    "message": "Disaster not found."
                }), 404

            # Delete disaster
            cursor.execute(
                "DELETE FROM disasters WHERE disaster_id = %s",
                (disaster_id,)
            )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Disaster deleted successfully!",
            "deleted_disaster_id": disaster_id
        }), 200

    except pymysql.err.IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Cannot delete this disaster because related records exist."
        }), 409

    except Exception:

        if connection:
            connection.rollback()

        import logging
        logging.exception("Could not delete disaster")

        return jsonify({
            "success": False,
            "message": "Unable to delete disaster."
        }), 500

    finally:

        if connection:
            connection.close()
