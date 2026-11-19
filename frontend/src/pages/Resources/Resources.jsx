
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
import "./Resources.css";

const API = "http://127.0.0.1:5000/api";

const emptyResource = {
  location_id: "",
  resource_name: "",
  category: "Food",
  quantity_available: "",
  unit: "",
  minimum_stock: "0"
};

const emptyAllocation = {
  resource_id: "",
  disaster_id: "",
  quantity_allocated: "",
  notes: ""
};


function Resources() {

  const [resources, setResources] = useState([]);
  const [locations, setLocations] = useState([]);
  const [disasters, setDisasters] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showAllocationForm, setShowAllocationForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [allocationForm, setAllocationForm] = useState(emptyAllocation);


  // --------------------------------
  // LOAD ALL DATA
  // --------------------------------

  const loadData = async () => {

    try {

      setLoading(true);
      setError("");

      const responses = await Promise.all([
        fetch(`${API}/resources`),
        fetch(`${API}/locations`),
        fetch(`${API}/disasters`),
        fetch(`${API}/allocations`)
      ]);

      const results = await Promise.all(
        responses.map(response => response.json())
      );

      responses.forEach((response, index) => {
        if (!response.ok || !results[index].success) {
          throw new Error(
            results[index].message || "Unable to load module data."
          );
        }
      });

      setResources(results[0].data || []);
      setLocations(results[1].data || []);
      setDisasters(results[2].data || []);
      setAllocations(results[3].data || []);

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
  // HANDLE RESOURCE INPUTS
  // --------------------------------

  const handleResourceChange = (e) => {

    const { name, value } = e.target;

    setResourceForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // OPEN ADD RESOURCE FORM
  const handleAddResource = () => {

    setEditingId(null);

    setResourceForm({
      ...emptyResource,
      location_id: locations.length
        ? String(locations[0].location_id)
        : ""
    });

    setError("");
    setNotice("");
    setShowResourceForm(true);

  };


  // OPEN EDIT RESOURCE FORM
  const handleEditResource = (resource) => {

    setEditingId(resource.resource_id);

    setResourceForm({
      location_id: String(resource.location_id),
      resource_name: resource.resource_name,
      category: resource.category,
      quantity_available: String(resource.quantity_available),
      unit: resource.unit,
      minimum_stock: String(resource.minimum_stock)
    });

    setError("");
    setNotice("");
    setShowResourceForm(true);

  };


  // --------------------------------
  // ADD OR UPDATE RESOURCE
  // --------------------------------

  const handleResourceSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const isEditing = editingId !== null;

      const payload = {
        ...resourceForm,
        location_id: Number(resourceForm.location_id),
        quantity_available: Number(resourceForm.quantity_available),
        minimum_stock: Number(resourceForm.minimum_stock)
      };

      const response = await fetch(
        isEditing
          ? `${API}/resources/${editingId}`
          : `${API}/resources`,
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
        throw new Error(result.message || "Unable to save resource.");
      }

      setShowResourceForm(false);
      setEditingId(null);
      setResourceForm(emptyResource);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------
  // DELETE RESOURCE
  // --------------------------------

  const handleDeleteResource = async (id) => {

    if (!window.confirm("Delete this resource?")) return;

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API}/resources/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete resource.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // HANDLE ALLOCATION INPUTS
  // --------------------------------

  const handleAllocationChange = (e) => {

    const { name, value } = e.target;

    setAllocationForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  // OPEN ALLOCATION FORM
  const handleAddAllocation = () => {

    setAllocationForm({
      ...emptyAllocation,
      resource_id: resources.length
        ? String(resources[0].resource_id)
        : "",
      disaster_id: disasters.length
        ? String(disasters[0].disaster_id)
        : ""
    });

    setError("");
    setNotice("");
    setShowAllocationForm(true);

  };


  // --------------------------------
  // CREATE ALLOCATION
  // --------------------------------

  const handleAllocationSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        ...allocationForm,
        resource_id: Number(allocationForm.resource_id),
        disaster_id: Number(allocationForm.disaster_id),
        quantity_allocated: Number(allocationForm.quantity_allocated)
      };

      const response = await fetch(
        `${API}/allocations`,
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
        throw new Error(result.message || "Allocation failed.");
      }

      setShowAllocationForm(false);
      setAllocationForm(emptyAllocation);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------
  // UPDATE ALLOCATION STATUS
  // --------------------------------

  const handleAllocationStatus = async (allocation, newStatus) => {

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API}/allocations/${allocation.allocation_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            allocation_status: newStatus
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update allocation.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // DELETE PENDING ALLOCATION
  // --------------------------------

  const handleDeleteAllocation = async (id) => {

    if (!window.confirm("Delete this pending allocation?")) return;

    try {

      const response = await fetch(
        `${API}/allocations/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete allocation.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // RESOURCE SEARCH AND FILTER
  // --------------------------------

  const filteredResources = resources.filter(resource => {

    const text = search.toLowerCase();

    const matchesSearch = [
      resource.resource_name,
      resource.category,
      resource.location_name
    ].some(value =>
      String(value || "").toLowerCase().includes(text)
    );

    const matchesStock =
      stockFilter === "All" ||
      resource.stock_status === stockFilter;

    return matchesSearch && matchesStock;

  });


  // --------------------------------
  // RESOURCE TABLE
  // --------------------------------

  const resourceRows = filteredResources.map(resource => ({

    resourceId: resource.resource_id,

    id: `R${String(resource.resource_id).padStart(3, "0")}`,

    name: resource.resource_name,

    category: resource.category,

    location: resource.location_name || "Unknown",

    quantity: Number(resource.quantity_available),

    unit: resource.unit,

    minimum: Number(resource.minimum_stock),

    stock: resource.stock_status

  }));


  const resourceColumns = [

    { key: "id", label: "Resource ID" },
    { key: "name", label: "Resource Name" },
    { key: "category", label: "Category" },
    { key: "location", label: "Location" },

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
        <StatusBadge
          status={row.stock.replaceAll("_", " ")}
        />
      )
    },

    {
      key: "actions",
      label: "Actions",
      render: row => (

        <div className="resource-actions">

          <button
            type="button"
            className="resource-edit-button"
            onClick={() => {
              const selected = resources.find(
                r => r.resource_id === row.resourceId
              );

              if (selected) handleEditResource(selected);
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="resource-delete-button"
            onClick={() => handleDeleteResource(row.resourceId)}
          >
            Delete
          </button>

        </div>
      )
    }

  ];


  // --------------------------------
  // ALLOCATION TABLE
  // --------------------------------

  const allocationRows = allocations.map(allocation => ({
    allocationId: allocation.allocation_id,
    id: `A${String(allocation.allocation_id).padStart(3, "0")}`,
    resource: allocation.resource_name,
    disaster: allocation.disaster_type,
    location: allocation.location_name || "Unknown",
    quantity: allocation.quantity_allocated,
    unit: allocation.unit,
    status: allocation.allocation_status,
    original: allocation
  }));


  const nextStatus = {
    pending: "approved",
    approved: "dispatched",
    dispatched: "delivered"
  };

  const nextStatusLabel = {
    pending: "Approve",
    approved: "Mark Dispatched",
    dispatched: "Mark Delivered"
  };


  const allocationColumns = [

    { key: "id", label: "Allocation ID" },
    { key: "resource", label: "Resource" },
    { key: "disaster", label: "Disaster" },
    { key: "location", label: "Location" },

    {
      key: "quantity",
      label: "Allocated Quantity",
      render: row => `${row.quantity} ${row.unit}`
    },

    {
      key: "status",
      label: "Status",
      render: row => (
        <StatusBadge status={row.status} />
      )
    },

    {
      key: "actions",
      label: "Actions",
      render: row => (

        <div className="resource-actions">

          {nextStatus[row.status] && (

            <button
              type="button"
              className="resource-edit-button"
              onClick={() =>
                handleAllocationStatus(
                  row.original,
                  nextStatus[row.status]
                )
              }
            >
              {nextStatusLabel[row.status]}
            </button>

          )}

          {(row.status === "pending" || row.status === "approved") && (

            <button
              type="button"
              className="resource-delete-button"
              onClick={() =>
                handleAllocationStatus(row.original, "cancelled")
              }
            >
              Cancel
            </button>

          )}

          {row.status === "pending" && (

            <button
              type="button"
              className="resource-delete-button"
              onClick={() => handleDeleteAllocation(row.allocationId)}
            >
              Delete
            </button>

          )}

        </div>
      )
    }

  ];


  // --------------------------------
  // STATISTICS
  // --------------------------------

  const lowStock = resources.filter(
    r => Number(r.quantity_available) <= Number(r.minimum_stock)
  ).length;

  const pendingAllocations = allocations.filter(
    a => a.allocation_status === "pending"
  ).length;


  // --------------------------------
  // PAGE
  // --------------------------------

  return (

    <div className="module-page">

      <PageHeader
        title="Resource Management"
        description="Manage relief supplies, monitor stock and allocate resources to disasters."
        action={
          <button
            type="button"
            className="module-primary-button"
            onClick={handleAddResource}
          >
            Add Resource
          </button>
        }
      />


      {notice && (
        <p className="resource-notice">{notice}</p>
      )}

      {error && (
        <p className="resource-error">{error}</p>
      )}


      <StatGrid>

        <StatCard
          label="Total Resource Items"
          value={resources.length}
        />

        <StatCard
          label="Low / Out of Stock"
          value={lowStock}
        />

        <StatCard
          label="Allocation Requests"
          value={allocations.length}
        />

        <StatCard
          label="Pending Allocations"
          value={pendingAllocations}
        />

      </StatGrid>


      {/* RESOURCE FORM */}
      {showResourceForm && (

        <SectionCard
          title={editingId ? "Edit Resource" : "Add New Resource"}
        >

          <form
            className="module-form resource-form"
            onSubmit={handleResourceSubmit}
          >

            <label>
              Resource Name
              <input
                name="resource_name"
                value={resourceForm.resource_name}
                onChange={handleResourceChange}
                placeholder="Example: Drinking Water"
                maxLength="120"
                required
              />
            </label>


            <label>
              Category
              <select
                name="category"
                value={resourceForm.category}
                onChange={handleResourceChange}
                required
              >
                <option value="Food">Food</option>
                <option value="Water">Water</option>
                <option value="Medicine">Medicine</option>
                <option value="Clothing">Clothing</option>
                <option value="Rescue Equipment">Rescue Equipment</option>
                <option value="Other">Other</option>
              </select>
            </label>


            <label>
              Location
              <select
                name="location_id"
                value={resourceForm.location_id}
                onChange={handleResourceChange}
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
              Available Quantity
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
              Unit
              <input
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
                disabled={saving || locations.length === 0}
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
                onClick={() => setShowResourceForm(false)}
              >
                Cancel
              </button>

            </div>

          </form>

        </SectionCard>

      )}


      {/* RESOURCE INVENTORY */}
      <SectionCard title="Resource Inventory">

        <SearchFilters>

          <input
            type="text"
            placeholder="Search resources, category or location"
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


        {loading ? (
          <p>Loading resources...</p>
        ) : (
          <DataTable
            columns={resourceColumns}
            data={resourceRows}
            rowKey="resourceId"
            emptyMessage="No resources found."
          />
        )}

      </SectionCard>


      {/* RESOURCE ALLOCATION */}
      <SectionCard
        title="Resource Allocation"
      >

        <div className="resource-allocation-heading">

          <p>
            Allocate available relief supplies to registered disasters.
          </p>

          <button
            type="button"
            className="module-primary-button"
            onClick={handleAddAllocation}
            disabled={!resources.length || !disasters.length}
          >
            Allocate Resource
          </button>

        </div>


        {showAllocationForm && (

          <form
            className="module-form resource-form"
            onSubmit={handleAllocationSubmit}
          >

            <label>
              Select Resource
              <select
                name="resource_id"
                value={allocationForm.resource_id}
                onChange={handleAllocationChange}
                required
              >

                <option value="">Select Resource</option>

                {resources.map(resource => (

                  <option
                    key={resource.resource_id}
                    value={resource.resource_id}
                  >
                    {resource.resource_name} (
                    {resource.quantity_available} {resource.unit})
                  </option>

                ))}

              </select>
            </label>


            <label>
              Select Disaster
              <select
                name="disaster_id"
                value={allocationForm.disaster_id}
                onChange={handleAllocationChange}
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
              Quantity to Allocate
              <input
                type="number"
                name="quantity_allocated"
                value={allocationForm.quantity_allocated}
                onChange={handleAllocationChange}
                min="0.01"
                step="0.01"
                required
              />
            </label>


            <label>
              Notes
              <input
                name="notes"
                value={allocationForm.notes}
                onChange={handleAllocationChange}
                placeholder="Enter allocation notes"
              />
            </label>


            <div className="full-width resource-form-actions">

              <button
                type="submit"
                className="module-primary-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Allocation"}
              </button>

              <button
                type="button"
                className="resource-cancel-button"
                onClick={() => setShowAllocationForm(false)}
              >
                Cancel
              </button>

            </div>

          </form>

        )}


        {allocations.length === 0 ? (

          <p>No allocation requests available.</p>

        ) : (

          <DataTable
            columns={allocationColumns}
            data={allocationRows}
            rowKey="allocationId"
            emptyMessage="No allocations found."
          />

        )}

      </SectionCard>

    </div>

  );

}

export default Resources;
