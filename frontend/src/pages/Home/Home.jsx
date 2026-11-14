
import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  const features = [
    {
      icon: "🌪️",
      title: "Disaster Management",
      description:
        "Monitor disaster reports, track incidents and coordinate emergency response."
    },
    {
      icon: "🏠",
      title: "Shelter Management",
      description:
        "Manage shelters, monitor available capacity and organize accommodation."
    },
    {
      icon: "📦",
      title: "Resource Management",
      description:
        "Track essential supplies and coordinate the distribution of resources."
    },
    {
      icon: "🤝",
      title: "Volunteer Coordination",
      description:
        "Organize volunteers and coordinate their participation in relief activities."
    },
    {
      icon: "❤️",
      title: "Donation Management",
      description:
        "Manage donations and support transparent allocation of relief assistance."
    },
    {
      icon: "📊",
      title: "Analytics & Forecasting",
      description:
        "Explore response information and understand resource and disaster trends."
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Report",
      description: "Record disaster incidents and identify affected areas."
    },
    {
      number: "02",
      title: "Coordinate",
      description: "Connect shelters, volunteers and available resources."
    },
    {
      number: "03",
      title: "Allocate",
      description: "Organize and distribute resources according to requirements."
    },
    {
      number: "04",
      title: "Respond",
      description: "Support coordinated relief and recovery activities."
    }
  ];

  return (
    <div className="home-page">

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="home-eyebrow">
            INTELLIGENT DISASTER RESPONSE PLATFORM
          </span>

          <h1>
            Coordinating Relief.
            <br />
            <span>Restoring Hope.</span>
          </h1>

          <p>
            ReliefSync is an intelligent disaster resource allocation and
            coordination platform designed to bring disaster information,
            shelters, resources, volunteers and donations together in one
            organized system.
          </p>

          <div className="home-hero-actions">
            <Link to="/dashboard" className="home-primary-button">
              Explore Dashboard →
            </Link>

            <a href="#about" className="home-secondary-button">
              Learn More
            </a>
          </div>
        </div>

        <div className="home-hero-visual">
          <div className="home-visual-icon">🌍</div>
          <div className="home-visual-circle circle-one"></div>
          <div className="home-visual-circle circle-two"></div>

          <div className="home-visual-caption">
            <strong>One Platform</strong>
            <span>Multiple Relief Operations</span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="home-about" id="about">
        <div className="home-section-heading">
          <span>ABOUT RELIEFSYNC</span>
          <h2>Bringing disaster response together</h2>
        </div>

        <p>
          During disasters, coordinating information and resources across
          different teams can be challenging. ReliefSync aims to simplify
          this process through a centralized platform where administrators
          can manage disaster reports, shelters, resources, volunteers and
          donations.
        </p>

        <p>
          By organizing these operations in one place, the platform supports
          better visibility, coordination and resource allocation during
          disaster response activities.
        </p>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <div className="home-section-heading">
          <span>OUR MODULES</span>
          <h2>Everything connected in one platform</h2>
          <p>
            Dedicated modules to organize different aspects of disaster
            response and relief coordination.
          </p>
        </div>

        <div className="home-feature-grid">
          {features.map((feature) => (
            <div className="home-feature-card" key={feature.title}>
              <div className="home-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Section */}
      <section className="home-workflow">
        <div className="home-section-heading">
          <span>HOW IT WORKS</span>
          <h2>A coordinated approach to relief</h2>
        </div>

        <div className="home-workflow-grid">
          {steps.map((step) => (
            <div className="home-workflow-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="home-cta">
        <h2>Explore the ReliefSync platform</h2>
        <p>
          Access the dashboard to view operational summaries and explore
          the different disaster management modules.
        </p>

        <Link to="/dashboard" className="home-primary-button">
          Go to Dashboard →
        </Link>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <h3>ReliefSync</h3>
        <p>Intelligent Disaster Resource Allocation and Coordination Platform</p>
        <span>Academic Project | MCA</span>
      </footer>

    </div>
  );
}

export default Home;
