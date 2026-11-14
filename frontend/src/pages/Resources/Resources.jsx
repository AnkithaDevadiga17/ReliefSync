import { useState } from "react";
import { DataTable, PageHeader, SearchFilters, SectionCard, StatGrid, StatusBadge } from "../../components/ModuleUI";
import "../../styles/Modules.css";

const resourceData = [
  { id: "R001", name: "Drinking Water", category: "Essential Supplies", quantity: 1200, distributed: 450, unit: "bottles", location: "Udupi Store", status: "Available" },
  { id: "R002", name: "Food Kits", category: "Food", quantity: 500, distributed: 380, unit: "kits", location: "Mangalore Store", status: "Limited" },
  { id: "R003", name: "Blankets", category: "Clothing", quantity: 300, distributed: 300, unit: "pieces", location: "Kodagu Store", status: "Unavailable" },
  { id: "R004", name: "First Aid Kits", category: "Medical", quantity: 150, distributed: 45, unit: "kits", location: "Udupi Store", status: "Available" }
];

function Resources() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const rows = resourceData
    .filter((item) => [item.id, item.name, item.location].some((value) => value.toLowerCase().includes(search.toLowerCase())))
    .filter((item) => category === "All" || item.category === category)
    .map((item) => ({ ...item, available: item.quantity - item.distributed }));
  const totalItems = resourceData.reduce((sum, item) => sum + item.quantity, 0);
  const totalDistributed = resourceData.reduce((sum, item) => sum + item.distributed, 0);

  const columns = [
    { key: "id", label: "Resource ID" },
    { key: "name", label: "Resource" },
    { key: "category", label: "Category" },
    { key: "quantity", label: "Total Quantity" },
    { key: "distributed", label: "Distributed" },
    { key: "available", label: "Available" },
    { key: "unit", label: "Unit" },
    { key: "location", label: "Storage Location" },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }
  ];

  return (
    <div className="module-page">
      <PageHeader title="Resource Management" description="Track relief inventory, available quantities and distributed supplies." />
      <StatGrid items={[
        { label: "Resource Types", value: resourceData.length },
        { label: "Total Stock", value: totalItems },
        { label: "Distributed", value: totalDistributed },
        { label: "Remaining Stock", value: totalItems - totalDistributed }
      ]} />
      <SectionCard title="Resource Inventory">
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by resource ID, name or storage location"
          filters={[{ label: "Resource category", value: category, onChange: setCategory, options: ["All", "Essential Supplies", "Food", "Clothing", "Medical"].map((v) => ({ value: v, label: v === "All" ? "All Categories" : v })) }]}
        />
        <DataTable columns={columns} rows={rows} emptyMessage="No resources match your search." />
      </SectionCard>
    </div>
  );
}

export default Resources;
