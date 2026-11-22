
import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import {
  loginUser,
  getCurrentSession,
  logoutUser
} from "../services/api";


const AuthContext = createContext(null);


export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


  // Check existing login session when application loads
  useEffect(() => {

    async function checkUserSession() {

      try {
        const data = await getCurrentSession();

        if (data.success && data.logged_in) {
          setUser(data.user);
        }

      } catch (error) {
        if (error.status !== 401) {
          console.error("Session check failed:", error);
        }

        setUser(null);

      } finally {
        setLoading(false);
      }
    }

    checkUserSession();

  }, []);


  // Login function
  async function login(email, password) {

    const data = await loginUser(email, password);

    setUser(data.user);

    return data;
  }


  // Logout function
  async function logout() {

    await logoutUser();

    setUser(null);
  }


  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout
  };


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


// Custom hook
export function useAuth() {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
