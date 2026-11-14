import { useState } from "react";
import { DataTable, PageHeader, SearchFilters, SectionCard, StatGrid, StatusBadge } from "../../components/ModuleUI";
import "../../styles/Modules.css";

const volunteerData = [
  { id: "V001", name: "Aarav Shetty", skills: "First Aid", location: "Udupi", availability: "Available", assignment: "Udupi Shelter" },
  { id: "V002", name: "Meera Rao", skills: "Logistics", location: "Mangalore", availability: "Assigned", assignment: "Resource Distribution" },
  { id: "V003", name: "Rohan Poojary", skills: "Driving, Transport", location: "Kundapura", availability: "Available", assignment: "Not Assigned" },
  { id: "V004", name: "Nisha Hegde", skills: "Medical Support", location: "Kodagu", availability: "Unavailable", assignment: "Not Assigned" }
];

function Volunteers() {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("All");
  const rows = volunteerData
    .filter((item) => [item.id, item.name, item.skills, item.location].some((value) => value.toLowerCase().includes(search.toLowerCase())))
    .filter((item) => availability === "All" || item.availability === availability);

  const columns = [
    { key: "id", label: "Volunteer ID" },
    { key: "name", label: "Name" },
    { key: "skills", label: "Skills" },
    { key: "location", label: "Location" },
    { key: "availability", label: "Availability", render: (row) => <StatusBadge value={row.availability} /> },
    { key: "assignment", label: "Current Assignment" }
  ];

  return (
    <div className="module-page">
      <PageHeader title="Volunteer Management" description="View volunteer details, skills, availability and assignments." />
      <StatGrid items={[
        { label: "Registered Volunteers", value: volunteerData.length },
        { label: "Available", value: volunteerData.filter((v) => v.availability === "Available").length },
        { label: "Assigned", value: volunteerData.filter((v) => v.availability === "Assigned").length },
        { label: "Unavailable", value: volunteerData.filter((v) => v.availability === "Unavailable").length }
      ]} />
      <SectionCard title="Volunteer Directory">
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by ID, name, skill or location"
          filters={[{ label: "Availability", value: availability, onChange: setAvailability, options: ["All", "Available", "Assigned", "Unavailable"].map((v) => ({ value: v, label: v === "All" ? "All Availability" : v })) }]}
        />
        <DataTable columns={columns} rows={rows} emptyMessage="No volunteers match your search." />
      </SectionCard>
    </div>
  );
}

export default Volunteers;
