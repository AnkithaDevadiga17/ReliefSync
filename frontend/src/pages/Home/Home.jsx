import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

const ACTIVE_STATUSES = ["reported", "active", "monitoring"];

function locationLabel(item) {
  return [item.location_name, item.district, item.state, item.country]
    .filter(Boolean)
    .join(", ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [disasters, setDisasters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const [mapStatus, setMapStatus] = useState("Loading affected locations on the map...");
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const loadPublicData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [disasterResult, locationResult] = await Promise.all([
        apiRequest("/public/disasters"),
        apiRequest("/public/locations"),
      ]);
      const activeDisasters = (disasterResult.data || []).filter((item) =>
        ACTIVE_STATUSES.includes(String(item.status || "").toLowerCase())
      );
      setDisasters(activeDisasters);
      setLocations(locationResult.data || []);
    } catch (error) {
      console.error("Unable to load public disaster data:", error);
      setLoadError("We couldn't load current disaster information. Please check that the ReliefSync backend is running.");
      setDisasters([]);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPublicData(); }, [loadPublicData]);

  const latestDisaster = disasters[0] || null;
  const filteredDisasters = useMemo(() => {
    const search = query.trim().toLowerCase();
    return disasters.filter((item) => {
      const matchesSearch = !search || [item.disaster_type, item.location_name, item.district, item.state, item.severity, item.description]
        .filter(Boolean).join(" ").toLowerCase().includes(search);
      const matchesLocation = selectedLocationId === "all" || String(item.location_id) === String(selectedLocationId);
      return matchesSearch && matchesLocation;
    });
  }, [disasters, query, selectedLocationId]);

  useEffect(() => {
    if (!mapElementRef.current) return undefined;
    const map = L.map(mapElementRef.current, { scrollWheelZoom: false }).setView([22.5, 79], 4.5);
    mapInstanceRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const visibleMapDisasters = useMemo(() => (
    selectedLocationId === "all"
      ? disasters
      : disasters.filter((item) => String(item.location_id) === String(selectedLocationId))
  ), [disasters, selectedLocationId]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    let cancelled = false;
    const markerLayer = L.featureGroup().addTo(map);

    async function resolveCoordinates(item) {
      const lat = Number(item.latitude ?? item.location_latitude);
      const lng = Number(item.longitude ?? item.location_longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return [lat, lng];
      // Existing location records may not have coordinates. Resolve their place name
      // through OpenStreetMap Nominatim so the map can still show a useful marker.
      const searchText = locationLabel(item);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(searchText)}`, {
          headers: { "Accept-Language": "en" },
        });
        if (!response.ok) return null;
        const results = await response.json();
        if (!results.length) return null;
        const point = [Number(results[0].lat), Number(results[0].lon)];
        return point.every(Number.isFinite) ? point : null;
      } catch (error) {
        console.warn("Could not geocode map location:", searchText, error);
        return null;
      }
    }

    async function drawMarkers() {
      if (!disasters.length) {
        setMapStatus("No currently active disaster locations to display.");
        map.setView([22.5, 79], 4.5);
        return;
      }
      setMapStatus("Locating current disaster locations...");
      const points = [];
      for (let index = 0; index < visibleMapDisasters.length; index += 1) {
        if (cancelled) return;
        const item = visibleMapDisasters[index];
        if (index > 0) await new Promise((resolve) => window.setTimeout(resolve, 1100));
        const coordinates = await resolveCoordinates(item);
        if (coordinates) {
          points.push({ item, coordinates });
          const popup = `<strong>${escapeHtml(item.disaster_type)}</strong><br>${escapeHtml(locationLabel(item))}<br><small>Status: ${escapeHtml(item.status)} · Severity: ${escapeHtml(item.severity)}</small>`;
          L.circleMarker(coordinates, {
            radius: 10,
            color: "#ffffff",
            weight: 3,
            fillColor: String(item.severity).toLowerCase() === "critical" || String(item.severity).toLowerCase() === "high" ? "#dc4b45" : "#e49a35",
            fillOpacity: 0.95,
          }).bindPopup(popup).addTo(markerLayer);
        }
      }
      if (cancelled) return;
      if (points.length) {
        const bounds = markerLayer.getBounds();
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 10 });
        setMapStatus(`${points.length} active disaster location${points.length === 1 ? "" : "s"} shown on the map.`);
      } else {
        map.setView([22.5, 79], 4.5);
        setMapStatus("Location coordinates could not be found. Add latitude and longitude in Location Management for reliable map pins.");
      }
    }

    drawMarkers();
    return () => {
      cancelled = true;
      markerLayer.remove();
    };
  }, [visibleMapDisasters]);

  return (
    <div className="public-home">
      {!isAuthenticated && (
        <nav className="public-nav">
          <Link to="/" className="public-brand">Relief<span>Sync</span></Link>
          <div className="public-nav-links">
            <a href="#disasters">Disasters</a>
            <a href="#map">Map</a>
            <a href="#about">About</a>
            <Link to="/donate">Donate</Link>
            <Link to="/register">Volunteer</Link>
            <Link to="/login" className="nav-login">Sign in</Link>
          </div>
        </nav>
      )}

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="public-kicker">DISASTER RELIEF · COMMUNITY RESPONSE</span>
          <h1>When disaster strikes,<br /><em>every helping hand matters.</em></h1>
          <p>ReliefSync brings disaster information, volunteers, resources and donations together to support coordinated relief operations.</p>
          <div className="public-actions">
            <Link to="/donate" className="public-btn primary">Donate now</Link>
            <Link to="/register" className="public-btn light">Become a volunteer</Link>
          </div>
        </div>
        <aside className="public-hero-note">
          <div className="hero-symbol">＋</div>
          <strong>Help reach the people who need it.</strong>
          <span>Explore current incidents registered by ReliefSync coordinators and support verified affected locations.</span>
          <div className="hero-live-count"><strong>{loading ? "—" : disasters.length}</strong><span>current active incidents</span></div>
        </aside>
      </section>

      <section className="public-section" id="disasters">
        <div className="public-section-heading">
          <div>
            <span className="public-kicker">CURRENT RELIEF INFORMATION</span>
            <h2>Latest active disasters</h2>
            <p>Only incidents marked Reported, Active or Monitoring by ReliefSync teams appear here. Resolved and closed incidents are excluded.</p>
          </div>
          <button type="button" className="refresh-disasters" onClick={loadPublicData} disabled={loading}>↻ Refresh updates</button>
        </div>
        {latestDisaster && !loading && (
          <article className="latest-disaster-banner">
            <div><span className="latest-label">LATEST CURRENT INCIDENT</span><h3>{latestDisaster.disaster_type} · {locationLabel(latestDisaster)}</h3><p>{latestDisaster.description || "Relief teams are monitoring this incident."}</p></div>
            <span className={`severity severity-${String(latestDisaster.severity).toLowerCase()}`}>{latestDisaster.severity}</span>
          </article>
        )}
        <div className="disaster-filter-row">
          <input className="disaster-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search disaster, district or state..." />
          <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} aria-label="Filter by currently affected location">
            <option value="all">All currently affected locations</option>
            {locations.map((location) => <option key={location.location_id} value={location.location_id}>{location.location_name} · {location.district}, {location.state}</option>)}
          </select>
        </div>
        {loading ? <div className="empty-disasters">Loading current disaster information...</div>
          : loadError ? <div className="empty-disasters error-message">{loadError}</div>
          : filteredDisasters.length === 0 ? <div className="empty-disasters">No current active disaster records match this filter.</div>
          : <div className="disaster-cards">
            {filteredDisasters.map((item, index) => (
              <article className="disaster-card" key={item.disaster_id}>
                <div className="disaster-card-top"><span className={`severity severity-${String(item.severity).toLowerCase()}`}>{item.severity}</span><span className="incident-status">{item.status}</span></div>
                {index === 0 && <span className="latest-chip">Latest reported</span>}
                <h3>{item.disaster_type}</h3>
                <p className="disaster-place">⌖ {locationLabel(item)}</p>
                <p>{item.description || "No additional public update has been provided."}</p>
                <Link to={`/donate?location=${item.location_id}`} className="donate-card-link">Support this affected location →</Link>
              </article>
            ))}
          </div>}
      </section>

      <section className="public-map-section" id="map">
        <div className="map-copy">
          <span className="public-kicker">LIVE GEOGRAPHICAL VIEW</span>
          <h2>Map of affected locations</h2>
          <p>The map displays locations associated with currently reported, active or monitored incidents. Select an affected location above to filter the incident list.</p>
          <div className="map-legend"><span className="map-legend-dot" /> Current disaster location</div>
          <p className="map-status" aria-live="polite">{mapStatus}</p>
          <a className="public-text-link" href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">Map data © OpenStreetMap</a>
        </div>
        <div className="public-map-frame"><div ref={mapElementRef} className="leaflet-home-map" aria-label="Map showing current disaster locations" /></div>
      </section>

      <section className="public-about" id="about">
        <span className="public-kicker">ABOUT RELIEFSYNC</span>
        <h2>One platform for coordinated disaster response</h2>
        <p>ReliefSync is an intelligent disaster resource allocation and coordination platform. It helps authorized teams organize disaster reports, shelters, resources, volunteers, donations and relief distributions in a centralized system.</p>
        <div className="public-cta-grid">
          <article><div>♡</div><h3>Would you like to donate?</h3><p>Support a currently affected location through a public donation. No account is required.</p><Link to="/donate" className="public-btn primary">Donate now</Link></article>
          <article><div>✚</div><h3>Interested in volunteering?</h3><p>Register your details and skills to become part of the ReliefSync volunteer network.</p><Link to="/register" className="public-btn light">Register as volunteer</Link></article>
        </div>
      </section>
      <footer className="public-footer"><Link to="/" className="public-brand">Relief<span>Sync</span></Link><span>Intelligent Disaster Relief and Resource Coordination</span>{!isAuthenticated && <Link to="/login">Admin / Coordinator / Volunteer sign in</Link>}{isAuthenticated && <Link to="/dashboard">Open management dashboard</Link>}</footer>
    </div>
  );
}
