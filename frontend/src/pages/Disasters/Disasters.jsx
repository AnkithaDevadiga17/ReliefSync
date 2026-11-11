
import { useState } from "react";
import "./Disasters.css";

function Disasters() {

  // Temporary sample records
  const disasters = [
    {
      id: "D001",
      type: "Flood",
      location: "Udupi",
      severity: "High",
      date: "2026-11-10",
      status: "Pending"
    },
    {
      id: "D002",
      type: "Landslide",
      location: "Kodagu",
      severity: "Critical",
      date: "2026-11-09",
      status: "Verified"
    },
    {
      id: "D003",
      type: "Cyclone",
      location: "Mangalore",
      severity: "Medium",
      date: "2026-11-08",
      status: "Resolved"
    }
  ];

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [status, setStatus] = useState("All");

  // Apply search and filters
  const filteredDisasters = disasters.filter((disaster) => {

    const matchesSearch =
      disaster.id.toLowerCase().includes(search.toLowerCase()) ||
      disaster.type.toLowerCase().includes(search.toLowerCase()) ||
      disaster.location.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity =
      severity === "All" || disaster.severity === severity;

    const matchesStatus =
      status === "All" || disaster.status === status;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="disasters-page">

      <h1>Disaster Management</h1>
      <p>Monitor and manage reported disasters.</p>

      <div className="disasters-header">
        <h2>Disaster Reports</h2>
        <button>Add Disaster</button>
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
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Verified">Verified</option>
          <option value="Resolved">Resolved</option>
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
            <th>Reported Date</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {filteredDisasters.length > 0 ? (
            filteredDisasters.map((disaster) => (
              <tr key={disaster.id}>
                <td>{disaster.id}</td>
                <td>{disaster.type}</td>
                <td>{disaster.location}</td>
                <td>{disaster.severity}</td>
                <td>{disaster.date}</td>
                <td>{disaster.status}</td>
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
