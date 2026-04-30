import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmon.css";

const ESTADOS = ["", "Nuevo", "En negociación", "Cotizado", "Enviado", "Cerrado", "Perdido"];

const BADGE = {
  "Nuevo":          { bg: "rgba(52,152,219,.18)", color: "#3498db" },
  "En negociación": { bg: "rgba(243,156,18,.18)",  color: "#f39c12" },
  "Cotizado":       { bg: "rgba(155,89,182,.18)",  color: "#9b59b6" },
  "Enviado":        { bg: "rgba(26,188,156,.18)",  color: "#1abc9c" },
  "Cerrado":        { bg: "rgba(46,204,113,.18)",  color: "#2ecc71" },
  "Perdido":        { bg: "rgba(231,76,60,.18)",   color: "#e74c3c" },
};

const money = (v) =>
  typeof v === "number" ? `$${v.toLocaleString("es-CO")}` : (v ?? "—");

const safeDate = (str) => {
  if (!str) return "—";
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toLocaleDateString("es-CO");
};

const FILTRO_INIT = {
  cot: "", fechaOrden: "desc",
  cliente: "", ciudad: "", kwhMin: "", kwhMax: "",
  kwpMin: "", sistema: "", valorMin: "", estado: "", asesor: "",
};

const inputStyle = {
  width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "4px 6px", color: "var(--text)",
  fontSize: "0.75rem", boxSizing: "border-box",
};

