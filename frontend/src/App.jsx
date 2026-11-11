
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Home from "./pages/Home/Home";
import Disasters from "./pages/Disasters/Disasters";

import "./App.css";

// Temporary placeholder for modules we haven't developed yet
function Placeholder({ title }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>This module will be developed soon.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">

        {/* Navigation sidebar */}
        <Sidebar />

        {/* Main page content */}
        <main className="main-content">

          <Routes>

            {/* Home page */}
            <Route path="/" element={<Home />} />

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={<Placeholder title="Dashboard" />}
            />

            {/* Disaster Management */}
            <Route
              path="/disasters"
              element={<Disasters />}
            />

            {/* Other modules */}
            <Route
              path="/shelters"
              element={<Placeholder title="Shelter Management" />}
            />

            <Route
              path="/resources"
              element={<Placeholder title="Resource Management" />}
            />

            <Route
              path="/volunteers"
              element={<Placeholder title="Volunteer Management" />}
            />

            <Route
              path="/donations"
              element={<Placeholder title="Donation Management" />}
            />

            <Route
              path="/analytics"
              element={<Placeholder title="Analytics & Forecasting" />}
            />

            <Route
              path="/profile"
              element={<Placeholder title="Profile / Login" />}
            />

          </Routes>

        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
