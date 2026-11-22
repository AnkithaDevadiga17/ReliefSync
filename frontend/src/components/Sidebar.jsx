import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {

  const { user, logout } = useAuth();

  const role = user?.role?.toLowerCase();


  const menuItems = [

    { name: "Home", path: "/" },

    { name: "Dashboard", path: "/dashboard" },


    // Location Management
    { name: "Location Management", path: "/locations" },


    // Disaster Management
    { name: "Disaster Management", path: "/disasters" },


    // Shelter Management
    { name: "Shelter Management", path: "/shelters" },


    // Resource Management
    { name: "Resource Management", path: "/resources" },


    // Resource Allocation
    ...(role === "admin" ||
        role === "coordinator" ||
        role === "ngo"
      ? [
          {
            name: "Resource Allocation",
            path: "/allocations"
          }
        ]
      : []),


    // Volunteer Management
    ...(role === "admin" || role === "coordinator"
      ? [
          {
            name: "Volunteer Management",
            path: "/volunteers"
          }
        ]
      : []),


    // Donation Management
    ...(role !== "volunteer"
      ? [
          {
            name: "Donation Management",
            path: "/donations"
          }
        ]
      : []),


    // Analytics
    {
      name: "Analytics & Forecasting",
      path: "/analytics"
    },


    // User Management
    ...(role === "admin"
      ? [
          {
            name: "User Management",
            path: "/users"
          }
        ]
      : [])

  ];


  // LOGOUT
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


        <NavLink to="/profile">
          My Profile
        </NavLink>


        <button
          type="button"
          onClick={handleLogout}
        >
          Logout
        </button>

      </div>

    </aside>

  );

}

export default Sidebar;