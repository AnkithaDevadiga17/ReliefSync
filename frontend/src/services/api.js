
const API_BASE_URL = "http://localhost:5000/api";
const API_ORIGIN = "http://localhost:5000";

function normalizeApiUrl(url) {
  return String(url).replace(
    "http://127.0.0.1:5000",
    API_ORIGIN
  );
}

// Use this when you need the normal Fetch Response object.
export function apiFetch(url, options = {}) {
  return fetch(normalizeApiUrl(url), {
    ...options,
    credentials: "include"
  });
}

// Use this when you want parsed JSON and automatic error handling.
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await apiFetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
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
      data.message || "Something went wrong."
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
    body: JSON.stringify({ email, password })
  });
}

export function getCurrentSession() {
  return apiRequest("/session");
}

export function logoutUser() {
  return apiRequest("/logout", {
    method: "POST"
  });
}
