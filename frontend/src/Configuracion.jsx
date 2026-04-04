import { useEffect, useState } from "react";
import "./dashboardAdmon.css";

const API = process.env.REACT_APP_API_URL;

const SECTIONS = [
  {
    id: "tecnico",
    title: "Parametros Tecnicos",
    hint: "Valores que determinan el dimensionamiento del sistema solar.",
    fields: [
      { key: "costokWp",          label: "Costo por kWp instalado",        unit: "COP/kWp",  type: "number", hint: "Precio de mercado por kilovatio-pico instalado." },
      { key: "potenciaPanel",     label: "Potencia por panel",             unit: "W",        type: "number", hint: "Wattios de cada panel solar (ej: 585 W)." },
      { key: "capacidadInversor", label: "Capacidad del inversor",         unit: "W",        type: "number", hint: "Potencia nominal del inversor (ej: 3000 W = 3 kW)." },
      { key: "radiacionSolar",    label: "Radiacion solar promedio",       unit: "kWh/m2/dia", type: "number", step: "0.1", hint: "Horas pico solar segun la region." },
      { key: "margenCobertura",   label: "Margen de cobertura del sistema",unit: "%",        type: "number", step: "0.01", factor: 100, hint: "Eficiencia real del sistema (ej: 0.8 = 80%)." },
      { key: "longitudRiel",      label: "Longitud del riel de montaje",   unit: "m",        type: "number", step: "0.1", hint: "Metros por riel de aluminio." },
      { key: "cableSolar",        label: "Cable solar incluido",           unit: "m",        type: "number", hint: "Metros de cable solar por instalacion." },
    ],
  },
  {
    id: "financiero",
    title: "Parametros Financieros",
    hint: "Tasas e impuestos que afectan la propuesta economica.",
    fields: [
      { key: "ivaPct",             label: "IVA aplicable",                 unit: "%",  type: "number", step: "0.1", hint: "Segun Ley 1715/2014 actualmente es 5% para FNCE." },
      { key: "descuentoRentaPct",  label: "Descuento declaracion de renta",unit: "%",  type: "number", step: "1",   hint: "Porcentaje del costo del sistema deducible de renta." },
    ],
  },
  {
    id: "ambiental",
    title: "Factores Ambientales",
    hint: "Coeficientes para calcular el impacto ambiental del proyecto.",
    fields: [
      { key: "factorCO2",      label: "Factor CO2 evitado por kWp", unit: "ton/kWp/año", type: "number", step: "0.0001", hint: "Toneladas de CO2 evitadas por kWp instalado al año." },
      { key: "factorArboles",  label: "Factor arboles equivalentes", unit: "ton CO2/arbol", type: "number", step: "0.001", hint: "Toneladas de CO2 que absorbe un arbol al año." },
      { key: "factorGalones",  label: "Factor galones de gasolina",  unit: "gal/ton CO2", type: "number", step: "0.1", hint: "Galones equivalentes por tonelada de CO2." },
    ],
  },
  {
    id: "empresa",
    title: "Datos de la Empresa",
    hint: "Informacion de contacto que aparece en los PDF generados.",
    isEmpresa: true,
    fields: [
      { key: "nombre",   label: "Nombre de la empresa", type: "text",  hint: "Aparece en encabezados y pie de pagina del PDF." },
      { key: "telefono", label: "Telefono",              type: "text",  hint: "Numero de contacto visible en el PDF." },
      { key: "email",    label: "Correo electronico",    type: "email", hint: "Email de contacto visible en el PDF." },
      { key: "web",      label: "Sitio web",             type: "text",  hint: "URL sin https:// (ej: www.solartech.com.co)." },
      { key: "nit",      label: "NIT",                   type: "text",  hint: "Numero de identificacion tributaria." },
      { key: "ciudad",   label: "Ciudad / Pais",         type: "text",  hint: "Ciudad y pais de la empresa." },
    ],
  },
];

