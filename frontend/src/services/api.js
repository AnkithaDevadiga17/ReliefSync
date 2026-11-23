
const API_BASE_URL = "http://localhost:5000/api";

// Send requests to the Flask backend and preserve login sessions.
export async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: "include",
  });
}

// Common API request function.
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await apiFetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    const error = new Error(
      data.message || `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export function loginUser(email, password) {
  return apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentSession() {
  return apiRequest("/session");
}

export function logoutUser() {
  return apiRequest("/logout", {
    method: "POST",
  });
}
