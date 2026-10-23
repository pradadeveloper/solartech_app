import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./dashboardAdmon.css";
import { cerrarSesion } from "./supabase";

// Íconos de línea de 16 px (trazo 1.5), uno por destino.
const ICONOS = {
  resumen: "M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z",
  leads: "M4 6h16M4 12h16M4 18h10",
  cotizar: "M12 5v14M5 12h14",
  gerencia: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  forecast: "M3 17l6-6 4 4 8-8M15 7h6v6",
  agente: "M4 5h16v11H8l-4 4z",
  asesores: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  configuracion: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  salir: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M3 6h18M3 12h18M3 18h18",
  cerrar: "M18 6L6 18M6 6l12 12",
};

function Icono({ nombre, className = "navItem__icono" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONOS[nombre]} />
    </svg>
  );
}

// Destinos del menú, agrupados. `titulo` y `frase` arman la fila del título de cada pantalla.
const GRUPOS = [
  {
    nombre: "Ventas",
    items: [
      { label: "Resumen", path: "/", icono: "resumen", titulo: "Resumen", frase: "El embudo de leads y lo cotizado en los últimos 30 días" },
      { label: "Leads y cotizaciones", path: "/leads", icono: "leads", titulo: "Leads y cotizaciones", frase: "Todos los clientes cotizados y en qué etapa va cada uno" },
      { label: "Nueva cotización", path: "/cliente", icono: "cotizar", titulo: "Nueva cotización", frase: "Datos del cliente, consumo y techo para dimensionar el sistema" },
      { label: "Agente IA", path: "/agente", icono: "agente", titulo: "Agente IA", frase: "Pregúntale por tus leads y cotizaciones" },
    ],
  },
  {
    nombre: "Gerencia",
    adminOnly: true,
    items: [
      { label: "Resumen gerencia", path: "/gerencia", icono: "gerencia", titulo: "Resumen gerencia", frase: "Desempeño por asesor" },
      { label: "Forecast equipos", path: "/forecast", icono: "forecast", titulo: "Forecast de equipos", frase: "Paneles e inversores de los proyectos cerrados, por mes" },
      { label: "Asesores", path: "/asesores", icono: "asesores", titulo: "Asesores", frase: "Quién tiene acceso al CRM y con qué rol" },
      { label: "Configuración", path: "/configuracion", icono: "configuracion", titulo: "Configuración", frase: "Parámetros de cálculo y datos de la empresa" },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.items.map((i) => ({ ...i, adminOnly: !!g.adminOnly })));
const RUTAS_ADMIN = TODOS.filter((i) => i.adminOnly).map((i) => i.path);
const PANTALLA_EXTRA = { "/resultado": { titulo: "Resultado de la cotización", frase: "Opciones del sistema, inversión y retorno" } };

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);

  const rol = localStorage.getItem("rolUsuario") || "Asesor";
  const isAdmin = rol === "Admin";
  const nombre = [localStorage.getItem("nombreUsuario"), localStorage.getItem("apellidoUsuario")].filter(Boolean).join(" ") || "Usuario";
  const iniciales = nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  const actual = TODOS.find((i) => i.path === location.pathname) || PANTALLA_EXTRA[location.pathname] || TODOS[0];

  // Redirigir si un asesor intenta entrar a una ruta de gerencia
  useEffect(() => {
    if (!isAdmin && RUTAS_ADMIN.includes(location.pathname)) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, isAdmin, navigate]);

  useEffect(() => { document.title = `${actual.titulo} · Solartech`; }, [actual.titulo]);

  // Menú del celular: cerrar con Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleHamburger = () => {
    if (window.innerWidth <= 820) setMobileOpen((v) => !v);
    else setSidebarOpen((v) => !v);
  };

  return (
    <div className={`dash ${sidebarOpen ? "dash--sidebar" : ""}`}>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside ref={sidebarRef} className={`sidebar${mobileOpen ? " sidebar--mobile-open" : ""}`} aria-label="Menú principal">
        <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
          <Icono nombre="cerrar" className="" />
        </button>

        <div className="sidebar__brand">
          <div className="brandMark" aria-hidden="true">ST</div>
          <div className="brandText">
            <img src="/logos/logo_solartech.webp" alt="Solartech Energy" className="sidebar__logo" width="136" height="24" />
          </div>
        </div>

        <nav className="sidebar__nav">
          {GRUPOS.filter((g) => isAdmin || !g.adminOnly).map((g) => (
            <div key={g.nombre} style={{ display: "contents" }}>
              <div className="sidebar__grupo">{g.nombre}</div>
              {g.items.map((item) => {
                const activo = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    className={`navItem${activo ? " navItem--active" : ""}`}
                    aria-current={activo ? "page" : undefined}
                    title={sidebarOpen ? undefined : item.label}
                    onClick={() => navTo(item.path)}
                  >
                    <Icono nombre={item.icono} />
                    <span className="navItem__texto">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="avatar" aria-hidden="true">{iniciales}</span>
            <span className="sidebar__userInfo">
              <span className="sidebar__userName">{nombre}</span>
              <span className="sidebar__userRol">{rol === "Admin" ? "Administrador" : "Asesor"}</span>
            </span>
          </div>
          <button
            className="navItem"
            title={sidebarOpen ? undefined : "Cerrar sesión"}
            onClick={async () => {
              await cerrarSesion();
              navigate("/login");
            }}
          >
            <Icono nombre="salir" />
            <span className="navItem__texto">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__left">
            <button className="iconBtn" onClick={handleHamburger} aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}>
              <Icono nombre="menu" className="" />
            </button>
            <div className="pageTitle">
              <h1>{actual.titulo}</h1>
              <p>{actual.frase}</p>
            </div>
          </div>

          {location.pathname !== "/cliente" && (
            <div className="topbar__right">
              <button type="button" className="boton boton--primario" onClick={() => navigate("/cliente")}>
                <Icono nombre="cotizar" className="navItem__icono" />
                <span>Nueva<span className="boton__largo"> cotización</span></span>
              </button>
            </div>
          )}
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
