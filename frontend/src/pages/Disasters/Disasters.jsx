
import { useState, useEffect } from "react";
import "./Disasters.css";

// Flask backend address
const API_URL = "http://127.0.0.1:5000/api";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function Disasters() {

  // Store disaster records received from Flask
  const [disasters, setDisasters] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search and filter states
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [status, setStatus] = useState("All");


  // Fetch disaster records when the page opens
  useEffect(() => {

    const fetchDisasters = async () => {

      try {

        setLoading(true);
        setError("");

        // Send GET request to Flask
        const response = await fetch(`${API_URL}/disasters`);

        // Convert response into JSON
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to load disaster records."
          );
        }

        // Store records in React state
        setDisasters(
          Array.isArray(result.data) ? result.data : []
        );

      } catch (err) {

        setError(err.message || "Could not connect to the backend.");

      } finally {

        setLoading(false);

      }
    };

    fetchDisasters();

  }, []);


  // Apply search and filters
  const filteredDisasters = disasters.filter((disaster) => {

    const reportId =
      `D${String(disaster.disaster_id).padStart(3, "0")}`;

    const location =
      disaster.location_name || `Location ${disaster.location_id}`;

    const matchesSearch =
      reportId.toLowerCase().includes(search.toLowerCase()) ||
      disaster.disaster_type.toLowerCase().includes(search.toLowerCase()) ||
      location.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity =
      severity === "All" ||
      disaster.severity === severity;

    const matchesStatus =
      status === "All" ||
      disaster.status === status;

    return matchesSearch && matchesSeverity && matchesStatus;

  });


  return (

    <div className="disasters-page">

      <h1>Disaster Management</h1>

      <p>Monitor and manage reported disasters.</p>


      <div className="disasters-header">

        <h2>Disaster Reports</h2>

        <button type="button" disabled
          title="Add functionality will be connected next">
          Add Disaster
        </button>

      </div>


      {/* Search and filters */}
      <div className="disaster-filters">

        <input
          type="text"
          placeholder="Search by ID, type or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />


        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="All">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>


        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="reported">Reported</option>
          <option value="active">Active</option>
          <option value="monitoring">Monitoring</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

      </div>


      {/* Disaster reports table */}
      <table className="disasters-table">

        <thead>
          <tr>
            <th>Report ID</th>
            <th>Disaster Type</th>
            <th>Location</th>
            <th>Severity</th>
            <th>Incident Date</th>
            <th>Status</th>
          </tr>
        </thead>


        <tbody>

          {loading ? (

            <tr>
              <td colSpan="6">Loading disaster records...</td>
            </tr>

          ) : error ? (

            <tr>
              <td colSpan="6">{error}</td>
            </tr>

          ) : filteredDisasters.length > 0 ? (

            filteredDisasters.map((disaster) => (

              <tr key={disaster.disaster_id}>

                <td>
                  D{String(disaster.disaster_id).padStart(3, "0")}
                </td>

                <td>{disaster.disaster_type}</td>

                <td>
                  {disaster.location_name || `Location ${disaster.location_id}`}
                </td>

                <td>
                  {disaster.severity
                    ? disaster.severity.charAt(0).toUpperCase() +
                      disaster.severity.slice(1)
                    : "—"}
                </td>

                <td>{formatDate(disaster.incident_date)}</td>

                <td>
                  {disaster.status
                    ? disaster.status.charAt(0).toUpperCase() +
                      disaster.status.slice(1)
                    : "—"}
                </td>

              </tr>

            ))

          ) : (

            <tr>
              <td colSpan="6">No disaster reports found.</td>
            </tr>

          )}

        </tbody>

      </table>

    </div>

  );

}

export default Disasters;