function ConfigCard({ section, values, onChange }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__head">
        <div>
          <h2>{section.title}</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{section.hint}</p>
        </div>
      </div>
      <div className="panel__body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {section.fields.map((f) => {
            const raw = section.isEmpresa
              ? (values.empresa?.[f.key] ?? "")
              : (values[f.key] ?? "");
            const display = f.factor ? Number((raw * f.factor).toFixed(4)) : raw;
            return (
              <div key={f.key} className="field">
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{f.label}</span>
                  {f.unit && <span style={{ color: "var(--muted2)", fontSize: 11 }}>{f.unit}</span>}
                </label>
                <input
                  type={f.type || "text"}
                  step={f.step || undefined}
                  value={display}
                  onChange={(e) => {
                    let val = f.type === "number" ? e.target.value : e.target.value;
                    if (f.factor && f.type === "number") val = Number(e.target.value) / f.factor;
                    onChange(f.key, val, section.isEmpresa);
                  }}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                {f.hint && (
                  <span style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>{f.hint}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Configuracion() {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/config`)
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setMsg({ type: "error", text: "No se pudo cargar la configuracion." }));
  }, []);

  const handleChange = (key, value, isEmpresa) => {
    setConfig((prev) => {
      if (isEmpresa) {
        return { ...prev, empresa: { ...prev.empresa, [key]: value } };
      }
      return { ...prev, [key]: value };
    });
    setMsg(null);
  };

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      const token = localStorage.getItem("token");
      const payload = { ...config };
      // Convertir strings numericos a Number
      const numKeys = ["costokWp","potenciaPanel","capacidadInversor","radiacionSolar",
        "margenCobertura","longitudRiel","cableSolar","ivaPct","descuentoRentaPct",
        "factorCO2","factorArboles","factorGalones"];
      numKeys.forEach((k) => { if (payload[k] !== undefined) payload[k] = Number(payload[k]); });

      const res = await fetch(`${API}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error guardando");
      setMsg({ type: "ok", text: "Configuracion guardada correctamente. Los nuevos calculos usaran estos valores." });
    } catch (_) {
      setMsg({ type: "error", text: "Error al guardar. Verifica tu sesion." });
    } finally {
      setGuardando(false);
    }
  };

  if (!config) {
    return <p style={{ color: "var(--muted)", padding: 20 }}>Cargando configuracion…</p>;
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>Configuracion del Sistema</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            Los cambios aqui afectan todos los calculos y PDF generados a partir de este momento.
          </p>
        </div>
        <button
          onClick={guardar}
          disabled={guardando}
          style={{
            background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 10, padding: "10px 24px",
            fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
            opacity: guardando ? 0.7 : 1, whiteSpace: "nowrap",
          }}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: "0.85rem", fontWeight: 500,
          background: msg.type === "ok" ? "rgba(46,204,113,.12)" : "rgba(231,76,60,.12)",
          border: `1px solid ${msg.type === "ok" ? "rgba(46,204,113,.4)" : "rgba(231,76,60,.4)"}`,
          color: msg.type === "ok" ? "#16a34a" : "#dc2626",
        }}>
          {msg.text}
        </div>
      )}

      {SECTIONS.map((section) => (
        <ConfigCard
          key={section.id}
          section={section}
          values={config}
          onChange={handleChange}
        />
      ))}

      {/* Resumen visual de valores clave */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel__head"><h2>Resumen de valores actuales</h2></div>
        <div className="panel__body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {[
              { label: "Costo/kWp",      value: `$${Number(config.costokWp || 0).toLocaleString("es-CO")}` },
              { label: "IVA",            value: `${config.ivaPct}%` },
              { label: "Panel",          value: `${config.potenciaPanel} W` },
              { label: "Radiacion",      value: `${config.radiacionSolar} kWh/m2/dia` },
              { label: "Cobertura",      value: `${Math.round((config.margenCobertura || 0) * 100)}%` },
              { label: "Desc. renta",    value: `${config.descuentoRentaPct}%` },
              { label: "Factor CO2",     value: `${config.factorCO2} ton/kWp` },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "var(--bg)", borderRadius: 10, padding: "10px 14px",
                border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
