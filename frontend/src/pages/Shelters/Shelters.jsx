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
import "./Shelters.css";


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


function formatNumber(value) {

  return Number(value || 0).toLocaleString("en-IN");

}


function Shelters() {

  const { user } = useAuth();

  const role = user?.role?.toLowerCase();

  const isAdmin = role === "admin";

  const isCoordinator = role === "coordinator";

  const isVolunteer = role === "volunteer";

  const canManage = [
    "admin",
    "coordinator",
    "ngo"
  ].includes(role);


  // ----------------------------------------
  // DATA
  // ----------------------------------------

  const [shelters, setShelters] = useState([]);

  const [locations, setLocations] = useState([]);

  const [locationSummary, setLocationSummary] = useState([]);

  const [assignedLocation, setAssignedLocation] = useState(null);


  // ----------------------------------------
  // FILTERS
  // ----------------------------------------

  // Admin/NGO initially see all.
  // Coordinator must select their monitoring location.
  // Volunteer is automatically assigned by the backend.
  const [selectedLocationId, setSelectedLocationId] =
    useState(isCoordinator ? "" : "All");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");


  // ----------------------------------------
  // FORM AND REQUEST STATE
  // ----------------------------------------

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState(emptyForm);


  // ----------------------------------------
  // LOAD DATA
  // ----------------------------------------

  const loadData = async () => {

    try {

      setLoading(true);

      setError("");

      const shelterResponse = await apiRequest("/shelters");

      setShelters(shelterResponse.data || []);

      setLocationSummary(
        shelterResponse.location_summary || []
      );

      const scope = shelterResponse.scope || {};

      setAssignedLocation(scope.assigned_location || null);


      if (isVolunteer) {

        // The server already restricts this volunteer's shelter data.
        setSelectedLocationId(
          scope.assigned_location_id
            ? String(scope.assigned_location_id)
            : ""
        );

        // Do not fetch the global location list for volunteers.
        setLocations([]);

      } else {

        // Managers use the shared Location Management API.
        const locationResponse = await apiRequest("/locations");

        setLocations(locationResponse.data || []);

      }

    } catch (err) {

      setError(
        err.message || "Unable to load shelter information."
      );

    } finally {

      setLoading(false);

    }

  };


  useEffect(() => {
    loadData();
  }, []);


  // ----------------------------------------
  // SELECTED LOCATION
  // ----------------------------------------

  const selectedLocation = useMemo(() => {

    if (isVolunteer) {
      return assignedLocation;
    }

    return locations.find(
      location =>
        String(location.location_id) === selectedLocationId
    ) || null;

  }, [
    isVolunteer,
    assignedLocation,
    locations,
    selectedLocationId
  ]);


  const locationSelected =
    isAdmin ||
    !isCoordinator && selectedLocationId === "All" ||
    Boolean(selectedLocationId);


  // ----------------------------------------
  // LOCATION-WISE SHELTER FILTER
  // ----------------------------------------

  const locationShelters = useMemo(() => {

    if (!selectedLocationId || selectedLocationId === "All") {

      return shelters;

    }

    return shelters.filter(
      shelter =>
        String(shelter.location_id) === selectedLocationId
    );

  }, [shelters, selectedLocationId]);


  // ----------------------------------------
  // SEARCH AND STATUS FILTER
  // ----------------------------------------

  const filteredShelters = useMemo(() => {

    return locationShelters.filter(shelter => {

      const searchText = search.toLowerCase().trim();

      const searchableValues = [
        shelter.shelter_id,
        shelter.shelter_name,
        shelter.location_name,
        shelter.district,
        shelter.state,
        shelter.address
      ];

      const matchesSearch = searchableValues.some(value =>
        String(value || "")
          .toLowerCase()
          .includes(searchText)
      );

      const matchesStatus =
        statusFilter === "All" ||
        shelter.status === statusFilter;

      return matchesSearch && matchesStatus;

    });

  }, [
    locationShelters,
    search,
    statusFilter
  ]);


  // ----------------------------------------
  // LOCATION-WISE STATISTICS
  // ----------------------------------------

  const totalShelters = locationShelters.length;

  const operationalShelters = locationShelters.filter(
    shelter => shelter.status === "operational"
  ).length;

  const fullShelters = locationShelters.filter(
    shelter => shelter.status === "full"
  ).length;

  const totalCapacity = locationShelters.reduce(
    (sum, shelter) =>
      sum + Number(shelter.capacity || 0),
    0
  );

  const totalOccupied = locationShelters.reduce(
    (sum, shelter) =>
      sum + Number(shelter.occupied_count || 0),
    0
  );

  const totalAvailable = locationShelters.reduce(
    (sum, shelter) =>
      sum + Number(shelter.available || 0),
    0
  );

  const occupancyPercentage = totalCapacity > 0
    ? Math.round((totalOccupied / totalCapacity) * 100)
    : 0;


  // ----------------------------------------
  // LOCATION OVERVIEW DATA
  // ----------------------------------------

  const overviewRows = locationSummary.map(location => ({

    locationId: location.location_id,

    name: location.location_name,

    district: location.district,

    state: location.state,

    shelters: location.total_shelters,

    capacity: location.total_capacity,

    occupied: location.total_occupied,

    available: location.total_available,

    operational: location.operational_shelters,

    full: location.full_shelters,

    closed: location.closed_shelters,

    original: location

  }));


  const overviewColumns = [

    {
      key: "name",
      label: "Location"
    },

    {
      key: "district",
      label: "District"
    },

    {
      key: "shelters",
      label: "Shelters"
    },

    {
      key: "capacity",
      label: "Capacity"
    },

    {
      key: "occupied",
      label: "Occupied"
    },

    {
      key: "available",
      label: "Available"
    },

    {
      key: "operational",
      label: "Operational"
    },

    {
      key: "full",
      label: "Full"
    }

  ];


  // ----------------------------------------
  // HANDLE INPUTS
  // ----------------------------------------

  const handleChange = (e) => {

    const { name, value } = e.target;

    setFormData(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // ----------------------------------------
  // OPEN ADD FORM
  // ----------------------------------------

  const handleAdd = () => {

    setEditingId(null);

    setFormData({
      ...emptyForm,

      location_id:
        selectedLocationId &&
        selectedLocationId !== "All"
          ? selectedLocationId
          : locations.length
            ? String(locations[0].location_id)
            : ""
    });

    setError("");

    setNotice("");

    setShowForm(true);

  };


  // ----------------------------------------
  // OPEN EDIT FORM
  // ----------------------------------------

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

      status: shelter.status || "operational"

    });

    setError("");

    setNotice("");

    setShowForm(true);

  };


  // ----------------------------------------
  // CLOSE FORM
  // ----------------------------------------

  const closeForm = () => {

    setShowForm(false);

    setEditingId(null);

    setFormData({ ...emptyForm });

    setError("");

  };


  // ----------------------------------------
  // ADD / UPDATE SHELTER
  // ----------------------------------------

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setNotice("");


    const capacity = Number(formData.capacity);

    const occupiedCount = Number(formData.occupied_count);


    if (!formData.location_id) {

      setError("Please select a location.");

      return;
    }


    if (!Number.isInteger(capacity) || capacity <= 0) {

      setError("Capacity must be a positive whole number.");

      return;
    }


    if (
      !Number.isInteger(occupiedCount) ||
      occupiedCount < 0
    ) {

      setError("Occupied spaces must be a non-negative whole number.");

      return;
    }


    if (occupiedCount > capacity) {

      setError("Occupied spaces cannot exceed total capacity.");

      return;
    }


    const payload = {

      ...formData,

      location_id: Number(formData.location_id),

      capacity,

      occupied_count: occupiedCount

    };


    try {

      setSaving(true);

      const isEditing = editingId !== null;

      const response = await apiRequest(
        isEditing
          ? `/shelters/${editingId}`
          : "/shelters",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );


      setNotice(
        response.message ||
        (
          isEditing
            ? "Shelter updated successfully."
            : "Shelter added successfully."
        )
      );

      setShowForm(false);

      setEditingId(null);

      setFormData({ ...emptyForm });

      await loadData();

    } catch (err) {

      setError(
        err.message || "Unable to save shelter."
      );

    } finally {

      setSaving(false);

    }

  };


  // ----------------------------------------
  // DELETE SHELTER
  // ----------------------------------------

  const handleDelete = async (shelter) => {

    const confirmed = window.confirm(
      `Are you sure you want to delete "${shelter.shelter_name}"?`
    );

    if (!confirmed) return;


    try {

      setDeletingId(shelter.shelter_id);

      setError("");

      setNotice("");

      const response = await apiRequest(
        `/shelters/${shelter.shelter_id}`,
        {
          method: "DELETE"
        }
      );

      setNotice(
        response.message || "Shelter deleted successfully."
      );

      await loadData();

    } catch (err) {

      setError(
        err.message || "Unable to delete shelter."
      );

    } finally {

      setDeletingId(null);

    }

  };


  // ----------------------------------------
  // SHELTER TABLE DATA
  // ----------------------------------------

  const tableData = filteredShelters.map(shelter => ({

    shelterId: shelter.shelter_id,

    id: `S${String(shelter.shelter_id).padStart(3, "0")}`,

    name: shelter.shelter_name,

    location: shelter.location_name || "Unknown",

    capacity: shelter.capacity,

    occupied: shelter.occupied_count,

    available: shelter.available,

    status: shelter.status,

    original: shelter

  }));


  // ----------------------------------------
  // TABLE COLUMNS
  // ----------------------------------------

  const columns = [

    {
      key: "id",
      label: "Shelter ID"
    },

    {
      key: "name",
      label: "Shelter Name"
    },

    // Admin and coordinator can see area details.
    ...(isVolunteer
      ? []
      : [
          {
            key: "location",
            label: "Location"
          }
        ]
    ),

    {
      key: "capacity",
      label: "Capacity"
    },

    {
      key: "occupied",
      label: "Occupied"
    },

    {
      key: "available",
      label: "Available"
    },

    {
      key: "status",
      label: "Status",
      render: row => (
        <StatusBadge
          status={row.status.replaceAll("_", " ")}
        />
      )
    },

    ...(canManage
      ? [
          {
            key: "actions",
            label: "Actions",
            render: row => (
              <div className="shelter-actions">

                <button
                  type="button"
                  className="shelter-edit-button"
                  onClick={() => handleEdit(row.original)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="shelter-delete-button"
                  onClick={() => handleDelete(row.original)}
                  disabled={deletingId === row.shelterId}
                >
                  {deletingId === row.shelterId
                    ? "Deleting..."
                    : "Delete"}
                </button>

              </div>
            )
          }
        ]
      : [])

  ];


  // ----------------------------------------
  // PAGE UI
  // ----------------------------------------

  return (

    <div className="module-page shelters-page">

      <PageHeader
        title="Shelter Management"
        description="Monitor shelter capacity, occupancy and availability by location."
        action={
          canManage && locationSelected && (

            <button
              type="button"
              className="module-primary-button"
              onClick={handleAdd}
            >
              + Add Shelter
            </button>

          )
        }
      />


      {notice && (
        <div className="shelter-notice">
          {notice}
        </div>
      )}


      {error && (
        <div className="shelter-error">
          {error}
        </div>
      )}


      {/* VOLUNTEER LOCATION */}

      {isVolunteer && (

        <div className="shelter-location-banner">

          <div>
            <span>Your Volunteer Location</span>

            <h2>
              {assignedLocation
                ? assignedLocation.location_name
                : "Location not assigned"}
            </h2>

            {assignedLocation && (

              <p>
                {[
                  assignedLocation.district,
                  assignedLocation.state
                ].filter(Boolean).join(", ")}
              </p>

            )}

          </div>

          <span className="shelter-scope-label">
            Location-specific view
          </span>

        </div>

      )}


      {/* LOCATION SELECTOR FOR ADMIN / COORDINATOR / NGO */}

      {!isVolunteer && (

        <SectionCard title="Select Monitoring Location">

          <div className="shelter-location-filter">

            <label htmlFor="shelter-location-filter">
              View shelter information for
            </label>

            <select
              id="shelter-location-filter"
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
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

              <p className="shelter-filter-hint">
                Choose the area you are currently monitoring.
                All statistics below will be specific to that location.
              </p>

            )}

          </div>

        </SectionCard>

      )}


      {/* LOADING */}

      {loading ? (

        <SectionCard title="Shelter Information">

          <p className="module-muted">
            Loading location-wise shelter information...
          </p>

        </SectionCard>

      ) : (

        <>

          {/* VOLUNTEER WITH NO LINKED LOCATION */}

          {isVolunteer && !assignedLocation && (

            <div className="shelter-empty-location">

              <h3>Volunteer location not linked</h3>

              <p>
                Your volunteer account is not connected to a registered
                location. Please ask an administrator or coordinator
                to update your volunteer profile with your location
                and account email.
              </p>

            </div>

          )}


          {/* COORDINATOR MUST CHOOSE A LOCATION */}

          {isCoordinator && !selectedLocationId && (

            <div className="shelter-empty-location">

              <h3>Select a location to monitor</h3>

              <p>
                Choose your assigned monitoring area from the dropdown
                above to view its shelters, occupancy and available spaces.
              </p>

            </div>

          )}


          {/* LOCATION-SPECIFIC INFORMATION */}

          {locationSelected && (!isVolunteer || assignedLocation) && (

            <>

              <div className="shelter-current-location">

                <span>
                  {selectedLocationId === "All"
                    ? "Showing combined information"
                    : "Currently monitoring"}
                </span>

                <strong>
                  {selectedLocationId === "All"
                    ? "All Locations"
                    : selectedLocation?.location_name || assignedLocation?.location_name}
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
                  label="Total Shelters"
                  value={formatNumber(totalShelters)}
                  note="In selected location"
                />

                <StatCard
                  label="Operational Shelters"
                  value={formatNumber(operationalShelters)}
                  note="Currently operational"
                />

                <StatCard
                  label="Occupied Spaces"
                  value={formatNumber(totalOccupied)}
                  note={`Out of ${formatNumber(totalCapacity)} capacity`}
                />

                <StatCard
                  label="Available Spaces"
                  value={formatNumber(totalAvailable)}
                  note={`${occupancyPercentage}% occupancy`}
                />

              </StatGrid>


              {/* LOCATION-WISE BREAKDOWN */}

              {isAdmin && (

                <SectionCard title="Shelter Overview by Location">

                  <p className="shelter-section-description">
                    Compare shelter availability, capacity and occupancy
                    across all registered locations. Select a location
                    above to focus on one area.
                  </p>

                  <div className="shelter-overview-table">

                    <DataTable
                      columns={overviewColumns}
                      data={overviewRows}
                      rowKey="locationId"
                      emptyMessage="No registered locations found."
                    />

                  </div>

                </SectionCard>

              )}


              {/* SHELTER LIST */}

              <SectionCard title="Shelter List">

                <SearchFilters>

                  <input
                    type="search"
                    placeholder="Search shelter name or address..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />


                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >

                    <option value="All">
                      All Statuses
                    </option>

                    <option value="operational">
                      Operational
                    </option>

                    <option value="full">
                      Full
                    </option>

                    <option value="temporarily_closed">
                      Temporarily Closed
                    </option>

                  </select>

                </SearchFilters>


                <DataTable
                  columns={columns}
                  data={tableData}
                  rowKey="shelterId"
                  emptyMessage="No shelters found for this location."
                />

              </SectionCard>

            </>

          )}

        </>

      )}


      {/* ADD / EDIT SHELTER */}

      {showForm && canManage && (

        <SectionCard
          title={
            editingId
              ? "Edit Shelter"
              : "Add New Shelter"
          }
        >

          {locations.length === 0 ? (

            <div className="shelter-empty-location">

              No registered locations found.
              Add a location in Location Management first.

            </div>

          ) : (

            <form
              className="module-form shelter-form"
              onSubmit={handleSubmit}
            >

              <label>
                Shelter Name *

                <input
                  type="text"
                  name="shelter_name"
                  value={formData.shelter_name}
                  onChange={handleChange}
                  maxLength="150"
                  required
                />

              </label>


              <label>
                Location *

                <select
                  name="location_id"
                  value={formData.location_id}
                  onChange={handleChange}
                  required
                >

                  <option value="">
                    Select Location
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

              </label>


              <label className="shelter-full-width">
                Address

                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                />

              </label>


              <label>
                Total Capacity *

                <input
                  type="number"
                  name="capacity"
                  min="1"
                  step="1"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                />

              </label>


              <label>
                Occupied Spaces *

                <input
                  type="number"
                  name="occupied_count"
                  min="0"
                  step="1"
                  value={formData.occupied_count}
                  onChange={handleChange}
                  required
                />

              </label>


              <label>
                Contact Person

                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  maxLength="100"
                />

              </label>


              <label>
                Contact Phone

                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  maxLength="20"
                />

              </label>


              <label>
                Status

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >

                  <option value="operational">
                    Operational
                  </option>

                  <option value="full">
                    Full
                  </option>

                  <option value="temporarily_closed">
                    Temporarily Closed
                  </option>

                </select>

              </label>


              <div className="shelter-form-actions shelter-full-width">

                <button
                  type="submit"
                  className="module-primary-button"
                  disabled={saving}
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
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

              </div>

            </form>

          )}

        </SectionCard>

      )}

    </div>

  );

}


export default Shelters;