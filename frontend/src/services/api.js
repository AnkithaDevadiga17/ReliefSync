
const API_BASE_URL = "http://localhost:5000/api";

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

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
