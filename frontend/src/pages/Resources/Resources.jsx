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
import "./Resources.css";


const emptyResource = {
  location_id: "",
  resource_name: "",
  category: "Food",
  quantity_available: "",
  unit: "",
  minimum_stock: "0"
};


const resourceCategories = [
  "Food",
  "Water",
  "Medicine",
  "Clothing",
  "Rescue Equipment",
  "Other"
];


function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}


function Resources() {

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


  // -----------------------------------------
  // DATA
  // -----------------------------------------

  const [resources, setResources] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationSummary, setLocationSummary] = useState([]);
  const [assignedLocation, setAssignedLocation] = useState(null);


  // -----------------------------------------
  // LOCATION FILTER
  // -----------------------------------------

  const [selectedLocationId, setSelectedLocationId] =
    useState(isCoordinator ? "" : "All");


  // -----------------------------------------
  // SEARCH AND STOCK FILTER
  // -----------------------------------------

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("All");


  // -----------------------------------------
  // FORM STATE
  // -----------------------------------------

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [resourceForm, setResourceForm] = useState(emptyResource);


  // -----------------------------------------
  // REQUEST STATE
  // -----------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");


  // -----------------------------------------
  // LOAD INVENTORY FOR SELECTED LOCATION
  // -----------------------------------------

  const loadInventory = async (locationId = null) => {

    let endpoint = "/resources";

    if (locationId && locationId !== "All") {
      endpoint += `?location_id=${encodeURIComponent(locationId)}`;
    }

    const response = await apiRequest(endpoint);

    setResources(response.data || []);

    setLocationSummary(response.location_summary || []);

    return response;
  };


  // -----------------------------------------
  // INITIAL PAGE LOAD
  // -----------------------------------------

  const loadPage = async () => {

    try {

      setLoading(true);
      setError("");

      if (isVolunteer) {

        const response = await apiRequest("/resources");

        setResources(response.data || []);

        setLocationSummary(
          response.location_summary || []
        );

        const scope = response.scope || {};

        setAssignedLocation(
          scope.assigned_location || null
        );

        setSelectedLocationId(
          scope.assigned_location_id
            ? String(scope.assigned_location_id)
            : ""
        );

        setLocations([]);

      } else {

        const locationResponse = await apiRequest("/locations");

        setLocations(locationResponse.data || []);

        if (isCoordinator) {

          setResources([]);
          setLocationSummary([]);
          setSelectedLocationId("");

        } else {

          setSelectedLocationId("All");

          await loadInventory();

        }

      }

    } catch (err) {

      setError(
        err.message || "Unable to load resource information."
      );

    } finally {

      setLoading(false);

    }

  };


  useEffect(() => {
    loadPage();
  }, []);


  // -----------------------------------------
  // CHANGE LOCATION
  // -----------------------------------------

  const handleLocationSelect = async (e) => {

    const locationId = e.target.value;

    setSelectedLocationId(locationId);

    setError("");
    setNotice("");

    setSearch("");
    setStockFilter("All");

    if (!locationId) {

      setResources([]);
      setLocationSummary([]);

      return;
    }

    try {

      setLoading(true);

      await loadInventory(locationId);

    } catch (err) {

      setError(
        err.message || "Unable to load inventory for this location."
      );

      setResources([]);
      setLocationSummary([]);

    } finally {

      setLoading(false);

    }

  };


  // -----------------------------------------
  // IMPORTANT: FRONTEND LOCATION FILTER
  // -----------------------------------------

  const locationScopedResources = useMemo(() => {

    // Admin and NGO viewing all locations.
    if (
      !selectedLocationId ||
      selectedLocationId === "All"
    ) {
      return resources;
    }

    // Only show resources belonging to selected location.
    return resources.filter(resource =>

      String(resource.location_id) ===
      String(selectedLocationId)

    );

  }, [resources, selectedLocationId]);


  // -----------------------------------------
  // LOCATION SUMMARY FILTER
  // -----------------------------------------

  const locationScopedSummary = useMemo(() => {

    if (
      !selectedLocationId ||
      selectedLocationId === "All"
    ) {
      return locationSummary;
    }

    return locationSummary.filter(location =>

      String(location.location_id) ===
      String(selectedLocationId)

    );

  }, [locationSummary, selectedLocationId]);


  // -----------------------------------------
  // HANDLE RESOURCE INPUTS
  // -----------------------------------------

  const handleResourceChange = (e) => {

    const { name, value } = e.target;

    setResourceForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // -----------------------------------------
  // OPEN ADD RESOURCE FORM
  // -----------------------------------------

  const handleAddResource = () => {

    const defaultLocation =
      selectedLocationId &&
      selectedLocationId !== "All"
        ? selectedLocationId
        : locations.length
          ? String(locations[0].location_id)
          : "";

    setEditingId(null);

    setResourceForm({
      ...emptyResource,
      location_id: defaultLocation
    });

    setError("");
    setNotice("");

    setShowForm(true);

  };


  // -----------------------------------------
  // OPEN EDIT RESOURCE FORM
  // -----------------------------------------

  const handleEditResource = (resource) => {

    setEditingId(resource.resource_id);

    setResourceForm({

      location_id: String(resource.location_id),
      resource_name: resource.resource_name || "",
      category: resource.category || "Other",
      quantity_available: String(resource.quantity_available),
      unit: resource.unit || "",
      minimum_stock: String(resource.minimum_stock ?? 0)

    });

    setError("");
    setNotice("");

    setShowForm(true);

  };


  // -----------------------------------------
  // CLOSE FORM
  // -----------------------------------------

  const closeForm = () => {

    setShowForm(false);

    setEditingId(null);

    setResourceForm({ ...emptyResource });

    setError("");

  };


  // -----------------------------------------
  // ADD / UPDATE RESOURCE
  // -----------------------------------------

  const handleResourceSubmit = async (e) => {

    e.preventDefault();

    setError("");
    setNotice("");

    if (!resourceForm.location_id) {

      setError("Please select a location.");

      return;
    }

    const quantity = Number(
      resourceForm.quantity_available
    );

    const minimumStock = Number(
      resourceForm.minimum_stock
    );

    if (!Number.isFinite(quantity) || quantity < 0) {

      setError("Enter a valid available quantity.");

      return;
    }

    if (!Number.isFinite(minimumStock) || minimumStock < 0) {

      setError("Enter a valid minimum stock level.");

      return;
    }

    const payload = {

      ...resourceForm,

      location_id: Number(resourceForm.location_id),

      quantity_available: quantity,

      minimum_stock: minimumStock

    };

    try {

      setSaving(true);

      const isEditing = editingId !== null;

      const response = await apiRequest(
        isEditing
          ? `/resources/${editingId}`
          : "/resources",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      setNotice(
        response.message ||
        (
          isEditing
            ? "Resource updated successfully."
            : "Resource added successfully."
        )
      );

      setShowForm(false);
      setEditingId(null);

      setResourceForm({ ...emptyResource });

      await loadInventory(
        selectedLocationId === "All"
          ? null
          : selectedLocationId
      );

    } catch (err) {

      setError(
        err.message || "Unable to save resource."
      );

    } finally {

      setSaving(false);

    }

  };


  // -----------------------------------------
  // DELETE RESOURCE
  // -----------------------------------------

  const handleDeleteResource = async (resource) => {

    const confirmed = window.confirm(
      `Delete "${resource.resource_name}" from ${resource.location_name} inventory?\n\nResources with allocation records cannot be deleted.`
    );

    if (!confirmed) return;

    try {

      setDeletingId(resource.resource_id);

      setError("");
      setNotice("");

      const response = await apiRequest(
        `/resources/${resource.resource_id}`,
        {
          method: "DELETE"
        }
      );

      setNotice(
        response.message || "Resource deleted successfully."
      );

      await loadInventory(
        selectedLocationId === "All"
          ? null
          : selectedLocationId
      );

    } catch (err) {

      setError(
        err.message || "Unable to delete resource."
      );

    } finally {

      setDeletingId(null);

    }

  };


  // -----------------------------------------
  // SEARCH AND STOCK FILTER
  // -----------------------------------------

  const filteredResources = locationScopedResources.filter(resource => {

    const searchText = search.toLowerCase().trim();

    const searchableValues = [
      resource.resource_id,
      resource.resource_name,
      resource.category,
      resource.location_name,
      resource.district,
      resource.state
    ];

    const matchesSearch = searchableValues.some(value =>

      String(value || "")
        .toLowerCase()
        .includes(searchText)

    );

    const matchesStock =
      stockFilter === "All" ||
      resource.stock_status === stockFilter;

    return matchesSearch && matchesStock;

  });


  // -----------------------------------------
  // LOCATION-SPECIFIC STATISTICS
  // -----------------------------------------

  const totalItems = locationScopedResources.length;

  const lowStock = locationScopedResources.filter(
    resource => resource.stock_status === "low_stock"
  ).length;

  const outOfStock = locationScopedResources.filter(
    resource => resource.stock_status === "out_of_stock"
  ).length;

  const availableItems = locationScopedResources.filter(
    resource => resource.stock_status === "available"
  ).length;

  const totalCategories = new Set(
    locationScopedResources.map(resource => resource.category)
  ).size;


  // -----------------------------------------
  // SELECTED LOCATION DETAILS
  // -----------------------------------------

  const selectedLocation = isVolunteer
    ? assignedLocation
    : locations.find(
        location =>
          String(location.location_id) ===
          String(selectedLocationId)
      ) || null;


  const locationViewReady =
    !isCoordinator || Boolean(selectedLocationId);


  // -----------------------------------------
  // LOCATION SUMMARY TABLE
  // -----------------------------------------

  const overviewRows = locationScopedSummary.map(location => ({

    locationId: location.location_id,
    name: location.location_name,
    district: location.district,
    state: location.state,
    totalItems: location.total_items,
    lowStock: location.low_stock_items,
    outOfStock: location.out_of_stock_items,
    available: location.available_items,
    categories: location.total_categories

  }));


  const overviewColumns = [

    { key: "name", label: "Location" },
    { key: "district", label: "District" },
    { key: "state", label: "State" },
    { key: "totalItems", label: "Resource Items" },
    { key: "categories", label: "Categories" },
    { key: "available", label: "Available" },
    { key: "lowStock", label: "Low Stock" },
    { key: "outOfStock", label: "Out of Stock" }

  ];


  // -----------------------------------------
  // RESOURCE TABLE DATA
  // -----------------------------------------

  const resourceRows = filteredResources.map(resource => ({

    resourceId: resource.resource_id,

    id: `R${String(resource.resource_id).padStart(3, "0")}`,

    name: resource.resource_name,

    category: resource.category,

    location: resource.location_name || "Unknown",

    quantity: Number(resource.quantity_available),

    unit: resource.unit,

    minimum: Number(resource.minimum_stock),

    stock: resource.stock_status,

    original: resource

  }));


  // -----------------------------------------
  // RESOURCE TABLE COLUMNS
  // -----------------------------------------

  const resourceColumns = [

    { key: "id", label: "Resource ID" },

    { key: "name", label: "Resource Name" },

    { key: "category", label: "Category" },

    ...(
      isVolunteer
        ? []
        : [
            {
              key: "location",
              label: "Location"
            }
          ]
    ),

    {
      key: "quantity",
      label: "Available",
      render: row => `${row.quantity} ${row.unit}`
    },

    {
      key: "minimum",
      label: "Minimum Stock",
      render: row => `${row.minimum} ${row.unit}`
    },

    {
      key: "stock",
      label: "Stock Status",
      render: row => (
        <StatusBadge status={row.stock.replaceAll("_", " ")} />
      )
    },

    ...(
      canManage
        ? [
            {
              key: "actions",
              label: "Actions",
              render: row => (
                <div className="resource-actions">

                  <button
                    type="button"
                    className="resource-edit-button"
                    onClick={() => handleEditResource(row.original)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="resource-delete-button"
                    onClick={() => handleDeleteResource(row.original)}
                    disabled={deletingId === row.resourceId}
                  >
                    {deletingId === row.resourceId
                      ? "Deleting..."
                      : "Delete"}
                  </button>

                </div>
              )
            }
          ]
        : []
    )

  ];


  // -----------------------------------------
  // PAGE UI
  // -----------------------------------------

  return (

    <div className="module-page resources-page">

      <PageHeader
        title="Resource Management"
        description="Manage relief supplies and monitor inventory by location."
        action={
          canManage && locationViewReady && locations.length > 0 && (
            <button
              type="button"
              className="module-primary-button"
              onClick={handleAddResource}
            >
              + Add Resource
            </button>
          )
        }
      />


      {notice && (
        <p className="resource-notice">{notice}</p>
      )}

      {error && (
        <p className="resource-error">{error}</p>
      )}


      {/* VOLUNTEER LOCATION */}

      {isVolunteer && (

        <div className="resource-location-banner">

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

          <span className="resource-scope-label">
            Location-specific inventory
          </span>

        </div>

      )}


      {/* LOCATION SELECTOR */}

      {!isVolunteer && (

        <SectionCard title="Select Inventory Location">

          <div className="resource-location-filter">

            <label htmlFor="resource-location-filter">
              View inventory for
            </label>

            <select
              id="resource-location-filter"
              value={selectedLocationId}
              onChange={handleLocationSelect}
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
                Choose the area you are monitoring to view its inventory.
              </p>
            )}

          </div>

        </SectionCard>

      )}


      {/* LOADING */}

      {loading ? (

        <SectionCard title="Resource Inventory">
          <p className="module-muted">
            Loading resource information...
          </p>
        </SectionCard>

      ) : (

        <>

          {isVolunteer && !assignedLocation && (

            <div className="resource-empty-location">

              <h3>Volunteer location not linked</h3>

              <p>
                Your volunteer profile is not connected to a registered
                location. Please ask an administrator or coordinator
                to update your volunteer profile.
              </p>

            </div>

          )}


          {isCoordinator && !selectedLocationId && (

            <div className="resource-empty-location">

              <h3>Select a location to monitor</h3>

              <p>
                Choose a location from the dropdown above.
                The inventory statistics and resource list will
                update for that area.
              </p>

            </div>

          )}


          {locationViewReady &&
            (!isVolunteer || assignedLocation) && (

            <>

              {/* CURRENT LOCATION */}

              <div className="resource-current-location">

                <span>
                  {selectedLocationId === "All"
                    ? "Showing combined inventory"
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


              {/* LOCATION-SPECIFIC STATISTICS */}

              <StatGrid>

                <StatCard
                  label="Total Resource Items"
                  value={formatNumber(totalItems)}
                  note="In selected inventory"
                />

                <StatCard
                  label="Available Items"
                  value={formatNumber(availableItems)}
                  note="Above minimum stock"
                />

                <StatCard
                  label="Low Stock Items"
                  value={formatNumber(lowStock)}
                  note="At or below minimum stock"
                />

                <StatCard
                  label="Out of Stock"
                  value={formatNumber(outOfStock)}
                  note={`${totalCategories} resource categories`}
                />

              </StatGrid>


              {/* ADMIN LOCATION OVERVIEW */}

              {isAdmin && selectedLocationId === "All" && (

                <SectionCard title="Inventory Overview by Location">

                  <p className="resource-section-description">
                    Compare resource stock levels across registered
                    locations. Select a location above to view its
                    detailed inventory.
                  </p>

                  <DataTable
                    columns={overviewColumns}
                    data={overviewRows}
                    rowKey="locationId"
                    emptyMessage="No registered locations found."
                  />

                </SectionCard>

              )}


              {/* ADD / EDIT RESOURCE FORM */}

              {showForm && canManage && (

                <SectionCard
                  title={
                    editingId
                      ? "Edit Resource"
                      : "Add New Resource"
                  }
                >

                  <form
                    className="module-form resource-form"
                    onSubmit={handleResourceSubmit}
                  >

                    <label>
                      Resource Name *

                      <input
                        type="text"
                        name="resource_name"
                        value={resourceForm.resource_name}
                        onChange={handleResourceChange}
                        placeholder="Example: Drinking Water"
                        maxLength="120"
                        required
                      />
                    </label>


                    <label>
                      Category *

                      <select
                        name="category"
                        value={resourceForm.category}
                        onChange={handleResourceChange}
                        required
                      >
                        {resourceCategories.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>


                    <label>
                      Location *

                      <select
                        name="location_id"
                        value={resourceForm.location_id}
                        onChange={handleResourceChange}
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
                            {location.location_name}, {location.district}
                          </option>
                        ))}
                      </select>
                    </label>


                    <label>
                      Available Quantity *

                      <input
                        type="number"
                        name="quantity_available"
                        value={resourceForm.quantity_available}
                        onChange={handleResourceChange}
                        min="0"
                        step="0.01"
                        required
                      />
                    </label>


                    <label>
                      Unit *

                      <input
                        type="text"
                        name="unit"
                        value={resourceForm.unit}
                        onChange={handleResourceChange}
                        placeholder="kg, litres, packets, units"
                        maxLength="30"
                        required
                      />
                    </label>


                    <label>
                      Minimum Stock Level

                      <input
                        type="number"
                        name="minimum_stock"
                        value={resourceForm.minimum_stock}
                        onChange={handleResourceChange}
                        min="0"
                        step="0.01"
                      />
                    </label>


                    <div className="full-width resource-form-actions">

                      <button
                        type="submit"
                        className="module-primary-button"
                        disabled={saving}
                      >
                        {saving
                          ? "Saving..."
                          : editingId
                            ? "Update Resource"
                            : "Save Resource"}
                      </button>

                      <button
                        type="button"
                        className="resource-cancel-button"
                        onClick={closeForm}
                        disabled={saving}
                      >
                        Cancel
                      </button>

                    </div>

                  </form>

                </SectionCard>

              )}


              {/* RESOURCE TABLE */}

              <SectionCard title="Resource Inventory">

                <SearchFilters>

                  <input
                    type="search"
                    placeholder="Search resource or category..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />

                  <select
                    value={stockFilter}
                    onChange={e => setStockFilter(e.target.value)}
                  >
                    <option value="All">All Stock Levels</option>
                    <option value="available">Available</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>

                </SearchFilters>


                <DataTable
                  columns={resourceColumns}
                  data={resourceRows}
                  rowKey="resourceId"
                  emptyMessage="No resources found for this location."
                />

              </SectionCard>

            </>

          )}

        </>

      )}

    </div>

  );

}


export default Resources;