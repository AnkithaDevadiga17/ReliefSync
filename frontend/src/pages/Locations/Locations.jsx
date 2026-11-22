import { useEffect, useState } from "react";

import {
  DataTable,
  PageHeader,
  SearchFilters,
  SectionCard,
  StatGrid,
  StatCard
} from "../../components/ModuleUI";

import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

import "../../styles/Modules.css";
import "./Locations.css";


const emptyForm = {
  location_name: "",
  location_type: "Disaster Affected Area",
  district: "",
  state: "Karnataka",
  country: "India",
  latitude: "",
  longitude: "",
  pincode: ""
};


function Locations() {

  const { user } = useAuth();

  const role = user?.role?.toLowerCase();

  const canManage =
    role === "admin" || role === "coordinator";


  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState(emptyForm);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");


  // ----------------------------------
  // LOAD LOCATIONS
  // ----------------------------------

  const loadLocations = async () => {

    try {

      setLoading(true);

      const response = await apiRequest("/locations");

      setLocations(response.data || []);

      setError("");

    } catch (err) {

      setError(err.message || "Unable to load locations.");

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {
    loadLocations();
  }, []);


  // ----------------------------------
  // HANDLE INPUT CHANGES
  // ----------------------------------

  const handleChange = (e) => {

    const { name, value } = e.target;

    setFormData(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // ----------------------------------
  // OPEN ADD FORM
  // ----------------------------------

  const handleAdd = () => {

    setEditingId(null);

    setFormData({ ...emptyForm });

    setError("");
    setNotice("");

    setShowForm(true);

  };


  // ----------------------------------
  // OPEN EDIT FORM
  // ----------------------------------

  const handleEdit = (location) => {

    setEditingId(location.location_id);

    setFormData({
      location_name: location.location_name || "",
      location_type: location.location_type || "Other",
      district: location.district || "",
      state: location.state || "Karnataka",
      country: location.country || "India",
      latitude: location.latitude ?? "",
      longitude: location.longitude ?? "",
      pincode: location.pincode || ""
    });

    setError("");
    setNotice("");

    setShowForm(true);

  };


  // ----------------------------------
  // CLOSE FORM
  // ----------------------------------

  const closeForm = () => {

    setShowForm(false);

    setEditingId(null);

    setFormData({ ...emptyForm });

    setError("");

  };


  // ----------------------------------
  // ADD / UPDATE LOCATION
  // ----------------------------------

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");
    setNotice("");

    if (
      (formData.latitude === "") !==
      (formData.longitude === "")
    ) {

      setError(
        "Please enter both latitude and longitude, or leave both empty."
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
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    ) {

      setError("Latitude must be between -90 and 90.");

      return;
    }


    if (
      longitude !== null &&
      (!Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180)
    ) {

      setError("Longitude must be between -180 and 180.");

      return;
    }


    const payload = {
      ...formData,
      latitude,
      longitude
    };


    try {

      setSaving(true);

      const isEditing = editingId !== null;

      const response = await apiRequest(
        isEditing
          ? `/locations/${editingId}`
          : "/locations",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );


      setShowForm(false);

      setEditingId(null);

      setFormData({ ...emptyForm });

      setNotice(
        response.message ||
        (isEditing
          ? "Location updated successfully."
          : "Location added successfully.")
      );

      await loadLocations();

    } catch (err) {

      setError(err.message || "Unable to save location.");

    } finally {

      setSaving(false);

    }

  };


  // ----------------------------------
  // DELETE LOCATION
  // ----------------------------------

  const handleDelete = async (location) => {

    const confirmed = window.confirm(
      `Do you want to delete ${location.location_name}?\n\nLocations already used by other modules cannot be deleted.`
    );

    if (!confirmed) {
      return;
    }


    try {

      setError("");
      setNotice("");

      const response = await apiRequest(
        `/locations/${location.location_id}`,
        {
          method: "DELETE"
        }
      );

      setNotice(
        response.message || "Location deleted successfully."
      );

      await loadLocations();

    } catch (err) {

      const linkedModules = err.data?.linked_modules;

      if (linkedModules?.length) {

        setError(
          `${err.message} Linked modules: ${linkedModules.join(", ")}.`
        );

      } else {

        setError(err.message || "Unable to delete location.");

      }

    }

  };


  // ----------------------------------
  // FILTER LOCATIONS
  // ----------------------------------

  const locationTypes = [
    ...new Set(
      locations
        .map(location => location.location_type)
        .filter(Boolean)
    )
  ];


  const filteredLocations = locations.filter(location => {

    const searchText = search.toLowerCase().trim();

    const searchableValues = [
      location.location_id,
      location.location_name,
      location.location_type,
      location.district,
      location.state,
      location.country,
      location.pincode
    ];

    const matchesSearch = searchableValues.some(value =>
      String(value || "")
        .toLowerCase()
        .includes(searchText)
    );

    const matchesType =
      typeFilter === "All" ||
      location.location_type === typeFilter;

    return matchesSearch && matchesType;

  });


  // ----------------------------------
  // TABLE DATA
  // ----------------------------------

  const tableData = filteredLocations.map(location => ({

    locationId: location.location_id,

    id: `LOC-${String(location.location_id).padStart(3, "0")}`,

    name: location.location_name,

    type: location.location_type || "—",

    district: location.district,

    state: location.state,

    country: location.country,

    pincode: location.pincode || "—",

    original: location

  }));


  // ----------------------------------
  // TABLE COLUMNS
  // ----------------------------------

  const columns = [

    {
      key: "id",
      label: "Location ID"
    },

    {
      key: "name",
      label: "Location Name"
    },

    {
      key: "type",
      label: "Location Type"
    },

    {
      key: "district",
      label: "District"
    },

    {
      key: "state",
      label: "State"
    },

    {
      key: "country",
      label: "Country"
    },

    {
      key: "pincode",
      label: "Pincode"
    },

    ...(canManage
      ? [
          {
            key: "actions",
            label: "Actions",

            render: row => (

              <div className="location-actions">

                <button
                  type="button"
                  className="location-edit-button"
                  onClick={() => handleEdit(row.original)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="location-delete-button"
                  onClick={() => handleDelete(row.original)}
                >
                  Delete
                </button>

              </div>

            )
          }
        ]
      : [])

  ];


  // ----------------------------------
  // STATISTICS
  // ----------------------------------

  const totalLocations = locations.length;

  const totalDistricts = new Set(
    locations.map(location => location.district)
  ).size;

  const totalStates = new Set(
    locations.map(location => location.state)
  ).size;


  // ----------------------------------
  // PAGE UI
  // ----------------------------------

  return (

    <div className="module-page locations-page">

      <PageHeader
        title="Location Management"
        description="Manage geographical locations and disaster-affected areas."
        action={
          canManage && (

            <button
              type="button"
              className="module-primary-button"
              onClick={handleAdd}
            >
              + Add Location
            </button>

          )
        }
      />


      {notice && (

        <div className="location-message location-success">
          {notice}
        </div>

      )}


      {error && (

        <div className="location-message location-error">
          {error}
        </div>

      )}


      {/* STATISTICS */}

      <StatGrid>

        <StatCard
          label="Total Locations"
          value={totalLocations}
          note="Registered locations"
        />

        <StatCard
          label="Districts"
          value={totalDistricts}
          note="Different districts"
        />

        <StatCard
          label="States"
          value={totalStates}
          note="Different states"
        />

        <StatCard
          label="Search Results"
          value={filteredLocations.length}
          note="Matching locations"
        />

      </StatGrid>


      {/* ADD / EDIT FORM */}

      {showForm && canManage && (

        <SectionCard
          title={
            editingId
              ? "Edit Location"
              : "Add New Location"
          }
        >

          <form
            className="module-form location-form"
            onSubmit={handleSubmit}
          >

            <label>
              Location Name *

              <input
                type="text"
                name="location_name"
                value={formData.location_name}
                onChange={handleChange}
                placeholder="Example: Chooralmala"
                maxLength="100"
                required
              />
            </label>


            <label>
              Location Type *

              <select
                name="location_type"
                value={formData.location_type}
                onChange={handleChange}
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
                value={formData.district}
                onChange={handleChange}
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
                value={formData.state}
                onChange={handleChange}
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
                value={formData.country}
                onChange={handleChange}
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
                value={formData.pincode}
                onChange={handleChange}
                placeholder="Enter pincode"
                maxLength="10"
              />
            </label>


            <label>
              Latitude (Optional)

              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="Example: 11.6854"
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
                onChange={handleChange}
                placeholder="Example: 76.1320"
                step="any"
                min="-180"
                max="180"
              />
            </label>


            <div className="full-width location-form-actions">

              <button
                type="submit"
                className="module-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Location"
                    : "Save Location"}
              </button>


              <button
                type="button"
                className="location-cancel-button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

            </div>

          </form>

        </SectionCard>

      )}


      {/* LOCATION LIST */}

      <SectionCard title="Registered Locations">

        <SearchFilters>

          <input
            type="text"
            placeholder="Search by name, district, state or pincode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >

            <option value="All">
              All Location Types
            </option>

            {locationTypes.map(type => (

              <option key={type} value={type}>
                {type}
              </option>

            ))}

          </select>

        </SearchFilters>


        {loading ? (

          <p className="module-muted">
            Loading locations...
          </p>

        ) : (

          <DataTable
            columns={columns}
            data={tableData}
            rowKey="locationId"
            emptyMessage="No locations found."
          />

        )}

      </SectionCard>


      {!canManage && (

        <p className="module-muted location-view-note">
          You have view-only access to Location Management.
        </p>

      )}

    </div>

  );

}

export default Locations;