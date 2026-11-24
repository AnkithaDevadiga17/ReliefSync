import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
// Live database-backed overview with selectable disaster map
// ==================================================

function OperationsDashboard() {
  const [summary, setSummary] = useState(null);
  const [disasters, setDisasters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [resources, setResources] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [donations, setDonations] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);

  const loadDashboard = async () => {
    setLoading(true);
    const requests = [
      ["summary", "/analytics/summary"], ["disasters", "/disasters"],
      ["locations", "/locations"], ["shelters", "/shelters"],
      ["resources", "/resources"], ["volunteers", "/volunteers"],
      ["donations", "/donations"], ["allocations", "/allocations"],
    ];
    const results = await Promise.allSettled(requests.map(([, endpoint]) => apiRequest(endpoint)));
    const nextErrors = [];
    results.forEach((result, index) => {
      const [key] = requests[index];
      if (result.status !== "fulfilled") {
        nextErrors.push(`${key}: ${result.reason?.message || "Unavailable"}`);
        return;
      }
      const payload = result.value;
      if (key === "summary") setSummary(payload.data || null);
      else if (key === "disasters") setDisasters(payload.data || []);
      else if (key === "locations") setLocations(payload.data || []);
      else if (key === "shelters") setShelters(payload.data || []);
      else if (key === "resources") setResources(payload.data || []);
      else if (key === "volunteers") setVolunteers(payload.data || []);
      else if (key === "donations") setDonations(payload.data || []);
      else if (key === "allocations") setAllocations(payload.data || []);
    });
    setErrors(nextErrors);
    setLoading(false);
  };

  useEffect(() => { loadDashboard(); }, [refreshKey]);

  useEffect(() => {
    if (!mapElementRef.current) return undefined;
    const map = L.map(mapElementRef.current, { scrollWheelZoom: false }).setView([15.3, 75.7], 5);
    mapInstanceRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markerLayerRef.current = L.featureGroup().addTo(map);
    return () => { map.remove(); mapInstanceRef.current = null; markerLayerRef.current = null; };
  }, []);

  const locationById = useMemo(() => new Map(locations.map((item) => [String(item.location_id), item])), [locations]);
  const activeDisasters = useMemo(() => disasters.filter((item) => ["reported", "active", "monitoring"].includes(String(item.status || "").toLowerCase())), [disasters]);
  const visibleDisasters = selectedLocationId === "all" ? disasters : disasters.filter((item) => String(item.location_id) === selectedLocationId);
  const selectedLocation = selectedLocationId === "all" ? null : locationById.get(selectedLocationId);
  const selectedDisasters = selectedLocationId === "all" ? [] : disasters.filter((item) => String(item.location_id) === selectedLocationId);
  const inArea = (rows) => selectedLocationId === "all" ? rows : rows.filter((row) => String(row.location_id) === selectedLocationId);
  const areaShelters = inArea(shelters);
  const areaResources = inArea(resources);
  const areaVolunteers = inArea(volunteers);
  const areaDonations = inArea(donations);
  const areaAllocations = allocations.filter((row) => selectedLocationId === "all" || String(row.disaster_location_id ?? row.location_id) === selectedLocationId);
  const activeCount = Number(summary?.disasters?.active || 0);
  const shelterCapacity = Number(summary?.shelters?.available || 0);
  const resourceUnits = Number(summary?.resources?.total || 0);
  const volunteerCount = Number(summary?.volunteers?.total || 0);
  const pendingDonations = Number(summary?.donations?.pending || 0);

  useEffect(() => {
    const layer = markerLayerRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const points = [];
    visibleDisasters.forEach((item) => {
      const location = locationById.get(String(item.location_id)) || {};
      const lat = Number(item.latitude ?? location.latitude);
      const lng = Number(item.longitude ?? location.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) return;
      const status = String(item.status || "").toLowerCase();
      const color = status === "active" ? "#b5473c" : status === "reported" ? "#c58b35" : status === "monitoring" ? "#347b69" : status === "resolved" ? "#56856b" : "#7b8588";
      const marker = L.circleMarker([lat, lng], { radius: 9, color, weight: 2, fillColor: color, fillOpacity: 0.82 });
      marker.bindTooltip(`${item.disaster_type || "Incident"} · ${item.location_name || location.location_name || "Location"}`);
      marker.on("click", () => setSelectedLocationId(String(item.location_id)));
      marker.addTo(layer);
      points.push([lat, lng]);
    });
    if (points.length === 1) map.setView(points[0], 9);
    else if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 8 });
    else map.setView([15.3, 75.7], 6);
  }, [visibleDisasters, locationById]);

  const statItems = [
    { label: "Active incidents", value: activeCount, note: "Reported, active or monitoring" },
    { label: "Shelter spaces available", value: shelterCapacity.toLocaleString("en-IN"), note: `${summary?.shelters?.operational || 0} operational shelters` },
    { label: "Resource records", value: resourceUnits.toLocaleString("en-IN"), note: `${summary?.resources?.low_stock || 0} items at low stock` },
    { label: "Registered volunteers", value: volunteerCount.toLocaleString("en-IN"), note: `${summary?.volunteers?.available || 0} currently available` },
    { label: "Pending donations", value: pendingDonations, note: "Awaiting verification" },
  ];

  return (
    <div className="dashboard-page operations-dashboard">
      <div className="dashboard-heading-row">
        <PageHeader title="Operations overview" description="A live view of incidents, response capacity and relief activity across registered locations." />
        <button className="dashboard-refresh-button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>{loading ? "Updating…" : "Refresh data"}</button>
      </div>
      {errors.length > 0 && <div className="dashboard-data-notice"><strong>Some module data could not be loaded.</strong><span>{errors.join(" · ")}</span></div>}
      <div className="dashboard-live-stats">
        {statItems.map((item) => <article className="dashboard-live-stat" key={item.label}><span>{item.label}</span><strong>{loading ? "—" : item.value}</strong><small>{item.note}</small></article>)}
      </div>

      <section className="dashboard-map-section">
        <div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">GEOGRAPHIC OVERVIEW</span><h2>Incident locations</h2><p>Select a marker or a location to inspect its response information.</p></div>
          <select aria-label="Filter dashboard by location" value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}><option value="all">All monitored locations</option>{locations.filter((location) => disasters.some((item) => String(item.location_id) === String(location.location_id))).map((location) => <option key={location.location_id} value={String(location.location_id)}>{[location.location_name, location.district].filter(Boolean).join(" · ")}</option>)}</select>
        </div>
        <div className="dashboard-map-layout"><div className="dashboard-leaflet-map" ref={mapElementRef} />
          <aside className="dashboard-map-legend"><h3>Incident status</h3><p><i className="legend-dot legend-active" /> Active</p><p><i className="legend-dot legend-reported" /> Reported</p><p><i className="legend-dot legend-monitoring" /> Monitoring</p><p><i className="legend-dot legend-resolved" /> Resolved / closed</p><div className="dashboard-map-total"><strong>{visibleDisasters.length}</strong><span>current incidents shown</span></div><Link to="/disasters">Open disaster register →</Link></aside>
        </div>
      </section>

      <section className="dashboard-area-section">
        <div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">LOCATION INTELLIGENCE</span><h2>{selectedLocation ? `${selectedLocation.location_name} response overview` : "All-location response overview"}</h2><p>{selectedLocation ? [selectedLocation.district, selectedLocation.state, selectedLocation.country].filter(Boolean).join(", ") : "Choose a location above or select an incident marker to see its detailed records."}</p></div>{selectedLocation && <button className="dashboard-text-button" onClick={() => setSelectedLocationId("all")}>Clear selection</button>}</div>
        <div className="dashboard-area-metrics">
          <article><span>Disaster reports</span><strong>{selectedLocation ? selectedDisasters.length : disasters.length}</strong></article>
          <article><span>Shelters</span><strong>{selectedLocation ? areaShelters.length : shelters.length}</strong></article>
          <article><span>Resources</span><strong>{selectedLocation ? areaResources.length : resources.length}</strong></article>
          <article><span>Volunteers</span><strong>{selectedLocation ? areaVolunteers.length : volunteers.length}</strong></article>
          <article><span>Donations</span><strong>{selectedLocation ? areaDonations.length : donations.length}</strong></article>
          <article><span>Allocations</span><strong>{selectedLocation ? areaAllocations.length : allocations.length}</strong></article>
        </div>
        {selectedLocation ? <div className="dashboard-area-detail-grid">
          <section><h3>Disaster reports</h3>{selectedDisasters.length ? selectedDisasters.map((item) => <div className="dashboard-detail-row" key={item.disaster_id}><div><strong>{item.disaster_type}</strong><small>{formatDate(item.incident_date)}</small></div><StatusBadge status={displayLabel(item.status)} /></div>) : <p className="dashboard-empty">No disaster reports recorded for this location.</p>}</section>
          <section><h3>Shelters</h3>{areaShelters.length ? areaShelters.slice(0, 5).map((item) => <div className="dashboard-detail-row" key={item.shelter_id}><div><strong>{item.shelter_name}</strong><small>{item.occupied_count || 0} occupied · {item.available ?? "—"} available</small></div><StatusBadge status={displayLabel(item.status)} /></div>) : <p className="dashboard-empty">No shelter records available.</p>}</section>
          <section><h3>Resources</h3>{areaResources.length ? areaResources.slice(0, 5).map((item) => <div className="dashboard-detail-row" key={item.resource_id}><div><strong>{item.resource_name}</strong><small>{item.quantity_available ?? 0} {item.unit || "units"} available</small></div></div>) : <p className="dashboard-empty">No resource records available.</p>}</section>
          <section><h3>Volunteers</h3>{areaVolunteers.length ? areaVolunteers.slice(0, 5).map((item) => <div className="dashboard-detail-row" key={item.volunteer_id}><div><strong>{item.full_name}</strong><small>{item.skills || "Volunteer"}</small></div><StatusBadge status={displayLabel(item.availability)} /></div>) : <p className="dashboard-empty">No volunteer records available.</p>}</section>
          <section><h3>Donations</h3>{areaDonations.length ? areaDonations.slice(0, 5).map((item) => <div className="dashboard-detail-row" key={item.donation_id}><div><strong>{item.donor_name || "Donor"}</strong><small>{item.donation_type === "cash" ? `₹${item.amount}` : `${item.quantity || ""} ${item.unit || "items"}`}</small></div><StatusBadge status={displayLabel(item.donation_status)} /></div>) : <p className="dashboard-empty">No donation records linked to this location.</p>}</section>
          <section><h3>Resource allocations</h3>{areaAllocations.length ? areaAllocations.slice(0, 5).map((item) => <div className="dashboard-detail-row" key={item.allocation_id}><div><strong>{item.resource_name}</strong><small>{item.quantity_allocated} {item.unit || "units"}</small></div><StatusBadge status={displayLabel(item.allocation_status)} /></div>) : <p className="dashboard-empty">No allocation records linked to this location.</p>}</section>
        </div> : <div className="dashboard-select-prompt">Select a location to view its disaster reports, shelter capacity, resources, volunteer registrations, donations and allocations together.</div>}
      </section>

      <section className="dashboard-latest-section"><div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">LATEST UPDATES</span><h2>Recent disaster reports</h2></div><Link to="/disasters">View all reports →</Link></div>
        <div className="dashboard-report-list">{disasters.slice(0, 6).map((item) => <button className="dashboard-report-row" key={item.disaster_id} onClick={() => setSelectedLocationId(String(item.location_id))}><span><strong>{item.disaster_type}</strong><small>{item.location_name}{item.district ? `, ${item.district}` : ""} · {formatDate(item.incident_date)}</small></span><StatusBadge status={displayLabel(item.status)} /><StatusBadge status={displayLabel(item.severity)} /></button>)}{!loading && disasters.length === 0 && <p className="dashboard-empty">No disaster reports have been added yet.</p>}</div>
      </section>
      <section className="dashboard-quick-access"><h2>Management access</h2><div>{[["Disasters", "/disasters"], ["Locations", "/locations"], ["Shelters", "/shelters"], ["Resources", "/resources"], ["Volunteers", "/volunteers"], ["Donations", "/donations"], ["Allocations", "/allocations"], ["Analytics", "/analytics"]].map(([label, path]) => <Link key={path} to={path}>{label}<span>→</span></Link>)}</div></section>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  return user?.role?.toLowerCase() === "volunteer" ? <VolunteerDashboard /> : <OperationsDashboard />;
}

export default Dashboard;
