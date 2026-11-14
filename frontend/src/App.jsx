
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Reusable Components
import Sidebar from "./components/Sidebar";

// Pages
import Home from "./pages/Home/Home";
import Dashboard from "./pages/Dashboard/Dashboard";
import Disasters from "./pages/Disasters/Disasters";
import Shelters from "./pages/Shelters/Shelters";
import Resources from "./pages/Resources/Resources";
import Volunteers from "./pages/Volunteers/Volunteers";
import Donations from "./pages/Donations/Donations";
import Analytics from "./pages/Analytics/Analytics";
import Profile from "./pages/Profile/Profile";

// Shared CSS
import "./styles/Modules.css";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/disasters" element={<Disasters />} />
            <Route path="/shelters" element={<Shelters />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/volunteers" element={<Volunteers />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
