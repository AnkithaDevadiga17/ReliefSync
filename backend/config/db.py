
import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()


def get_db_connection():
    required = ["DB_HOST", "DB_USER", "DB_NAME"]

    missing = [
        key for key in required
        if not os.getenv(key, "").strip()
    ]

    if missing:
        raise RuntimeError(
            "Missing database configuration: " + ", ".join(missing)
        )

    db_host = os.getenv("DB_HOST", "").strip()
    db_user = os.getenv("DB_USER", "").strip()
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "").strip()

    try:
        db_port = int(os.getenv("DB_PORT", "3306"))
    except ValueError as exc:
        raise RuntimeError("DB_PORT must be a valid number.") from exc

    if not 1 <= db_port <= 65535:
        raise RuntimeError("DB_PORT is outside the valid range.")

    # Root with an empty password is permitted only for local development.
    if APP_ENV == "production":
        if db_user.lower() == "root" or not db_password:
            raise RuntimeError(
                "Production requires a dedicated database user "
                "with a non-empty password."
            )

    return pymysql.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=5,
        read_timeout=10,
        write_timeout=10,
        autocommit=False
    )
