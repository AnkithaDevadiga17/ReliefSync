
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
import "./Shelters.css";

const API_URL = "http://127.0.0.1:5000/api";

const emptyForm = {
  location_id: "",
  shelter_name: "",
  address: "",
  capacity: "",
  occupied_count: "0",
  contact_person: "",
  contact_phone: "",
  status: "operational"
};

function Shelters() {

  const [shelters, setShelters] = useState([]);
  const [locations, setLocations] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);


  // LOAD SHELTERS AND LOCATIONS
  const loadData = async () => {

    try {

      setLoading(true);
      setError("");

      const [shelterResponse, locationResponse] =
        await Promise.all([
          fetch(`${API_URL}/shelters`),
          fetch(`${API_URL}/locations`)
        ]);

      const shelterResult = await shelterResponse.json();
      const locationResult = await locationResponse.json();

      if (!shelterResponse.ok || !shelterResult.success) {
        throw new Error(shelterResult.message || "Unable to load shelters.");
      }

      if (!locationResponse.ok || !locationResult.success) {
        throw new Error(locationResult.message || "Unable to load locations.");
      }

      setShelters(shelterResult.data || []);
      setLocations(locationResult.data || []);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {
    loadData();
  }, []);


  // HANDLE FORM INPUTS
  const handleChange = (e) => {

    const { name, value } = e.target;

    setFormData(previous => ({
      ...previous,
      [name]: value
    }));
  };


  // OPEN ADD FORM
  const handleAdd = () => {

    setEditingId(null);

    setFormData({
      ...emptyForm,
      location_id: locations.length
        ? String(locations[0].location_id)
        : ""
    });

    setError("");
    setNotice("");
    setShowForm(true);
  };


  // OPEN EDIT FORM
  const handleEdit = (shelter) => {

    setEditingId(shelter.shelter_id);

    setFormData({
      location_id: String(shelter.location_id),
      shelter_name: shelter.shelter_name || "",
      address: shelter.address || "",
      capacity: String(shelter.capacity),
      occupied_count: String(shelter.occupied_count),
      contact_person: shelter.contact_person || "",
      contact_phone: shelter.contact_phone || "",
      status: shelter.status
    });

    setError("");
    setNotice("");
    setShowForm(true);
  };


  // SAVE OR UPDATE SHELTER
  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const isEditing = editingId !== null;

      const payload = {
        ...formData,
        location_id: Number(formData.location_id),
        capacity: Number(formData.capacity),
        occupied_count: Number(formData.occupied_count)
      };

      const response = await fetch(
        isEditing
          ? `${API_URL}/shelters/${editingId}`
          : `${API_URL}/shelters`,
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
        throw new Error(result.message || "Unable to save shelter.");
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }
  };


  // DELETE SHELTER
  const handleDelete = async (id) => {

    if (!window.confirm("Are you sure you want to delete this shelter?")) {
      return;
    }

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API_URL}/shelters/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete shelter.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }
  };


  // SEARCH AND FILTER
  const filteredShelters = shelters.filter(shelter => {

    const searchText = search.toLowerCase();

    const matchesSearch = [
      shelter.shelter_id,
      shelter.shelter_name,
      shelter.location_name
    ].some(value =>
      String(value || "").toLowerCase().includes(searchText)
    );

    const matchesStatus =
      status === "All" || shelter.status === status;

    return matchesSearch && matchesStatus;
  });


  // PREPARE TABLE DATA
  const tableData = filteredShelters.map(shelter => ({

    shelterId: shelter.shelter_id,

    id: `S${String(shelter.shelter_id).padStart(3, "0")}`,

    name: shelter.shelter_name,

    location: shelter.location_name || "Unknown",

    capacity: shelter.capacity,

    occupied: shelter.occupied_count,

    available: shelter.available,

    status: shelter.status

  }));


  // TABLE COLUMNS
  const columns = [

    { key: "id", label: "Shelter ID" },

    { key: "name", label: "Shelter Name" },

    { key: "location", label: "Location" },

    { key: "capacity", label: "Capacity" },

    { key: "occupied", label: "Occupied" },

    { key: "available", label: "Available" },

    {
      key: "status",
      label: "Status",
      render: row => (
        <StatusBadge
          status={row.status.replaceAll("_", " ")}
        />
      )
    },

    {
      key: "actions",
      label: "Actions",
      render: row => (
        <div className="shelter-actions">

          <button
            type="button"
            className="shelter-edit-button"
            onClick={() => {
              const selected = shelters.find(
                s => s.shelter_id === row.shelterId
              );

              if (selected) handleEdit(selected);
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="shelter-delete-button"
            onClick={() => handleDelete(row.shelterId)}
          >
            Delete
          </button>

        </div>
      )
    }

  ];


  // STATISTICS
  const totalCapacity = shelters.reduce(
    (sum, s) => sum + Number(s.capacity), 0
  );

  const totalOccupied = shelters.reduce(
    (sum, s) => sum + Number(s.occupied_count), 0
  );


  return (

    <div className="module-page">

      <PageHeader
        title="Shelter Management"
        description="Monitor shelter capacity, occupancy and availability."
        action={
          <button
            className="module-primary-button"
            onClick={handleAdd}
          >
            Add Shelter
          </button>
        }
      />


      {notice && (
        <p className="shelter-notice">{notice}</p>
      )}

      {error && (
        <p className="shelter-error">{error}</p>
      )}


      <StatGrid>

        <StatCard
          label="Total Shelters"
          value={shelters.length}
        />

        <StatCard
          label="Operational Shelters"
          value={shelters.filter(s => s.status === "operational").length}
        />

        <StatCard
          label="Total Capacity"
          value={totalCapacity}
        />

        <StatCard
          label="Occupied Spaces"
          value={totalOccupied}
        />

      </StatGrid>


      {showForm && (

        <SectionCard
          title={editingId ? "Edit Shelter" : "Add New Shelter"}
        >

          <form
            className="module-form"
            onSubmit={handleSubmit}
          >

            <label>
              Shelter Name
              <input
                name="shelter_name"
                value={formData.shelter_name}
                onChange={handleChange}
                required
              />
            </label>


            <label>
              Location
              <select
                name="location_id"
                value={formData.location_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Location</option>

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


            <label>
              Address
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </label>


            <label>
              Total Capacity
              <input
                type="number"
                name="capacity"
                min="1"
                value={formData.capacity}
                onChange={handleChange}
                required
              />
            </label>


            <label>
              Occupied Spaces
              <input
                type="number"
                name="occupied_count"
                min="0"
                value={formData.occupied_count}
                onChange={handleChange}
                required
              />
            </label>


            <label>
              Contact Person
              <input
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
              />
            </label>


            <label>
              Contact Phone
              <input
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
              />
            </label>


            <label>
              Status
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="operational">Operational</option>
                <option value="full">Full</option>
                <option value="temporarily_closed">
                  Temporarily Closed
                </option>
              </select>
            </label>


            <div className="full-width shelter-form-actions">

              <button
                type="submit"
                className="module-primary-button"
                disabled={saving || locations.length === 0}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Shelter"
                    : "Save Shelter"}
              </button>

              <button
                type="button"
                className="shelter-cancel-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

            </div>

          </form>

        </SectionCard>

      )}


      <SectionCard title="Shelter List">

        <SearchFilters>

          <input
            type="text"
            placeholder="Search by shelter ID, name or location"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="operational">Operational</option>
            <option value="full">Full</option>
            <option value="temporarily_closed">Temporarily Closed</option>
          </select>

        </SearchFilters>


        {loading ? (

          <p>Loading shelters...</p>

        ) : (

          <DataTable
            columns={columns}
            data={tableData}
            rowKey="shelterId"
            emptyMessage="No shelters found."
          />

        )}

      </SectionCard>

    </div>

  );
}

export default Shelters;
