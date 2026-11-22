import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageHeader,
  SectionCard,
  StatGrid,
  StatCard,
  DataTable,
  StatusBadge
} from "../../components/ModuleUI";

import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

import "./Dashboard.css";


function formatDate(value) {

  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

}


function formatDateTime(value) {

  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

}


function displayLabel(value) {

  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());

}


// ==================================================
// VOLUNTEER PERSONAL DASHBOARD
// ==================================================

function VolunteerDashboard() {

  const { user } = useAuth();


  const [profile, setProfile] = useState(null);

  const [assignments, setAssignments] = useState([]);

  const [stats, setStats] = useState({

    total_assignments: 0,

    active_assignments: 0,

    completed_assignments: 0,

    cancelled_assignments: 0

  });


  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [search, setSearch] = useState("");


  // ----------------------------------------
  // LOAD MY ASSIGNMENTS
  // ----------------------------------------

  const loadMyDashboard = async () => {

    try {

      setLoading(true);

      setError("");

      const response = await apiRequest(
        "/volunteer/my-dashboard"
      );

      setProfile(response.profile || null);

      setAssignments(response.assignments || []);

      setStats(response.stats || {

        total_assignments: 0,

        active_assignments: 0,

        completed_assignments: 0,

        cancelled_assignments: 0

      });

    } catch (err) {

      setError(
        err.message || "Unable to load your assignments."
      );

    } finally {

      setLoading(false);

    }

  };


  useEffect(() => {

    loadMyDashboard();

  }, []);


  // ----------------------------------------
  // FILTER MY ASSIGNMENTS
  // ----------------------------------------

  const filteredAssignments = useMemo(() => {

    const searchText = search.toLowerCase().trim();

    return assignments.filter(assignment => {

      const searchableValues = [

        assignment.disaster_type,

        assignment.location_name,

        assignment.district,

        assignment.state,

        assignment.assigned_role,

        assignment.notes,

        assignment.disaster_description

      ];

      const matchesSearch = searchableValues.some(value =>

        String(value || "")
          .toLowerCase()
          .includes(searchText)

      );

      const matchesStatus =
        statusFilter === "All" ||
        assignment.assignment_status === statusFilter;

      return matchesSearch && matchesStatus;

    });

  }, [assignments, search, statusFilter]);


  // ----------------------------------------
  // ACTIVE ASSIGNMENTS
  // ----------------------------------------

  const activeAssignments = assignments.filter(assignment =>

    ["assigned", "in_progress"].includes(
      assignment.assignment_status
    )

  );


  // ----------------------------------------
  // PAGE UI
  // ----------------------------------------

  return (

    <div className="dashboard-page volunteer-dashboard-page">

      <PageHeader

        title={`Welcome, ${profile?.full_name || user?.full_name || "Volunteer"}`}

        description="Your personal disaster response dashboard. View your assignments and track your work."

      />


      {/* PROFILE INFORMATION */}

      <div className="volunteer-dashboard-profile">

        <div className="volunteer-dashboard-avatar">
          {(
            profile?.full_name ||
            user?.full_name ||
            "V"
          ).charAt(0).toUpperCase()}
        </div>


        <div className="volunteer-dashboard-profile-details">

          <h2>
            {profile?.full_name || user?.full_name}
          </h2>

          <p>
            {profile?.location_name
              ? `${profile.location_name}, ${profile.district || ""}, ${profile.state || ""}`
              : "Volunteer location not assigned"}
          </p>

          <small>
            {profile?.skills || "No skills added to your profile yet."}
          </small>

        </div>


        <span className="volunteer-dashboard-role">
          VOLUNTEER
        </span>

      </div>


      {/* ERROR */}

      {error && (

        <div className="volunteer-dashboard-error">
          {error}

          <button
            type="button"
            onClick={loadMyDashboard}
          >
            Try Again
          </button>

        </div>

      )}


      {/* LOADING */}

      {loading ? (

        <SectionCard title="My Assignments">

          <p className="dashboard-volunteer-muted">
            Loading your assignment details...
          </p>

        </SectionCard>

      ) : (

        <>

          {/* PROFILE NOT LINKED */}

          {!profile && (

            <div className="volunteer-dashboard-empty">

              <div className="volunteer-dashboard-empty-icon">
                🤝
              </div>

              <h2>Your volunteer profile is not linked yet.</h2>

              <p>
                Your login account exists, but a volunteer profile
                has not been linked to it. Please contact your
                coordinator and ask them to register you using
                the same email address as your login account.
              </p>

            </div>

          )}


          {/* ASSIGNMENT DASHBOARD */}

          {profile && (

            <>

              {/* STATISTICS */}

              <StatGrid>

                <StatCard
                  label="Total Assignments"
                  value={stats.total_assignments}
                  note="All your assignment records"
                />

                <StatCard
                  label="Active Assignments"
                  value={stats.active_assignments}
                  note="Assigned or in progress"
                />

                <StatCard
                  label="Completed"
                  value={stats.completed_assignments}
                  note="Successfully completed"
                />

                <StatCard
                  label="Cancelled"
                  value={stats.cancelled_assignments}
                  note="Cancelled assignments"
                />

              </StatGrid>


              {/* ACTIVE TASKS */}

              <SectionCard title="My Active Assignments">

                {activeAssignments.length === 0 ? (

                  <div className="volunteer-dashboard-no-tasks">

                    <span>✅</span>

                    <h3>No active assignments</h3>

                    <p>
                      You currently have no active disaster assignments.
                      New assignments from your coordinator will appear here.
                    </p>

                  </div>

                ) : (

                  <div className="volunteer-dashboard-task-list">

                    {activeAssignments.map(assignment => (

                      <div
                        className="volunteer-dashboard-task"
                        key={assignment.assignment_id}
                      >

                        <div className="volunteer-dashboard-task-heading">

                          <div>

                            <span className="volunteer-dashboard-task-id">
                              Assignment AS{String(
                                assignment.assignment_id
                              ).padStart(3, "0")}
                            </span>

                            <h3>
                              {assignment.disaster_type}
                            </h3>

                          </div>

                          <StatusBadge
                            status={displayLabel(
                              assignment.assignment_status
                            )}
                          />

                        </div>


                        <div className="volunteer-dashboard-task-details">

                          <div>
                            <small>Affected Location</small>

                            <strong>
                              {assignment.location_name || "—"}
                            </strong>

                            <span>
                              {[
                                assignment.district,
                                assignment.state
                              ].filter(Boolean).join(", ")}
                            </span>
                          </div>


                          <div>
                            <small>Assigned Role</small>

                            <strong>
                              {assignment.assigned_role || "—"}
                            </strong>
                          </div>


                          <div>
                            <small>Disaster Severity</small>

                            <StatusBadge
                              status={displayLabel(assignment.severity)}
                            />
                          </div>


                          <div>
                            <small>Incident Date</small>

                            <strong>
                              {formatDate(assignment.incident_date)}
                            </strong>
                          </div>


                          <div>
                            <small>Assigned By</small>

                            <strong>
                              {assignment.assigned_by_name || "Coordinator"}
                            </strong>
                          </div>


                          <div>
                            <small>Assignment Date</small>

                            <strong>
                              {formatDateTime(assignment.assigned_at)}
                            </strong>
                          </div>

                        </div>


                        {assignment.disaster_description && (

                          <div className="volunteer-dashboard-description">

                            <strong>Disaster Information</strong>

                            <p>
                              {assignment.disaster_description}
                            </p>

                          </div>

                        )}


                        {assignment.notes && (

                          <div className="volunteer-dashboard-notes">

                            <strong>Instructions / Notes</strong>

                            <p>
                              {assignment.notes}
                            </p>

                          </div>

                        )}

                      </div>

                    ))}

                  </div>

                )}

              </SectionCard>


              {/* ALL ASSIGNMENT HISTORY */}

              <SectionCard title="Assignment History">

                <div className="volunteer-dashboard-filters">

                  <input
                    type="search"
                    placeholder="Search disaster, location or role..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />


                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >

                    <option value="All">
                      All Assignments
                    </option>

                    <option value="assigned">
                      Assigned
                    </option>

                    <option value="in_progress">
                      In Progress
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>

                  </select>

                  <button
                    type="button"
                    className="volunteer-dashboard-refresh"
                    onClick={loadMyDashboard}
                  >
                    Refresh
                  </button>

                </div>


                {filteredAssignments.length === 0 ? (

                  <div className="volunteer-dashboard-no-tasks">

                    <h3>No assignments found</h3>

                    <p>
                      Your assignment history will appear here
                      once your coordinator assigns you to a disaster.
                    </p>

                  </div>

                ) : (

                  <div className="volunteer-dashboard-table-wrapper">

                    <table className="volunteer-dashboard-table">

                      <thead>

                        <tr>
                          <th>Assignment ID</th>
                          <th>Disaster</th>
                          <th>Location</th>
                          <th>Assigned Role</th>
                          <th>Status</th>
                          <th>Assigned Date</th>
                        </tr>

                      </thead>


                      <tbody>

                        {filteredAssignments.map(assignment => (

                          <tr key={assignment.assignment_id}>

                            <td>
                              AS{String(
                                assignment.assignment_id
                              ).padStart(3, "0")}
                            </td>


                            <td>
                              {assignment.disaster_type}
                            </td>


                            <td>
                              {assignment.location_name || "—"}
                            </td>


                            <td>
                              {assignment.assigned_role || "—"}
                            </td>


                            <td>

                              <StatusBadge
                                status={displayLabel(
                                  assignment.assignment_status
                                )}
                              />

                            </td>


                            <td>
                              {formatDate(assignment.assigned_at)}
                            </td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                )}

              </SectionCard>


              {/* QUICK LINKS */}

              <SectionCard title="Quick Access">

                <div className="volunteer-dashboard-quick-links">

                  <Link to="/shelters">
                    🏠 View Shelter Information
                  </Link>

                  <Link to="/resources">
                    📦 View Resource Information
                  </Link>

                  <Link to="/disasters">
                    🌪️ View Disaster Reports
                  </Link>

                  <Link to="/profile">
                    👤 View My Profile
                  </Link>

                </div>

              </SectionCard>

            </>

          )}

        </>

      )}

    </div>

  );

}


// ==================================================
// ADMIN / COORDINATOR / NGO OPERATIONS DASHBOARD
// Existing dashboard retained
// ==================================================

function OperationsDashboard() {

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


      <StatGrid>

        {statistics.map(item => (

          <div
            className="dashboard-stat-wrapper"
            key={item.label}
          >

            <div className="dashboard-stat-icon">
              {item.icon}
            </div>

            <StatCard
              label={item.label}
              value={item.value}
              note={item.note}
            />

          </div>

        ))}

      </StatGrid>


      <div className="dashboard-main-grid">


        <SectionCard title="Recent Disaster Reports">

          <DataTable
            columns={[

              {
                key: "name",
                label: "Disaster"
              },

              {
                key: "location",
                label: "Location"
              },

              {
                key: "date",
                label: "Reported On"
              },

              {
                key: "severity",
                label: "Severity",
                render: row => (
                  <StatusBadge status={row.severity} />
                )
              },

              {
                key: "status",
                label: "Status",
                render: row => (
                  <StatusBadge status={row.status} />
                )
              }

            ]}
            data={recentDisasters}
          />


          <Link
            to="/disasters"
            className="dashboard-view-link"
          >
            View all disaster reports →
          </Link>

        </SectionCard>


        <SectionCard title="Recent Alerts">

          <div className="dashboard-alert-list">

            {alerts.map(alert => (

              <div
                className="dashboard-alert"
                key={alert.id}
              >

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

            <Link to="/locations">
              📍 Manage Locations
            </Link>

            <Link to="/disasters">
              🌪️ Manage Disasters
            </Link>

            <Link to="/shelters">
              🏠 Manage Shelters
            </Link>

            <Link to="/resources">
              📦 Manage Resources
            </Link>

            <Link to="/allocations">
              🚚 Resource Allocation
            </Link>

            <Link to="/volunteers">
              🤝 Manage Volunteers
            </Link>

            <Link to="/donations">
              ❤️ Manage Donations
            </Link>

            <Link to="/analytics">
              📊 View Analytics
            </Link>

          </div>

        </SectionCard>

      </div>


      <p className="dashboard-demo-note">
        Note: Operations dashboard currently contains demonstration statistics.
      </p>

    </div>

  );

}


// ==================================================
// ROLE-BASED DASHBOARD
// ==================================================

function Dashboard() {

  const { user } = useAuth();

  const role = user?.role?.toLowerCase();

  if (role === "volunteer") {

    return <VolunteerDashboard />;

  }

  return <OperationsDashboard />;

}


export default Dashboard;