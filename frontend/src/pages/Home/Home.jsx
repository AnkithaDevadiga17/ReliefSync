function Home() {

  return (
    <div>

      <h1>Welcome to ReliefSync</h1>

      <p>
        Intelligent Disaster Resource Allocation and Coordination Platform
      </p>

      <hr />

      <h2>Overview</h2>

      <p>Monitor and coordinate disaster response operations.</p>

      <br />

      <div className="stats">

        <div>
          <h3>Active Disasters</h3>
          <h2>05</h2>
        </div>

        <div>
          <h3>Affected Areas</h3>
          <h2>12</h2>
        </div>

        <div>
          <h3>Operational Shelters</h3>
          <h2>08</h2>
        </div>

        <div>
          <h3>Critical Alerts</h3>
          <h2>03</h2>
        </div>

      </div>

      <br />

      <h2>Quick Access</h2>

      <ul>
        <li>View Disaster Reports</li>
        <li>Manage Shelters</li>
        <li>Check Resource Availability</li>
        <li>Coordinate Volunteers</li>
      </ul>

      <br />

      <h2>Disaster Monitoring</h2>

      <div className="map-placeholder">
        Map integration will be added later.
      </div>

      <small>All displayed figures are illustrative sample data.</small>

    </div>
  );
}

export default Home;