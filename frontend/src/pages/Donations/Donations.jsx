import { useState } from "react";
import { DataTable, PageHeader, SearchFilters, SectionCard, StatGrid, StatusBadge } from "../../components/ModuleUI";
import "../../styles/Modules.css";

const donationData = [
  { id: "DN001", donor: "Community Group A", item: "Food Kits", quantity: 100, date: "2026-11-10", destination: "Udupi", status: "Received" },
  { id: "DN002", donor: "Local Business B", item: "Blankets", quantity: 75, date: "2026-11-09", destination: "Kodagu", status: "Distributed" },
  { id: "DN003", donor: "Individual Donor", item: "Drinking Water", quantity: 200, date: "2026-11-08", destination: "Mangalore", status: "Pending" },
  { id: "DN004", donor: "Student Association", item: "First Aid Kits", quantity: 30, date: "2026-11-07", destination: "Kundapura", status: "Partially Distributed" }
];

function Donations() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const rows = donationData
    .filter((item) => [item.id, item.donor, item.item, item.destination].some((value) => value.toLowerCase().includes(search.toLowerCase())))
    .filter((item) => status === "All" || item.status === status);

  const columns = [
    { key: "id", label: "Donation ID" },
    { key: "donor", label: "Donor" },
    { key: "item", label: "Item" },
    { key: "quantity", label: "Quantity" },
    { key: "date", label: "Received Date" },
    { key: "destination", label: "Destination" },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }
  ];

  return (
    <div className="module-page">
      <PageHeader title="Donation Management" description="Record donated relief items and monitor their distribution." />
      <StatGrid items={[
        { label: "Donation Records", value: donationData.length },
        { label: "Items Received", value: donationData.reduce((sum, d) => sum + d.quantity, 0) },
        { label: "Distributed Records", value: donationData.filter((d) => d.status === "Distributed").length },
        { label: "Pending Records", value: donationData.filter((d) => d.status === "Pending").length }
      ]} />
      <SectionCard title="Donation Records">
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by donation ID, donor, item or destination"
          filters={[{ label: "Donation status", value: status, onChange: setStatus, options: ["All", "Received", "Pending", "Distributed", "Partially Distributed"].map((v) => ({ value: v, label: v === "All" ? "All Statuses" : v })) }]}
        />
        <DataTable columns={columns} rows={rows} emptyMessage="No donation records match your search." />
      </SectionCard>
    </div>
  );
}

export default Donations;
