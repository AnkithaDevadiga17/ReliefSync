
import { useState, useEffect } from "react";

import {
  DataTable,
  PageHeader,
  SearchFilters,
  SectionCard,
  StatGrid,
  StatCard,
  StatusBadge
} from "../../components/ModuleUI";

import "../../styles/Modules.css";
import "./Volunteers.css";

const API = "http://127.0.0.1:5000/api";

const emptyVolunteer = {
  location_id: "",
  full_name: "",
  email: "",
  phone: "",
  skills: "",
  availability: "available"
};

const emptyAssignment = {
  volunteer_id: "",
  disaster_id: "",
  assigned_role: "",
  notes: ""
};

function Volunteers() {

  const [volunteers, setVolunteers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [disasters, setDisasters] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showVolunteerForm, setShowVolunteerForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [volunteerForm, setVolunteerForm] = useState(emptyVolunteer);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);


  // --------------------------------
  // LOAD DATA
  // --------------------------------

  const loadData = async () => {

    try {

      setLoading(true);
      setError("");

      const endpoints = [
        "/volunteers",
        "/volunteer-locations",
        "/disasters",
        "/volunteer-assignments"
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint => fetch(`${API}${endpoint}`))
      );

      const results = await Promise.all(
        responses.map(response => response.json())
      );

      responses.forEach((response, index) => {

        if (!response.ok || !results[index].success) {
          throw new Error(
            results[index].message || "Unable to load volunteer data."
          );
        }

      });

      setVolunteers(results[0].data || []);
      setLocations(results[1].data || []);
      setDisasters(results[2].data || []);
      setAssignments(results[3].data || []);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {
    loadData();
  }, []);


  // --------------------------------
  // VOLUNTEER FORM
  // --------------------------------

  const handleVolunteerChange = (e) => {

    const { name, value } = e.target;

    setVolunteerForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  const handleAddVolunteer = () => {

    setEditingId(null);
    setVolunteerForm({
      ...emptyVolunteer,
      location_id: locations.length
        ? String(locations[0].location_id)
        : ""
    });

    setError("");
    setNotice("");
    setShowVolunteerForm(true);

  };


  const handleEditVolunteer = (volunteer) => {

    setEditingId(volunteer.volunteer_id);

    setVolunteerForm({
      location_id: volunteer.location_id
        ? String(volunteer.location_id)
        : "",
      full_name: volunteer.full_name || "",
      email: volunteer.email || "",
      phone: volunteer.phone || "",
      skills: volunteer.skills || "",
      availability: volunteer.availability
    });

    setError("");
    setNotice("");
    setShowVolunteerForm(true);

  };


  // --------------------------------
  // SAVE VOLUNTEER
  // --------------------------------

  const handleVolunteerSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const isEditing = editingId !== null;

      const payload = {
        ...volunteerForm,
        location_id: volunteerForm.location_id
          ? Number(volunteerForm.location_id)
          : null
      };

      const response = await fetch(
        isEditing
          ? `${API}/volunteers/${editingId}`
          : `${API}/volunteers`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save volunteer.");
      }

      setShowVolunteerForm(false);
      setEditingId(null);
      setVolunteerForm(emptyVolunteer);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------
  // DELETE VOLUNTEER
  // --------------------------------

  const handleDeleteVolunteer = async (id) => {

    if (!window.confirm("Are you sure you want to delete this volunteer?")) {
      return;
    }

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API}/volunteers/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete volunteer.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // ASSIGNMENT FORM
  // --------------------------------

  const handleAssignmentChange = (e) => {

    const { name, value } = e.target;

    setAssignmentForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  const handleAddAssignment = () => {

    const availableVolunteers = volunteers.filter(
      v => v.availability === "available"
    );

    setAssignmentForm({
      ...emptyAssignment,
      volunteer_id: availableVolunteers.length
        ? String(availableVolunteers[0].volunteer_id)
        : "",
      disaster_id: disasters.length
        ? String(disasters[0].disaster_id)
        : ""
    });

    setError("");
    setNotice("");
    setShowAssignmentForm(true);

  };


  // --------------------------------
  // CREATE ASSIGNMENT
  // --------------------------------

  const handleAssignmentSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        ...assignmentForm,
        volunteer_id: Number(assignmentForm.volunteer_id),
        disaster_id: Number(assignmentForm.disaster_id)
      };

      const response = await fetch(
        `${API}/volunteer-assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to assign volunteer.");
      }

      setShowAssignmentForm(false);
      setAssignmentForm(emptyAssignment);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------
  // UPDATE ASSIGNMENT STATUS
  // --------------------------------

  const handleAssignmentStatus = async (assignment, newStatus) => {

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API}/volunteer-assignments/${assignment.assignment_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            assignment_status: newStatus
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update assignment.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // FILTER VOLUNTEERS
  // --------------------------------

  const filteredVolunteers = volunteers.filter(volunteer => {

    const text = search.toLowerCase();

    const matchesSearch = [
      volunteer.full_name,
      volunteer.email,
      volunteer.phone,
      volunteer.location_name,
      volunteer.skills
    ].some(value =>
      String(value || "").toLowerCase().includes(text)
    );

    const matchesAvailability =
      availability === "All" ||
      volunteer.availability === availability;

    return matchesSearch && matchesAvailability;

  });


  // --------------------------------
  // VOLUNTEER TABLE
  // --------------------------------

  const volunteerRows = filteredVolunteers.map(volunteer => ({

    volunteerId: volunteer.volunteer_id,

    id: `V${String(volunteer.volunteer_id).padStart(3, "0")}`,

    name: volunteer.full_name,

    location: volunteer.location_name || "Not assigned",

    phone: volunteer.phone,

    skills: volunteer.skills || "Not specified",

    availability: volunteer.availability,

    original: volunteer

  }));


  const volunteerColumns = [

    { key: "id", label: "Volunteer ID" },
    { key: "name", label: "Full Name" },
    { key: "location", label: "Location" },
    { key: "phone", label: "Phone" },
    { key: "skills", label: "Skills" },

    {
      key: "availability",
      label: "Availability",
      render: row => (
        <StatusBadge status={row.availability} />
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
            onClick={() => handleDeleteVolunteer(row.volunteerId)}
          >
            Delete
          </button>

        </div>
      )
    }

  ];


  // --------------------------------
  // ASSIGNMENT TABLE
  // --------------------------------

  const assignmentRows = assignments.map(assignment => ({
    assignmentId: assignment.assignment_id,
    id: `AS${String(assignment.assignment_id).padStart(3, "0")}`,
    volunteer: assignment.full_name,
    disaster: assignment.disaster_type,
    location: assignment.location_name || "Unknown",
    role: assignment.assigned_role,
    status: assignment.assignment_status,
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
        <StatusBadge status={row.status.replaceAll("_", " ")} />
      )
    },

    {
      key: "actions",
      label: "Actions",
      render: row => (

        <div className="volunteer-actions">

          {row.status === "assigned" && (
            <button
              type="button"
              className="volunteer-edit-button"
              onClick={() =>
                handleAssignmentStatus(row.original, "in_progress")
              }
            >
              Start
            </button>
          )}

          {(row.status === "assigned" || row.status === "in_progress") && (

            <button
              type="button"
              className="volunteer-complete-button"
              onClick={() =>
                handleAssignmentStatus(row.original, "completed")
              }
            >
              Complete
            </button>

          )}

          {(row.status === "assigned" || row.status === "in_progress") && (

            <button
              type="button"
              className="volunteer-delete-button"
              onClick={() =>
                handleAssignmentStatus(row.original, "cancelled")
              }
            >
              Cancel
            </button>

          )}

        </div>
      )
    }

  ];


  // --------------------------------
  // STATISTICS
  // --------------------------------

  const availableCount = volunteers.filter(
    v => v.availability === "available"
  ).length;

  const assignedCount = volunteers.filter(
    v => v.availability === "assigned"
  ).length;

  const completedCount = assignments.filter(
    a => a.assignment_status === "completed"
  ).length;


  // --------------------------------
  // PAGE
  // --------------------------------

  return (

    <div className="module-page">

      <PageHeader
        title="Volunteer Management"
        description="Manage volunteer profiles, skills, availability and disaster assignments."
        action={
          <button
            type="button"
            className="module-primary-button"
            onClick={handleAddVolunteer}
          >
            Add Volunteer
          </button>
        }
      />


      {notice && (
        <p className="volunteer-notice">{notice}</p>
      )}

      {error && (
        <p className="volunteer-error">{error}</p>
      )}


      <StatGrid>

        <StatCard
          label="Total Volunteers"
          value={volunteers.length}
        />

        <StatCard
          label="Available"
          value={availableCount}
        />

        <StatCard
          label="Currently Assigned"
          value={assignedCount}
        />

        <StatCard
          label="Completed Assignments"
          value={completedCount}
        />

      </StatGrid>


      {/* ADD / EDIT VOLUNTEER FORM */}
      {showVolunteerForm && (

        <SectionCard
          title={editingId ? "Edit Volunteer" : "Register New Volunteer"}
        >

          <form
            className="module-form volunteer-form"
            onSubmit={handleVolunteerSubmit}
          >

            <label>
              Full Name
              <input
                name="full_name"
                value={volunteerForm.full_name}
                onChange={handleVolunteerChange}
                placeholder="Enter full name"
                maxLength="120"
                required
              />
            </label>


            <label>
              Phone Number
              <input
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
              />
            </label>


            <label>
              Location
              <select
                name="location_id"
                value={volunteerForm.location_id}
                onChange={handleVolunteerChange}
              >

                <option value="">Not assigned</option>

                {locations.map(location => (
                  <option
                    key={location.location_id}
                    value={location.location_id}
                  >
                    {location.location_name}, {location.district}
                  </option>
                ))}

              </select>
            </label>


            <label className="full-width">
              Skills
              <textarea
                name="skills"
                value={volunteerForm.skills}
                onChange={handleVolunteerChange}
                placeholder="Example: First Aid, Rescue Support, Driving"
              />
            </label>


            <label>
              Availability
              <select
                name="availability"
                value={volunteerForm.availability}
                onChange={handleVolunteerChange}
              >
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="unavailable">Unavailable</option>
              </select>
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
                    : "Save Volunteer"}
              </button>

              <button
                type="button"
                className="volunteer-cancel-button"
                onClick={() => setShowVolunteerForm(false)}
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
            type="text"
            placeholder="Search by name, phone, skill or location"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            value={availability}
            onChange={e => setAvailability(e.target.value)}
          >
            <option value="All">All Availability</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="unavailable">Unavailable</option>
          </select>

        </SearchFilters>


        {loading ? (
          <p>Loading volunteers...</p>
        ) : (
          <DataTable
            columns={volunteerColumns}
            data={volunteerRows}
            rowKey="volunteerId"
            emptyMessage="No volunteers found."
          />
        )}

      </SectionCard>


      {/* ASSIGNMENT SECTION */}
      <SectionCard title="Volunteer Assignments">

        <div className="volunteer-assignment-heading">

          <p>
            Assign available volunteers to registered disasters.
          </p>

          <button
            type="button"
            className="module-primary-button"
            onClick={handleAddAssignment}
            disabled={
              !volunteers.some(v => v.availability === "available") ||
              disasters.length === 0
            }
          >
            Assign Volunteer
          </button>

        </div>


        {showAssignmentForm && (

          <form
            className="module-form volunteer-form"
            onSubmit={handleAssignmentSubmit}
          >

            <label>
              Select Volunteer
              <select
                name="volunteer_id"
                value={assignmentForm.volunteer_id}
                onChange={handleAssignmentChange}
                required
              >

                <option value="">Select Volunteer</option>

                {volunteers
                  .filter(v => v.availability === "available")
                  .map(volunteer => (

                    <option
                      key={volunteer.volunteer_id}
                      value={volunteer.volunteer_id}
                    >
                      {volunteer.full_name}
                    </option>

                  ))}

              </select>
            </label>


            <label>
              Select Disaster
              <select
                name="disaster_id"
                value={assignmentForm.disaster_id}
                onChange={handleAssignmentChange}
                required
              >

                <option value="">Select Disaster</option>

                {disasters.map(disaster => (

                  <option
                    key={disaster.disaster_id}
                    value={disaster.disaster_id}
                  >
                    {disaster.disaster_type} - {disaster.location_name}
                  </option>

                ))}

              </select>
            </label>


            <label>
              Assigned Role
              <input
                name="assigned_role"
                value={assignmentForm.assigned_role}
                onChange={handleAssignmentChange}
                placeholder="Example: First Aid Support"
                required
              />
            </label>


            <label>
              Notes
              <input
                name="notes"
                value={assignmentForm.notes}
                onChange={handleAssignmentChange}
                placeholder="Assignment details"
              />
            </label>


            <div className="full-width volunteer-form-actions">

              <button
                type="submit"
                className="module-primary-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Assignment"}
              </button>

              <button
                type="button"
                className="volunteer-cancel-button"
                onClick={() => setShowAssignmentForm(false)}
              >
                Cancel
              </button>

            </div>

          </form>

        )}


        {loading ? (
          <p>Loading assignments...</p>
        ) : (
          <DataTable
            columns={assignmentColumns}
            data={assignmentRows}
            rowKey="assignmentId"
            emptyMessage="No volunteer assignments found."
          />
        )}

      </SectionCard>

    </div>

  );

}

export default Volunteers;
