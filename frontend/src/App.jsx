import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Sidebar from "./components/Sidebar";

import Home from "./pages/Home/Home";
import Dashboard from "./pages/Dashboard/Dashboard";

import Locations from "./pages/Locations/Locations";
import Disasters from "./pages/Disasters/Disasters";
import Shelters from "./pages/Shelters/Shelters";
import Resources from "./pages/Resources/Resources";
import Allocations from "./pages/Allocations/Allocations";

import Volunteers from "./pages/Volunteers/Volunteers";
import Donations from "./pages/Donations/Donations";
import Analytics from "./pages/Analytics/Analytics";
import Profile from "./pages/Profile/Profile";

import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import UserManagement from "./pages/UserManagement/UserManagement";

import "./styles/Modules.css";
import "./App.css";


function AppLayout() {

  const { loading, isAuthenticated } = useAuth();

  const location = useLocation();

  const isPublicPage =
    location.pathname === "/login" ||
    location.pathname === "/register";


  if (loading) {

    return (
      <div className="auth-loading">
        Loading ReliefSync...
      </div>
    );

  }


  if (isAuthenticated && isPublicPage) {

    return <Navigate to="/" replace />;

  }


  if (!isAuthenticated && !isPublicPage) {

    return <Navigate to="/login" replace />;

  }


  return (

    <div className="app-layout">

      {isAuthenticated && <Sidebar />}


      <main className="main-content">

        <Routes>

          <Route path="/" element={<Home />} />

          <Route path="/login" element={<Login />} />

          <Route path="/register" element={<Register />} />


          <Route path="/dashboard" element={<Dashboard />} />


          {/* LOCATION MANAGEMENT */}

          <Route
            path="/locations"
            element={<Locations />}
          />


          {/* DISASTER MANAGEMENT */}

          <Route
            path="/disasters"
            element={<Disasters />}
          />


          {/* SHELTER MANAGEMENT */}

          <Route
            path="/shelters"
            element={<Shelters />}
          />


          {/* RESOURCE INVENTORY */}

          <Route
            path="/resources"
            element={<Resources />}
          />


          {/* RESOURCE ALLOCATION */}

          <Route
            path="/allocations"
            element={<Allocations />}
          />


          {/* VOLUNTEER MANAGEMENT */}

          <Route
            path="/volunteers"
            element={<Volunteers />}
          />


          {/* DONATION MANAGEMENT */}

          <Route
            path="/donations"
            element={<Donations />}
          />


          {/* ANALYTICS */}

          <Route
            path="/analytics"
            element={<Analytics />}
          />


          {/* PROFILE */}

          <Route
            path="/profile"
            element={<Profile />}
          />


          {/* USER MANAGEMENT */}

          <Route
            path="/users"
            element={<UserManagement />}
          />


          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>

      </main>

    </div>

  );

}


function App() {

  return (

    <BrowserRouter>

      <AppLayout />

    </BrowserRouter>

  );

}


export default App;