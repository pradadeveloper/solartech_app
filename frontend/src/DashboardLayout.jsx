import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import "./dashboardAdmon.css";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const sidebarRef = useRef(null);

  // Cerrar sidebar mobile al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [mobileOpen]);

  // Cerrar mobile al navegar
  const navTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleHamburger = () => {
    // En mobile: toggle overlay; en desktop: toggle width
    if (window.innerWidth <= 820) {
      setMobileOpen((v) => !v);
    } else {
      setSidebarOpen((v) => !v);
    }
  };

  return (
    <div className={`dash ${sidebarOpen ? "dash--sidebar" : ""}`}>

      {/* Backdrop mobile */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`sidebar${mobileOpen ? " sidebar--mobile-open" : ""}`}
      >
        {/* Botón cerrar (solo mobile) */}
        <button
          className="sidebar-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          ✕
        </button>

        <div className="sidebar__brand">
          <div className="brandMark">
            <span style={{ fontWeight: 900, fontSize: "1rem", color: "var(--accent)" }}>ST</span>
          </div>
          <div className="brandText">
            <img
              src="/logos/logo_solartech.webp"
              alt="Logo SolarTech Energy"
              className="sidebar__logo"
            />
          </div>
        </div>

        <nav className="sidebar__nav">
          <button className="navItem" onClick={() => navTo("/")}>Resumen</button>
          <button className="navItem" onClick={() => navTo("/leads")}>Leads y Cotizaciones</button>
          <button className="navItem" onClick={() => navTo("/asesores")}>Asesores</button>
          <button className="navItem">Proyectos</button>
          <button className="navItem" onClick={() => navTo("/configuracion")}>Configuración</button>
        </nav>

        <div className="sidebar__footer">
          <button
            className="navItem"
            style={{ color: "var(--accent)", marginTop: "auto" }}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("nombreUsuario");
              navigate("/login");
            }}
          >
            Cerrar sesión
          </button>
          <small>v0.1</small>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="iconBtn"
              onClick={handleHamburger}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              ☰
            </button>

            <div className="pageTitle">
              <h1>Resumen</h1>
              <p>Leads, cotizaciones y desempeño del mes</p>
            </div>
          </div>

          <div className="topbar__right">
            <button className="btn">Exportar CSV</button>

            <button
              type="button"
              className="btn btn--primary"
              onClick={() => navigate("/cliente")}
            >
              Nuevo Lead
            </button>
          </div>
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
