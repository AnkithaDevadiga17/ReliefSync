
from decimal import Decimal

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

from config.db import get_db_connection

from routes.disaster_routes import disaster_bp
from routes.shelter_routes import shelter_bp
from routes.resource_routes import resource_bp
from routes.allocation_routes import allocation_bp
from routes.volunteer_routes import volunteer_bp
from routes.donation_routes import donation_bp
from routes.analytics_routes import analytics_bp


# Convert MySQL DECIMAL values into JSON numbers
class ReliefJSONProvider(DefaultJSONProvider):

    @staticmethod
    def default(value):
        if isinstance(value, Decimal):
            return float(value)

        return DefaultJSONProvider.default(value)


app = Flask(__name__)
app.json = ReliefJSONProvider(app)

CORS(app, resources={
    r"/api/*": {"origins": "http://localhost:5173"}
})


# REGISTER ALL MODULES
app.register_blueprint(disaster_bp, url_prefix="/api")
app.register_blueprint(shelter_bp, url_prefix="/api")
app.register_blueprint(resource_bp, url_prefix="/api")
app.register_blueprint(allocation_bp, url_prefix="/api")
app.register_blueprint(volunteer_bp, url_prefix="/api")
app.register_blueprint(donation_bp, url_prefix="/api")
app.register_blueprint(analytics_bp, url_prefix="/api")


# HOME
@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "success": True,
        "message": "Welcome to ReliefSync Backend!",
        "available_apis": [
            "/api/health",
            "/api/db-test",
            "/api/disasters",
            "/api/shelters",
            "/api/locations",
            "/api/resources",
            "/api/allocations",
            "/api/volunteers",
            "/api/volunteer-locations",
            "/api/volunteer-assignments",
            "/api/donations",
            "/api/donation-locations",
            "/api/donation-distributions",
            "/api/analytics/summary",
            "/api/risk-predictions"
        ]
    })


# HEALTH CHECK
@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "message": "ReliefSync backend is running!"
    })


# DATABASE TEST
@app.route("/api/db-test", methods=["GET"])
def db_test():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("SELECT DATABASE() AS database_name")
            result = cursor.fetchone()

        return jsonify({
            "success": True,
            "message": "Database connected successfully!",
            "database": result["database_name"]
        })

    except Exception:
        app.logger.exception("Database connection test failed")

        return jsonify({
            "success": False,
            "message": "Database connection failed."
        }), 500

    finally:
        if connection:
            connection.close()


if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )
