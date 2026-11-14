import { PageHeader, SectionCard } from "../../components/ModuleUI";
import "../../styles/Modules.css";

function Profile() {
  // Demonstration profile information. Authentication and database loading will be added later.
  const profile = {
    name: "ReliefSync Administrator",
    email: "admin@reliefsync.demo",
    role: "Administrator",
    location: "Mangaluru, Karnataka"
  };

  return (
    <div className="module-page">
      <PageHeader title="My Profile" description="View the current demonstration account details." />
      <SectionCard title="Account Information">
        <dl className="profile-details">
          <dt>Name</dt><dd>{profile.name}</dd>
          <dt>Email</dt><dd>{profile.email}</dd>
          <dt>Role</dt><dd>{profile.role}</dd>
          <dt>Location</dt><dd>{profile.location}</dd>
        </dl>
        <p className="module-muted">This is placeholder profile data. Login, registration and role-based access will be connected when we develop authentication in the backend.</p>
      </SectionCard>
    </div>
  );
}

export default Profile;
