import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const role = user?.role?.toLowerCase();

  const menuItems = [
    { name: "Home", path: "/" },
    { name: "Dashboard", path: "/dashboard" },
    { name: "Location Management", path: "/locations" },
    { name: "Disaster Management", path: "/disasters" },
    { name: "Shelter Management", path: "/shelters" },
    { name: "Resource Management", path: "/resources" },
    ...(role === "admin" || role === "coordinator" || role === "ngo"
      ? [{ name: "Resource Allocation", path: "/allocations" }]
      : []),
    ...(role === "admin" || role === "coordinator"
      ? [{ name: "Volunteer Management", path: "/volunteers" }]
      : []),
    ...(role !== "volunteer"
      ? [{ name: "Donation Management", path: "/donations" }]
      : []),
    { name: "Analytics & Forecasting", path: "/analytics" },
    ...(role === "admin"
      ? [{ name: "User Management", path: "/users" }]
      : []),
  ];

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      console.error("Logout request failed:", error);
      window.alert(
        "The server did not confirm logout. The application will return to the public homepage; please sign in again if your session is still active."
      );
    } finally {
      // A full navigation avoids a race between clearing React auth state
      // and Protected routes redirecting to /login. The root route is the
      // public homepage for signed-out visitors.
      window.location.replace("/");
    }
  }

  return (
    <aside className="sidebar">
      <h2>ReliefSync</h2>
      <p>Disaster Response Platform</p>
      <hr />

      <nav>
        {menuItems.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === "/"}>
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <p>{user?.full_name}</p>
        <p>{role?.toUpperCase()}</p>
        <NavLink to="/profile">My Profile</NavLink>
        <button type="button" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
