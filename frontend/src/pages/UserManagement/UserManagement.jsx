
import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "coordinator",
  });

  async function fetchUsers() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    setSubmitting(true);

    try {
      const data = await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setMessage(data.message);
      setForm({
        full_name: "",
        email: "",
        password: "",
        role: "coordinator",
      });

      setShowForm(false);
      await fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(user) {
    setError("");
    setMessage("");

    try {
      const data = await apiRequest(
        `/users/${user.user_id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_active: !Boolean(user.is_active),
          }),
        }
      );

      setMessage(data.message);
      await fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to update user status.");
    }
  }

  const activeUsers = users.filter(
    (user) => Boolean(user.is_active)
  ).length;

  const coordinators = users.filter(
    (user) => user.role === "coordinator"
  ).length;

  const ngos = users.filter(
    (user) => user.role === "ngo"
  ).length;

  return (
    <div className="module-page">
      <header>
        <h1>User Management</h1>
        <p>
          Manage ReliefSync accounts, roles and user access.
        </p>
      </header>

      {error && <p role="alert"><strong>{error}</strong></p>}
      {message && <p role="status">{message}</p>}

      <section>
        <h2>User Overview</h2>

        <div className="stat-grid">
          <article>
            <h3>Total Users</h3>
            <p>{users.length}</p>
          </article>

          <article>
            <h3>Active Users</h3>
            <p>{activeUsers}</p>
          </article>

          <article>
            <h3>Coordinators</h3>
            <p>{coordinators}</p>
          </article>

          <article>
            <h3>NGOs</h3>
            <p>{ngos}</p>
          </article>
        </div>
      </section>

      <section>
        <h2>Manage Accounts</h2>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ Add New User"}
        </button>

        {showForm && (
          <form onSubmit={handleCreateUser}>
            <h3>Create Account</h3>

            <p>
              <label htmlFor="full_name">Full Name</label>
              <br />
              <input
                id="full_name"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </p>

            <p>
              <label htmlFor="email">Email Address</label>
              <br />
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </p>

            <p>
              <label htmlFor="password">Temporary Password</label>
              <br />
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                value={form.password}
                onChange={handleChange}
                required
              />
            </p>

            <p>
              <label htmlFor="role">Account Role</label>
              <br />
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="coordinator">Coordinator</option>
                <option value="ngo">NGO</option>
              </select>
            </p>

            <button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </form>
        )}
      </section>

      <section>
        <h2>Registered Users</h2>

        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No registered users found.</p>
        ) : (
          <div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td>{user.user_id}</td>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      {Boolean(user.is_active) ? "Active" : "Inactive"}
                    </td>
                    <td>
                      {user.role === "admin" ? (
                        "Protected"
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStatus(user)}
                        >
                          {Boolean(user.is_active)
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default UserManagement;
