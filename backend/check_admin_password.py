from getpass import getpass
from werkzeug.security import check_password_hash
from config.db import get_db_connection

email = input("Admin email: ").strip().lower()
password = getpass("Admin password: ")

connection = get_db_connection()

try:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT password_hash FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()

    if user:
        result = check_password_hash(
            user["password_hash"], password
        )
        print("Password verification:", result)
    else:
        print("Admin account not found.")

finally:
    connection.close()