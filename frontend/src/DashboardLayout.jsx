import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./dashboardAdmon.css";

// Módulos y qué roles tienen acceso
const NAV_ITEMS = [
  { label: 'Resumen',              path: '/',              adminOnly: false },
  { label: 'Leads y Cotizaciones', path: '/leads',         adminOnly: false },
  { label: 'Resumen Gerencia',     path: '/gerencia',      adminOnly: true  },
  { label: 'Forecast Equipos',     path: '/forecast',      adminOnly: true  },
  { label: 'Agente IA',            path: '/agente',        adminOnly: false },
  { label: 'Asesores',             path: '/asesores',      adminOnly: true  },
  { label: 'Configuración',        path: '/configuracion', adminOnly: true  },
];

const RUTAS_ADMIN = ['/gerencia', '/forecast', '/asesores', '/configuracion'];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);

  const rol = localStorage.getItem('rolUsuario') || 'Asesor';
  const isAdmin = rol === 'Admin';

  // Redirigir si Asesor intenta acceder a ruta restringida
  useEffect(() => {
    if (!isAdmin && RUTAS_ADMIN.includes(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, isAdmin, navigate]);

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
          {NAV_ITEMS
            .filter(item => isAdmin || !item.adminOnly)
            .map(item => (
              <button
                key={item.label}
                className={`navItem${item.path && location.pathname === item.path ? ' navItem--active' : ''}`}
                onClick={() => item.path && navTo(item.path)}
                style={!item.path ? { opacity: 0.5, cursor: 'default' } : {}}
              >
                {item.label}
              </button>
            ))
          }
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__userInfo">
            <span className="sidebar__userName">
              {localStorage.getItem('nombreUsuario') || 'Usuario'}
            </span>
            <span className={`rolBadge rolBadge--${isAdmin ? 'admin' : 'asesor'}`}>
              {rol}
            </span>
          </div>
          <button
            className="navItem"
            style={{ color: "var(--accent)", marginTop: 4 }}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("nombreUsuario");
              localStorage.removeItem("apellidoUsuario");
              localStorage.removeItem("cargoUsuario");
              localStorage.removeItem("celularUsuario");
              localStorage.removeItem("correoUsuario");
              localStorage.removeItem("rolUsuario");
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
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => navigate("/cliente")}
            >
              Nueva Cotización
            </button>

            <div className="topbar__user">
              <span className="topbar__userName">
                {localStorage.getItem('nombreUsuario') || 'Usuario'}
              </span>
              <span className={`rolBadge rolBadge--${isAdmin ? 'admin' : 'asesor'}`}>
                {rol}
              </span>
            </div>
          </div>
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
