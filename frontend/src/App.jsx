import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
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
import Donate from "./pages/Donate/Donate";
import "./styles/Modules.css";
import "./App.css";

function Protected({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading">Loading ReliefSync...</div>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function AppLayout() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const publicPaths = ["/", "/login", "/register", "/donate"];
  const isPublicPath = publicPaths.includes(path);

  if (loading) return <div className="auth-loading">Loading ReliefSync...</div>;

  // An authenticated user opening the sign-in route should return to the
  // shared public homepage, where the management sidebar remains visible.
  if (isAuthenticated && path === "/login") {
    return <Navigate to="/" replace />;
  }

  // The public homepage is shared by visitors and signed-in users.
  // Signed-in users keep their management sidebar while viewing it.
  const showSidebar = isAuthenticated && (path === "/" || !isPublicPath);
  const isStandalonePublicPage = isPublicPath && !showSidebar;
  const protectedPage = (element) => <Protected>{element}</Protected>;

  return (
    <div className={showSidebar ? "app-layout public-home-layout" : isStandalonePublicPage ? "public-shell" : "app-layout"}>
      {showSidebar && <Sidebar />}
      <main className={isStandalonePublicPage ? "public-main" : showSidebar && path === "/" ? "public-main authenticated-public-main" : "main-content"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
          <Route path="/locations" element={protectedPage(<Locations />)} />
          <Route path="/disasters" element={protectedPage(<Disasters />)} />
          <Route path="/shelters" element={protectedPage(<Shelters />)} />
          <Route path="/resources" element={protectedPage(<Resources />)} />
          <Route path="/allocations" element={protectedPage(<Allocations />)} />
          <Route path="/volunteers" element={protectedPage(<Volunteers />)} />
          <Route path="/donations" element={protectedPage(<Donations />)} />
          <Route path="/analytics" element={protectedPage(<Analytics />)} />
          <Route path="/profile" element={protectedPage(<Profile />)} />
          <Route path="/users" element={protectedPage(<UserManagement />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
