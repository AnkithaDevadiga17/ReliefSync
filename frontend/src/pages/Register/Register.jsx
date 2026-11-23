import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", location_id: "", skills: "", password: "", confirmPassword: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { apiRequest("/public/locations").then((r) => setLocations(r.data || [])).catch(() => setLocations([])); }, []);
  function change(e) { setForm((old) => ({ ...old, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setError(""); setSuccess("");
    if (form.password.length < 8) return setError("Password must contain at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (!acceptedTerms) return setError("Please accept the terms and conditions.");
    setSubmitting(true);
    try {
      const result = await apiRequest("/register", { method: "POST", body: JSON.stringify({
        full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        location_id: form.location_id || null, skills: form.skills.trim(), password: form.password
      }) });
      setSuccess(result.email_sent ? "Registration successful. A confirmation email has been sent." : "Registration successful. Email notifications are not configured; you can sign in now.");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) { setError(err.message || "Registration failed."); }
    finally { setSubmitting(false); }
  }

  return <main className="registration-page">
    <header><Link to="/" className="public-brand">Relief<span>Sync</span></Link><p>Join the community helping coordinate disaster relief.</p></header>
    <section><h2>Volunteer registration</h2><p>Create your volunteer account. Your profile will also be added to the ReliefSync volunteer database.</p>
      <form onSubmit={submit}>
        <label>Full name<input name="full_name" value={form.full_name} onChange={change} required autoComplete="name"/></label>
        <label>Email address<input type="email" name="email" value={form.email} onChange={change} required autoComplete="email"/></label>
        <label>Mobile number<input name="phone" value={form.phone} onChange={change} required minLength="7" maxLength="20" autoComplete="tel"/></label>
        <label>Nearest registered location<select name="location_id" value={form.location_id} onChange={change}><option value="">Select if available</option>{locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}, {l.district}</option>)}</select></label>
        <label>Skills / areas of interest<textarea name="skills" value={form.skills} onChange={change} rows="3" placeholder="First aid, logistics, rescue support..."/></label>
        <label>Password<input type="password" name="password" value={form.password} onChange={change} minLength="8" required autoComplete="new-password"/></label>
        <label>Confirm password<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} required autoComplete="new-password"/></label>
        <label className="terms-label"><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)}/> I agree to the terms and conditions.</label>
        {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
        <button type="submit" disabled={submitting}>{submitting ? "Registering..." : "Register as volunteer"}</button>
      </form>
      <p>Already registered? <Link to="/login">Sign in</Link></p><p><Link to="/">Return to homepage</Link></p>
    </section>
  </main>;
}
