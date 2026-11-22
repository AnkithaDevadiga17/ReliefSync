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
import "./Allocations.css";


const emptyForm = {
  location_id: "",
  disaster_id: "",
  resource_id: "",
  quantity_allocated: "",
  notes: ""
};


const allocationStatuses = [
  "pending",
  "approved",
  "dispatched",
  "delivered",
  "cancelled"
];


function formatDate(value) {

  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
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


function Allocations() {

  const { user } = useAuth();

  const role = user?.role?.toLowerCase();

  const canManage = [
    "admin",
    "coordinator",
    "ngo"
  ].includes(role);

  const isCoordinator = role === "coordinator";


  // ----------------------------------------
  // DATA
  // ----------------------------------------

  const [locations, setLocations] = useState([]);

  const [disasters, setDisasters] = useState([]);

  const [resources, setResources] = useState([]);

  const [allocations, setAllocations] = useState([]);


  // ----------------------------------------
  // LOCATION FILTER
  // ----------------------------------------

  const [selectedLocationId, setSelectedLocationId] =
    useState(isCoordinator ? "" : "All");


  // ----------------------------------------
  // SEARCH AND FILTER
  // ----------------------------------------

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");


  // ----------------------------------------
  // FORM
  // ----------------------------------------

  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState(emptyForm);


  // ----------------------------------------
  // REQUEST STATE
  // ----------------------------------------

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");


  // ----------------------------------------
  // LOAD ALLOCATIONS AND INVENTORY
  // ----------------------------------------

  const loadScopeData = async (locationId) => {

    const scoped = locationId && locationId !== "All";

    const allocationEndpoint = scoped
      ? `/allocations?location_id=${encodeURIComponent(locationId)}`
      : "/allocations";

    const resourceEndpoint = scoped
      ? `/resources?location_id=${encodeURIComponent(locationId)}`
      : "/resources";


    const [allocationResponse, resourceResponse] =
      await Promise.all([

        apiRequest(allocationEndpoint),

        apiRequest(resourceEndpoint)

      ]);


    setAllocations(allocationResponse.data || []);

    setResources(resourceResponse.data || []);

  };


  // ----------------------------------------
  // INITIAL PAGE LOAD
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

        setSelectedLocationId("");

        setAllocations([]);

        setResources([]);

      } else {

        setSelectedLocationId("All");

        await loadScopeData("All");

      }

    } catch (err) {

      setError(
        err.message || "Unable to load allocation information."
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

    setStatusFilter("All");

    setError("");

    setNotice("");

    setShowForm(false);

    if (!locationId) {

      setAllocations([]);

      setResources([]);

      return;
    }

    try {

      setLoading(true);

      await loadScopeData(locationId);

    } catch (err) {

      setError(
        err.message || "Unable to load records for this location."
      );

      setAllocations([]);

      setResources([]);

    } finally {

      setLoading(false);

    }

  };


  // ----------------------------------------
  // REFRESH CURRENT VIEW
  // ----------------------------------------

  const refreshCurrentView = async () => {

    if (isCoordinator && !selectedLocationId) {
      return;
    }

    await loadScopeData(selectedLocationId);

  };


  // ----------------------------------------
  // FORM INPUT HANDLING
  // ----------------------------------------

  const handleFormChange = (e) => {

    const { name, value } = e.target;

    setFormData(previous => ({

      ...previous,

      [name]: value,

      // Reset dependent selections when location changes.
      ...(name === "location_id"
        ? {
            disaster_id: "",
            resource_id: ""
          }
        : {})

    }));

  };


  // ----------------------------------------
  // OPEN ALLOCATION FORM
  // ----------------------------------------

  const openForm = () => {

    setFormData({

      ...emptyForm,

      location_id:
        selectedLocationId !== "All"
          ? selectedLocationId
          : ""

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

    setFormData({ ...emptyForm });

  };


  // ----------------------------------------
  // FILTER DISASTERS BY FORM LOCATION
  // ----------------------------------------

  const formDisasters = useMemo(() => {

    if (!formData.location_id) return [];

    return disasters.filter(disaster =>

      String(disaster.location_id) ===
      String(formData.location_id)

    );

  }, [disasters, formData.location_id]);


  // ----------------------------------------
  // FILTER RESOURCES BY FORM LOCATION
  // ----------------------------------------

  const formResources = useMemo(() => {

    if (!formData.location_id) return [];

    return resources.filter(resource =>

      String(resource.location_id) ===
      String(formData.location_id)

    );

  }, [resources, formData.location_id]);


  const selectedResource = formResources.find(resource =>

    String(resource.resource_id) ===
    String(formData.resource_id)

  );


  // ----------------------------------------
  // CREATE ALLOCATION REQUEST
  // ----------------------------------------

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setNotice("");


    if (
      !formData.location_id ||
      !formData.disaster_id ||
      !formData.resource_id
    ) {

      setError("Please select a location, disaster and resource.");

      return;
    }


    const quantity = Number(formData.quantity_allocated);

    if (!Number.isFinite(quantity) || quantity <= 0) {

      setError("Enter a valid positive allocation quantity.");

      return;
    }


    if (!selectedResource) {

      setError("Please select a valid resource from this location.");

      return;
    }


    if (
      quantity >
      Number(selectedResource.quantity_available)
    ) {

      setError(
        `Only ${selectedResource.quantity_available} ${selectedResource.unit} is currently available.`
      );

      return;
    }


    const payload = {

      resource_id: Number(formData.resource_id),

      disaster_id: Number(formData.disaster_id),

      quantity_allocated: quantity,

      notes: formData.notes.trim() || null

    };


    try {

      setSaving(true);

      const response = await apiRequest(
        "/allocations",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );


      setNotice(
        response.message ||
        "Allocation request created successfully."
      );

      setShowForm(false);

      setFormData({ ...emptyForm });

      await refreshCurrentView();

      // Refresh inventory to reflect any stock changes.
      await loadScopeData(selectedLocationId);

    } catch (err) {

      setError(
        err.message || "Unable to create allocation request."
      );

    } finally {

      setSaving(false);

    }

  };


  // ----------------------------------------
  // UPDATE ALLOCATION STATUS
  // ----------------------------------------

  const updateStatus = async (allocation, newStatus) => {

    const confirmed = window.confirm(
      `Change allocation A${String(allocation.allocation_id).padStart(3, "0")} to "${displayLabel(newStatus)}"?`
    );

    if (!confirmed) return;


    try {

      setUpdatingId(allocation.allocation_id);

      setError("");

      setNotice("");

      const response = await apiRequest(
        `/allocations/${allocation.allocation_id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            allocation_status: newStatus
          })
        }
      );


      setNotice(
        response.message || "Allocation status updated."
      );

      await refreshCurrentView();

    } catch (err) {

      setError(
        err.message || "Unable to update allocation."
      );

    } finally {

      setUpdatingId(null);

    }

  };


  // ----------------------------------------
  // DELETE PENDING ALLOCATION
  // ----------------------------------------

  const deleteAllocation = async (allocation) => {

    const confirmed = window.confirm(
      "Delete this pending allocation request?"
    );

    if (!confirmed) return;


    try {

      setDeletingId(allocation.allocation_id);

      setError("");

      setNotice("");

      const response = await apiRequest(
        `/allocations/${allocation.allocation_id}`,
        {
          method: "DELETE"
        }
      );


      setNotice(
        response.message || "Allocation deleted successfully."
      );

      await refreshCurrentView();

    } catch (err) {

      setError(
        err.message || "Unable to delete allocation."
      );

    } finally {

      setDeletingId(null);

    }

  };


  // ----------------------------------------
  // AVAILABLE ACTIONS FOR EACH STATUS
  // ----------------------------------------

  const renderActions = (allocation) => {

    const busy =
      updatingId === allocation.allocation_id ||
      deletingId === allocation.allocation_id;

    if (busy) {

      return (
        <span className="allocation-muted">
          Updating...
        </span>
      );

    }

    const buttons = [];

    if (allocation.allocation_status === "pending") {

      buttons.push(
        <button
          key="approve"
          type="button"
          className="allocation-action approve"
          onClick={() => updateStatus(allocation, "approved")}
        >
          Approve
        </button>
      );

      buttons.push(
        <button
          key="cancel"
          type="button"
          className="allocation-action cancel"
          onClick={() => updateStatus(allocation, "cancelled")}
        >
          Cancel
        </button>
      );

      buttons.push(
        <button
          key="delete"
          type="button"
          className="allocation-action delete"
          onClick={() => deleteAllocation(allocation)}
        >
          Delete
        </button>
      );

    }


    if (allocation.allocation_status === "approved") {

      buttons.push(
        <button
          key="dispatch"
          type="button"
          className="allocation-action dispatch"
          onClick={() => updateStatus(allocation, "dispatched")}
        >
          Mark Dispatched
        </button>
      );

      buttons.push(
        <button
          key="cancel"
          type="button"
          className="allocation-action cancel"
          onClick={() => updateStatus(allocation, "cancelled")}
        >
          Cancel
        </button>
      );

    }


    if (allocation.allocation_status === "dispatched") {

      buttons.push(
        <button
          key="delivered"
          type="button"
          className="allocation-action delivered"
          onClick={() => updateStatus(allocation, "delivered")}
        >
          Mark Delivered
        </button>
      );

    }

    return (

      <div className="allocation-actions">

        {buttons.length
          ? buttons
          : <span className="allocation-muted">No actions</span>}

      </div>

    );

  };


  // ----------------------------------------
  // LOCATION-SCOPED ALLOCATIONS
  // ----------------------------------------

  const scopedAllocations = useMemo(() => {

    if (
      !selectedLocationId ||
      selectedLocationId === "All"
    ) {

      return allocations;

    }

    return allocations.filter(allocation =>

      String(allocation.disaster_location_id) ===
      String(selectedLocationId)

    );

  }, [allocations, selectedLocationId]);


  // ----------------------------------------
  // SEARCH AND STATUS FILTER
  // ----------------------------------------

  const filteredAllocations = scopedAllocations.filter(allocation => {

    const searchText = search.toLowerCase().trim();

    const searchableValues = [
      allocation.allocation_id,
      allocation.resource_name,
      allocation.disaster_type,
      allocation.location_name,
      allocation.district,
      allocation.state,
      allocation.allocated_by_name,
      allocation.notes
    ];

    const matchesSearch = searchableValues.some(value =>

      String(value || "")
        .toLowerCase()
        .includes(searchText)

    );

    const matchesStatus =
      statusFilter === "All" ||
      allocation.allocation_status === statusFilter;

    return matchesSearch && matchesStatus;

  });


  // ----------------------------------------
  // STATISTICS
  // ----------------------------------------

  const totalAllocations = scopedAllocations.length;

  const pendingCount = scopedAllocations.filter(
    item => item.allocation_status === "pending"
  ).length;

  const approvedCount = scopedAllocations.filter(
    item => item.allocation_status === "approved"
  ).length;

  const dispatchedCount = scopedAllocations.filter(
    item => item.allocation_status === "dispatched"
  ).length;

  const deliveredCount = scopedAllocations.filter(
    item => item.allocation_status === "delivered"
  ).length;


  // ----------------------------------------
  // TABLE DATA
  // ----------------------------------------

  const tableData = filteredAllocations.map(allocation => ({

    allocationId: allocation.allocation_id,

    id: `A${String(allocation.allocation_id).padStart(3, "0")}`,

    resource: allocation.resource_name,

    disaster: allocation.disaster_type,

    location: allocation.location_name || "—",

    quantity: `${allocation.quantity_allocated} ${allocation.unit}`,

    status: allocation.allocation_status,

    requestedBy: allocation.allocated_by_name || "—",

    requestedAt: formatDate(allocation.allocated_at),

    dispatchedAt: formatDate(allocation.dispatched_at),

    original: allocation

  }));


  // ----------------------------------------
  // TABLE COLUMNS
  // ----------------------------------------

  const columns = [

    {
      key: "id",
      label: "Allocation ID"
    },

    {
      key: "resource",
      label: "Resource"
    },

    {
      key: "disaster",
      label: "Disaster"
    },

    {
      key: "location",
      label: "Location"
    },

    {
      key: "quantity",
      label: "Allocated Quantity"
    },

    {
      key: "status",
      label: "Status",
      render: row => (
        <StatusBadge
          status={row.status}
        />
      )
    },

    {
      key: "requestedBy",
      label: "Requested By"
    },

    {
      key: "requestedAt",
      label: "Requested At"
    },

    {
      key: "dispatchedAt",
      label: "Dispatched At"
    },

    {
      key: "actions",
      label: "Actions",
      render: row => renderActions(row.original)
    }

  ];


  // ----------------------------------------
  // SELECTED LOCATION LABEL
  // ----------------------------------------

  const selectedLocation = locations.find(location =>

    String(location.location_id) ===
    String(selectedLocationId)

  );


  // ----------------------------------------
  // LOCATION VIEW READY
  // IMPORTANT: THIS MUST BE INSIDE THE COMPONENT
  // ----------------------------------------

  const locationViewReady =
    !isCoordinator || Boolean(selectedLocationId);


  // ----------------------------------------
  // ACCESS CONTROL MESSAGE
  // ----------------------------------------

  if (!canManage) {

    return (

      <div className="module-page">

        <PageHeader
          title="Resource Allocation"
          description="Manage the allocation and delivery of relief resources."
        />

        <SectionCard title="Access Restricted">

          <p>
            Resource Allocation is available to administrators,
            coordinators and NGO operators.
          </p>

        </SectionCard>

      </div>

    );

  }


  // ----------------------------------------
  // PAGE UI
  // ----------------------------------------

  return (

    <div className="module-page allocations-page">

      <PageHeader

        title="Resource Allocation"

        description="Allocate relief supplies to disasters and track their delivery."

        action={

          locationViewReady && (

            <button
              type="button"
              className="module-primary-button"
              onClick={openForm}
            >
              + New Allocation
            </button>

          )

        }

      />


      {notice && (
        <div className="allocation-notice">
          {notice}
        </div>
      )}


      {error && (
        <div className="allocation-error">
          {error}
        </div>
      )}


      {/* LOCATION SELECTOR */}

      <SectionCard title="Select Allocation Location">

        <div className="allocation-location-filter">

          <label htmlFor="allocation-location">
            View allocations for
          </label>

          <select
            id="allocation-location"
            value={selectedLocationId}
            onChange={handleLocationChange}
          >

            {isCoordinator ? (

              <option value="">
                Select your monitoring location
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

        </div>

      </SectionCard>


      {isCoordinator && !selectedLocationId && (

        <div className="allocation-empty">

          <h3>Select a location</h3>

          <p>
            Choose the location you are monitoring to view and manage
            its resource allocations.
          </p>

        </div>

      )}


      {/* MAIN CONTENT */}

      {locationViewReady && (

        <>

          <div className="allocation-current-location">

            <span>
              {selectedLocationId === "All"
                ? "Showing combined allocation information"
                : "Currently monitoring"}
            </span>

            <strong>
              {selectedLocationId === "All"
                ? "All Locations"
                : selectedLocation?.location_name || "Selected Location"}
            </strong>

          </div>


          {/* STATISTICS */}

          <StatGrid>

            <StatCard
              label="Total Allocations"
              value={totalAllocations}
              note="All allocation records"
            />

            <StatCard
              label="Pending"
              value={pendingCount}
              note="Awaiting approval"
            />

            <StatCard
              label="Approved"
              value={approvedCount}
              note="Ready for dispatch"
            />

            <StatCard
              label="Dispatched"
              value={dispatchedCount}
              note={`${deliveredCount} delivered`}
            />

          </StatGrid>


          {/* CREATE ALLOCATION FORM */}

          {showForm && (

            <SectionCard title="Create Allocation Request">

              <form
                className="module-form allocation-form"
                onSubmit={handleSubmit}
              >

                <label>
                  Location *

                  <select
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleFormChange}
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
                  Disaster *

                  <select
                    name="disaster_id"
                    value={formData.disaster_id}
                    onChange={handleFormChange}
                    required
                    disabled={!formData.location_id}
                  >

                    <option value="">
                      Select Disaster
                    </option>

                    {formDisasters.map(disaster => (

                      <option
                        key={disaster.disaster_id}
                        value={disaster.disaster_id}
                      >
                        {disaster.disaster_type} — {disaster.location_name}
                      </option>

                    ))}

                  </select>

                  {formData.location_id && formDisasters.length === 0 && (

                    <small className="allocation-hint">
                      No disasters are registered for this location.
                    </small>

                  )}

                </label>


                <label>
                  Resource *

                  <select
                    name="resource_id"
                    value={formData.resource_id}
                    onChange={handleFormChange}
                    required
                    disabled={!formData.location_id}
                  >

                    <option value="">
                      Select Resource
                    </option>

                    {formResources.map(resource => (

                      <option
                        key={resource.resource_id}
                        value={resource.resource_id}
                      >
                        {resource.resource_name} — {resource.quantity_available} {resource.unit} available
                      </option>

                    ))}

                  </select>

                  {formData.location_id && formResources.length === 0 && (

                    <small className="allocation-hint">
                      No resources are registered for this location.
                    </small>

                  )}

                </label>


                <label>
                  Quantity to Allocate *

                  <input
                    type="number"
                    name="quantity_allocated"
                    value={formData.quantity_allocated}
                    onChange={handleFormChange}
                    min="0.01"
                    max={selectedResource?.quantity_available}
                    step="0.01"
                    placeholder="Enter quantity"
                    required
                  />

                </label>


                {selectedResource && (

                  <div className="allocation-stock-info">

                    <span>Current available stock</span>

                    <strong>
                      {selectedResource.quantity_available} {selectedResource.unit}
                    </strong>

                  </div>

                )}


                <label className="allocation-full-width">
                  Notes

                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    placeholder="Reason for allocation or special instructions..."
                    rows="3"
                  />

                </label>


                <div className="allocation-form-actions allocation-full-width">

                  <button
                    type="submit"
                    className="module-primary-button"
                    disabled={
                      saving ||
                      !formDisasters.length ||
                      !formResources.length
                    }
                  >
                    {saving
                      ? "Submitting..."
                      : "Create Allocation Request"}
                  </button>


                  <button
                    type="button"
                    className="allocation-cancel-button"
                    onClick={closeForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </SectionCard>

          )}


          {/* ALLOCATION RECORDS */}

          <SectionCard title="Allocation Records">

            <SearchFilters>

              <input
                type="search"
                placeholder="Search resource, disaster or location..."
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

                {allocationStatuses.map(status => (

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
                Loading allocations...
              </p>

            ) : (

              <DataTable
                columns={columns}
                data={tableData}
                rowKey="allocationId"
                emptyMessage="No allocation records found for this location."
              />

            )}

          </SectionCard>

        </>

      )}

    </div>

  );

}


export default Allocations;