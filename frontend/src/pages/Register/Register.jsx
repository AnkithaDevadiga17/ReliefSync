
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      setError("Please accept the terms and conditions.");
      return;
    }

    setSubmitting(true);

    try {
      const data = await apiRequest("/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      setSuccess(data.message || "Account created successfully.");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="registration-page">
      <header>
        <h1>ReliefSync</h1>
        <p>Disaster Response and Resource Coordination Platform</p>
      </header>

      <section aria-labelledby="register-heading">
        <h2 id="register-heading">Create Your Account</h2>

        <p>
          Join ReliefSync to participate in disaster response
          and humanitarian assistance activities.
        </p>

        <p>
          <strong>Account type:</strong> Volunteer
        </p>

        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Personal Information</legend>

            <p>
              <label htmlFor="full_name">Full Name</label>
              <br />
              <input
                id="full_name"
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </p>

            <p>
              <label htmlFor="email">Email Address</label>
              <br />
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                autoComplete="email"
                required
              />
            </p>
          </fieldset>

          <br />

          <fieldset>
            <legend>Account Security</legend>

            <p>
              <label htmlFor="password">Password</label>
              <br />
              <input
                id="password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <br />
              <small>Password must contain at least 8 characters.</small>
            </p>

            <p>
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>
              <br />
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
              />
            </p>
          </fieldset>

          <p>
            <label>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              {" "}I agree to the terms and conditions.
            </label>
          </p>

          {error && (
            <p role="alert">
              <strong>{error}</strong>
            </p>
          )}

          {success && (
            <p role="status">
              <strong>{success}</strong>
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <hr />

        <p>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>

        <p>
          <small>
            Registration is currently available for volunteers.
            Other account roles require administrator approval.
          </small>
        </p>
      </section>

      <footer>
        <p>
          <small>© 2026 ReliefSync. All rights reserved.</small>
        </p>
      </footer>
    </main>
  );
}

export default Register;
