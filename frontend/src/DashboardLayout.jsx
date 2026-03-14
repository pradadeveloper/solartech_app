import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import "./dashboardAdmon.css";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div className={`dash ${sidebarOpen ? "dash--sidebar" : ""}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="brandMark">⚡</div>
          <div className="brandText">
            <img
              src="/logos/logo_solartech_negativo.png"
              alt="Logo SolarTech Energy"
              className="sidebar__logo"
            />
            <small>Dashboard Admin</small>
          </div>
        </div>

        <nav className="sidebar__nav">
          <button className="navItem navItem--active" onClick={() => navigate("/")}>Resumen</button>
          <button className="navItem">Leads</button>
          <button className="navItem">Cotizaciones</button>
          <button className="navItem">Proyectos</button>
          <button className="navItem">Asesores</button>
          <button className="navItem">Configuración</button>
        </nav>

        <div className="sidebar__footer">
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
              onClick={() => setSidebarOpen((v) => !v)}
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

        {/* ✅ AQUÍ se pinta el contenido (Dashboard o Cotizador) */}
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}