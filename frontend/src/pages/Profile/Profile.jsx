import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { PageHeader, SectionCard } from "../../components/ModuleUI";
import "../../styles/Modules.css";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signOut() {
    try { await logout(); } finally { navigate("/", { replace: true }); }
  }
  async function changePassword(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    setBusy(true);
    try {
      const result = await apiRequest("/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      setMessage(result.message);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) { setError(err.message || "Could not change password."); }
    finally { setBusy(false); }
  }

  return <div className="module-page">
    <PageHeader title="My Profile" description="Your authenticated ReliefSync account information."/>
    <SectionCard title="Account information">
      <dl className="profile-details">
        <dt>Name</dt><dd>{user?.full_name || "—"}</dd>
        <dt>Email</dt><dd>{user?.email || "—"}</dd>
        <dt>Role</dt><dd>{user?.role || "—"}</dd>
        <dt>User ID</dt><dd>{user?.user_id || "—"}</dd>
      </dl>
      <p className="module-muted">Your role determines which ReliefSync management modules you can access.</p>
    </SectionCard>
    <SectionCard title="Change password">
      <form onSubmit={changePassword} style={{display:"grid",gap:12,maxWidth:420}}>
        <label>Current password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required autoComplete="current-password"/></label>
        <label>New password<input type="password" minLength="8" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required autoComplete="new-password"/></label>
        <label>Confirm new password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required autoComplete="new-password"/></label>
        {error && <p role="alert" style={{color:"#b42318"}}>{error}</p>}
        {message && <p role="status" style={{color:"#237347"}}>{message}</p>}
        <button type="submit" disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
      </form>
    </SectionCard>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:18}}>
      <Link to="/dashboard" className="module-button">Back to dashboard</Link>
      <button type="button" className="module-button" onClick={signOut}>Logout</button>
    </div>
  </div>;
}
