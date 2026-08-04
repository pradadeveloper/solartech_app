import { useState } from "react";

/* Panel lateral tipo HubSpot: estado, ciclo de vida y gestión del asesor de un lead. */

const ESTADOS = ["Nuevo", "En negociación", "Cotizado", "Enviado", "Cerrado", "Perdido"];

const BADGE = {
  "Nuevo":          { bg: "rgba(52,152,219,.18)", color: "#3498db" },
  "En negociación": { bg: "rgba(243,156,18,.18)",  color: "#f39c12" },
  "Cotizado":       { bg: "rgba(155,89,182,.18)",  color: "#9b59b6" },
  "Enviado":        { bg: "rgba(26,188,156,.18)",  color: "#1abc9c" },
  "Cerrado":        { bg: "rgba(46,204,113,.18)",  color: "#2ecc71" },
  "Perdido":        { bg: "rgba(231,76,60,.18)",   color: "#e74c3c" },
};

const TIPOS = [
  { key: "nota",     label: "Nota",      icon: "📝" },
  { key: "llamada",  label: "Llamada",   icon: "📞" },
  { key: "whatsapp", label: "WhatsApp",  icon: "💬" },
  { key: "correo",   label: "Correo",    icon: "✉️" },
  { key: "reunion",  label: "Reunión",   icon: "🤝" },
];

const money = (v) => (typeof v === "number" ? `$${v.toLocaleString("es-CO")}` : (v ?? "—"));

const fechaHora = (str) => {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function LeadCRMDrawer({ lead, onClose, onEstado, onActividad, onVerCompleto, pdfUrl, guardando }) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("nota");
  const [enviando, setEnviando] = useState(false);

  if (!lead) return null;

  const badge = BADGE[lead.estado] ?? BADGE["Nuevo"];

  // Ciclo de vida: creación + cada transición, más reciente arriba.
  const eventos = [
    ...(Array.isArray(lead.historialEstados) ? lead.historialEstados : []).map((h) => ({
      tipo: "estado", texto: `${h.de} → ${h.a}`, fecha: h.fecha, usuario: h.usuario, color: BADGE[h.a]?.color || "var(--accent)",
    })),
    { tipo: "creacion", texto: "Lead creado", fecha: lead.fecha, usuario: lead.vendedor, color: "var(--muted2)" },
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const actividades = [...(Array.isArray(lead.actividades) ? lead.actividades : [])].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );

  const enviarActividad = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    await onActividad(tipo, texto.trim());
    setTexto("");
    setTipo("nota");
    setEnviando(false);
  };

  const iconoTipo = (t) => TIPOS.find((x) => x.key === t)?.icon || "📝";

  return (
    <div className="crm-overlay" onClick={onClose}>
      <aside className="crm-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="crm-head">
          <div>
            <div className="crm-head__cot">N-{lead.numeroCotizacion}</div>
            <h3 className="crm-head__name">{lead.nombre || "—"}</h3>
            <div className="crm-head__sub">{lead.ubicacion || "—"} · {lead.tipoSolicitud || "—"}</div>
          </div>
          <button className="crm-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Estado */}
        <div className="crm-section">
          <div className="crm-label">Estado del lead</div>
          <select
            className="crm-estado"
            value={lead.estado ?? "Nuevo"}
            onChange={(e) => onEstado(e.target.value)}
            disabled={guardando}
            style={{ background: badge.bg, color: badge.color, borderColor: badge.color }}
          >
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Datos clave */}
        <div className="crm-section">
          <div className="crm-label">Datos del proyecto</div>
          <div className="crm-grid">
            <Dato k="Valor" v={money(lead.costoProyectoMasIva)} accent />
            <Dato k="Potencia" v={lead.kwp != null ? `${lead.kwp} kWp` : "—"} />
            <Dato k="Consumo" v={lead.consumoKwh != null ? `${lead.consumoKwh} kWh/mes` : "—"} />
            <Dato k="Ahorro/mes" v={money(lead.ahorroMensual)} />
            <Dato k="Retorno" v={lead.tiempoRetorno != null ? `${lead.tiempoRetorno} años` : "—"} />
            <Dato k="Asesor" v={lead.vendedor || "—"} />
          </div>
          <div className="crm-contacto">
            {lead.telefono && <a href={`https://wa.me/57${String(lead.telefono).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="crm-chip crm-chip--wa">💬 {lead.telefono}</a>}
            {lead.correo && <a href={`mailto:${lead.correo}`} className="crm-chip">✉️ {lead.correo}</a>}
          </div>
          <div className="crm-actions">
            <button className="crm-btn crm-btn--ghost" onClick={() => onVerCompleto(lead)}>Ver propuesta completa</button>
            {pdfUrl && (
              <a className="crm-btn crm-btn--ghost" href={pdfUrl.startsWith("http") ? pdfUrl : `${process.env.REACT_APP_API_URL}${pdfUrl}`} target="_blank" rel="noreferrer">↓ PDF</a>
            )}
            {lead.codigoPublico && (
              <a className="crm-btn crm-btn--ghost" href={`/propuesta/${lead.codigoPublico}`} target="_blank" rel="noreferrer">Link cliente</a>
            )}
          </div>
        </div>

        {/* Gestión / Actividades */}
        <div className="crm-section">
          <div className="crm-label">Registrar gestión</div>
          <div className="crm-tipos">
            {TIPOS.map((t) => (
              <button
                key={t.key}
                className={`crm-tipo${tipo === t.key ? " crm-tipo--on" : ""}`}
                onClick={() => setTipo(t.key)}
                type="button"
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <textarea
            className="crm-textarea"
            placeholder="Escribe la nota, resultado de la llamada, próximo paso…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
          />
          <button className="crm-btn crm-btn--primary" onClick={enviarActividad} disabled={!texto.trim() || enviando}>
            {enviando ? "Guardando…" : "Agregar a la gestión"}
          </button>
        </div>

        {/* Timeline: gestión + ciclo de vida entremezclados por fecha */}
        <div className="crm-section">
          <div className="crm-label">Historial y ciclo de vida</div>
          <div className="crm-timeline">
            {[...actividades.map((a) => ({ ...a, _clase: "act" })), ...eventos.map((e) => ({ ...e, _clase: "evt" }))]
              .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
              .map((item, i) => (
                <div className="crm-tl-item" key={item.id || `${item._clase}-${i}`}>
                  <span
                    className="crm-tl-dot"
                    style={{ background: item._clase === "evt" ? (item.color || "var(--accent)") : "var(--accent)" }}
                  >
                    {item._clase === "evt" ? (item.tipo === "creacion" ? "✦" : "⇄") : iconoTipo(item.tipo)}
                  </span>
                  <div className="crm-tl-body">
                    <div className="crm-tl-text">{item.texto}</div>
                    <div className="crm-tl-meta">{fechaHora(item.fecha)}{item.usuario ? ` · ${item.usuario}` : ""}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Dato({ k, v, accent }) {
  return (
    <div className="crm-dato">
      <span className="crm-dato__k">{k}</span>
      <span className="crm-dato__v" style={accent ? { color: "var(--accent)" } : undefined}>{v}</span>
    </div>
  );
}
