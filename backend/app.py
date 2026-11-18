
from flask import Flask, jsonify
from flask_cors import CORS

from config.db import get_db_connection
from routes.disaster_routes import disaster_bp
from routes.shelter_routes import shelter_bp


app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {"origins": "http://localhost:5173"}
})


# Register module blueprints
app.register_blueprint(disaster_bp, url_prefix="/api")
app.register_blueprint(shelter_bp, url_prefix="/api")


# Home API
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
            "/api/locations"
        ]
    })


# Health API
@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "message": "ReliefSync backend is running!"
    })


# Database test API
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
