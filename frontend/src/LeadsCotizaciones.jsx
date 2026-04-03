import { useEffect, useState } from "react";
import "./dashboardAdmon.css";

const ESTADOS = ["Nuevo", "En negociación", "Cotizado", "Enviado", "Cerrado", "Perdido"];

const BADGE = {
  "Nuevo":          { bg: "rgba(52,152,219,.18)", color: "#3498db" },
  "En negociación": { bg: "rgba(243,156,18,.18)",  color: "#f39c12" },
  "Cotizado":       { bg: "rgba(155,89,182,.18)",  color: "#9b59b6" },
  "Enviado":        { bg: "rgba(26,188,156,.18)",  color: "#1abc9c" },
  "Cerrado":        { bg: "rgba(46,204,113,.18)",  color: "#2ecc71" },
  "Perdido":        { bg: "rgba(231,76,60,.18)",   color: "#e74c3c" },
};

const money = (v) =>
  typeof v === "number"
    ? `$${v.toLocaleString("es-CO")}`
    : (v ?? "—");

export default function LeadsCotizaciones() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`)
      .then((r) => r.json())
      .then((data) => { setLeads(data.reverse()); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const actualizarEstado = async (numeroCotizacion, estado) => {
    setLeads((prev) =>
      prev.map((l) => l.numeroCotizacion === numeroCotizacion ? { ...l, estado } : l)
    );
    await fetch(`${process.env.REACT_APP_API_URL}/api/leads/${numeroCotizacion}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
  };

  const filtrados = leads.filter((l) => {
    const q = busqueda.toLowerCase();
    return (
      l.nombre?.toLowerCase().includes(q) ||
      l.ubicacion?.toLowerCase().includes(q) ||
      l.vendedor?.toLowerCase().includes(q) ||
      String(l.numeroCotizacion).includes(q)
    );
  });

  const opcionPrincipal = (lead) =>
    lead.opciones?.find((o) => o.seleccionada) ?? null;

  const pdfPrincipal = (lead) => {
    const op = opcionPrincipal(lead);
    return op?.pdfUrl ?? lead.pdfUrl ?? null;
  };

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>Leads y Cotizaciones</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            {leads.length} registros totales
          </p>
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar cliente, ciudad, asesor…"
          style={{
            background: "var(--panel)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "8px 14px", color: "var(--text)",
            fontSize: "0.85rem", width: 260,
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 60 }}>Cargando leads…</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 60 }}>No hay registros.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                {["Cot.", "Fecha", "Cliente", "Ciudad", "kWh", "kWp", "Sistema", "Valor", "Opción principal", "Estado", "Asesor", "Acciones"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((lead) => {
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
                    <td style={{ padding: "10px 12px", color: "var(--accent)", fontWeight: 700 }}>
                      N-{lead.numeroCotizacion}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(lead.fecha).toLocaleDateString("es-CO")}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{lead.nombre}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{lead.ubicacion}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{lead.consumoKwh ?? "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent)" }}>{lead.kwp ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{lead.tipoSolicitud}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                      {money(lead.costoProyectoMasIva)}
                    </td>

                    {/* Opción principal */}
                    <td style={{ padding: "10px 12px" }}>
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

                    {/* Estado editable */}
                    <td style={{ padding: "10px 12px" }}>
                      <select
                        value={lead.estado ?? "Nuevo"}
                        onChange={(e) => actualizarEstado(lead.numeroCotizacion, e.target.value)}
                        style={{
                          background: badge.bg, color: badge.color,
                          border: `1px solid ${badge.color}`,
                          borderRadius: 20, padding: "3px 10px", fontSize: "0.78rem",
                          fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>

                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{lead.vendedor}</td>

                    {/* Acciones */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {pdf ? (
                          <a
                            href={`${process.env.REACT_APP_API_URL}${pdf}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: "var(--accent)", color: "#000",
                              padding: "4px 10px", borderRadius: 6,
                              fontSize: "0.78rem", fontWeight: 700,
                              textDecoration: "none", whiteSpace: "nowrap",
                            }}
                          >
                            ↓ PDF
                          </a>
                        ) : (
                          <span style={{ color: "var(--muted2)", fontSize: "0.78rem" }}>Sin PDF</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
