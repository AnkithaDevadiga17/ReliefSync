import { NavLink } from "react-router-dom";

function Sidebar() {

  const menuItems = [
    { name: "Home", path: "/" },
    { name: "Dashboard", path: "/dashboard" },
    { name: "Disaster Management", path: "/disasters" },
    { name: "Shelter Management", path: "/shelters" },
    { name: "Resource Management", path: "/resources" },
    { name: "Volunteer Management", path: "/volunteers" },
    { name: "Donation Management", path: "/donations" },
    { name: "Analytics & Forecasting", path: "/analytics" }
  ];

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
        <NavLink to="/profile">Profile / Login</NavLink>
      </div>

    </aside>
  );
}

export default Sidebar;