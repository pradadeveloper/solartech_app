import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./dashboardAdmon.css";
import LeadCRMDrawer from "./LeadCRMDrawer";
import { avisar } from "./components/Avisos";

const ESTADOS = ["Nuevo", "En negociación", "Cotizado", "Enviado", "Cerrado", "Perdido"];
const CLASE_ESTADO = {
  "Nuevo": "estado",
  "En negociación": "estado estado--progreso",
  "Cotizado": "estado estado--progreso",
  "Enviado": "estado estado--progreso",
  "Cerrado": "estado estado--positivo",
  "Perdido": "estado estado--negativo",
};

const money = (v) => (typeof v === "number" && v > 0 ? `$${v.toLocaleString("es-CO")}` : "—");
const numero = (v, dec = 0) => (v || v === 0 ? Number(v).toLocaleString("es-CO", { maximumFractionDigits: dec }) : "—");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
// "23 oct" este año; "23 oct 2025" si es de otro año.
const fechaCorta = (str) => {
  const d = new Date(str);
  if (isNaN(d.getTime())) return "—";
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
};

const FILTRO_INIT = {
  q: "", estado: "", asesor: "", ciudad: "", sistema: "",
  kwhMin: "", kwhMax: "", valorMin: "", orden: "reciente",
};

const IconoBuscar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
);