const selectStyle = { ...{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", color: "var(--text)", fontSize: "0.75rem", boxSizing: "border-box" } };

export default function LeadsCotizaciones() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState(FILTRO_INIT);
  const [generandoPdf, setGenerandoPdf] = useState({});
  const navigate = useNavigate();

  const rol = localStorage.getItem('rolUsuario') || 'Asesor';
  const isAdmin = rol === 'Admin';

  const generarPdfLead = async (lead) => {
    const num = String(lead.numeroCotizacion);
    setGenerandoPdf(prev => ({ ...prev, [num]: true }));
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...lead,
        consumoKwh: lead.consumoKwh || 0,
        costoKwh: lead.costoKwh ||
          (lead.ahorroMensual > 0 && lead.consumoKwh > 0
            ? Math.round(lead.ahorroMensual / lead.consumoKwh)
            : 0),
      };
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/generar-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.pdfUrl) {
        setLeads(prev => prev.map(l =>
          String(l.numeroCotizacion) === num ? { ...l, pdfUrl: data.pdfUrl } : l
        ));
      } else {
        alert(data.error || 'No se pudo generar el PDF');
      }
    } catch {
      alert('Error generando PDF');
    } finally {
      setGenerandoPdf(prev => ({ ...prev, [num]: false }));
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const ciudades = useMemo(() => ["", ...new Set(leads.map((l) => l.ubicacion).filter(Boolean)).keys()].sort(), [leads]);
  const sistemas = useMemo(() => ["", ...new Set(leads.map((l) => l.tipoSolicitud).filter(Boolean)).keys()].sort(), [leads]);
  const asesores = useMemo(() => ["", ...new Set(leads.map((l) => l.vendedor).filter(Boolean)).keys()].sort(), [leads]);

  const filtrados = useMemo(() => {
    const lista = leads.filter((l) => {
      if (f.cot && !String(l.numeroCotizacion).includes(f.cot)) return false;
      if (f.cliente && !l.nombre?.toLowerCase().includes(f.cliente.toLowerCase())) return false;
      if (f.ciudad && l.ubicacion !== f.ciudad) return false;
      if (f.kwhMin && (l.consumoKwh ?? 0) < Number(f.kwhMin)) return false;
      if (f.kwhMax && (l.consumoKwh ?? 0) > Number(f.kwhMax)) return false;
      if (f.kwpMin && (l.kwp ?? 0) < Number(f.kwpMin)) return false;
      if (f.sistema && l.tipoSolicitud !== f.sistema) return false;
      if (f.valorMin && (l.costoProyectoMasIva ?? 0) < Number(f.valorMin)) return false;
      if (f.estado && (l.estado ?? "Nuevo") !== f.estado) return false;
      if (f.asesor && l.vendedor !== f.asesor) return false;
      return true;
    });
    lista.sort((a, b) => {
      const da = new Date(a.fecha), db = new Date(b.fecha);
      return f.fechaOrden === "asc" ? da - db : db - da;
    });
    return lista;
  }, [leads, f]);

  const actualizarEstado = async (lead, estado) => {
    setLeads((prev) =>
      prev.map((l) => l.id === lead.id ? { ...l, estado } : l)
    );
    await fetch(`${process.env.REACT_APP_API_URL}/api/leads/${lead.numeroCotizacion}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
  };

  const opcionPrincipal = (lead) => lead.opciones?.find((o) => o.seleccionada) ?? null;
  const pdfPrincipal = (lead) => {
    const op = opcionPrincipal(lead);
    return op?.pdfUrl ?? lead.pdfUrl ?? null;
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
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verLead = (lead) => {
    navigate("/resultado", { state: { resultado: { ...lead, numeroCotizacion: lead.numeroCotizacion } } });
  };

  const limpiarFiltros = () => setF(FILTRO_INIT);
  const hayFiltros = Object.entries(f).some(([k, v]) => k !== "fechaOrden" && v !== "");

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>Leads y Cotizaciones</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            {filtrados.length} de {leads.length} registros
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                style={{ marginLeft: 10, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.82rem", padding: 0 }}
              >
                × Limpiar filtros
              </button>
            )}
          </p>
        </div>
        <button
          onClick={exportarCSV}
          style={{
            background: "var(--accent)", color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 18px", fontSize: "0.85rem",
            fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          ↓ Exportar CSV {hayFiltros ? `(${filtrados.length})` : ""}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 60 }}>Cargando leads…</p>
      ) : (
        <>
        {/* ── Vista tarjetas (mobile) ── */}
        <div className="leads-cards-wrap">
          {filtrados.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>No hay registros con esos filtros.</p>
          ) : filtrados.map((lead) => {
            const pdf = pdfPrincipal(lead);
            const badge = BADGE[lead.estado] ?? BADGE["Nuevo"];
            return (
              <div key={lead.id} className="lead-card">
                <div className="lead-card__top">
                  <div className="lead-card__nombre">{lead.nombre}</div>
                  <span className="lead-card__fecha">{safeDate(lead.fecha)}</span>
                </div>
                <div className="lead-card__valor">{money(lead.costoProyectoMasIva)}</div>
                <div className="lead-card__bottom">
                  <select
                    value={lead.estado ?? "Nuevo"}
                    onChange={(e) => actualizarEstado(lead, e.target.value)}
                    style={{
                      background: badge.bg, color: badge.color,
                      border: `1px solid ${badge.color}`,
                      borderRadius: 20, padding: "4px 12px", fontSize: "0.8rem",
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {ESTADOS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="lead-card__actions">
                    <button
                      onClick={() => verLead(lead)}
                      style={{
                        background: "var(--bg)", color: "var(--text)",
                        border: "1px solid var(--border)",
                        padding: "5px 14px", borderRadius: 8,
                        fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Ver
                    </button>
                    {pdf ? (
                      <a
                        href={pdf?.startsWith('http') ? pdf : `${process.env.REACT_APP_API_URL}${pdf}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: "var(--accent)", color: "#fff",
                          padding: "5px 14px", borderRadius: 8,
                          fontSize: "0.8rem", fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        ↓ PDF
                      </a>
                    ) : (
                      <button
                        onClick={() => generarPdfLead(lead)}
                        disabled={generandoPdf[String(lead.numeroCotizacion)]}
                        style={{
                          background: "var(--panel2)", color: "var(--muted)",
                          border: "1px solid var(--border)",
                          padding: "5px 14px", borderRadius: 8,
                          fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {generandoPdf[String(lead.numeroCotizacion)] ? '...' : '+ PDF'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Vista tabla (desktop) ── */}
        <div className="leads-table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              {/* Fila de encabezados */}
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                {[
                  { label: "Cot.",             hide: true,      adminOnly: false },
                  { label: "Fecha",            hide: false,     adminOnly: false },
                  { label: "Cliente",          hide: false,     adminOnly: false },
                  { label: "Ciudad",           hide: true,      adminOnly: false },
                  { label: "kWh",              hide: true,      adminOnly: false },
                  { label: "kWp",              hide: true,      adminOnly: false },
                  { label: "Sistema",          hide: true,      adminOnly: false },
                  { label: "Valor",            hide: false,     adminOnly: false },
                  { label: "Opción principal", hide: true,      adminOnly: false },
                  { label: "Estado",           hide: false,     adminOnly: false },
                  { label: "Asesor",           hide: true,      adminOnly: true  },
                  { label: "Acciones",         hide: false,     adminOnly: false },
                ].filter(col => !col.adminOnly || isAdmin).map(({ label, hide }) => (
                  <th key={label} className={hide ? "col-hide-mobile" : ""} style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</th>
                ))}
              </tr>

              {/* Fila de filtros por columna */}
              <tr style={{ borderBottom: "2px solid var(--accent)", background: "rgba(245,197,24,.04)" }}>
                {/* Cot. */}
                <td className="col-hide-mobile" style={{ padding: "6px 8px" }}>
                  <input style={inputStyle} placeholder="Nº" value={f.cot} onChange={set("cot")} />
                </td>

                {/* Fecha: orden */}
                <td style={{ padding: "6px 8px", minWidth: 90 }}>
                  <select style={selectStyle} value={f.fechaOrden} onChange={set("fechaOrden")}>
                    <option value="desc">Más reciente</option>
                    <option value="asc">Más antiguo</option>
                  </select>
                </td>

                {/* Cliente */}
                <td style={{ padding: "6px 8px", minWidth: 120 }}>
                  <input style={inputStyle} placeholder="Buscar…" value={f.cliente} onChange={set("cliente")} />
                </td>

                {/* Ciudad */}
                <td className="col-hide-mobile" style={{ padding: "6px 8px" }}>
                  <select style={selectStyle} value={f.ciudad} onChange={set("ciudad")}>
                    {ciudades.map((c) => <option key={c} value={c}>{c || "Todas"}</option>)}
                  </select>
                </td>

                {/* kWh min / max */}
                <td className="col-hide-mobile" style={{ padding: "6px 8px", minWidth: 100 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input style={{ ...inputStyle, width: "50%" }} type="number" placeholder="Min" value={f.kwhMin} onChange={set("kwhMin")} min="0" />
                    <input style={{ ...inputStyle, width: "50%" }} type="number" placeholder="Max" value={f.kwhMax} onChange={set("kwhMax")} min="0" />
                  </div>
                </td>

                {/* kWp min */}
                <td className="col-hide-mobile" style={{ padding: "6px 8px", minWidth: 70 }}>
                  <input style={inputStyle} type="number" placeholder="Min" value={f.kwpMin} onChange={set("kwpMin")} min="0" />
                </td>

                {/* Sistema */}
                <td className="col-hide-mobile" style={{ padding: "6px 8px" }}>
                  <select style={selectStyle} value={f.sistema} onChange={set("sistema")}>
                    {sistemas.map((s) => <option key={s} value={s}>{s || "Todos"}</option>)}
                  </select>
                </td>

                {/* Valor min */}
                <td style={{ padding: "6px 8px", minWidth: 100 }}>
                  <input style={inputStyle} type="number" placeholder="Valor mín" value={f.valorMin} onChange={set("valorMin")} min="0" />
                </td>

                {/* Opción principal — sin filtro */}
                <td className="col-hide-mobile" style={{ padding: "6px 8px" }} />

                {/* Estado */}
                <td style={{ padding: "6px 8px" }}>
                  <select style={selectStyle} value={f.estado} onChange={set("estado")}>
                    {ESTADOS.map((s) => <option key={s} value={s}>{s || "Todos"}</option>)}
                  </select>
                </td>

                {/* Asesor — solo admin */}
                {isAdmin && (
                  <td className="col-hide-mobile" style={{ padding: "6px 8px" }}>
                    <select style={selectStyle} value={f.asesor} onChange={set("asesor")}>
                      {asesores.map((a) => <option key={a} value={a}>{a || "Todos"}</option>)}
                    </select>
                  </td>
                )}

                {/* Acciones — sin filtro */}
                <td style={{ padding: "6px 8px" }} />
              </tr>
            </thead>

            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: "40px 12px", textAlign: "center", color: "var(--muted)" }}>
                    No hay registros con esos filtros.
                  </td>
                </tr>
              ) : (
                filtrados.map((lead) => {
                  const op = opcionPrincipal(lead);
                  const pdf = pdfPrincipal(lead);
                  const badge = BADGE[lead.estado] ?? BADGE["Nuevo"];
                  return (
                    <tr
                      key={lead.id}
                      style={{ borderBottom: "1px solid var(--border)", transition: "background .15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td className="col-hide-mobile" style={{ padding: "10px 12px", color: "var(--accent)", fontWeight: 700 }}>
                        N-{lead.numeroCotizacion}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {safeDate(lead.fecha)}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{lead.nombre}</td>
                      <td className="col-hide-mobile" style={{ padding: "10px 12px", color: "var(--muted)" }}>{lead.ubicacion}</td>
                      <td className="col-hide-mobile" style={{ padding: "10px 12px", textAlign: "right" }}>{lead.consumoKwh ?? "—"}</td>
                      <td className="col-hide-mobile" style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent)" }}>{lead.kwp ?? "—"}</td>
                      <td className="col-hide-mobile" style={{ padding: "10px 12px" }}>{lead.tipoSolicitud}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                        {money(lead.costoProyectoMasIva)}
                      </td>

                      <td className="col-hide-mobile" style={{ padding: "10px 12px" }}>
                        {op ? (
                          <div>
                            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{op.label}</span>
                            <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginLeft: 6 }}>
                              {op.kwp ?? "—"} kWp · {money(op.costoProyectoMasIva)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted2)" }}>Sin opción marcada</span>
                        )}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        <select
                          value={lead.estado ?? "Nuevo"}
                          onChange={(e) => actualizarEstado(lead, e.target.value)}
                          style={{
                            background: badge.bg, color: badge.color,
                            border: `1px solid ${badge.color}`,
                            borderRadius: 20, padding: "3px 10px", fontSize: "0.78rem",
                            fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          {ESTADOS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {isAdmin && (
                        <td className="col-hide-mobile" style={{ padding: "10px 12px", color: "var(--muted)" }}>{lead.vendedor}</td>
                      )}

                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            onClick={() => verLead(lead)}
                            style={{
                              background: "var(--panel)", color: "var(--text)",
                              border: "1px solid var(--border)",
                              padding: "4px 10px", borderRadius: 6,
                              fontSize: "0.78rem", fontWeight: 600,
                              cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            Ver
                          </button>
                          {pdf ? (
                            <a
                              href={pdf?.startsWith('http') ? pdf : `${process.env.REACT_APP_API_URL}${pdf}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: "var(--accent)", color: "#fff",
                                padding: "4px 10px", borderRadius: 6,
                                fontSize: "0.78rem", fontWeight: 700,
                                textDecoration: "none", whiteSpace: "nowrap",
                              }}
                            >
                              ↓ PDF
                            </a>
                          ) : (
                            <button
                              onClick={() => generarPdfLead(lead)}
                              disabled={generandoPdf[String(lead.numeroCotizacion)]}
                              style={{
                                background: "var(--panel2)", color: "var(--muted)",
                                border: "1px solid var(--border)",
                                padding: "4px 10px", borderRadius: 6,
                                fontSize: "0.78rem", fontWeight: 600,
                                cursor: "pointer", whiteSpace: "nowrap",
                              }}
                            >
                              {generandoPdf[String(lead.numeroCotizacion)] ? '...' : '+ PDF'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
