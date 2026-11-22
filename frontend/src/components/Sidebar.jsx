
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const { user, logout } = useAuth();

  const role = user?.role?.toLowerCase();

  const menuItems = [
    { name: "Home", path: "/" },
    { name: "Dashboard", path: "/dashboard" },

    { name: "Disaster Management", path: "/disasters" },
    { name: "Shelter Management", path: "/shelters" },
    { name: "Resource Management", path: "/resources" },

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
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <aside className="sidebar">
      <h2>ReliefSync</h2>
      <p>Disaster Response Platform</p>

      <hr />

      <nav>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <p>{user?.full_name}</p>
        <p>{role?.toUpperCase()}</p>

        <NavLink to="/profile">My Profile</NavLink>

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
