
import { Link } from "react-router-dom";
import {
  PageHeader,
  SectionCard,
  StatGrid,
  StatCard,
  DataTable,
  StatusBadge
} from "../../components/ModuleUI";
import "./Dashboard.css";

function Dashboard() {
  // Sample dashboard statistics
  const statistics = [
    {
      label: "Active Disasters",
      value: "08",
      note: "Across monitored regions",
      icon: "🌪️"
    },
    {
      label: "Available Shelters",
      value: "24",
      note: "Shelters currently operational",
      icon: "🏠"
    },
    {
      label: "Available Resources",
      value: "1,250",
      note: "Units ready for allocation",
      icon: "📦"
    },
    {
      label: "Registered Volunteers",
      value: "186",
      note: "Volunteers in the system",
      icon: "🤝"
    },
    {
      label: "Pending Donations",
      value: "12",
      note: "Awaiting verification",
      icon: "❤️"
    }
  ];

  // Sample disaster reports
  const recentDisasters = [
    {
      id: 1,
      name: "Flood",
      location: "Udupi",
      date: "14 Nov 2026",
      severity: "High",
      status: "Active"
    },
    {
      id: 2,
      name: "Landslide",
      location: "Kodagu",
      date: "13 Nov 2026",
      severity: "Critical",
      status: "Active"
    },
    {
      id: 3,
      name: "Heavy Rainfall",
      location: "Mangaluru",
      date: "12 Nov 2026",
      severity: "Medium",
      status: "Monitoring"
    },
    {
      id: 4,
      name: "Flood",
      location: "Shivamogga",
      date: "11 Nov 2026",
      severity: "High",
      status: "Resolved"
    }
  ];

  const alerts = [
    {
      id: 1,
      type: "Critical",
      message: "Shelter capacity is nearly full in Kodagu.",
      time: "10 minutes ago"
    },
    {
      id: 2,
      type: "Warning",
      message: "Resource allocation is pending for Udupi.",
      time: "30 minutes ago"
    },
    {
      id: 3,
      type: "Information",
      message: "New volunteer registrations received.",
      time: "1 hour ago"
    }
  ];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        description="Overview of disaster response operations and available resources."
      />

      {/* Statistics */}
      <StatGrid>
        {statistics.map((item) => (
          <div className="dashboard-stat-wrapper" key={item.label}>
            <div className="dashboard-stat-icon">{item.icon}</div>
            <StatCard
              label={item.label}
              value={item.value}
              note={item.note}
            />
          </div>
        ))}
      </StatGrid>

      {/* Main dashboard content */}
      <div className="dashboard-main-grid">

        {/* Recent disaster reports */}
        <SectionCard title="Recent Disaster Reports">
          <DataTable
            columns={[
              { key: "name", label: "Disaster" },
              { key: "location", label: "Location" },
              { key: "date", label: "Reported On" },
              {
                key: "severity",
                label: "Severity",
                render: (row) => (
                  <StatusBadge status={row.severity} />
                )
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusBadge status={row.status} />
                )
              }
            ]}
            data={recentDisasters}
          />

          <Link to="/disasters" className="dashboard-view-link">
            View all disaster reports →
          </Link>
        </SectionCard>

        {/* Alerts */}
        <SectionCard title="Recent Alerts">
          <div className="dashboard-alert-list">
            {alerts.map((alert) => (
              <div className="dashboard-alert" key={alert.id}>
                <div className="dashboard-alert-heading">
                  <StatusBadge status={alert.type} />
                  <small>{alert.time}</small>
                </div>
                <p>{alert.message}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Map and activity */}
      <div className="dashboard-bottom-grid">

        <SectionCard title="Affected Areas Overview">
          <div className="dashboard-map-placeholder">
            <span>📍</span>
            <h3>Disaster Location Map</h3>
            <p>
              A map showing affected areas and disaster locations
              will be integrated here.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Quick Access">
          <div className="dashboard-quick-links">
            <Link to="/disasters">🌪️ Manage Disasters</Link>
            <Link to="/shelters">🏠 Manage Shelters</Link>
            <Link to="/resources">📦 Manage Resources</Link>
            <Link to="/volunteers">🤝 Manage Volunteers</Link>
            <Link to="/donations">❤️ Manage Donations</Link>
            <Link to="/analytics">📊 View Analytics</Link>
          </div>
        </SectionCard>
      </div>

      <p className="dashboard-demo-note">
        Note: Dashboard currently displays sample data for demonstration.
      </p>
    </div>
  );
}

export default Dashboard;
