import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  loginUser,
  getCurrentSession,
  logoutUser,
} from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the login session once when the application starts.
  useEffect(() => {
    let isMounted = true;

    async function checkUserSession() {
      try {
        const data = await getCurrentSession();

        if (isMounted && data.success && data.logged_in) {
          setUser(data.user);
        } else if (isMounted) {
          setUser(null);
        }
      } catch (error) {
        if (error.status !== 401) {
          console.error("Session check failed:", error);
        }
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkUserSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(email, password) {
    const data = await loginUser(email, password);

    if (!data.success || !data.user) {
      throw new Error(data.message || "Login failed.");
    }

    setUser(data.user);
    return data;
  }

  // The backend logout endpoint clears the Flask session cookie. Clear the
  // React user state in finally so the sidebar disappears even if the
  // request returns an error; the caller then redirects to the public home.
  async function logout() {
    try {
      return await logoutUser();
    } finally {
      setUser(null);
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
