// src/pages/dashboardAdmon.jsx
import React, { useEffect, useMemo, useState } from "react";
// import logoSolartech from "./assets/logo_solartech.webp";
import './dashboardAdmon.css';
import { useNavigate } from "react-router-dom";


/**
 * Dashboard Administrativo - Base
 * - Sidebar
 * - Topbar
 * - KPI Cards
 * - Filtros
 * - Tabla de Leads/Proyectos
 * - Secciones para gráficas (placeholders)
 */

const mockKPIs = {
  leadsHoy: 12,
  leadsMes: 328,
  cotizacionesMes: 96,
  tasaCierre: 18.4, // %
  ticketPromedio: 14500000, // COP
  kwpProyectadosMes: 214.6,
};

const mockRows = [
  {
    id: "LD-1001",
    cliente: "María Gómez",
    ciudad: "Medellín",
    consumoKwh: 450,
    sistemaKwp: 3.3,
    valorCOP: 14500000,
    estado: "Nuevo",
    fuente: "Meta",
    fecha: "2026-03-01",
    asesor: "Aleja",
  },
  {
    id: "LD-1002",
    cliente: "Carlos Pérez",
    ciudad: "Bogotá",
    consumoKwh: 820,
    sistemaKwp: 6.0,
    valorCOP: 26500000,
    estado: "En negociación",
    fuente: "Google",
    fecha: "2026-03-01",
    asesor: "Juan",
  },
];

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const statusBadgeClass = (status) => {
  switch (status) {
    case "Nuevo":
      return "badge badge--new";
    case "Cotizado":
      return "badge badge--quoted";
    case "En negociación":
      return "badge badge--negotiation";
    case "Cerrado":
      return "badge badge--closed";
    case "Perdido":
      return "badge badge--lost";
    default:
      return "badge";
  }
};

