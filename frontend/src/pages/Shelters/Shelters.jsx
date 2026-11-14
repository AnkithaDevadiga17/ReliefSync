import { useState } from "react";
import { DataTable, PageHeader, SearchFilters, SectionCard, StatGrid, StatusBadge } from "../../components/ModuleUI";
import "../../styles/Modules.css";

const shelterData = [
  { id: "S001", name: "Government High School", location: "Udupi", capacity: 200, occupied: 145, status: "Open" },
  { id: "S002", name: "Community Relief Centre", location: "Mangalore", capacity: 120, occupied: 120, status: "Full" },
  { id: "S003", name: "Government College", location: "Kundapura", capacity: 150, occupied: 80, status: "Open" },
  { id: "S004", name: "Town Community Hall", location: "Madikeri", capacity: 100, occupied: 0, status: "Closed" }
];

function Shelters() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const totalCapacity = shelterData.reduce((sum, item) => sum + item.capacity, 0);
  const totalOccupied = shelterData.reduce((sum, item) => sum + item.occupied, 0);

  const filtered = shelterData
    .filter((item) => [item.id, item.name, item.location].some((value) => value.toLowerCase().includes(search.toLowerCase())))
    .filter((item) => status === "All" || item.status === status)
    .map((item) => ({ ...item, available: item.capacity - item.occupied }));

  const columns = [
    { key: "id", label: "Shelter ID" },
    { key: "name", label: "Shelter Name" },
    { key: "location", label: "Location" },
    { key: "capacity", label: "Capacity" },
    { key: "occupied", label: "Occupied" },
    { key: "available", label: "Available" },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }
  ];

  return (
    <div className="module-page">
      <PageHeader title="Shelter Management" description="Monitor shelter capacity, occupancy and availability." />
      <StatGrid items={[
        { label: "Total Shelters", value: shelterData.length },
        { label: "Open Shelters", value: shelterData.filter((s) => s.status === "Open").length },
        { label: "Total Capacity", value: totalCapacity },
        { label: "Occupied Spaces", value: totalOccupied }
      ]} />
      <SectionCard title="Shelter List">
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by shelter ID, name or location"
          filters={[{ label: "Shelter status", value: status, onChange: setStatus, options: ["All", "Open", "Full", "Closed"].map((v) => ({ value: v, label: v === "All" ? "All Statuses" : v })) }]}
        />
        <DataTable columns={columns} rows={filtered} emptyMessage="No shelters match your search." />
      </SectionCard>
    </div>
  );
}

export default Shelters;
