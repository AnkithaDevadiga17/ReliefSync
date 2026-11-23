import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, apiRequest } from "../../services/api";
import "./Donate.css";

const UPI_ID = import.meta.env.VITE_UPI_ID || "";
const UPI_NAME = import.meta.env.VITE_UPI_NAME || "ReliefSync";

export default function Donate() {
  const [params] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    donor_name: "", donor_email: "", donor_contact: "",
    location_id: params.get("location") || "", amount: "", transaction_reference: ""
  });
  const [proof, setProof] = useState(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest("/public/locations").then((r) => setLocations(r.data || [])).catch(() => setLocations([]));
  }, []);

  function update(e) {
    setForm((old) => ({ ...old, [e.target.name]: e.target.value }));
  }

  async function lookupDonor() {
    if (!form.donor_email && !form.donor_contact) return;
    setLookupMessage("Checking existing donor...");
    try {
      const qs = new URLSearchParams();
      if (form.donor_email) qs.set("email", form.donor_email.trim());
      if (form.donor_contact) qs.set("phone", form.donor_contact.trim());
      const result = await apiRequest(`/public/donors/lookup?${qs.toString()}`);
      if (result.found) {
        setForm((old) => ({ ...old, donor_name: result.donor.full_name, donor_email: result.donor.email, donor_contact: result.donor.phone }));
        setLookupMessage("Existing donor found. Your details have been filled in.");
      } else setLookupMessage("New donor. Please enter your name and contact details.");
    } catch (e) {
      setLookupMessage(e.message || "Could not check donor details.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(""); setMessage("");
    if (!UPI_ID) {
      setError("UPI QR is not configured yet. The project administrator must add VITE_UPI_ID to frontend/.env.");
      return;
    }
    if (!proof) {
      setError("Please attach your payment screenshot or PDF for coordinator verification.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest("/public/donations", {
        method: "POST",
        body: JSON.stringify({ ...form, payment_method: "upi" })
      });
      const data = new FormData();
      data.append("proof", proof);
      const upload = await apiFetch(`http://localhost:5000/api/public/donations/${result.donation_id}/proof`, { method: "POST", body: data });
      const uploadResult = await upload.json();
      if (!upload.ok) throw new Error(uploadResult.message || "Donation saved but proof upload failed.");
      setMessage(`Thank you! Donation #${result.donation_id} has been submitted and is pending verification.`);
      setForm({ donor_name: "", donor_email: "", donor_contact: "", location_id: "", amount: "", transaction_reference: "" });
      setProof(null);
      e.target.reset();
    } catch (err) {
      setError(err.message || "Could not submit donation.");
    } finally {
      setBusy(false);
    }
  }

  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&cu=INR`;
  const qrUrl = UPI_ID ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}` : "";

  return <div className="donate-page">
    <nav className="donate-nav"><Link to="/" className="public-brand">Relief<span>Sync</span></Link><Link to="/">← Back to homepage</Link></nav>
    <div className="donate-wrap">
      <div className="donate-intro"><span className="public-kicker">SUPPORT RELIEF OPERATIONS</span><h1>Make a donation</h1><p>Donate to a registered affected location. You do not need to create an account. Every submitted UPI donation is marked pending until the coordinator verifies the payment.</p></div>
      <form className="donate-form" onSubmit={submit}>
        <section className="donate-panel">
          <h2>1. Donor details</h2>
          <label>Email address<input type="email" name="donor_email" value={form.donor_email} onChange={update} onBlur={lookupDonor} required placeholder="you@example.com"/></label>
          <label>Mobile number<input name="donor_contact" value={form.donor_contact} onChange={update} onBlur={lookupDonor} required placeholder="Contact number"/></label>
          <button type="button" className="lookup-button" onClick={lookupDonor}>Find existing donor</button>
          {lookupMessage && <p className="lookup-message">{lookupMessage}</p>}
          <label>Full name<input name="donor_name" value={form.donor_name} onChange={update} required placeholder="Your name"/></label>
        </section>
        <section className="donate-panel">
          <h2>2. Donation details</h2>
          <label>Affected disaster location<select name="location_id" value={form.location_id} onChange={update} required><option value="">Select location</option>{locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name} – {l.district}, {l.state}</option>)}</select></label>
          <label>Donation amount (₹)<input type="number" name="amount" min="1" step="0.01" value={form.amount} onChange={update} required placeholder="Enter amount"/></label>
        </section>
        <section className="donate-panel payment-panel">
          <h2>3. Pay using UPI QR</h2>
          {UPI_ID ? <><img className="donate-qr" src={qrUrl} alt="UPI payment QR code"/><p><strong>UPI ID:</strong> {UPI_ID}</p><p>Scan using any UPI app and pay the amount entered above.</p></> : <p className="config-warning">UPI QR is awaiting organization payment details. Configure VITE_UPI_ID in frontend/.env before accepting donations.</p>}
          <label>UPI transaction/reference ID<input name="transaction_reference" value={form.transaction_reference} onChange={update} required placeholder="Enter UPI reference number"/></label>
          <label>Payment screenshot / PDF<input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={(e) => setProof(e.target.files?.[0] || null)} required/></label>
          <p className="payment-note">Do not upload bank passwords, OTPs or card details. A screenshot is supporting evidence only; payment is verified separately by the coordinator.</p>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="public-btn primary submit-donation" type="submit" disabled={busy || !UPI_ID}>{busy ? "Submitting..." : "Submit donation"}</button>
      </form>
    </div>
  </div>;
}
