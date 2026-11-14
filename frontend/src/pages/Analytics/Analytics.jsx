import { PageHeader, SectionCard, StatGrid } from "../../components/ModuleUI";
import "../../styles/Modules.css";

function Analytics() {
  const resourceDemand = [
    { name: "Drinking Water", value: 85 },
    { name: "Food Kits", value: 72 },
    { name: "Medical Supplies", value: 58 },
    { name: "Blankets", value: 44 }
  ];

  const areaSummary = [
    { area: "Udupi", reports: 8, priority: "High" },
    { area: "Mangalore", reports: 5, priority: "Medium" },
    { area: "Kodagu", reports: 4, priority: "High" },
    { area: "Kundapura", reports: 2, priority: "Low" }
  ];

  return (
    <div className="module-page">
      <PageHeader title="Analytics & Forecasting" description="Review response activity and illustrative resource-demand trends." />
      <StatGrid items={[
        { label: "Reports Analysed", value: 19 },
        { label: "Areas Monitored", value: 4 },
        { label: "Resource Categories", value: 4 },
        { label: "Forecast Window", value: "7 days", note: "Demonstration only" }
      ]} />

      <div className="module-two-column">
        <SectionCard title="Illustrative Resource Demand">
          <div className="analytics-bars">
            {resourceDemand.map((item) => (
              <div className="analytics-bar-row" key={item.name}>
                <span>{item.name}</span>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: `${item.value}%` }} />
                </div>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>
          <p className="module-muted">Sample percentages only. The real forecast will be generated from project data after the backend and ML module are implemented.</p>
        </SectionCard>

        <SectionCard title="Area-wise Report Summary">
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr><th>Area</th><th>Reports</th><th>Priority</th></tr></thead>
              <tbody>
                {areaSummary.map((item) => (
                  <tr key={item.area}><td>{item.area}</td><td>{item.reports}</td><td>{item.priority}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default Analytics;
