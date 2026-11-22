
from getpass import getpass
from werkzeug.security import generate_password_hash
from config.db import get_db_connection


def create_admin():
    print("\n=== ReliefSync Admin Account Setup ===\n")

    full_name = input("Enter admin name: ").strip()
    email = input("Enter admin email: ").strip().lower()
    password = getpass("Enter admin password: ")
    confirm_password = getpass("Confirm admin password: ")

    if not full_name or not email or not password:
        print("All fields are required.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    if len(password) < 8:
        print("Password must contain at least 8 characters.")
        return

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM users WHERE email = %s",
                (email,)
            )

            if cursor.fetchone():
                print("An account with this email already exists.")
                return

            password_hash = generate_password_hash(password)

            cursor.execute(
                """
                INSERT INTO users
                (full_name, email, password_hash, role, is_active)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (full_name, email, password_hash, "admin", 1)
            )

        connection.commit()
        print("\nAdmin account created successfully!")

    except Exception as error:
        print("Error creating admin account:", error)

    finally:
        if connection:
            connection.close()


if __name__ == "__main__":
    create_admin()
