import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const role = user?.role?.toLowerCase();
  const menuItems = [
    ["Home", "/"], ["Operations dashboard", "/dashboard"],
    ["Locations", "/locations"], ["Disasters", "/disasters"],
    ["Shelters", "/shelters"], ["Resources", "/resources"],
    ...(role === "admin" || role === "coordinator" || role === "ngo" ? [["Resource allocation", "/allocations"]] : []),
    ...(role === "admin" || role === "coordinator" ? [["Volunteer management", "/volunteers"]] : []),
    ...(role !== "volunteer" ? [["Donations", "/donations"]] : []),
    ["Analytics", "/analytics"], ...(role === "admin" ? [["User management", "/users"]] : []),
  ];

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); }
    catch (error) { console.error("Logout request failed:", error); }
    finally { navigate("/", { replace: true }); }
  }

  return <>
    <header className="rs-topbar">
      <div className="rs-topbar-brand"><button className="rs-menu-toggle" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span /><span /><span /></button><NavLink to="/" className="rs-brand-wordmark">Relief<span>Sync</span></NavLink><small>DISASTER RESPONSE PLATFORM</small></div>
      <div className="rs-profile-wrap"><button className="rs-profile-trigger" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}><span className="rs-avatar">{(user?.full_name || "U").charAt(0).toUpperCase()}</span><span className="rs-profile-name">{user?.full_name || "Account"}<small>{role?.toUpperCase()}</small></span><span className="rs-chevron">⌄</span></button>
        {profileOpen && <div className="rs-profile-menu"><NavLink to="/profile" onClick={() => setProfileOpen(false)}>My profile</NavLink><button type="button" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</button></div>}
      </div>
    </header>
    {menuOpen && <><button className="rs-drawer-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /><aside className="rs-drawer"><div className="rs-drawer-heading"><strong>Workspace</strong><button type="button" onClick={() => setMenuOpen(false)} aria-label="Close">×</button></div><nav>{menuItems.map(([label, path]) => <NavLink key={path} to={path} end={path === "/"} onClick={() => setMenuOpen(false)}>{label}<span>›</span></NavLink>)}</nav><div className="rs-drawer-foot">Signed in as <strong>{user?.full_name}</strong><small>{role?.toUpperCase()}</small></div></aside></>}
  </>;
}