export default function LeadsCotizaciones() {
  const location = useLocation();
  const [leads, setLeads] = useState([]);
  const [carga, setCarga] = useState("cargando"); // cargando | listo | error
  const [f, setF] = useState(() => ({ ...FILTRO_INIT, ...(location.state?.asesor ? { asesor: location.state.asesor } : {}) }));
  const [masFiltros, setMasFiltros] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState({});
  const [leadActivoNum, setLeadActivoNum] = useState(null);
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const navigate = useNavigate();

  const isAdmin = (localStorage.getItem("rolUsuario") || "Asesor") === "Admin";
  const token = () => localStorage.getItem("token");
  const auth = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

  const cargar = () => {
    setCarga("cargando");
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`, { headers: auth() })
      .then((r) => {
        if (r.status === 401) { navigate("/login", { replace: true }); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => { if (data) { setLeads(Array.isArray(data) ? data : []); setCarga("listo"); } })
      .catch(() => setCarga("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, []);

  const generarPdfLead = async (lead) => {
    const num = String(lead.numeroCotizacion);
    setGenerandoPdf((prev) => ({ ...prev, [num]: true }));
    try {
      const payload = {
        ...lead,
        consumoKwh: lead.consumoKwh || 0,
        costoKwh: lead.costoKwh || (lead.ahorroMensual > 0 && lead.consumoKwh > 0 ? Math.round(lead.ahorroMensual / lead.consumoKwh) : 0),
      };
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/generar-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.pdfUrl) {
        setLeads((prev) => prev.map((l) => (String(l.numeroCotizacion) === num ? { ...l, pdfUrl: data.pdfUrl } : l)));
        avisar(`PDF de la cotización N-${num} listo.`);
      } else {
        avisar(data.error || "No se pudo generar el PDF.", "error");
      }
    } catch {
      avisar("No se pudo generar el PDF. Revisa la conexión e inténtalo de nuevo.", "error");
    } finally {
      setGenerandoPdf((prev) => ({ ...prev, [num]: false }));
    }
  };

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const opciones = (campo) => [...new Set(leads.map((l) => l[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const ciudades = useMemo(() => opciones("ubicacion"), [leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const sistemas = useMemo(() => opciones("tipoSolicitud"), [leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const asesores = useMemo(() => opciones("vendedor"), [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const lista = leads.filter((l) => {
      if (q && ![l.nombre, l.ubicacion, `n-${l.numeroCotizacion}`, String(l.numeroCotizacion)].some((t) => String(t || "").toLowerCase().includes(q))) return false;
      if (f.estado && (l.estado ?? "Nuevo") !== f.estado) return false;
      if (f.asesor && l.vendedor !== f.asesor) return false;
      if (f.ciudad && l.ubicacion !== f.ciudad) return false;
      if (f.sistema && l.tipoSolicitud !== f.sistema) return false;
      if (f.kwhMin && (l.consumoKwh ?? 0) < Number(f.kwhMin)) return false;
      if (f.kwhMax && (l.consumoKwh ?? 0) > Number(f.kwhMax)) return false;
      if (f.valorMin && (l.costoProyectoMasIva ?? 0) < Number(f.valorMin)) return false;
      return true;
    });
    const orden = {
      reciente: (a, b) => new Date(b.fecha) - new Date(a.fecha),
      antiguo: (a, b) => new Date(a.fecha) - new Date(b.fecha),
      valor: (a, b) => (b.costoProyectoMasIva || 0) - (a.costoProyectoMasIva || 0),
      cliente: (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")),
    }[f.orden];
    return lista.sort(orden);
  }, [leads, f]);

  const matchLead = (l, lead) => String(l.numeroCotizacion) === String(lead.numeroCotizacion);

  const actualizarEstado = async (lead, estado) => {
    const anterior = lead.estado;
    setGuardandoEstado(true);
    setLeads((prev) => prev.map((l) => (matchLead(l, lead) ? { ...l, estado } : l)));
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/leads/${lead.numeroCotizacion}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.historialEstados) {
        setLeads((prev) => prev.map((l) => (matchLead(l, lead)
          ? { ...l, estado, historialEstados: data.historialEstados, ...(estado === "Cerrado" && !l.fechaCierre ? { fechaCierre: new Date().toISOString() } : {}) }
          : l)));
      }
    } catch (err) {
      setLeads((prev) => prev.map((l) => (matchLead(l, lead) ? { ...l, estado: anterior } : l)));
      avisar(err?.message || "No se pudo actualizar el estado.", "error");
    } finally {
      setGuardandoEstado(false);
    }
  };

  const agregarActividad = async (lead, tipo, texto) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/leads/${lead.numeroCotizacion}/actividad`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify({ tipo, texto }),
      });
      const data = await res.json();
      if (data.actividad) {
        setLeads((prev) => prev.map((l) => (matchLead(l, lead) ? { ...l, actividades: [...(l.actividades || []), data.actividad] } : l)));
      } else {
        avisar(data.error || "No se pudo guardar la nota.", "error");
      }
    } catch {
      avisar("No se pudo guardar la nota.", "error");
    }
  };

  const leadActivo = leadActivoNum != null ? leads.find((l) => String(l.numeroCotizacion) === String(leadActivoNum)) || null : null;

  const opcionPrincipal = (lead) => lead.opciones?.find((o) => o.seleccionada) ?? null;
  const pdfPrincipal = (lead) => {
    const pdf = opcionPrincipal(lead)?.pdfUrl ?? lead.pdfUrl ?? null;
    if (!pdf) return null;
    return pdf.startsWith("http") ? pdf : `${process.env.REACT_APP_API_URL}${pdf}`;
  };

  const exportarCSV = () => {
    const headers = ["Cot.", "Fecha", "Cliente", "Ciudad", "kWh/mes", "kWp", "Sistema", "Valor (COP)", "Opción principal", "Estado", "Asesor"];
    const filas = filtrados.map((l) => {
      const op = opcionPrincipal(l);
      return [
        `N-${l.numeroCotizacion}`,
        new Date(l.fecha).toLocaleDateString("es-CO"),
        `"${l.nombre ?? ""}"`,
        `"${l.ubicacion ?? ""}"`,
        l.consumoKwh ?? "",
        l.kwp ?? "",
        `"${l.tipoSolicitud ?? ""}"`,
        l.costoProyectoMasIva ?? "",
        op ? `"${op.label} · ${op.kwp ?? "—"} kWp"` : "",
        l.estado ?? "Nuevo",
        `"${l.vendedor ?? ""}"`,
      ];
    });
    const csv = [headers, ...filas].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verLead = (lead) => navigate("/resultado", { state: { resultado: { ...lead } } });

  const hayFiltros = Object.entries(f).some(([k, v]) => k !== "orden" && v !== "");
  const filtrosOcultos = ["ciudad", "sistema", "kwhMin", "kwhMax", "valorMin"].filter((k) => f[k]).length + (f.orden !== "reciente" ? 1 : 0);

  const selectEstado = (lead) => (
    <select
      className={CLASE_ESTADO[lead.estado ?? "Nuevo"]}
      value={lead.estado ?? "Nuevo"}
      onChange={(e) => actualizarEstado(lead, e.target.value)}
      disabled={guardandoEstado}
      aria-label={`Estado de ${lead.nombre}`}
    >
      {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  const accionPdf = (lead) => {
    const pdf = pdfPrincipal(lead);
    const num = String(lead.numeroCotizacion);
    return pdf ? (
      <a className="boton boton--chico" href={pdf} target="_blank" rel="noreferrer">PDF</a>
    ) : (
      <button className="boton boton--chico" onClick={() => generarPdfLead(lead)} disabled={generandoPdf[num]}>
        {generandoPdf[num] ? "Generando…" : "Crear PDF"}
      </button>
    );
  };

  return (
    <div className="panel lista-leads">
      <div className="panel__body">
        {/* Barra: búsqueda y filtros principales, visible en todas las pantallas */}
        <div className="leads-barra" role="search">
          <div className="buscar">
            <IconoBuscar />
            <label className="sr-only" htmlFor="leads-q">Buscar</label>
            <input id="leads-q" className="control" type="search" placeholder="Cliente, ciudad o N.º de cotización" value={f.q} onChange={set("q")} />
          </div>
          <label className="sr-only" htmlFor="leads-estado">Estado</label>
          <select id="leads-estado" className="control" value={f.estado} onChange={set("estado")}>
            <option value="">Estado: todos</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {isAdmin && (
            <>
              <label className="sr-only" htmlFor="leads-asesor">Asesor</label>
              <select id="leads-asesor" className="control" value={f.asesor} onChange={set("asesor")}>
                <option value="">Asesor: todos</option>
                {asesores.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </>
          )}
          <button className="boton" onClick={() => setMasFiltros((v) => !v)} aria-expanded={masFiltros} aria-controls="leads-mas">
            Más filtros{filtrosOcultos ? ` (${filtrosOcultos})` : ""}
          </button>
          <div className="leads-barra__fin">
            <span className="leads-cuenta">
              {carga === "listo" ? (hayFiltros ? `${filtrados.length} de ${leads.length} leads` : `${leads.length} leads`) : ""}
            </span>
            {hayFiltros && <button className="boton boton--texto" onClick={() => setF(FILTRO_INIT)}>Limpiar</button>}
            <button className="boton" onClick={exportarCSV} disabled={!filtrados.length}>Exportar CSV</button>
          </div>
        </div>

        {masFiltros && (
          <div className="leads-mas" id="leads-mas">
            <div className="campo">
              <label htmlFor="f-ciudad">Ciudad</label>
              <select id="f-ciudad" className="control" value={f.ciudad} onChange={set("ciudad")}>
                <option value="">Todas</option>
                {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="f-sistema">Tipo de proyecto</label>
              <select id="f-sistema" className="control" value={f.sistema} onChange={set("sistema")}>
                <option value="">Todos</option>
                {sistemas.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="campo">
              <span className="campo__label" id="f-kwh">Consumo (kWh/mes)</span>
              <div className="rango" role="group" aria-labelledby="f-kwh">
                <input className="control" type="number" min="0" inputMode="numeric" placeholder="Desde" aria-label="Consumo desde" value={f.kwhMin} onChange={set("kwhMin")} />
                <input className="control" type="number" min="0" inputMode="numeric" placeholder="Hasta" aria-label="Consumo hasta" value={f.kwhMax} onChange={set("kwhMax")} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="f-valor">Valor desde (COP)</label>
              <input id="f-valor" className="control" type="number" min="0" inputMode="numeric" placeholder="Ej: 50000000" value={f.valorMin} onChange={set("valorMin")} />
            </div>
            <div className="campo">
              <label htmlFor="f-orden">Ordenar por</label>
              <select id="f-orden" className="control" value={f.orden} onChange={set("orden")}>
                <option value="reciente">Más reciente</option>
                <option value="antiguo">Más antiguo</option>
                <option value="valor">Mayor valor</option>
                <option value="cliente">Cliente A–Z</option>
              </select>
            </div>
          </div>
        )}

        {carga === "error" ? (
          <div className="bloque-error" style={{ paddingTop: 16 }}>
            No se pudieron cargar los leads.
            <button className="boton boton--texto" onClick={cargar}>Reintentar</button>
          </div>
        ) : carga === "cargando" ? (
          <p className="vacio" style={{ marginTop: 16 }}>Cargando leads…</p>
        ) : filtrados.length === 0 ? (
          <p className="vacio" style={{ marginTop: 16 }}>
            {leads.length ? "Ningún lead coincide con estos filtros." : "Todavía no hay leads. Las cotizaciones nuevas y los formularios de la web aparecerán aquí."}
          </p>
        ) : (
          <>
            {/* Celular: filas de dos líneas */}
            <div className="leads-cards-wrap">
              {filtrados.map((lead) => (
                <div key={lead.id} className="lead-card">
                  <button className="lead-card__nombre" onClick={() => setLeadActivoNum(lead.numeroCotizacion)}>{lead.nombre}</button>
                  <span className="lead-card__valor">{money(lead.costoProyectoMasIva)}</span>
                  <span className="lead-card__meta">
                    N-{lead.numeroCotizacion} · {lead.ubicacion || "—"}{lead.kwp ? ` · ${numero(lead.kwp, 1)} kWp` : ""}
                  </span>
                  <span className="lead-card__meta" style={{ textAlign: "right" }}>{fechaCorta(lead.fecha)}</span>
                  <div className="lead-card__pie">
                    {selectEstado(lead)}
                    <div className="lead-card__acciones">
                      <button className="boton boton--chico boton--texto" onClick={() => verLead(lead)}>Ver</button>
                      {accionPdf(lead)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Escritorio: tabla */}
            <div className="leads-table-wrap tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cot.</th>
                    <th>Cliente</th>
                    <th>Ciudad</th>
                    <th className="num">kWh/mes</th>
                    <th className="num">kWp</th>
                    <th className="num">Valor</th>
                    <th>Estado</th>
                    {isAdmin && <th>Asesor</th>}
                    <th className="num">Fecha</th>
                    <th><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((lead) => (
                    <tr key={lead.id}>
                      <td className="cot-id num">N-{lead.numeroCotizacion}</td>
                      <td className="identidad">
                        <button className="enlace-fila" onClick={() => setLeadActivoNum(lead.numeroCotizacion)} title="Abrir ficha del lead">
                          {lead.nombre}
                        </button>
                      </td>
                      <td className="tenue">{lead.ubicacion || "—"}</td>
                      <td className="num">{numero(lead.consumoKwh)}</td>
                      <td className="num">{numero(lead.kwp, 1)}</td>
                      <td className="num">{money(lead.costoProyectoMasIva)}</td>
                      <td className="estado-celda">{selectEstado(lead)}</td>
                      {isAdmin && <td className="tenue">{lead.vendedor || "Sin asignar"}</td>}
                      <td className="num tenue">{fechaCorta(lead.fecha)}</td>
                      <td>
                        <div className="fila-acciones">
                          <button className="boton boton--chico boton--texto" onClick={() => verLead(lead)}>Ver</button>
                          {accionPdf(lead)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {leadActivo && (
        <LeadCRMDrawer
          lead={leadActivo}
          guardando={guardandoEstado}
          pdfUrl={pdfPrincipal(leadActivo)}
          onClose={() => setLeadActivoNum(null)}
          onEstado={(estado) => actualizarEstado(leadActivo, estado)}
          onActividad={(tipo, texto) => agregarActividad(leadActivo, tipo, texto)}
          onVerCompleto={(lead) => { setLeadActivoNum(null); verLead(lead); }}
        />
      )}
    </div>
  );
}
