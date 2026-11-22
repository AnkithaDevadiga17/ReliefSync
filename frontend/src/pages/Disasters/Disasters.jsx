import { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";

import "./Disasters.css";


const emptyDisaster = {
  location_id: "",
  disaster_type: "",
  severity: "medium",
  status: "reported",
  incident_date: "",
  description: "",
  latitude: "",
  longitude: ""
};


const emptyLocation = {
  location_name: "",
  location_type: "Disaster Affected Area",
  district: "",
  state: "Karnataka",
  country: "India",
  pincode: ""
};


const severityOptions = [
  "low",
  "medium",
  "high",
  "critical"
];


const statusOptions = [
  "reported",
  "active",
  "monitoring",
  "resolved",
  "closed"
];


function formatDate(value) {

  if (!value) return "—";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

}


function formatDateInput(value) {

  if (!value) return "";

  return String(value).slice(0, 10);

}


function displayLabel(value) {

  if (!value) return "—";

  return value.charAt(0).toUpperCase() + value.slice(1);

}


function Disasters() {

  const { user } = useAuth();

  const role = user?.role?.toLowerCase();

  const canManage =
    role === "admin" || role === "coordinator";


  const [disasters, setDisasters] = useState([]);

  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");


  const [search, setSearch] = useState("");

  const [severityFilter, setSeverityFilter] = useState("All");

  const [statusFilter, setStatusFilter] = useState("All");


  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState(emptyDisaster);


  // Inline location creation
  const [showLocationForm, setShowLocationForm] = useState(false);

  const [locationSaving, setLocationSaving] = useState(false);

  const [locationError, setLocationError] = useState("");

  const [locationData, setLocationData] = useState(emptyLocation);


  // --------------------------------------------------
  // LOAD LOCATIONS
  // --------------------------------------------------

  const loadLocations = async () => {

    const response = await apiRequest("/locations");

    setLocations(
      Array.isArray(response.data) ? response.data : []
    );

    return response.data || [];

  };


  // --------------------------------------------------
  // LOAD DISASTERS
  // --------------------------------------------------

  const loadDisasters = async () => {

    const response = await apiRequest("/disasters");

    setDisasters(
      Array.isArray(response.data) ? response.data : []
    );

  };


  // --------------------------------------------------
  // LOAD ALL PAGE DATA
  // --------------------------------------------------

  const loadPageData = async () => {

    try {

      setLoading(true);

      setError("");

      await Promise.all([
        loadDisasters(),
        loadLocations()
      ]);

    } catch (err) {

      setError(
        err.message || "Unable to load disaster information."
      );

    } finally {

      setLoading(false);

    }

  };


  useEffect(() => {
    loadPageData();
  }, []);


  // --------------------------------------------------
  // FORM INPUT HANDLING
  // --------------------------------------------------

  const handleDisasterChange = (e) => {

    const { name, value } = e.target;

    setFormData(previous => ({
      ...previous,
      [name]: value
    }));

  };


  const handleLocationChange = (e) => {

    const { name, value } = e.target;

    setLocationData(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // --------------------------------------------------
  // OPEN NEW DISASTER FORM
  // --------------------------------------------------

  const openCreateForm = () => {

    setEditingId(null);

    setFormData({ ...emptyDisaster });

    setFormError("");

    setError("");
    setSuccess("");

    setShowLocationForm(false);

    setLocationData({ ...emptyLocation });

    setShowForm(true);

  };


  // --------------------------------------------------
  // OPEN EDIT DISASTER FORM
  // --------------------------------------------------

  const openEditForm = (disaster) => {

    setEditingId(disaster.disaster_id);

    setFormData({
      location_id: String(disaster.location_id || ""),
      disaster_type: disaster.disaster_type || "",
      severity: disaster.severity || "medium",
      status: disaster.status || "reported",
      incident_date: formatDateInput(disaster.incident_date),
      description: disaster.description || "",
      latitude: disaster.latitude ?? "",
      longitude: disaster.longitude ?? ""
    });

    setFormError("");

    setError("");
    setSuccess("");

    setShowLocationForm(false);

    setShowForm(true);

  };


  // --------------------------------------------------
  // CLOSE DISASTER FORM
  // --------------------------------------------------

  const closeDisasterForm = () => {

    setShowForm(false);

    setEditingId(null);

    setFormData({ ...emptyDisaster });

    setFormError("");

    setShowLocationForm(false);

    setLocationError("");

  };


  // --------------------------------------------------
  // ADD LOCATION FROM DISASTER FORM
  // --------------------------------------------------

  const handleAddLocation = async (e) => {

    e.preventDefault();

    setLocationError("");

    const payload = {
      ...locationData,
      latitude: null,
      longitude: null
    };


    try {

      setLocationSaving(true);

      const response = await apiRequest("/locations", {
        method: "POST",
        body: JSON.stringify(payload)
      });


      // Refresh location dropdown.
      await loadLocations();


      // Automatically select the new location.
      if (response.data?.location_id) {

        setFormData(previous => ({
          ...previous,
          location_id: String(response.data.location_id)
        }));

      }


      setLocationData({ ...emptyLocation });

      setShowLocationForm(false);

      setSuccess("Location added successfully and selected.");

    } catch (err) {

      setLocationError(
        err.message || "Unable to add location."
      );

    } finally {

      setLocationSaving(false);

    }

  };


  // --------------------------------------------------
  // CREATE OR UPDATE DISASTER
  // --------------------------------------------------

  const handleSubmit = async (e) => {

    e.preventDefault();

    setFormError("");

    setSuccess("");


    if (!formData.location_id) {

      setFormError("Please select a location.");

      return;
    }


    if (!formData.disaster_type.trim()) {

      setFormError("Please enter the disaster type.");

      return;
    }


    if (
      (formData.latitude === "") !==
      (formData.longitude === "")
    ) {

      setFormError(
        "Enter both latitude and longitude, or leave both empty."
      );

      return;
    }


    const latitude =
      formData.latitude === ""
        ? null
        : Number(formData.latitude);

    const longitude =
      formData.longitude === ""
        ? null
        : Number(formData.longitude);


    if (
      latitude !== null &&
      (!Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90)
    ) {

      setFormError("Latitude must be between -90 and 90.");

      return;
    }


    if (
      longitude !== null &&
      (!Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180)
    ) {

      setFormError("Longitude must be between -180 and 180.");

      return;
    }


    const payload = {
      location_id: Number(formData.location_id),
      disaster_type: formData.disaster_type.trim(),
      severity: formData.severity,
      status: formData.status,
      incident_date: formData.incident_date || null,
      description: formData.description.trim() || null,
      latitude,
      longitude
    };


    try {

      setSaving(true);

      const isEditing = editingId !== null;

      const endpoint = isEditing
        ? `/disasters/${editingId}`
        : "/disasters";


      const response = await apiRequest(endpoint, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });


      setSuccess(
        response.message ||
        (isEditing
          ? "Disaster updated successfully."
          : "Disaster reported successfully.")
      );

      setShowForm(false);

      setEditingId(null);

      setFormData({ ...emptyDisaster });

      await loadDisasters();

    } catch (err) {

      setFormError(
        err.message || "Unable to save disaster report."
      );

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------------------------
  // DELETE DISASTER
  // --------------------------------------------------

  const handleDelete = async (disaster) => {

    const reportId =
      `D${String(disaster.disaster_id).padStart(3, "0")}`;


    const confirmed = window.confirm(
      `Delete disaster report ${reportId}?\n\nReports connected to allocations, assignments or distributions cannot be deleted.`
    );

    if (!confirmed) return;


    try {

      setDeletingId(disaster.disaster_id);

      setError("");
      setSuccess("");

      const response = await apiRequest(
        `/disasters/${disaster.disaster_id}`,
        {
          method: "DELETE"
        }
      );


      setSuccess(
        response.message || "Disaster deleted successfully."
      );

      await loadDisasters();

    } catch (err) {

      const linked = err.data?.linked_modules;

      setError(
        linked?.length
          ? `${err.message} Connected records: ${linked.join(", ")}.`
          : err.message || "Unable to delete disaster."
      );

    } finally {

      setDeletingId(null);

    }

  };


  // --------------------------------------------------
  // SEARCH AND FILTER
  // --------------------------------------------------

  const filteredDisasters = disasters.filter(disaster => {

    const reportId =
      `D${String(disaster.disaster_id).padStart(3, "0")}`;

    const searchText = search.toLowerCase().trim();

    const searchableValues = [
      reportId,
      disaster.disaster_type,
      disaster.location_name,
      disaster.district,
      disaster.state,
      disaster.description
    ];

    const matchesSearch = searchableValues.some(value =>
      String(value || "")
        .toLowerCase()
        .includes(searchText)
    );

    const matchesSeverity =
      severityFilter === "All" ||
      disaster.severity === severityFilter;

    const matchesStatus =
      statusFilter === "All" ||
      disaster.status === statusFilter;

    return (
      matchesSearch &&
      matchesSeverity &&
      matchesStatus
    );

  });


  // --------------------------------------------------
  // STATISTICS
  // --------------------------------------------------

  const totalDisasters = disasters.length;

  const activeDisasters = disasters.filter(disaster =>
    ["reported", "active", "monitoring"].includes(disaster.status)
  ).length;

  const criticalDisasters = disasters.filter(disaster =>
    disaster.severity === "critical"
  ).length;

  const resolvedDisasters = disasters.filter(disaster =>
    ["resolved", "closed"].includes(disaster.status)
  ).length;


  // --------------------------------------------------
  // PAGE UI
  // --------------------------------------------------

  return (

    <div className="disasters-page">

      <div className="disasters-page-heading">

        <div>
          <h1>Disaster Management</h1>

          <p>
            Report disasters, monitor their severity and track response status.
          </p>
        </div>

        {canManage && (

          <button
            type="button"
            className="disaster-primary-button"
            onClick={openCreateForm}
          >
            + Report Disaster
          </button>

        )}

      </div>


      {success && (

        <div className="disaster-alert disaster-alert-success">
          {success}
        </div>

      )}


      {error && (

        <div className="disaster-alert disaster-alert-error">
          {error}
        </div>

      )}


      {/* STATISTICS */}

      <div className="disaster-stats-grid">

        <div className="disaster-stat-card">
          <span>Total Reports</span>
          <strong>{totalDisasters}</strong>
        </div>

        <div className="disaster-stat-card">
          <span>Active / Monitoring</span>
          <strong>{activeDisasters}</strong>
        </div>

        <div className="disaster-stat-card">
          <span>Critical Severity</span>
          <strong>{criticalDisasters}</strong>
        </div>

        <div className="disaster-stat-card">
          <span>Resolved / Closed</span>
          <strong>{resolvedDisasters}</strong>
        </div>

      </div>


      {/* CREATE / EDIT DISASTER */}

      {showForm && canManage && (

        <section className="disaster-card">

          <div className="disaster-card-heading">

            <div>
              <h2>
                {editingId ? "Edit Disaster Report" : "Report a New Disaster"}
              </h2>

              <p>
                Select a registered location and enter the incident details.
              </p>
            </div>

            <button
              type="button"
              className="disaster-text-button"
              onClick={closeDisasterForm}
            >
              Close
            </button>

          </div>


          {formError && (

            <div className="disaster-alert disaster-alert-error">
              {formError}
            </div>

          )}


          {/* LOCATION SELECTION */}

          <div className="disaster-location-selector">

            <label htmlFor="disaster-location">
              Affected Location *
            </label>

            <div className="disaster-location-row">

              <select
                id="disaster-location"
                name="location_id"
                value={formData.location_id}
                onChange={handleDisasterChange}
                required
              >

                <option value="">
                  Select a registered location
                </option>

                {locations.map(location => (

                  <option
                    key={location.location_id}
                    value={location.location_id}
                  >
                    {location.location_name}, {location.district}, {location.state}
                  </option>

                ))}

              </select>


              {!editingId && (

                <button
                  type="button"
                  className="disaster-secondary-button"
                  onClick={() => {
                    setShowLocationForm(!showLocationForm);
                    setLocationError("");
                  }}
                >
                  {showLocationForm ? "Cancel" : "+ Add Location"}
                </button>

              )}

            </div>


            {locations.length === 0 && (

              <small className="disaster-field-hint">
                No locations are registered yet. Add a location before reporting a disaster.
              </small>

            )}

          </div>


          {/* QUICK ADD LOCATION FORM */}

          {showLocationForm && !editingId && (

            <div className="quick-location-panel">

              <h3>Add New Location</h3>

              {locationError && (

                <div className="disaster-alert disaster-alert-error">
                  {locationError}
                </div>

              )}


              <form
                className="quick-location-form"
                onSubmit={handleAddLocation}
              >

                <label>
                  Location Name *

                  <input
                    type="text"
                    name="location_name"
                    value={locationData.location_name}
                    onChange={handleLocationChange}
                    placeholder="Example: Chooralmala"
                    maxLength="100"
                    required
                  />
                </label>


                <label>
                  Location Type *

                  <select
                    name="location_type"
                    value={locationData.location_type}
                    onChange={handleLocationChange}
                    required
                  >

                    <option value="Disaster Affected Area">
                      Disaster Affected Area
                    </option>

                    <option value="Village">Village</option>

                    <option value="Town">Town</option>

                    <option value="City">City</option>

                    <option value="Taluk">Taluk</option>

                    <option value="Other">Other</option>

                  </select>
                </label>


                <label>
                  District *

                  <input
                    type="text"
                    name="district"
                    value={locationData.district}
                    onChange={handleLocationChange}
                    placeholder="Enter district"
                    maxLength="100"
                    required
                  />
                </label>


                <label>
                  State *

                  <input
                    type="text"
                    name="state"
                    value={locationData.state}
                    onChange={handleLocationChange}
                    placeholder="Enter state"
                    maxLength="100"
                    required
                  />
                </label>


                <label>
                  Country *

                  <input
                    type="text"
                    name="country"
                    value={locationData.country}
                    onChange={handleLocationChange}
                    placeholder="Enter country"
                    maxLength="100"
                    required
                  />
                </label>


                <label>
                  Pincode

                  <input
                    type="text"
                    name="pincode"
                    value={locationData.pincode}
                    onChange={handleLocationChange}
                    placeholder="Enter pincode"
                    maxLength="10"
                  />
                </label>


                <div className="quick-location-actions">

                  <button
                    type="submit"
                    className="disaster-primary-button"
                    disabled={locationSaving}
                  >
                    {locationSaving ? "Saving..." : "Save Location"}
                  </button>

                  <button
                    type="button"
                    className="disaster-cancel-button"
                    onClick={() => setShowLocationForm(false)}
                    disabled={locationSaving}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </div>

          )}


          {/* DISASTER FORM */}

          <form
            className="disaster-form"
            onSubmit={handleSubmit}
          >

            <div className="disaster-form-grid">

              <label>
                Disaster Type *

                <input
                  type="text"
                  name="disaster_type"
                  value={formData.disaster_type}
                  onChange={handleDisasterChange}
                  placeholder="Example: Flood, Landslide, Cyclone"
                  maxLength="60"
                  required
                />
              </label>


              <label>
                Severity *

                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleDisasterChange}
                  required
                >

                  {severityOptions.map(option => (

                    <option key={option} value={option}>
                      {displayLabel(option)}
                    </option>

                  ))}

                </select>
              </label>


              <label>
                Status

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleDisasterChange}
                >

                  {statusOptions.map(option => (

                    <option key={option} value={option}>
                      {displayLabel(option)}
                    </option>

                  ))}

                </select>
              </label>


              <label>
                Incident Date

                <input
                  type="date"
                  name="incident_date"
                  value={formData.incident_date}
                  onChange={handleDisasterChange}
                />
              </label>


              <label>
                Latitude (Optional)

                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleDisasterChange}
                  placeholder="Enter latitude"
                  step="any"
                  min="-90"
                  max="90"
                />
              </label>


              <label>
                Longitude (Optional)

                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleDisasterChange}
                  placeholder="Enter longitude"
                  step="any"
                  min="-180"
                  max="180"
                />
              </label>


              <label className="disaster-description-field">
                Description

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleDisasterChange}
                  placeholder="Describe the incident, affected people and current situation..."
                  rows="4"
                />

              </label>

            </div>


            <div className="disaster-form-actions">

              <button
                type="submit"
                className="disaster-primary-button"
                disabled={saving || !locations.length}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Disaster"
                    : "Submit Disaster Report"}
              </button>


              <button
                type="button"
                className="disaster-cancel-button"
                onClick={closeDisasterForm}
                disabled={saving}
              >
                Cancel
              </button>

            </div>

          </form>

        </section>

      )}


      {/* DISASTER LIST */}

      <section className="disaster-card">

        <div className="disaster-card-heading">

          <div>
            <h2>Disaster Reports</h2>

            <p>
              View and manage all reported incidents.
            </p>
          </div>

          <span className="disaster-result-count">
            {filteredDisasters.length} records
          </span>

        </div>


        {/* SEARCH AND FILTER */}

        <div className="disaster-filters">

          <input
            type="search"
            placeholder="Search report, disaster or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />


          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >

            <option value="All">All Severities</option>

            {severityOptions.map(option => (

              <option key={option} value={option}>
                {displayLabel(option)}
              </option>

            ))}

          </select>


          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >

            <option value="All">All Statuses</option>

            {statusOptions.map(option => (

              <option key={option} value={option}>
                {displayLabel(option)}
              </option>

            ))}

          </select>

        </div>


        {/* TABLE */}

        {loading ? (

          <div className="disaster-empty">
            Loading disaster reports...
          </div>

        ) : (

          <div className="disaster-table-wrapper">

            <table className="disaster-table">

              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Disaster</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Incident Date</th>
                  <th>Reported By</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>


              <tbody>

                {filteredDisasters.length > 0 ? (

                  filteredDisasters.map(disaster => (

                    <tr key={disaster.disaster_id}>

                      <td>
                        <strong>
                          D{String(disaster.disaster_id).padStart(3, "0")}
                        </strong>
                      </td>


                      <td>
                        {disaster.disaster_type}
                      </td>


                      <td>
                        <strong>{disaster.location_name || "Unknown"}</strong>

                        <small>
                          {[
                            disaster.district,
                            disaster.state
                          ].filter(Boolean).join(", ")}
                        </small>
                      </td>


                      <td>
                        <span
                          className={`disaster-badge severity-${disaster.severity}`}
                        >
                          {displayLabel(disaster.severity)}
                        </span>
                      </td>


                      <td>
                        <span
                          className={`disaster-badge status-${disaster.status}`}
                        >
                          {displayLabel(disaster.status)}
                        </span>
                      </td>


                      <td>
                        {formatDate(disaster.incident_date)}
                      </td>


                      <td>
                        {disaster.reporter_name || "—"}
                      </td>


                      {canManage && (

                        <td>

                          <div className="disaster-row-actions">

                            <button
                              type="button"
                              className="disaster-edit-button"
                              onClick={() => openEditForm(disaster)}
                            >
                              Edit
                            </button>


                            <button
                              type="button"
                              className="disaster-delete-button"
                              onClick={() => handleDelete(disaster)}
                              disabled={deletingId === disaster.disaster_id}
                            >
                              {deletingId === disaster.disaster_id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>

                        </td>

                      )}

                    </tr>

                  ))

                ) : (

                  <tr>

                    <td
                      colSpan={canManage ? 8 : 7}
                      className="disaster-empty"
                    >
                      No disaster reports found.
                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>

  );

}


export default Disasters;