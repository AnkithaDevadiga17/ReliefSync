
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
import "./Donations.css";

const API = "http://127.0.0.1:5000/api";


const emptyDonation = {
  location_id: "",
  donor_name: "",
  donor_contact: "",
  donation_type: "items",
  amount: "",
  item_description: "",
  quantity: "",
  unit: "",
  notes: ""
};


const emptyDistribution = {
  donation_id: "",
  disaster_id: "",
  location_id: "",
  amount_allocated: "",
  quantity_allocated: "",
  distribution_notes: ""
};


function formatDate(value) {

  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

}


function Donations() {

  const [donations, setDonations] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [disasters, setDisasters] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showDonationForm, setShowDonationForm] = useState(false);
  const [showDistributionForm, setShowDistributionForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [donationForm, setDonationForm] = useState(emptyDonation);
  const [distributionForm, setDistributionForm] = useState(
    emptyDistribution
  );


  // --------------------------------
  // LOAD ALL DATA
  // --------------------------------

  const loadData = async () => {

    try {

      setLoading(true);
      setError("");

      const endpoints = [
        "/donations",
        "/donation-distributions",
        "/donation-locations",
        "/disasters"
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
            results[index].message || "Unable to load donation data."
          );
        }

      });

      setDonations(results[0].data || []);
      setDistributions(results[1].data || []);
      setLocations(results[2].data || []);
      setDisasters(results[3].data || []);

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
  // DONATION FORM
  // --------------------------------

  const handleDonationChange = (e) => {

    const { name, value } = e.target;

    setDonationForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  const handleAddDonation = () => {

    setEditingId(null);

    setDonationForm({
      ...emptyDonation,
      location_id: locations.length
        ? String(locations[0].location_id)
        : ""
    });

    setNotice("");
    setError("");
    setShowDonationForm(true);

  };


  const handleEditDonation = (donation) => {

    setEditingId(donation.donation_id);

    setDonationForm({
      location_id: donation.location_id
        ? String(donation.location_id)
        : "",
      donor_name: donation.donor_name || "",
      donor_contact: donation.donor_contact || "",
      donation_type: donation.donation_type,
      amount: donation.amount ?? "",
      item_description: donation.item_description || "",
      quantity: donation.quantity ?? "",
      unit: donation.unit || "",
      notes: donation.notes || ""
    });

    setNotice("");
    setError("");
    setShowDonationForm(true);

  };


  // --------------------------------
  // ADD OR UPDATE DONATION
  // --------------------------------

  const handleDonationSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const isEditing = editingId !== null;

      const payload = {
        ...donationForm,
        location_id: donationForm.location_id
          ? Number(donationForm.location_id)
          : null,
        amount: donationForm.donation_type === "cash"
          ? Number(donationForm.amount)
          : null,
        quantity: donationForm.donation_type === "items"
          ? Number(donationForm.quantity)
          : null
      };

      const response = await fetch(
        isEditing
          ? `${API}/donations/${editingId}`
          : `${API}/donations`,
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
        throw new Error(result.message || "Unable to save donation.");
      }

      setShowDonationForm(false);
      setEditingId(null);
      setDonationForm(emptyDonation);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------
  // VERIFY OR REJECT DONATION
  // --------------------------------

  const handleDonationStatus = async (donation, newStatus) => {

    const message = newStatus === "verified"
      ? "Verify this donation?"
      : "Reject this donation?";

    if (!window.confirm(message)) return;

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API}/donations/${donation.donation_id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            donation_status: newStatus
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update donation.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // DELETE DONATION
  // --------------------------------

  const handleDeleteDonation = async (id) => {

    if (!window.confirm("Are you sure you want to delete this donation?")) {
      return;
    }

    try {

      setError("");
      setNotice("");

      const response = await fetch(
        `${API}/donations/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete donation.");
      }

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    }

  };


  // --------------------------------
  // DISTRIBUTION FORM
  // --------------------------------

  const handleDistributionChange = (e) => {

    const { name, value } = e.target;

    setDistributionForm(previous => ({
      ...previous,
      [name]: value
    }));

  };


  const eligibleDonations = donations.filter(donation =>
    ["verified", "partially_distributed"].includes(
      donation.donation_status
    )
  );


  const selectedDonation = donations.find(
    donation =>
      donation.donation_id === Number(distributionForm.donation_id)
  );


  const openDistributionForm = (donation = null) => {

    setDistributionForm({
      ...emptyDistribution,
      donation_id: donation
        ? String(donation.donation_id)
        : eligibleDonations.length
          ? String(eligibleDonations[0].donation_id)
          : "",
      location_id: locations.length
        ? String(locations[0].location_id)
        : ""
    });

    setError("");
    setNotice("");
    setShowDistributionForm(true);

  };


  // --------------------------------
  // CREATE DONATION DISTRIBUTION
  // --------------------------------

  const handleDistributionSubmit = async (e) => {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");
      setNotice("");

      const isCash = selectedDonation?.donation_type === "cash";

      const payload = {
        ...distributionForm,
        donation_id: Number(distributionForm.donation_id),
        location_id: Number(distributionForm.location_id),
        disaster_id: distributionForm.disaster_id
          ? Number(distributionForm.disaster_id)
          : null,
        amount_allocated: isCash
          ? Number(distributionForm.amount_allocated)
          : 0,
        quantity_allocated: isCash
          ? 0
          : Number(distributionForm.quantity_allocated)
      };

      const response = await fetch(
        `${API}/donation-distributions`,
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
        throw new Error(result.message || "Unable to distribute donation.");
      }

      setShowDistributionForm(false);
      setDistributionForm(emptyDistribution);

      setNotice(result.message);

      await loadData();

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  };


  // --------------------------------
  // SEARCH AND FILTER DONATIONS
  // --------------------------------

  const filteredDonations = donations.filter(donation => {

    const text = search.toLowerCase();

    const matchesSearch = [
      donation.donation_id,
      donation.donor_name,
      donation.donor_contact,
      donation.location_name,
      donation.item_description,
      donation.donation_type
    ].some(value =>
      String(value || "").toLowerCase().includes(text)
    );

    const matchesStatus =
      statusFilter === "All" ||
      donation.donation_status === statusFilter;

    const matchesType =
      typeFilter === "All" ||
      donation.donation_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;

  });


  // --------------------------------
  // DONATION TABLE
  // --------------------------------

  const donationRows = filteredDonations.map(donation => {

    const isCash = donation.donation_type === "cash";

    const total = isCash
      ? Number(donation.amount || 0)
      : Number(donation.quantity || 0);

    const distributed = isCash
      ? Number(donation.distributed_amount || 0)
      : Number(donation.distributed_quantity || 0);

    return {

      donationId: donation.donation_id,

      id: `DN${String(donation.donation_id).padStart(3, "0")}`,

      donor: donation.donor_name || "Anonymous",

      location: donation.location_name || "Not specified",

      type: isCash ? "Cash" : "Items",

      details: isCash
        ? `₹${total.toLocaleString("en-IN")}`
        : `${donation.item_description} (${total} ${donation.unit})`,

      distributed: isCash
        ? `₹${distributed.toLocaleString("en-IN")}`
        : `${distributed} ${donation.unit || ""}`,

      status: donation.donation_status,

      date: formatDate(donation.received_at),

      original: donation

    };

  });


  const donationColumns = [

    { key: "id", label: "Donation ID" },
    { key: "donor", label: "Donor" },
    { key: "location", label: "Location" },
    { key: "type", label: "Type" },
    { key: "details", label: "Donation Details" },
    { key: "distributed", label: "Distributed" },

    {
      key: "status",
      label: "Status",
      render: row => (
        <StatusBadge
          status={row.status.replaceAll("_", " ")}
        />
      )
    },

    { key: "date", label: "Received Date" },

    {
      key: "actions",
      label: "Actions",
      render: row => (

        <div className="donation-actions">

          {row.status === "pending" && (
            <>
              <button
                type="button"
                className="donation-edit-button"
                onClick={() => handleEditDonation(row.original)}
              >
                Edit
              </button>

              <button
                type="button"
                className="donation-verify-button"
                onClick={() =>
                  handleDonationStatus(row.original, "verified")
                }
              >
                Verify
              </button>

              <button
                type="button"
                className="donation-delete-button"
                onClick={() =>
                  handleDonationStatus(row.original, "rejected")
                }
              >
                Reject
              </button>
            </>
          )}

          {row.status === "verified" && (
            <>
              <button
                type="button"
                className="donation-edit-button"
                onClick={() => handleEditDonation(row.original)}
              >
                Edit
              </button>

              <button
                type="button"
                className="donation-distribute-button"
                onClick={() => openDistributionForm(row.original)}
              >
                Distribute
              </button>
            </>
          )}

          {row.status === "partially_distributed" && (
            <button
              type="button"
              className="donation-distribute-button"
              onClick={() => openDistributionForm(row.original)}
            >
              Distribute Remaining
            </button>
          )}

        </div>

      )
    }

  ];


  // --------------------------------
  // DISTRIBUTION TABLE
  // --------------------------------

  const distributionRows = distributions.map(item => ({

    id: `DD${String(item.distribution_id).padStart(3, "0")}`,

    donor: item.donor_name || "Anonymous",

    type: item.donation_type,

    disaster: item.disaster_type || "General distribution",

    location: item.location_name,

    value: item.donation_type === "cash"
      ? `₹${Number(item.amount_allocated).toLocaleString("en-IN")}`
      : `${item.quantity_allocated} ${item.unit || ""}`,

    date: formatDate(item.distributed_at)

  }));


  const distributionColumns = [

    { key: "id", label: "Distribution ID" },
    { key: "donor", label: "Donor" },
    { key: "type", label: "Type" },
    { key: "disaster", label: "Disaster" },
    { key: "location", label: "Distribution Location" },
    { key: "value", label: "Distributed Value" },
    { key: "date", label: "Distribution Date" }

  ];


  // --------------------------------
  // STATISTICS
  // --------------------------------

  const totalDonations = donations.length;

  const pendingCount = donations.filter(
    d => d.donation_status === "pending"
  ).length;

  const verifiedCount = donations.filter(
    d => d.donation_status === "verified"
  ).length;

  const distributedCount = donations.filter(
    d => ["partially_distributed", "distributed"].includes(
      d.donation_status
    )
  ).length;


  // --------------------------------
  // PAGE
  // --------------------------------

  return (

    <div className="module-page">

      <PageHeader
        title="Donation Management"
        description="Record donations, verify contributions and track their distribution."
        action={
          <button
            type="button"
            className="module-primary-button"
            onClick={handleAddDonation}
          >
            Add Donation
          </button>
        }
      />


      {notice && (
        <p className="donation-notice">{notice}</p>
      )}

      {error && (
        <p className="donation-error">{error}</p>
      )}


      <StatGrid>

        <StatCard
          label="Total Donations"
          value={totalDonations}
        />

        <StatCard
          label="Pending Verification"
          value={pendingCount}
        />

        <StatCard
          label="Verified Donations"
          value={verifiedCount}
        />

        <StatCard
          label="Distributed Donations"
          value={distributedCount}
        />

      </StatGrid>


      {/* ADD / EDIT DONATION FORM */}
      {showDonationForm && (

        <SectionCard
          title={editingId ? "Edit Donation" : "Record New Donation"}
        >

          <form
            className="module-form donation-form"
            onSubmit={handleDonationSubmit}
          >

            <label>
              Donor Name
              <input
                name="donor_name"
                value={donationForm.donor_name}
                onChange={handleDonationChange}
                placeholder="Enter donor name"
                maxLength="120"
              />
            </label>


            <label>
              Donor Contact
              <input
                name="donor_contact"
                value={donationForm.donor_contact}
                onChange={handleDonationChange}
                placeholder="Phone or contact details"
                maxLength="30"
              />
            </label>


            <label>
              Location
              <select
                name="location_id"
                value={donationForm.location_id}
                onChange={handleDonationChange}
              >

                <option value="">Not specified</option>

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
              Donation Type
              <select
                name="donation_type"
                value={donationForm.donation_type}
                onChange={handleDonationChange}
                disabled={editingId !== null}
              >
                <option value="items">Items</option>
                <option value="cash">Cash</option>
              </select>
            </label>


            {donationForm.donation_type === "cash" ? (

              <label>
                Cash Amount (₹)
                <input
                  type="number"
                  name="amount"
                  value={donationForm.amount}
                  onChange={handleDonationChange}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

            ) : (

              <>
                <label>
                  Item Description
                  <input
                    name="item_description"
                    value={donationForm.item_description}
                    onChange={handleDonationChange}
                    placeholder="Example: Rice bags"
                    required
                  />
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    name="quantity"
                    value={donationForm.quantity}
                    onChange={handleDonationChange}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Unit
                  <input
                    name="unit"
                    value={donationForm.unit}
                    onChange={handleDonationChange}
                    placeholder="kg, packets, litres"
                    maxLength="30"
                    required
                  />
                </label>
              </>

            )}


            <label className="full-width">
              Notes
              <textarea
                name="notes"
                value={donationForm.notes}
                onChange={handleDonationChange}
                placeholder="Additional donation details"
              />
            </label>


            <div className="full-width donation-form-actions">

              <button
                type="submit"
                className="module-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Donation"
                    : "Save Donation"}
              </button>

              <button
                type="button"
                className="donation-cancel-button"
                onClick={() => setShowDonationForm(false)}
              >
                Cancel
              </button>

            </div>

          </form>

        </SectionCard>

      )}


      {/* DONATION LIST */}
      <SectionCard title="Donation Records">

        <SearchFilters>

          <input
            type="text"
            placeholder="Search by donor, location or donation type"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="cash">Cash</option>
            <option value="items">Items</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="partially_distributed">Partially Distributed</option>
            <option value="distributed">Distributed</option>
          </select>

        </SearchFilters>


        {loading ? (
          <p>Loading donations...</p>
        ) : (
          <DataTable
            columns={donationColumns}
            data={donationRows}
            rowKey="donationId"
            emptyMessage="No donations found."
          />
        )}

      </SectionCard>


      {/* DISTRIBUTION FORM */}
      {showDistributionForm && (

        <SectionCard title="Distribute Donation">

          <form
            className="module-form donation-form"
            onSubmit={handleDistributionSubmit}
          >

            <label>
              Select Donation
              <select
                name="donation_id"
                value={distributionForm.donation_id}
                onChange={handleDistributionChange}
                required
              >

                <option value="">Select Donation</option>

                {eligibleDonations.map(donation => {

                  const remaining = donation.donation_type === "cash"
                    ? Number(donation.amount || 0) -
                      Number(donation.distributed_amount || 0)
                    : Number(donation.quantity || 0) -
                      Number(donation.distributed_quantity || 0);

                  const details = donation.donation_type === "cash"
                    ? `₹${remaining} remaining`
                    : `${remaining} ${donation.unit || ""} remaining`;

                  return (
                    <option
                      key={donation.donation_id}
                      value={donation.donation_id}
                    >
                      {donation.donor_name || "Anonymous"} - {details}
                    </option>
                  );

                })}

              </select>
            </label>


            <label>
              Distribution Location
              <select
                name="location_id"
                value={distributionForm.location_id}
                onChange={handleDistributionChange}
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
              Related Disaster (Optional)
              <select
                name="disaster_id"
                value={distributionForm.disaster_id}
                onChange={handleDistributionChange}
              >

                <option value="">General Distribution</option>

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


            {selectedDonation?.donation_type === "cash" ? (

              <label>
                Amount to Distribute (₹)
                <input
                  type="number"
                  name="amount_allocated"
                  value={distributionForm.amount_allocated}
                  onChange={handleDistributionChange}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

            ) : (

              <label>
                Quantity to Distribute
                <input
                  type="number"
                  name="quantity_allocated"
                  value={distributionForm.quantity_allocated}
                  onChange={handleDistributionChange}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

            )}


            <label className="full-width">
              Distribution Notes
              <textarea
                name="distribution_notes"
                value={distributionForm.distribution_notes}
                onChange={handleDistributionChange}
                placeholder="Enter distribution details"
              />
            </label>


            <div className="full-width donation-form-actions">

              <button
                type="submit"
                className="module-primary-button"
                disabled={saving || !eligibleDonations.length}
              >
                {saving ? "Saving..." : "Confirm Distribution"}
              </button>

              <button
                type="button"
                className="donation-cancel-button"
                onClick={() => setShowDistributionForm(false)}
              >
                Cancel
              </button>

            </div>

            {!eligibleDonations.length && (
              <p className="donation-error">
                No verified donations are available for distribution.
              </p>
            )}

          </form>

        </SectionCard>

      )}


      {/* DISTRIBUTION HISTORY */}
      <SectionCard
        title="Donation Distribution History"
      >

        <div className="donation-distribution-heading">

          <p>
            View where cash and donated items have been distributed.
          </p>

          <button
            type="button"
            className="module-primary-button"
            onClick={() => openDistributionForm()}
            disabled={!eligibleDonations.length}
          >
            Distribute Donation
          </button>

        </div>


        {loading ? (
          <p>Loading distribution records...</p>
        ) : (
          <DataTable
            columns={distributionColumns}
            data={distributionRows}
            rowKey="id"
            emptyMessage="No distribution records found."
          />
        )}

      </SectionCard>

    </div>

  );

}

export default Donations;
