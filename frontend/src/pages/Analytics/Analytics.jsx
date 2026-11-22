
import { useEffect, useState } from "react";

import {
  DataTable,
  PageHeader,
  SectionCard,
  StatGrid,
  StatCard,
  StatusBadge
} from "../../components/ModuleUI";

import "../../styles/Modules.css";
import "./Analytics.css";
import { apiFetch } from "../../services/api";

const API = "http://127.0.0.1:5000/api";


function Analytics() {

  const [summary, setSummary] = useState(null);
  const [predictions, setPredictions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);


  // --------------------------------
  // LOAD ANALYTICS DATA
  // --------------------------------

  const loadAnalytics = async () => {

    try {

      setLoading(true);
      setError("");

      const [summaryResponse, predictionResponse] =
        await Promise.all([
          apiFetch(`${API}/analytics/summary`),
          apiFetch(`${API}/risk-predictions`)
        ]);

      const summaryResult = await summaryResponse.json();
      const predictionResult = await predictionResponse.json();

      if (!summaryResponse.ok || !summaryResult.success) {
        throw new Error(
          summaryResult.message || "Unable to load dashboard statistics."
        );
      }

      if (!predictionResponse.ok || !predictionResult.success) {
        throw new Error(
          predictionResult.message || "Unable to load prediction history."
        );
      }

      setSummary(summaryResult.data);
      setPredictions(predictionResult.data || []);
      setLastUpdated(new Date());

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {
    loadAnalytics();
  }, []);


  // --------------------------------
  // FORMAT DATE
  // --------------------------------

  const formatDate = (value) => {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

  };


  // --------------------------------
  // PREPARE RISK PREDICTION TABLE
  // --------------------------------

  const predictionRows = predictions.map(prediction => ({

    id: `P${String(prediction.prediction_id).padStart(3, "0")}`,

    disaster: prediction.disaster_type,

    location: prediction.location_name || "Unknown",

    district: prediction.district || "—",

    risk: prediction.risk_level,

    score: prediction.risk_score === null
      ? "—"
      : `${Number(prediction.risk_score).toFixed(2)}%`,

    model: prediction.model_version || "Not specified",

    date: formatDate(prediction.predicted_at)

  }));


  const predictionColumns = [

    { key: "id", label: "Prediction ID" },

    { key: "disaster", label: "Disaster Type" },

    { key: "location", label: "Location" },

    { key: "district", label: "District" },

    {
      key: "risk",
      label: "Risk Level",
      render: row => (
        <StatusBadge status={row.risk} />
      )
    },

    { key: "score", label: "Risk Score" },

    { key: "model", label: "Model Version" },

    { key: "date", label: "Predicted Date" }

  ];


  // --------------------------------
  // HANDLE LOADING
  // --------------------------------

  if (loading && !summary) {

    return (
      <div className="module-page">
        <PageHeader
          title="Analytics & Forecasting"
          description="View operational statistics and risk prediction history."
        />
        <p>Loading analytics...</p>
      </div>
    );

  }


  return (

    <div className="module-page">

      <PageHeader
        title="Analytics & Forecasting"
        description="Monitor disaster response activities and review risk prediction records."
        action={
          <button
            type="button"
            className="module-primary-button"
            onClick={loadAnalytics}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        }
      />


      {error && (
        <p className="analytics-error">{error}</p>
      )}


      {summary && (

        <>

          {/* DISASTER STATISTICS */}
          <SectionCard title="Disaster Overview">

            <StatGrid>

              <StatCard
                label="Total Disasters"
                value={summary.disasters.total || 0}
              />

              <StatCard
                label="Active Disasters"
                value={summary.disasters.active || 0}
              />

              <StatCard
                label="Critical Disasters"
                value={summary.disasters.critical || 0}
              />

              <StatCard
                label="Total Shelters"
                value={summary.shelters.total || 0}
              />

            </StatGrid>

          </SectionCard>


          {/* SHELTER STATISTICS */}
          <SectionCard title="Shelter Capacity Overview">

            <StatGrid>

              <StatCard
                label="Operational Shelters"
                value={summary.shelters.operational || 0}
              />

              <StatCard
                label="Total Capacity"
                value={summary.shelters.total_capacity || 0}
              />

              <StatCard
                label="Occupied Spaces"
                value={summary.shelters.occupied || 0}
              />

              <StatCard
                label="Available Spaces"
                value={summary.shelters.available || 0}
              />

            </StatGrid>

            <div className="analytics-capacity">

              <div className="analytics-capacity-heading">
                <span>Overall Shelter Occupancy</span>

                <strong>
                  {summary.shelters.total_capacity > 0
                    ? (
                        Number(summary.shelters.occupied) /
                        Number(summary.shelters.total_capacity) * 100
                      ).toFixed(1)
                    : 0}%
                </strong>
              </div>

              <div className="analytics-progress-track">

                <div
                  className="analytics-progress-fill"
                  style={{
                    width: `${
                      summary.shelters.total_capacity > 0
                        ? Math.min(
                            100,
                            Number(summary.shelters.occupied) /
                            Number(summary.shelters.total_capacity) * 100
                          )
                        : 0
                    }%`
                  }}
                />

              </div>

            </div>

          </SectionCard>


          {/* RESOURCE AND VOLUNTEER STATISTICS */}
          <SectionCard title="Resources & Volunteers">

            <StatGrid>

              <StatCard
                label="Resource Items"
                value={summary.resources.total || 0}
              />

              <StatCard
                label="Low Stock Items"
                value={summary.resources.low_stock || 0}
              />

              <StatCard
                label="Total Volunteers"
                value={summary.volunteers.total || 0}
              />

              <StatCard
                label="Available Volunteers"
                value={summary.volunteers.available || 0}
              />

            </StatGrid>

          </SectionCard>


          {/* DONATIONS AND ALLOCATIONS */}
          <SectionCard title="Donations & Resource Allocations">

            <StatGrid>

              <StatCard
                label="Total Donations"
                value={summary.donations.total || 0}
              />

              <StatCard
                label="Pending Donations"
                value={summary.donations.pending || 0}
              />

              <StatCard
                label="Allocation Requests"
                value={summary.allocations.total || 0}
              />

              <StatCard
                label="Pending Allocations"
                value={summary.allocations.pending || 0}
              />

            </StatGrid>

          </SectionCard>


          {/* VOLUNTEER ASSIGNMENTS */}
          <SectionCard title="Volunteer Assignment Overview">

            <StatGrid>

              <StatCard
                label="Total Assignments"
                value={summary.assignments.total || 0}
              />

              <StatCard
                label="Active Assignments"
                value={summary.assignments.active || 0}
              />

              <StatCard
                label="Completed Assignments"
                value={summary.assignments.completed || 0}
              />

              <StatCard
                label="Verified Donations"
                value={summary.donations.verified || 0}
              />

            </StatGrid>

          </SectionCard>


          {/* RISK PREDICTION SUMMARY */}
          <SectionCard title="Risk Prediction Summary">

            <StatGrid>

              {["low", "medium", "high", "critical"].map(level => {

                const item = summary.risk_summary.find(
                  r => r.risk_level === level
                );

                return (

                  <StatCard
                    key={level}
                    label={`${level.charAt(0).toUpperCase()}${level.slice(1)} Risk`}
                    value={item ? item.total : 0}
                  />

                );

              })}

            </StatGrid>

          </SectionCard>


          {/* PREDICTION HISTORY */}
          <SectionCard title="Risk Prediction History">

            {predictions.length === 0 ? (

              <p className="analytics-empty">
                No risk predictions have been recorded yet.
                Prediction history will appear here after the forecasting
                component generates and saves results.
              </p>

            ) : (

              <DataTable
                columns={predictionColumns}
                data={predictionRows}
                rowKey="id"
                emptyMessage="No predictions found."
              />

            )}

          </SectionCard>


          {lastUpdated && (

            <p className="analytics-updated">
              Last refreshed: {lastUpdated.toLocaleTimeString("en-IN")}
            </p>

          )}

        </>

      )}

    </div>

  );

}

export default Analytics;
