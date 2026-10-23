import { useState } from "react";
import Dialogo from "./components/Dialogo";

/* Ficha del lead en panel lateral: estado, datos del proyecto, gestión del asesor e historial.
   Cierra con Escape o clic afuera y mantiene el foco adentro (componente Dialogo). */

const ESTADOS = ["Nuevo", "En negociación", "Cotizado", "Enviado", "Cerrado", "Perdido"];
const CLASE_ESTADO = {
  "Nuevo": "estado",
  "En negociación": "estado estado--progreso",
  "Cotizado": "estado estado--progreso",
  "Enviado": "estado estado--progreso",
  "Cerrado": "estado estado--positivo",
  "Perdido": "estado estado--negativo",
};

const TIPOS = [
  { key: "nota", label: "Nota" },
  { key: "llamada", label: "Llamada" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "correo", label: "Correo" },
  { key: "reunion", label: "Reunión" },
];
const NOMBRE_TIPO = Object.fromEntries(TIPOS.map((t) => [t.key, t.label]));

const money = (v) => (typeof v === "number" && v > 0 ? `$${v.toLocaleString("es-CO")}` : "—");
const num = (v, unidad, dec = 1) => (v || v === 0 ? `${Number(v).toLocaleString("es-CO", { maximumFractionDigits: dec })} ${unidad}` : "—");

const fechaHora = (str) => {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function LeadCRMDrawer({ lead, onClose, onEstado, onActividad, onVerCompleto, pdfUrl, guardando }) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("nota");
  const [enviando, setEnviando] = useState(false);

  if (!lead) return null;

  // Gestión del asesor y ciclo de vida, entremezclados y lo más reciente arriba.
  const historial = [
    ...(Array.isArray(lead.actividades) ? lead.actividades : []).map((a) => ({
      clave: a.id, clase: "gestion", titulo: NOMBRE_TIPO[a.tipo] || "Nota", texto: a.texto, fecha: a.fecha, usuario: a.usuario,
    })),
    ...(Array.isArray(lead.historialEstados) ? lead.historialEstados : []).map((h, i) => ({
      clave: `e${i}`, clase: "estado", titulo: "Cambio de estado", texto: `${h.de} → ${h.a}`, fecha: h.fecha, usuario: h.usuario,
    })),
    { clave: "creado", clase: "estado", titulo: "Lead creado", texto: lead.conociste ? `Llegó por ${lead.conociste}` : "", fecha: lead.fecha, usuario: lead.vendedor !== "Sin asignar" ? lead.vendedor : "" },
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const enviarActividad = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    await onActividad(tipo, texto.trim());
    setTexto("");
    setTipo("nota");
    setEnviando(false);
  };

  const telefono = String(lead.telefono || "").replace(/\D/g, "");

  return (
    <Dialogo titulo={`Ficha de ${lead.nombre || "lead"}`} onCerrar={onClose} lateral className="crm-drawer">
      <div className="crm-head">
        <div style={{ minWidth: 0 }}>
          <div className="crm-head__cot">N-{lead.numeroCotizacion} · {lead.vendedor || "Sin asignar"}</div>
          <h2 className="crm-head__name">{lead.nombre || "—"}</h2>
          <div className="crm-head__sub">{lead.ubicacion || "—"} · {lead.tipoSolicitud || "—"}</div>
        </div>
        <button className="crm-close" onClick={onClose} aria-label="Cerrar ficha">✕</button>
      </div>

      <div className="crm-section">
        <label className="crm-label" htmlFor="crm-estado">Estado</label>
        <select
          id="crm-estado"
          className={`crm-estado ${CLASE_ESTADO[lead.estado ?? "Nuevo"]}`}
          value={lead.estado ?? "Nuevo"}
          onChange={(e) => onEstado(e.target.value)}
          disabled={guardando}
        >
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="crm-section">
        <div className="crm-label">Proyecto</div>
        <div className="crm-grid">
          <Dato k="Valor con IVA" v={money(lead.costoProyectoMasIva)} />
          <Dato k="Potencia" v={num(lead.kwp, "kWp")} />
          <Dato k="Consumo" v={num(lead.consumoKwh, "kWh/mes", 0)} />
          <Dato k="Ahorro mensual" v={money(lead.ahorroMensual)} />
          <Dato k="Retorno" v={num(lead.tiempoRetorno, "años")} />
          <Dato k="Paneles" v={lead.npaneles ? `${lead.npaneles}` : "—"} />
        </div>
        <div className="crm-contacto">
          {telefono && <a href={`https://wa.me/57${telefono}`} target="_blank" rel="noreferrer" className="crm-chip crm-chip--wa">WhatsApp {lead.telefono}</a>}
          {lead.correo && <a href={`mailto:${lead.correo}`} className="crm-chip">{lead.correo}</a>}
        </div>
        <div className="crm-actions">
          <button className="crm-btn crm-btn--ghost" onClick={() => onVerCompleto(lead)}>Ver propuesta completa</button>
          {pdfUrl && <a className="crm-btn crm-btn--ghost" href={pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
          {lead.codigoPublico && (
            <a className="crm-btn crm-btn--ghost" href={`/propuesta/${lead.codigoPublico}`} target="_blank" rel="noreferrer">Link del cliente</a>
          )}
        </div>
      </div>

      {(lead.empresa || lead.mensaje || lead.preferenciaContacto) && (
        <div className="crm-section">
          <div className="crm-label">Desde la página web</div>
          <div className="crm-grid">
            <Dato k="Empresa" v={lead.empresa || "—"} />
            <Dato k="Prefiere contacto por" v={lead.preferenciaContacto || "—"} />
          </div>
          {lead.mensaje && <p className="crm-mensaje">“{lead.mensaje}”</p>}
        </div>
      )}

      <div className="crm-section">
        <div className="crm-label" id="crm-tipo-label">Registrar gestión</div>
        <div className="crm-tipos" role="radiogroup" aria-labelledby="crm-tipo-label">
          {TIPOS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={tipo === t.key}
              className={`crm-tipo${tipo === t.key ? " crm-tipo--on" : ""}`}
              onClick={() => setTipo(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="crm-nota">Detalle de la gestión</label>
        <textarea
          id="crm-nota"
          className="crm-textarea"
          placeholder="Resultado de la llamada, acuerdo, próximo paso…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
        />
        <button className="crm-btn crm-btn--primary" onClick={enviarActividad} disabled={!texto.trim() || enviando}>
          {enviando ? "Guardando…" : "Guardar gestión"}
        </button>
      </div>

      <div className="crm-section">
        <div className="crm-label">Historial</div>
        <ol className="crm-timeline">
          {historial.map((item) => (
            <li className={`crm-tl-item crm-tl-item--${item.clase}`} key={item.clave}>
              <span className="crm-tl-dot" aria-hidden="true" />
              <div className="crm-tl-body">
                <div className="crm-tl-titulo">{item.titulo}</div>
                {item.texto && <div className="crm-tl-text">{item.texto}</div>}
                <div className="crm-tl-meta">{fechaHora(item.fecha)}{item.usuario ? ` · ${item.usuario}` : ""}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Dialogo>
  );
}

function Dato({ k, v }) {
  return (
    <div className="crm-dato">
      <span className="crm-dato__k">{k}</span>
      <span className="crm-dato__v">{v}</span>
    </div>
  );
}
