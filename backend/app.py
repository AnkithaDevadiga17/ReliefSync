from decimal import Decimal
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")


from config.db import get_db_connection

from security import register_security

from routes.disaster_routes import disaster_bp
from routes.shelter_routes import shelter_bp
from routes.resource_routes import resource_bp
from routes.allocation_routes import allocation_bp
from routes.volunteer_routes import volunteer_bp
from routes.volunteer_dashboard_routes import volunteer_dashboard_bp
from routes.donation_routes import donation_bp
from routes.analytics_routes import analytics_bp
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.location_routes import location_bp
from routes.public_routes import public_bp


class ReliefJSONProvider(DefaultJSONProvider):

    @staticmethod
    def default(value):

        if isinstance(value, Decimal):
            return float(value)

        return DefaultJSONProvider.default(value)


app = Flask(__name__)

app.json = ReliefJSONProvider(app)


app_env = os.getenv(
    "APP_ENV",
    "development"
).strip().lower()

secret_key = os.getenv("SECRET_KEY", "")


if len(secret_key) < 32:

    raise RuntimeError(
        "SECRET_KEY must be configured and contain at least 32 characters."
    )


if secret_key == "reliefsync-dev-secret-change-before-deployment":

    raise RuntimeError(
        "The default development secret is not allowed."
    )


if app_env == "production" and not os.getenv("FRONTEND_ORIGINS"):

    raise RuntimeError(
        "FRONTEND_ORIGINS must be configured in production."
    )


app.secret_key = secret_key


app.config.update(

    SESSION_COOKIE_HTTPONLY=True,

    SESSION_COOKIE_SECURE=(
        app_env == "production"
    ),

    SESSION_COOKIE_SAMESITE="Lax",

    PERMANENT_SESSION_LIFETIME=timedelta(days=7),

    SESSION_REFRESH_EACH_REQUEST=False,

    MAX_CONTENT_LENGTH=6 * 1024 * 1024,

    JSON_SORT_KEYS=False

)


frontend_origins = [

    origin.strip().rstrip("/")

    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173"
    ).split(",")

    if origin.strip()

]


CORS(
    app,
    resources={
        r"/api/*": {
            "origins": frontend_origins
        }
    },
    supports_credentials=True,
    allow_headers=[
        "Content-Type",
        "X-CSRF-Token"
    ],
    methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ]
)


register_security(app)


@app.after_request
def add_security_headers(response):

    response.headers["X-Content-Type-Options"] = "nosniff"

    response.headers["X-Frame-Options"] = "DENY"

    response.headers["Referrer-Policy"] = (
        "strict-origin-when-cross-origin"
    )

    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )

    if request_is_api(response):

        response.headers["Cache-Control"] = "no-store"

    return response


def request_is_api(response):

    return response.content_type.startswith(
        "application/json"
    )


# --------------------------------------------------
# REGISTER ALL MODULES
# --------------------------------------------------

app.register_blueprint(
    disaster_bp,
    url_prefix="/api"
)

app.register_blueprint(
    shelter_bp,
    url_prefix="/api"
)

app.register_blueprint(
    resource_bp,
    url_prefix="/api"
)

app.register_blueprint(
    allocation_bp,
    url_prefix="/api"
)

app.register_blueprint(
    volunteer_bp,
    url_prefix="/api"
)

# Personal volunteer dashboard
app.register_blueprint(
    volunteer_dashboard_bp,
    url_prefix="/api"
)

app.register_blueprint(
    donation_bp,
    url_prefix="/api"
)

app.register_blueprint(
    analytics_bp,
    url_prefix="/api"
)

app.register_blueprint(
    auth_bp,
    url_prefix="/api"
)

app.register_blueprint(
    user_bp,
    url_prefix="/api"
)

app.register_blueprint(
    location_bp,
    url_prefix="/api"
)

app.register_blueprint(
    public_bp,
    url_prefix="/api"
)


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "success": True,
        "message": "Welcome to ReliefSync Backend!"
    })


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "message": "ReliefSync backend is running!"
    })


# --------------------------------------------------
# DATABASE TEST
# --------------------------------------------------

@app.route("/api/db-test", methods=["GET"])
def db_test():

    connection = None

    try:

        connection = get_db_connection()

        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT DATABASE() AS database_name"
            )

            result = cursor.fetchone()

        return jsonify({
            "success": True,
            "message": "Database connected successfully!",
            "database": result["database_name"]
        })

    except Exception:

        app.logger.exception(
            "Database connection test failed."
        )

        return jsonify({
            "success": False,
            "message": "Database connection failed."
        }), 500

    finally:

        if connection:
            connection.close()


# --------------------------------------------------
# RUN APPLICATION
# --------------------------------------------------

if __name__ == "__main__":

    # Debug and reloader deliberately disabled.
    app.run(
        debug=False,
        use_reloader=False,
        host="127.0.0.1",
        port=5000
    )