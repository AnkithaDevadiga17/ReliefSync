
import json
import urllib.request
import urllib.error
import http.cookiejar
from getpass import getpass


BASE_URL = "http://127.0.0.1:5000/api"

# Store cookies between requests, just like a browser
cookie_jar = http.cookiejar.CookieJar()

opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar)
)


def send_request(endpoint, method="GET", data=None):

    url = BASE_URL + endpoint

    body = None
    headers = {}

    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method
    )

    try:
        with opener.open(request) as response:
            return response.status, json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as error:
        response_body = error.read().decode("utf-8")

        try:
            result = json.loads(response_body)
        except json.JSONDecodeError:
            result = {"message": response_body}

        return error.code, result


def main():

    print("\n===== RELIEFSYNC AUTHENTICATION TEST =====\n")

    email = input("Admin email: ").strip()
    password = getpass("Admin password: ")

    # TEST 1: LOGIN
    print("\n1. Testing Login...")

    status, result = send_request(
        "/login",
        "POST",
        {
            "email": email,
            "password": password
        }
    )

    print("Status:", status)
    print("Response:", result)

    if status != 200:
        print("\nLogin failed. Stopping tests.")
        return

    print("LOGIN: SUCCESS")

    # TEST 2: SESSION
    print("\n2. Testing Session...")

    status, result = send_request("/session")

    print("Status:", status)
    print("Response:", result)

    if status == 200 and result.get("logged_in"):
        print("SESSION: SUCCESS")
    else:
        print("SESSION: FAILED")
        return

    # TEST 3: LOGOUT
    print("\n3. Testing Logout...")

    status, result = send_request("/logout", "POST")

    print("Status:", status)
    print("Response:", result)

    if status == 200:
        print("LOGOUT: SUCCESS")
    else:
        print("LOGOUT: FAILED")
        return

    # TEST 4: SESSION AFTER LOGOUT
    print("\n4. Testing Session After Logout...")

    status, result = send_request("/session")

    print("Status:", status)
    print("Response:", result)

    if status == 401:
        print("SESSION INVALIDATION: SUCCESS")
    else:
        print("SESSION INVALIDATION: FAILED")

    print("\n===== TESTING COMPLETED =====")


if __name__ == "__main__":
    main()

