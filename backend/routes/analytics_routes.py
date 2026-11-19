
from flask import Blueprint, jsonify

from config.db import get_db_connection


analytics_bp = Blueprint("analytics", __name__)


# -----------------------------------
# GET - OVERALL DASHBOARD STATISTICS
# -----------------------------------

@analytics_bp.route("/analytics/summary", methods=["GET"])
def get_analytics_summary():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # DISASTER STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(status IN ('reported', 'active', 'monitoring')) AS active,
                    SUM(severity = 'critical') AS critical
                FROM disasters
            """)

            disasters = cursor.fetchone()


            # SHELTER STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(status = 'operational') AS operational,
                    COALESCE(SUM(capacity), 0) AS total_capacity,
                    COALESCE(SUM(occupied_count), 0) AS occupied,
                    COALESCE(SUM(capacity - occupied_count), 0) AS available
                FROM shelters
            """)

            shelters = cursor.fetchone()


            # RESOURCE STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(
                        quantity_available <= COALESCE(minimum_stock, 0)
                    ) AS low_stock,
                    SUM(quantity_available = 0) AS out_of_stock
                FROM resources
            """)

            resources = cursor.fetchone()


            # VOLUNTEER STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(availability = 'available') AS available,
                    SUM(availability = 'assigned') AS assigned
                FROM volunteers
            """)

            volunteers = cursor.fetchone()


            # DONATION STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(donation_status = 'pending') AS pending,
                    SUM(donation_status = 'verified') AS verified,
                    SUM(
                        donation_status IN (
                            'partially_distributed',
                            'distributed'
                        )
                    ) AS distributed
                FROM donations
            """)

            donations = cursor.fetchone()


            # RESOURCE ALLOCATION STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(allocation_status = 'pending') AS pending,
                    SUM(allocation_status = 'approved') AS approved,
                    SUM(allocation_status = 'dispatched') AS dispatched,
                    SUM(allocation_status = 'delivered') AS delivered
                FROM resource_allocations
            """)

            allocations = cursor.fetchone()


            # VOLUNTEER ASSIGNMENT STATISTICS
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(
                        assignment_status IN ('assigned', 'in_progress')
                    ) AS active,
                    SUM(assignment_status = 'completed') AS completed
                FROM volunteer_assignments
            """)

            assignments = cursor.fetchone()


            # RISK LEVEL SUMMARY
            cursor.execute("""
                SELECT
                    risk_level,
                    COUNT(*) AS total
                FROM risk_predictions
                GROUP BY risk_level
            """)

            risk_summary = cursor.fetchall()


        return jsonify({
            "success": True,
            "data": {
                "disasters": disasters,
                "shelters": shelters,
                "resources": resources,
                "volunteers": volunteers,
                "donations": donations,
                "allocations": allocations,
                "assignments": assignments,
                "risk_summary": risk_summary
            }
        })

    except Exception:
        import logging
        logging.exception("Could not retrieve analytics summary")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve analytics."
        }), 500

    finally:
        if connection:
            connection.close()


# -----------------------------------
# GET - RISK PREDICTION HISTORY
# -----------------------------------

@analytics_bp.route("/risk-predictions", methods=["GET"])
def get_risk_predictions():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT
                    p.prediction_id,
                    p.location_id,
                    l.location_name,
                    l.district,
                    p.disaster_id,
                    p.disaster_type,
                    p.risk_level,
                    p.risk_score,
                    p.model_version,
                    p.factors_summary,
                    p.predicted_at
                FROM risk_predictions AS p
                LEFT JOIN locations AS l
                    ON p.location_id = l.location_id
                ORDER BY p.predicted_at DESC
            """)

            predictions = cursor.fetchall()

        return jsonify({
            "success": True,
            "count": len(predictions),
            "data": predictions
        })

    except Exception:
        import logging
        logging.exception("Could not retrieve risk predictions")

        return jsonify({
            "success": False,
            "message": "Unable to retrieve risk predictions."
        }), 500

    finally:
        if connection:
            connection.close()