export default function DashboardAdmon() {

  const navigate = useNavigate();
  
  // UI
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data
  const [kpis, setKpis] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [fuente, setFuente] = useState("Todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Fetch (placeholder)
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    // Simula carga. Reemplaza por fetch a tu API:
    // fetch("/api/admin/dashboard").then(...)
    setTimeout(() => {
      if (!mounted) return;
      setKpis(mockKPIs);
      setRows(mockRows);
      setLoading(false);
    }, 300);

    return () => {
      mounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((r) => {
      const matchQ =
        !term ||
        r.id.toLowerCase().includes(term) ||
        r.cliente.toLowerCase().includes(term) ||
        r.ciudad.toLowerCase().includes(term) ||
        r.asesor.toLowerCase().includes(term);

      const matchEstado = estado === "Todos" ? true : r.estado === estado;
      const matchFuente = fuente === "Todas" ? true : r.fuente === fuente;

      const d = r.fecha; // YYYY-MM-DD
      const matchDesde = !desde ? true : d >= desde;
      const matchHasta = !hasta ? true : d <= hasta;

      return matchQ && matchEstado && matchFuente && matchDesde && matchHasta;
    });
  }, [rows, q, estado, fuente, desde, hasta]);

  const onResetFilters = () => {
    setQ("");
    setEstado("Todos");
    setFuente("Todas");
    setDesde("");
    setHasta("");
  };

  const onExportCSV = () => {
    // Export simple (client-side) sin librerías
    const headers = [
      "id",
      "cliente",
      "ciudad",
      "consumoKwh",
      "sistemaKwp",
      "valorCOP",
      "estado",
      "fuente",
      "fecha",
      "asesor",
    ];
    const csv = [
      headers.join(","),
      ...filteredRows.map((r) =>
        headers
          .map((h) => {
            const val = r[h];
            const safe = String(val ?? "").replaceAll('"', '""');
            return `"${safe}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

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
                className="logo"
                width="100%"
                height="auto"
                loading="lazy"
            />    
            <small>Dashboard Admin</small>
          </div>
        </div>

        <nav className="sidebar__nav">
          <button className="navItem navItem--active">Resumen</button>
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
            <button className="btn" onClick={onExportCSV}>
              Exportar CSV
            </button>
            <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate("/cliente")}> Nuevo Lead
            </button>
          </div>
        </header>

        {/* Content */}
        <section className="content">
          {/* KPIs */}
          <div className="grid kpiGrid">
            <KpiCard
              title="Leads hoy"
              value={loading || !kpis ? "—" : kpis.leadsHoy}
              hint="Últimas 24h"
            />
            <KpiCard
              title="Leads del mes"
              value={loading || !kpis ? "—" : kpis.leadsMes}
              hint="Mes actual"
            />
            <KpiCard
              title="Cotizaciones"
              value={loading || !kpis ? "—" : kpis.cotizacionesMes}
              hint="Mes actual"
            />
            <KpiCard
              title="Tasa de cierre"
              value={loading || !kpis ? "—" : `${kpis.tasaCierre}%`}
              hint="Promedio"
            />
            <KpiCard
              title="Ticket promedio"
              value={loading || !kpis ? "—" : formatCOP(kpis.ticketPromedio)}
              hint="COP"
            />
            <KpiCard
              title="kWp proyectados"
              value={loading || !kpis ? "—" : kpis.kwpProyectadosMes}
              hint="Mes actual"
            />
          </div>

          {/* Gráficas (placeholders) */}
          <div className="grid chartsGrid">
            <Panel title="Leads por día (placeholder)">
              <div className="placeholderChart" />
            </Panel>
            <Panel title="Fuentes de lead (placeholder)">
              <div className="placeholderChart" />
            </Panel>
          </div>

          {/* Filters */}
          <Panel
            title="Leads / Proyectos"
            right={
              <div className="panelActions">
                <button className="btn btn--ghost" onClick={onResetFilters}>
                  Limpiar filtros
                </button>
              </div>
            }
          >
            <div className="filters">
              <div className="field">
                <label>Buscar</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ID, cliente, ciudad, asesor…"
                />
              </div>

              <div className="field">
                <label>Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option>Todos</option>
                  <option>Nuevo</option>
                  <option>Cotizado</option>
                  <option>En negociación</option>
                  <option>Cerrado</option>
                  <option>Perdido</option>
                </select>
              </div>

              <div className="field">
                <label>Fuente</label>
                <select value={fuente} onChange={(e) => setFuente(e.target.value)}>
                  <option>Todas</option>
                  <option>Meta</option>
                  <option>Google</option>
                  <option>Orgánico</option>
                  <option>Referido</option>
                  <option>WhatsApp</option>
                </select>
              </div>

              <div className="field">
                <label>Desde</label>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>

              <div className="field">
                <label>Hasta</label>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>

            {/* Table */}
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Ciudad</th>
                    <th>kWh/mes</th>
                    <th>Sistema (kWp)</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th>Fuente</th>
                    <th>Fecha</th>
                    <th>Asesor</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="emptyCell">
                        Cargando…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="emptyCell">
                        No hay resultados con esos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.id}</td>
                        <td>{r.cliente}</td>
                        <td>{r.ciudad}</td>
                        <td className="num">{r.consumoKwh}</td>
                        <td className="num">{r.sistemaKwp}</td>
                        <td className="num">{formatCOP(r.valorCOP)}</td>
                        <td>
                          <span className={statusBadgeClass(r.estado)}>{r.estado}</span>
                        </td>
                        <td>{r.fuente}</td>
                        <td className="mono">{r.fecha}</td>
                        <td>{r.asesor}</td>
                        <td className="actions">
                          <button className="btn btn--tiny">Ver</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}

/* ----------------- Components ----------------- */

function KpiCard({ title, value, hint }) {
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">{title}</span>
        <span className="card__hint">{hint}</span>
      </div>
      <div className="card__value">{value}</div>
    </div>
  );
}

function Panel({ title, right, children }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h2>{title}</h2>
        {right}
      </div>
      <div className="panel__body">{children}</div>
    </div>
  );
}