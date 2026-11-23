from flask import request, session, jsonify, g, current_app
from config.db import get_db_connection


ALL_ROLES = {"admin", "coordinator", "ngo", "volunteer"}
OPERATORS = {"admin", "coordinator", "ngo"}
MANAGERS = {"admin", "coordinator"}
RESOURCE_MANAGERS = {"admin", "coordinator", "ngo"}
VOLUNTEERS = {"volunteer"}

READ_ALL = {
    "/api/disasters",
    "/api/shelters",
    "/api/resources",
    "/api/locations",
}

READ_OPERATORS = {
    "/api/allocations",
    "/api/volunteers",
    "/api/volunteer-locations",
    "/api/volunteer-assignments",
    "/api/donations",
    "/api/donation-locations",
    "/api/donation-distributions",
    "/api/analytics/summary",
    "/api/risk-predictions",
}

READ_VOLUNTEER = {"/api/volunteer/my-dashboard"}
ADMIN_ONLY = {"/api/users", "/api/db-test"}

# Public APIs are deliberately limited to read-only public information,
# public donor lookup, public donation submission, and session logout.
PUBLIC_ENDPOINTS = {
    ("/api/public/disasters", "GET"),
    ("/api/public/locations", "GET"),
    ("/api/public/donors/lookup", "GET"),
    ("/api/public/donations", "POST"),
    ("/api/logout", "POST"),
}


def path_matches(path, prefix):
    return path == prefix or path.startswith(prefix + "/")


def allowed_roles(path, method):
    if path == "/api/session":
        return ALL_ROLES

    if path in ADMIN_ONLY or path.startswith("/api/users/"):
        return {"admin"}

    if method == "GET":
        if path in READ_ALL:
            return ALL_ROLES
        if path in READ_VOLUNTEER:
            return VOLUNTEERS
        if path in READ_OPERATORS:
            return OPERATORS

    if path_matches(path, "/api/disasters"):
        return MANAGERS
    if path_matches(path, "/api/locations"):
        return MANAGERS
    if path_matches(path, "/api/shelters"):
        return RESOURCE_MANAGERS
    if path_matches(path, "/api/resources"):
        return RESOURCE_MANAGERS
    if path_matches(path, "/api/allocations"):
        return RESOURCE_MANAGERS
    if path_matches(path, "/api/volunteers"):
        return MANAGERS
    if path_matches(path, "/api/volunteer-locations"):
        return OPERATORS
    if path_matches(path, "/api/volunteer-assignments"):
        return MANAGERS
    if path_matches(path, "/api/donations"):
        if path.endswith("/status"):
            return MANAGERS
        return RESOURCE_MANAGERS
    if path_matches(path, "/api/donation-locations"):
        return OPERATORS
    if path_matches(path, "/api/donation-distributions"):
        return RESOURCE_MANAGERS
    if path_matches(path, "/api/analytics"):
        return OPERATORS
    if path_matches(path, "/api/risk-predictions"):
        return OPERATORS

    return set()


def register_security(app):
    @app.before_request
    def enforce_api_security():
        if not request.path.startswith("/api/"):
            return None

        if request.method == "OPTIONS":
            return None

        if request.path == "/api/health":
            return None

        # Login and registration must be available before authentication.
        if request.endpoint in {"auth.login", "auth.register"}:
            return None

        # Public endpoints are checked by exact path AND method. In
        # particular, logout must be allowed to clear an expired session.
        if (request.path, request.method) in PUBLIC_ENDPOINTS:
            return None

        user_id = session.get("user_id")
        if not user_id:
            return jsonify({
                "success": False,
                "message": "Authentication required.",
            }), 401

        connection = None
        user = None

        try:
            connection = get_db_connection()
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, full_name, email, role, is_active
                    FROM users
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
                user = cursor.fetchone()
        except Exception:
            current_app.logger.exception("Could not verify API session.")
            return jsonify({
                "success": False,
                "message": "Unable to verify your account.",
            }), 503
        finally:
            if connection:
                connection.close()

        if not user or not user["is_active"]:
            session.clear()
            return jsonify({
                "success": False,
                "message": (
                    "Your session is no longer valid. Please log in again."
                ),
            }), 401

        role = str(user["role"]).strip().lower()
        session["role"] = role
        g.current_user = user

        permitted_roles = allowed_roles(request.path, request.method)
        if role not in permitted_roles:
            return jsonify({
                "success": False,
                "message": "You do not have permission to perform this action.",
            }), 403

        return None


def require_roles(*roles):
    permitted = {role.lower() for role in roles}

    def decorator(function):
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user:
                return jsonify({
                    "success": False,
                    "message": "Authentication required.",
                }), 401

            current_role = str(user["role"]).strip().lower()
            if current_role not in permitted:
                return jsonify({
                    "success": False,
                    "message": "You do not have permission.",
                }), 403

            return function(*args, **kwargs)

        wrapper.__name__ = function.__name__
        return wrapper

    return decorator
