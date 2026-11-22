from getpass import getpass
from werkzeug.security import generate_password_hash
from config.db import get_db_connection

email = input("Enter admin email: ").strip().lower()
password = getpass("Enter new password: ")
confirm = getpass("Confirm new password: ")

if len(password) < 8:
    print("Password must contain at least 8 characters.")

elif password != confirm:
    print("Passwords do not match.")

else:
    connection = get_db_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE users
                SET password_hash = %s
                WHERE email = %s AND role = 'admin'
                """,
                (generate_password_hash(password), email)
            )

            if cursor.rowcount == 1:
                connection.commit()
                print("Admin password reset successfully!")
            else:
                connection.rollback()
                print("Admin account not found or not updated.")

    finally:
        connection.close()