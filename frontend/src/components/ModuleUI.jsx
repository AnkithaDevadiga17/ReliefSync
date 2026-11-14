
import "./common.css";

// Page heading with optional action button
export function PageHeader({ title, description, action }) {
  return (
    <div className="module-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>

      {action && (
        <div className="module-header-action">
          {action}
        </div>
      )}
    </div>
  );
}

// Reusable section container
export function SectionCard({ title, children }) {
  return (
    <section className="module-section-card">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

// Reusable statistics grid
export function StatGrid({ children }) {
  return (
    <div className="module-stat-grid">
      {children}
    </div>
  );
}

// Reusable statistics card
export function StatCard({ label, value, note }) {
  return (
    <div className="module-stat-card">
      <p className="module-stat-label">{label}</p>
      <h3 className="module-stat-value">{value}</h3>
      {note && <small className="module-stat-note">{note}</small>}
    </div>
  );
}

// Reusable search and filter area
export function SearchFilters({ children }) {
  return (
    <div className="module-toolbar">
      {children}
    </div>
  );
}

// Reusable status badge
export function StatusBadge({ status }) {
  const statusClass = String(status || "Unknown")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");

  return (
    <span className={`module-status status-${statusClass}`}>
      {status}
    </span>
  );
}

// Reusable data table
export function DataTable({
  columns = [],
  data = [],
  rowKey = "id",
  emptyMessage = "No records found."
}) {
  return (
    <div className="module-table-wrap">
      <table className="module-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length > 0 ? (
            data.map((row, index) => (
              <tr key={row[rowKey] ?? index}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render
                      ? column.render(row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length || 1}
                className="module-empty-cell"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
