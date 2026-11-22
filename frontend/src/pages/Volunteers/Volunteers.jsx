import { useEffect, useMemo, useState } from "react";

import {
  DataTable,
  PageHeader,
  SearchFilters,
  SectionCard,
  StatGrid,
  StatCard,
  StatusBadge
} from "../../components/ModuleUI";

import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

import "../../styles/Modules.css";
import "./Volunteers.css";


const emptyVolunteer = {
  location_id: "",
  full_name: "",
  email: "",
  phone: "",
  skills: "",
  availability: "available"
};


const emptyAssignment = {
  location_id: "",
  volunteer_id: "",
  disaster_id: "",
  assigned_role: "",
  notes: ""
};


const assignmentStatuses = [
  "assigned",
  "in_progress",
  "completed",
  "cancelled"
];


function formatDate(value) {

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


function Volunteers() {

  const { user } = useAuth();

  const role = user?.role?.toLowerCase();

  const isAdmin = role === "admin";

  const isCoordinator = role === "coordinator";

  const canManage = isAdmin || isCoordinator;


  // ----------------------------------------
  // DATA
  // ----------------------------------------

  const [locations, setLocations] = useState([]);

  const [disasters, setDisasters] = useState([]);

  const [volunteers, setVolunteers] = useState([]);

  const [assignments, setAssignments] = useState([]);

  const [locationSummary, setLocationSummary] = useState([]);


  // ----------------------------------------
  // LOCATION FILTER
  // ----------------------------------------

  const [selectedLocationId, setSelectedLocationId] =
    useState(isCoordinator ? "" : "All");


  // ----------------------------------------
  // VOLUNTEER SEARCH / FILTER
  // ----------------------------------------

  const [search, setSearch] = useState("");

  const [availabilityFilter, setAvailabilityFilter] =
    useState("All");


  // ----------------------------------------
  // ASSIGNMENT SEARCH / FILTER
  // ----------------------------------------

  const [assignmentSearch, setAssignmentSearch] = useState("");

  const [assignmentFilter, setAssignmentFilter] =
    useState("All");


  // ----------------------------------------
  // FORM STATE
  // ----------------------------------------

  const [showVolunteerForm, setShowVolunteerForm] = useState(false);

  const [showAssignmentForm, setShowAssignmentForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [volunteerForm, setVolunteerForm] =
    useState(emptyVolunteer);

  const [assignmentForm, setAssignmentForm] =
    useState(emptyAssignment);


  // ----------------------------------------
  // REQUEST STATE
  // ----------------------------------------

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [updatingAssignmentId, setUpdatingAssignmentId] =
    useState(null);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");


  // ----------------------------------------
  // LOAD VOLUNTEERS AND ASSIGNMENTS
  // ----------------------------------------

  const loadScopeData = async (locationId = null) => {

    const scoped = locationId && locationId !== "All";

    const query = scoped
      ? `?location_id=${encodeURIComponent(locationId)}`
      : "";

    const [volunteerResponse, assignmentResponse] =
      await Promise.all([

        apiRequest(`/volunteers${query}`),

        apiRequest(`/volunteer-assignments${query}`)

      ]);


    setVolunteers(volunteerResponse.data || []);

    setAssignments(assignmentResponse.data || []);

    setLocationSummary(
      volunteerResponse.location_summary || []
    );

  };


  // ----------------------------------------
  // INITIAL LOAD
  // ----------------------------------------

  const loadPage = async () => {

    try {

      setLoading(true);

      setError("");

      const [locationResponse, disasterResponse] =
        await Promise.all([

          apiRequest("/locations"),

          apiRequest("/disasters")

        ]);


      setLocations(locationResponse.data || []);

      setDisasters(disasterResponse.data || []);


      if (isCoordinator) {

        // Coordinator chooses the area being monitored.
        setSelectedLocationId("");

        setVolunteers([]);

        setAssignments([]);

        setLocationSummary([]);

      } else {

        // Admin initially sees all locations.
        setSelectedLocationId("All");

        await loadScopeData("All");

      }

    } catch (err) {

      setError(
        err.message || "Unable to load volunteer information."
      );

    } finally {

      setLoading(false);

    }

  };


  useEffect(() => {
    loadPage();
  }, []);


  // ----------------------------------------
  // CHANGE MONITORING LOCATION
  // ----------------------------------------

  const handleLocationChange = async (e) => {

    const locationId = e.target.value;

    setSelectedLocationId(locationId);

    setSearch("");

    setAvailabilityFilter("All");

    setAssignmentSearch("");

    setAssignmentFilter("All");

    setShowVolunteerForm(false);

    setShowAssignmentForm(false);

    setError("");

    setNotice("");


    if (!locationId) {

      setVolunteers([]);

      setAssignments([]);

      setLocationSummary([]);

      return;
    }


    try {

      setLoading(true);

      await loadScopeData(locationId);

    } catch (err) {

      setError(
        err.message || "Unable to load records for this location."
      );

      setVolunteers([]);

      setAssignments([]);

      setLocationSummary([]);

    } finally {

      setLoading(false);

    }

  };


  // ----------------------------------------
  // REFRESH CURRENT LOCATION
  // ----------------------------------------

  const refreshCurrentView = async () => {

    if (isCoordinator && !selectedLocationId) {
      return;
    }

    await loadScopeData(selectedLocationId);

  };


  // ----------------------------------------
  // SELECTED LOCATION
  // ----------------------------------------

  const selectedLocation = locations.find(location =>

    String(location.location_id) ===
    String(selectedLocationId)

  );


  const locationViewReady =
    !isCoordinator || Boolean(selectedLocationId);


  // ----------------------------------------
  // FORM LOCATION-SCOPED VOLUNTEERS
  // ----------------------------------------

  const formVolunteers = useMemo(() => {

    if (!assignmentForm.location_id) return [];

    return volunteers.filter(volunteer =>

      String(volunteer.location_id) ===
        String(assignmentForm.location_id)
      &&
      volunteer.availability === "available"

    );

  }, [volunteers, assignmentForm.location_id]);


  // ----------------------------------------
  // FORM LOCATION-SCOPED DISASTERS
  // ----------------------------------------

  const formDisasters = useMemo(() => {

    if (!assignmentForm.location_id) return [];

    return disasters.filter(disaster =>

      String(disaster.location_id) ===
        String(assignmentForm.location_id)
      &&
      !["resolved", "closed"].includes(disaster.status)

    );

  }, [disasters, assignmentForm.location_id]);


  // ----------------------------------------
  // VOLUNTEER FORM INPUTS
  // ----------------------------------------

  const handleVolunteerChange = (e) => {

    const { name, value } = e.target;

    setVolunteerForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // ----------------------------------------
  // OPEN ADD VOLUNTEER FORM
  // ----------------------------------------

  const handleAddVolunteer = () => {

    setEditingId(null);

    setVolunteerForm({

      ...emptyVolunteer,

      location_id:
        selectedLocationId &&
        selectedLocationId !== "All"
          ? selectedLocationId
          : ""

    });

    setError("");

    setNotice("");

    setShowAssignmentForm(false);

    setShowVolunteerForm(true);

  };


  // ----------------------------------------
  // OPEN EDIT VOLUNTEER FORM
  // ----------------------------------------

  const handleEditVolunteer = (volunteer) => {

    setEditingId(volunteer.volunteer_id);

    setVolunteerForm({

      location_id: String(volunteer.location_id || ""),

      full_name: volunteer.full_name || "",

      email: volunteer.email || "",

      phone: volunteer.phone || "",

      skills: volunteer.skills || "",

      availability: volunteer.availability || "available"

    });

    setError("");

    setNotice("");

    setShowAssignmentForm(false);

    setShowVolunteerForm(true);

  };


  // ----------------------------------------
  // CLOSE VOLUNTEER FORM
  // ----------------------------------------

  const closeVolunteerForm = () => {

    setShowVolunteerForm(false);

    setEditingId(null);

    setVolunteerForm({ ...emptyVolunteer });

  };


  // ----------------------------------------
  // SAVE VOLUNTEER
  // ----------------------------------------

  const handleVolunteerSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setNotice("");


    if (!volunteerForm.location_id) {

      setError("Please select a volunteer location.");

      return;
    }


    const editingVolunteer = volunteers.find(

      volunteer =>
        volunteer.volunteer_id === editingId

    );


    // Do not manually alter availability while the volunteer
    // has an active assignment.
    const payload = {

      ...volunteerForm,

      location_id: Number(volunteerForm.location_id)

    };

    if (editingVolunteer?.availability === "assigned") {

      delete payload.availability;

    }


    try {

      setSaving(true);

      const isEditing = editingId !== null;

      const response = await apiRequest(

        isEditing
          ? `/volunteers/${editingId}`
          : "/volunteers",

        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }

      );


      setNotice(
        response.message || "Volunteer saved successfully."
      );

      closeVolunteerForm();

      await refreshCurrentView();

    } catch (err) {

      setError(
        err.message || "Unable to save volunteer."
      );

    } finally {

      setSaving(false);

    }

  };


  // ----------------------------------------
  // DELETE VOLUNTEER
  // ----------------------------------------

  const handleDeleteVolunteer = async (volunteer) => {

    const confirmed = window.confirm(

      `Delete volunteer "${volunteer.full_name}"?\n\nProfiles with assignment history cannot be deleted.`

    );

    if (!confirmed) return;


    try {

      setDeletingId(volunteer.volunteer_id);

      setError("");

      setNotice("");

      const response = await apiRequest(

        `/volunteers/${volunteer.volunteer_id}`,

        {
          method: "DELETE"
        }

      );


      setNotice(
        response.message || "Volunteer deleted successfully."
      );

      await refreshCurrentView();

    } catch (err) {

      setError(
        err.message || "Unable to delete volunteer."
      );

    } finally {

      setDeletingId(null);

    }

  };


  // ----------------------------------------
  // OPEN ASSIGNMENT FORM
  // ----------------------------------------

  const handleAddAssignment = () => {

    setAssignmentForm({

      ...emptyAssignment,

      location_id:
        selectedLocationId !== "All"
          ? selectedLocationId
          : ""

    });

    setError("");

    setNotice("");

    setShowVolunteerForm(false);

    setShowAssignmentForm(true);

  };


  // ----------------------------------------
  // ASSIGNMENT FORM INPUTS
  // ----------------------------------------

  const handleAssignmentChange = (e) => {

    const { name, value } = e.target;

    setAssignmentForm(previous => ({

      ...previous,

      [name]: value,

      ...(name === "location_id"
        ? {
            volunteer_id: "",
            disaster_id: ""
          }
        : {})

    }));

  };


  // ----------------------------------------
  // CREATE VOLUNTEER ASSIGNMENT
  // ----------------------------------------

  const handleAssignmentSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setNotice("");


    if (
      !assignmentForm.location_id ||
      !assignmentForm.volunteer_id ||
      !assignmentForm.disaster_id ||
      !assignmentForm.assigned_role.trim()
    ) {

      setError(
        "Select a location, available volunteer, disaster and assigned role."
      );

      return;
    }


    const volunteer = formVolunteers.find(item =>

      String(item.volunteer_id) ===
      String(assignmentForm.volunteer_id)

    );

    const disaster = formDisasters.find(item =>

      String(item.disaster_id) ===
      String(assignmentForm.disaster_id)

    );


    if (!volunteer || !disaster) {

      setError(
        "The selected volunteer and disaster must belong to the same location."
      );

      return;
    }


    try {

      setSaving(true);

      const response = await apiRequest(
        "/volunteer-assignments",
        {
          method: "POST",
          body: JSON.stringify({
            volunteer_id: Number(assignmentForm.volunteer_id),
            disaster_id: Number(assignmentForm.disaster_id),
            assigned_role: assignmentForm.assigned_role.trim(),
            notes: assignmentForm.notes.trim() || null
          })
        }
      );


      setNotice(
        response.message || "Volunteer assigned successfully."
      );

      setShowAssignmentForm(false);

      setAssignmentForm({ ...emptyAssignment });

      await refreshCurrentView();

    } catch (err) {

      setError(
        err.message || "Unable to create volunteer assignment."
      );

    } finally {

      setSaving(false);

    }

  };


  // ----------------------------------------
  // UPDATE ASSIGNMENT STATUS
  // ----------------------------------------

  const handleAssignmentStatus = async (
    assignment,
    newStatus
  ) => {

    const confirmed = window.confirm(

      `Change assignment AS${String(assignment.assignment_id).padStart(3, "0")} to ${displayLabel(newStatus)}?`

    );

    if (!confirmed) return;


    try {

      setUpdatingAssignmentId(assignment.assignment_id);

      setError("");

      setNotice("");

      const response = await apiRequest(

        `/volunteer-assignments/${assignment.assignment_id}`,

        {
          method: "PUT",
          body: JSON.stringify({
            assignment_status: newStatus
          })
        }

      );


      setNotice(
        response.message || "Assignment status updated."
      );

      await refreshCurrentView();

    } catch (err) {

      setError(
        err.message || "Unable to update assignment."
      );

    } finally {

      setUpdatingAssignmentId(null);

    }

  };


  // ----------------------------------------
  // LOCATION-SCOPED VOLUNTEERS
  // ----------------------------------------

  const scopedVolunteers = useMemo(() => {

    if (
      !selectedLocationId ||
      selectedLocationId === "All"
    ) {
      return volunteers;
    }

    return volunteers.filter(volunteer =>

      String(volunteer.location_id) ===
      String(selectedLocationId)

    );

  }, [volunteers, selectedLocationId]);


  // ----------------------------------------
  // LOCATION-SCOPED ASSIGNMENTS
  // ----------------------------------------

  const scopedAssignments = useMemo(() => {

    if (
      !selectedLocationId ||
      selectedLocationId === "All"
    ) {
      return assignments;
    }

    return assignments.filter(assignment =>

      String(assignment.disaster_location_id) ===
      String(selectedLocationId)

    );

  }, [assignments, selectedLocationId]);


  // ----------------------------------------
  // FILTER VOLUNTEERS
  // ----------------------------------------

  const filteredVolunteers = scopedVolunteers.filter(volunteer => {

    const text = search.toLowerCase().trim();

    const searchableValues = [
      volunteer.full_name,
      volunteer.email,
      volunteer.phone,
      volunteer.location_name,
      volunteer.skills
    ];

    const matchesSearch = searchableValues.some(value =>

      String(value || "")
        .toLowerCase()
        .includes(text)

    );

    const matchesAvailability =
      availabilityFilter === "All" ||
      volunteer.availability === availabilityFilter;

    return matchesSearch && matchesAvailability;

  });


  // ----------------------------------------
  // FILTER ASSIGNMENTS
  // ----------------------------------------

  const filteredAssignments = scopedAssignments.filter(assignment => {

    const text = assignmentSearch.toLowerCase().trim();

    const searchableValues = [
      assignment.assignment_id,
      assignment.full_name,
      assignment.disaster_type,
      assignment.location_name,
      assignment.assigned_role,
      assignment.notes
    ];

    const matchesSearch = searchableValues.some(value =>

      String(value || "")
        .toLowerCase()
        .includes(text)

    );

    const matchesStatus =
      assignmentFilter === "All" ||
      assignment.assignment_status === assignmentFilter;

    return matchesSearch && matchesStatus;

  });


  // ----------------------------------------
  // VOLUNTEER STATISTICS
  // ----------------------------------------

  const totalVolunteers = scopedVolunteers.length;

  const availableCount = scopedVolunteers.filter(
    volunteer => volunteer.availability === "available"
  ).length;

  const assignedCount = scopedVolunteers.filter(
    volunteer => volunteer.availability === "assigned"
  ).length;

  const unavailableCount = scopedVolunteers.filter(
    volunteer => volunteer.availability === "unavailable"
  ).length;


  // ----------------------------------------
  // ASSIGNMENT STATISTICS
  // ----------------------------------------

  const totalAssignments = scopedAssignments.length;

  const activeAssignments = scopedAssignments.filter(
    assignment =>
      ["assigned", "in_progress"].includes(
        assignment.assignment_status
      )
  ).length;

  const completedCount = scopedAssignments.filter(
    assignment => assignment.assignment_status === "completed"
  ).length;


  // ----------------------------------------
  // LOCATION-WISE OVERVIEW
  // ----------------------------------------

  const overviewRows = locationSummary.map(location => ({

    locationId: location.location_id,

    name: location.location_name,

    district: location.district,

    state: location.state,

    total: location.total_volunteers,

    available: location.available_volunteers,

    assigned: location.assigned_volunteers,

    unavailable: location.unavailable_volunteers

  }));


  const overviewColumns = [

    { key: "name", label: "Location" },

    { key: "district", label: "District" },

    { key: "state", label: "State" },

    { key: "total", label: "Total Volunteers" },

    { key: "available", label: "Available" },

    { key: "assigned", label: "Assigned" },

    { key: "unavailable", label: "Unavailable" }

  ];


  // ----------------------------------------
  // VOLUNTEER TABLE
  // ----------------------------------------

  const volunteerRows = filteredVolunteers.map(volunteer => ({

    volunteerId: volunteer.volunteer_id,

    id: `V${String(volunteer.volunteer_id).padStart(3, "0")}`,

    name: volunteer.full_name,

    location: volunteer.location_name || "Not assigned",

    phone: volunteer.phone,

    email: volunteer.email || "—",

    skills: volunteer.skills || "Not specified",

    availability: volunteer.availability,

    original: volunteer

  }));


  const volunteerColumns = [

    { key: "id", label: "Volunteer ID" },

    { key: "name", label: "Full Name" },

    { key: "location", label: "Location" },

    { key: "phone", label: "Phone" },

    { key: "email", label: "Email" },

    { key: "skills", label: "Skills" },

    {
      key: "availability",
      label: "Availability",
      render: row => (
        <StatusBadge status={displayLabel(row.availability)} />
      )
    },

    {
      key: "actions",
      label: "Actions",
      render: row => (

        <div className="volunteer-actions">

          <button
            type="button"
            className="volunteer-edit-button"
            onClick={() => handleEditVolunteer(row.original)}
          >
            Edit
          </button>

          <button
            type="button"
            className="volunteer-delete-button"
            onClick={() => handleDeleteVolunteer(row.original)}
            disabled={deletingId === row.volunteerId}
          >
            {deletingId === row.volunteerId
              ? "Deleting..."
              : "Delete"}
          </button>

        </div>

      )
    }

  ];


  // ----------------------------------------
  // ASSIGNMENT TABLE
  // ----------------------------------------

  const assignmentRows = filteredAssignments.map(assignment => ({

    assignmentId: assignment.assignment_id,

    id: `AS${String(assignment.assignment_id).padStart(3, "0")}`,

    volunteer: assignment.full_name,

    disaster: assignment.disaster_type,

    location: assignment.location_name || "Unknown",

    role: assignment.assigned_role,

    status: assignment.assignment_status,

    assignedBy: assignment.assigned_by_name || "—",

    assignedAt: formatDate(assignment.assigned_at),

    original: assignment

  }));


  const assignmentColumns = [

    { key: "id", label: "Assignment ID" },

    { key: "volunteer", label: "Volunteer" },

    { key: "disaster", label: "Disaster" },

    { key: "location", label: "Location" },

    { key: "role", label: "Assigned Role" },

    {
      key: "status",
      label: "Status",
      render: row => (
        <StatusBadge status={displayLabel(row.status)} />
      )
    },

    { key: "assignedBy", label: "Assigned By" },

    { key: "assignedAt", label: "Assigned At" },

    {
      key: "actions",
      label: "Actions",
      render: row => {

        const assignment = row.original;

        const busy =
          updatingAssignmentId === assignment.assignment_id;

        if (busy) {
          return (
            <span className="volunteer-muted">
              Updating...
            </span>
          );
        }

        return (

          <div className="volunteer-actions">

            {assignment.assignment_status === "assigned" && (

              <button
                type="button"
                className="volunteer-edit-button"
                onClick={() =>
                  handleAssignmentStatus(
                    assignment,
                    "in_progress"
                  )
                }
              >
                Start
              </button>

            )}


            {["assigned", "in_progress"].includes(
              assignment.assignment_status
            ) && (

              <button
                type="button"
                className="volunteer-complete-button"
                onClick={() =>
                  handleAssignmentStatus(
                    assignment,
                    "completed"
                  )
                }
              >
                Complete
              </button>

            )}


            {["assigned", "in_progress"].includes(
              assignment.assignment_status
            ) && (

              <button
                type="button"
                className="volunteer-delete-button"
                onClick={() =>
                  handleAssignmentStatus(
                    assignment,
                    "cancelled"
                  )
                }
              >
                Cancel
              </button>

            )}

            {!["assigned", "in_progress"].includes(
              assignment.assignment_status
            ) && (

              <span className="volunteer-muted">
                No actions
              </span>

            )}

          </div>

        );

      }
    }

  ];


  // ----------------------------------------
  // ACCESS CONTROL
  // ----------------------------------------

  if (!canManage) {

    return (

      <div className="module-page">

        <PageHeader
          title="Volunteer Management"
          description="Manage volunteer profiles and disaster assignments."
        />

        <SectionCard title="Access Restricted">

          <p>
            Volunteer Management is available to administrators
            and coordinators.
          </p>

        </SectionCard>

      </div>

    );

  }


  // ----------------------------------------
  // MAIN PAGE
  // ----------------------------------------

  return (

    <div className="module-page volunteers-page">

      <PageHeader

        title="Volunteer Management"

        description="Manage volunteers, skills, availability and disaster assignments."

        action={
          locationViewReady && (

            <button
              type="button"
              className="module-primary-button"
              onClick={handleAddVolunteer}
            >
              + Add Volunteer
            </button>

          )
        }

      />


      {notice && (
        <div className="volunteer-notice">
          {notice}
        </div>
      )}


      {error && (
        <div className="volunteer-error">
          {error}
        </div>
      )}


      {/* LOCATION SELECTOR */}

      <SectionCard title="Select Volunteer Location">

        <div className="volunteer-location-filter">

          <label htmlFor="volunteer-location-filter">
            View volunteer records for
          </label>

          <select
            id="volunteer-location-filter"
            value={selectedLocationId}
            onChange={handleLocationChange}
          >

            {isCoordinator ? (

              <option value="">
                Select the location you are monitoring
              </option>

            ) : (

              <option value="All">
                All Locations
              </option>

            )}

            {locations.map(location => (

              <option
                key={location.location_id}
                value={String(location.location_id)}
              >
                {location.location_name}, {location.district}, {location.state}
              </option>

            ))}

          </select>


          {isCoordinator && (

            <p>
              Select the area where you are coordinating volunteer operations.
            </p>

          )}

        </div>

      </SectionCard>


      {/* COORDINATOR EMPTY STATE */}

      {isCoordinator && !selectedLocationId && (

        <div className="volunteer-empty">

          <h3>Select a location to monitor</h3>

          <p>
            Choose a location above to view its volunteers,
            availability and disaster assignments.
          </p>

        </div>

      )}


      {/* MAIN LOCATION CONTENT */}

      {locationViewReady && (

        <>

          <div className="volunteer-current-location">

            <span>
              {selectedLocationId === "All"
                ? "Showing combined volunteer information"
                : "Currently monitoring"}
            </span>

            <strong>
              {selectedLocationId === "All"
                ? "All Locations"
                : selectedLocation?.location_name || "Selected Location"}
            </strong>

            {selectedLocation && (

              <small>
                {[
                  selectedLocation.district,
                  selectedLocation.state
                ].filter(Boolean).join(", ")}
              </small>

            )}

          </div>


          {/* LOCATION-WISE STATISTICS */}

          <StatGrid>

            <StatCard
              label="Total Volunteers"
              value={totalVolunteers}
              note="In selected location"
            />

            <StatCard
              label="Available"
              value={availableCount}
              note="Ready for deployment"
            />

            <StatCard
              label="Currently Assigned"
              value={assignedCount}
              note="On active assignments"
            />

            <StatCard
              label="Unavailable"
              value={unavailableCount}
              note={`${activeAssignments} active assignments`}
            />

          </StatGrid>


          {/* ADMIN LOCATION OVERVIEW */}

          {isAdmin && selectedLocationId === "All" && (

            <SectionCard title="Volunteer Overview by Location">

              <p className="volunteer-section-description">
                Compare volunteer availability across every registered
                location. Select a location above to view its detailed
                volunteer records.
              </p>

              <DataTable
                columns={overviewColumns}
                data={overviewRows}
                rowKey="locationId"
                emptyMessage="No registered locations found."
              />

            </SectionCard>

          )}


          {/* ADD / EDIT VOLUNTEER */}

          {showVolunteerForm && (

            <SectionCard
              title={
                editingId
                  ? "Edit Volunteer"
                  : "Register New Volunteer"
              }
            >

              <form
                className="module-form volunteer-form"
                onSubmit={handleVolunteerSubmit}
              >

                <label>
                  Full Name *

                  <input
                    type="text"
                    name="full_name"
                    value={volunteerForm.full_name}
                    onChange={handleVolunteerChange}
                    placeholder="Enter full name"
                    maxLength="120"
                    required
                  />

                </label>


                <label>
                  Phone Number *

                  <input
                    type="tel"
                    name="phone"
                    value={volunteerForm.phone}
                    onChange={handleVolunteerChange}
                    placeholder="Enter phone number"
                    maxLength="20"
                    required
                  />

                </label>


                <label>
                  Email

                  <input
                    type="email"
                    name="email"
                    value={volunteerForm.email}
                    onChange={handleVolunteerChange}
                    placeholder="Enter email address"
                    maxLength="150"
                  />

                </label>


                <label>
                  Location *

                  <select
                    name="location_id"
                    value={volunteerForm.location_id}
                    onChange={handleVolunteerChange}
                    required
                  >

                    <option value="">
                      Select Location
                    </option>

                    {locations.map(location => (

                      <option
                        key={location.location_id}
                        value={String(location.location_id)}
                      >
                        {location.location_name}, {location.district}
                      </option>

                    ))}

                  </select>

                </label>


                <label className="volunteer-full-width">
                  Skills

                  <textarea
                    name="skills"
                    value={volunteerForm.skills}
                    onChange={handleVolunteerChange}
                    placeholder="Example: First Aid, Rescue Support, Driving"
                    rows="3"
                  />

                </label>


                <label>
                  Availability

                  <select
                    name="availability"
                    value={volunteerForm.availability}
                    onChange={handleVolunteerChange}
                    disabled={
                      volunteers.find(
                        item => item.volunteer_id === editingId
                      )?.availability === "assigned"
                    }
                  >

                    <option value="available">
                      Available
                    </option>

                    <option value="unavailable">
                      Unavailable
                    </option>

                    {volunteerForm.availability === "assigned" && (

                      <option value="assigned">
                        Assigned
                      </option>

                    )}

                  </select>

                  {volunteerForm.availability === "assigned" && (

                    <small className="volunteer-hint">
                      Availability is managed by the assignment workflow.
                    </small>

                  )}

                </label>


                <div className="full-width volunteer-form-actions">

                  <button
                    type="submit"
                    className="module-primary-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Update Volunteer"
                        : "Register Volunteer"}
                  </button>


                  <button
                    type="button"
                    className="volunteer-cancel-button"
                    onClick={closeVolunteerForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </SectionCard>

          )}


          {/* VOLUNTEER LIST */}

          <SectionCard title="Volunteer List">

            <SearchFilters>

              <input
                type="search"
                placeholder="Search name, phone, skill or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />


              <select
                value={availabilityFilter}
                onChange={e => setAvailabilityFilter(e.target.value)}
              >

                <option value="All">
                  All Availability
                </option>

                <option value="available">
                  Available
                </option>

                <option value="assigned">
                  Assigned
                </option>

                <option value="unavailable">
                  Unavailable
                </option>

              </select>

            </SearchFilters>


            {loading ? (

              <p className="module-muted">
                Loading volunteers...
              </p>

            ) : (

              <DataTable
                columns={volunteerColumns}
                data={volunteerRows}
                rowKey="volunteerId"
                emptyMessage="No volunteers found for this location."
              />

            )}

          </SectionCard>


          {/* VOLUNTEER ASSIGNMENTS */}

          <SectionCard title="Volunteer Assignments">

            <div className="volunteer-assignment-heading">

              <div>
                <h3>Disaster Deployment</h3>

                <p>
                  Assign volunteers registered in this location
                  to disasters affecting the same area.
                </p>
              </div>


              <button
                type="button"
                className="module-primary-button"
                onClick={handleAddAssignment}
                disabled={
                  !scopedVolunteers.some(
                    volunteer => volunteer.availability === "available"
                  ) ||
                  !disasters.some(disaster =>
                    (
                      selectedLocationId === "All" ||
                      String(disaster.location_id) === selectedLocationId
                    ) &&
                    !["resolved", "closed"].includes(disaster.status)
                  )
                }
              >
                + Assign Volunteer
              </button>

            </div>


            {/* ASSIGNMENT FORM */}

            {showAssignmentForm && (

              <form
                className="module-form volunteer-form"
                onSubmit={handleAssignmentSubmit}
              >

                <label>
                  Location *

                  <select
                    name="location_id"
                    value={assignmentForm.location_id}
                    onChange={handleAssignmentChange}
                    required
                    disabled={isCoordinator}
                  >

                    <option value="">
                      Select Location
                    </option>

                    {locations.map(location => (

                      <option
                        key={location.location_id}
                        value={String(location.location_id)}
                      >
                        {location.location_name}, {location.district}
                      </option>

                    ))}

                  </select>

                </label>


                <label>
                  Select Volunteer *

                  <select
                    name="volunteer_id"
                    value={assignmentForm.volunteer_id}
                    onChange={handleAssignmentChange}
                    required
                    disabled={!assignmentForm.location_id}
                  >

                    <option value="">
                      Select Available Volunteer
                    </option>

                    {formVolunteers.map(volunteer => (

                      <option
                        key={volunteer.volunteer_id}
                        value={String(volunteer.volunteer_id)}
                      >
                        {volunteer.full_name}
                        {volunteer.skills
                          ? ` — ${volunteer.skills}`
                          : ""}
                      </option>

                    ))}

                  </select>

                  {assignmentForm.location_id &&
                    formVolunteers.length === 0 && (

                    <small className="volunteer-hint">
                      No available volunteers in this location.
                    </small>

                  )}

                </label>


                <label>
                  Select Disaster *

                  <select
                    name="disaster_id"
                    value={assignmentForm.disaster_id}
                    onChange={handleAssignmentChange}
                    required
                    disabled={!assignmentForm.location_id}
                  >

                    <option value="">
                      Select Disaster
                    </option>

                    {formDisasters.map(disaster => (

                      <option
                        key={disaster.disaster_id}
                        value={String(disaster.disaster_id)}
                      >
                        {disaster.disaster_type} — {disaster.location_name}
                      </option>

                    ))}

                  </select>

                  {assignmentForm.location_id &&
                    formDisasters.length === 0 && (

                    <small className="volunteer-hint">
                      No active disasters are registered in this location.
                    </small>

                  )}

                </label>


                <label>
                  Assigned Role *

                  <input
                    type="text"
                    name="assigned_role"
                    value={assignmentForm.assigned_role}
                    onChange={handleAssignmentChange}
                    placeholder="Example: First Aid Support"
                    maxLength="100"
                    required
                  />

                </label>


                <label className="volunteer-full-width">
                  Notes

                  <textarea
                    name="notes"
                    value={assignmentForm.notes}
                    onChange={handleAssignmentChange}
                    placeholder="Assignment details and instructions..."
                    rows="3"
                  />

                </label>


                <div className="full-width volunteer-form-actions">

                  <button
                    type="submit"
                    className="module-primary-button"
                    disabled={
                      saving ||
                      !formVolunteers.length ||
                      !formDisasters.length
                    }
                  >
                    {saving
                      ? "Assigning..."
                      : "Create Assignment"}
                  </button>


                  <button
                    type="button"
                    className="volunteer-cancel-button"
                    onClick={() => setShowAssignmentForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            )}


            {/* ASSIGNMENT FILTERS */}

            <SearchFilters>

              <input
                type="search"
                placeholder="Search volunteer, disaster or role..."
                value={assignmentSearch}
                onChange={e => setAssignmentSearch(e.target.value)}
              />


              <select
                value={assignmentFilter}
                onChange={e => setAssignmentFilter(e.target.value)}
              >

                <option value="All">
                  All Assignment Statuses
                </option>

                {assignmentStatuses.map(status => (

                  <option
                    key={status}
                    value={status}
                  >
                    {displayLabel(status)}
                  </option>

                ))}

              </select>

            </SearchFilters>


            {loading ? (

              <p className="module-muted">
                Loading assignments...
              </p>

            ) : (

              <DataTable
                columns={assignmentColumns}
                data={assignmentRows}
                rowKey="assignmentId"
                emptyMessage="No assignments found for this location."
              />

            )}

          </SectionCard>

        </>

      )}

    </div>

  );

}


export default Volunteers;