function StatCard({ title, value, subtitle }) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <p className="stat-value">{value}</p>
      {subtitle && <small>{subtitle}</small>}
    </div>
  );
}

export default StatCard;
