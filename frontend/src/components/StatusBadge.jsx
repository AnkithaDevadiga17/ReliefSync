function StatusBadge({ status }) {
  const statusClass = String(status).toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`status-badge status-${statusClass}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
