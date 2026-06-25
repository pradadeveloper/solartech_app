import { useEffect, useState } from "react";
import "./dashboardAdmon.css";

const API = process.env.REACT_APP_API_URL;

const SECTIONS = [
  {
    id: "tecnico",
    title: "Parámetros Técnicos",
    hint: "Definen el dimensionamiento del sistema solar (kWp, paneles, inversores).",
    fields: [
      {
        key: "potenciaPanel",
        label: "Potencia por panel",
        unit: "W",
        type: "number",
        step: "1",
        hint: "Wattios pico de cada panel solar. Ej: 620 W. Define cuántos paneles se instalan.",
      },
      {
        key: "capacidadInversor",
        label: "Capacidad del inversor",
        unit: "W",
        type: "number",
        step: "100",
        hint: "Potencia AC máxima por inversor en watts. Determina cuántos inversores se requieren.",
      },
      {
        key: "radiacionSolar",
        label: "Radiación solar por defecto",
        unit: "HSP/día",
        type: "number",
        step: "0.1",
        hint: "Horas Sol Pico diarias promedio del país. Se reemplaza por el valor de la ciudad seleccionada. Ej: 3.8",
      },
      {
        key: "margenCobertura",
        label: "Factor de rendimiento del sistema (PR)",
        unit: "decimal",
        type: "number",
        step: "0.01",
        hint: "Pérdidas del sistema (temperatura, cableado, suciedad). 0.8 = 80% de eficiencia real.",
      },
      {
        key: "sobredimension",
        label: "Sobredimensionamiento DC/AC",
        unit: "decimal",
        type: "number",
        step: "0.01",
        hint: "Factor que relaciona la potencia DC (paneles) vs AC (inversor). 0.30 = 30% más DC que AC.",
      },
      {
        key: "factorAreaM2PorKwp",
        label: "Área de techo por kWp",
        unit: "m²/kWp",
        type: "number",
        step: "0.1",
        hint: "Metros cuadrados de techo requeridos por cada kWp instalado. Ej: 5.8 m²/kWp.",
      },
      {
        key: "maxAC100kWp",
        label: "Límite pequeño autogenerador (CREG)",
        unit: "kWp",
        type: "number",
        step: "1",
        hint: "Umbral CREG que separa pequeño de gran autogenerador. Actualmente 135 kWp AC según regulación.",
      },
    ],
  },
  {
    id: "financiero",
    title: "Parámetros Financieros",
    hint: "Costos, impuestos y tasas que determinan la rentabilidad del proyecto.",
    fields: [
      {
        key: "costokWp",
        label: "Costo de instalación por kWp",
        unit: "COP/kWp",
        type: "number",
        step: "10000",
        hint: "Precio total de instalación por kilovatio-pico (paneles + inversor + estructura + mano de obra).",
      },
      {
        key: "ivaPct",
        label: "IVA aplicable al proyecto",
        unit: "%",
        type: "number",
        step: "0.1",
        hint: "Según Ley 1715/2014, los proyectos FNCE tienen IVA del 5% (excluidos). Verificar con contador.",
      },
      {
        key: "descuentoRentaPct",
        label: "Descuento en declaración de renta",
        unit: "%",
        type: "number",
        step: "1",
        hint: "Porcentaje del costo del proyecto deducible de la renta. Actualmente 50% según Ley 1715.",
      },
      {
        key: "costoGeneracion",
        label: "Tarifa de generación CREG",
        unit: "COP/kWh",
        type: "number",
        step: "1",
        hint: "Precio al que la red paga los excedentes para GRANDES autogeneradores (>135 kWp). Aprox. 330 COP/kWh.",
      },
      {
        key: "costoComercializacion",
        label: "Cargo de comercialización CREG",
        unit: "COP/kWh",
        type: "number",
        step: "1",
        hint: "Costo que se descuenta a la tarifa del cliente para calcular el valor neto de excedentes. Aprox. 115 COP/kWh.",
      },
      {
        key: "mantenimientoKwp",
        label: "Mantenimiento anual por kWp",
        unit: "COP/kWp/año",
        type: "number",
        step: "1000",
        hint: "Costo estimado de mantenimiento anual por kWp instalado. Se muestra en el análisis financiero.",
      },
      {
        key: "inflacion",
        label: "Tasa de inflación / IPC anual",
        unit: "decimal",
        type: "number",
        step: "0.01",
        hint: "Tasa de indexación del ahorro para el cálculo de TIR. 0.08 = 8% anual.",
      },
    ],
  },
  {
    id: "formasPago",
    title: "Formas de Pago",
    hint: "Porcentajes de cada hito de pago del proyecto. Deben sumar 100%.",
    fields: [
      {
        key: "anticipo1Pct",
        label: "Anticipo inicial",
        unit: "%",
        type: "number",
        step: "1",
        hint: "Porcentaje que paga el cliente al firmar el contrato, antes de iniciar obra.",
      },
      {
        key: "anticipo2Pct",
        label: "Entrega de materiales",
        unit: "%",
        type: "number",
        step: "1",
        hint: "Porcentaje que paga el cliente cuando llegan los equipos al sitio de instalación.",
      },
      {
        key: "anticipo3Pct",
        label: "Pago final (RETIE)",
        unit: "%",
        type: "number",
        step: "1",
        hint: "Porcentaje final a pagar al obtener la certificación RETIE y entrega del sistema.",
      },
    ],
  },
  {
    id: "ambiental",
    title: "Factores Ambientales",
    hint: "Coeficientes para estimar el impacto ambiental positivo del proyecto.",
    fields: [
      {
        key: "factorCO2",
        label: "CO₂ evitado por kWp instalado",
        unit: "ton CO₂/kWp/año",
        type: "number",
        step: "0.0001",
        hint: "Toneladas de CO2 que deja de emitirse por cada kWp instalado al año. Factor de emisión de la red eléctrica colombiana.",
      },
      {
        key: "factorArboles",
        label: "Absorción CO₂ por árbol",
        unit: "ton CO₂/árbol/año",
        type: "number",
        step: "0.001",
        hint: "Toneladas de CO2 que absorbe un árbol promedio al año. Se usa para calcular árboles equivalentes.",
      },
      {
        key: "factorGalones",
        label: "Equivalencia en galones de gasolina",
        unit: "gal/ton CO₂",
        type: "number",
        step: "0.1",
        hint: "Galones de gasolina equivalentes a una tonelada de CO2. Se usa para dar contexto al ahorro ambiental.",
      },
    ],
  },
  {
    id: "materiales",
    title: "Materiales de Instalación",
    hint: "Parámetros de los accesorios de montaje. Afectan el listado de materiales del presupuesto.",
    fields: [
      {
        key: "longitudRiel",
        label: "Longitud de riel por segmento",
        unit: "metros",
        type: "number",
        step: "0.1",
        hint: "Longitud estándar de cada tramo de riel de montaje (estructura metálica). Ej: 4.7 m.",
      },
      {
        key: "cableSolar",
        label: "Cable solar incluido",
        unit: "metros",
        type: "number",
        step: "1",
        hint: "Metros de cable solar (DC) que se incluyen por defecto en la propuesta.",
      },
    ],
  },
  {
    id: "empresa",
    title: "Datos de la Empresa",
    hint: "Información de contacto que aparece en los encabezados y pie de página de los PDF.",
    isEmpresa: true,
    fields: [
      { key: "nombre",   label: "Nombre de la empresa", type: "text",  hint: "Nombre comercial que aparece en el PDF." },
      { key: "telefono", label: "Teléfono",              type: "text",  hint: "Número de contacto visible en el PDF." },
      { key: "email",    label: "Correo electrónico",    type: "email", hint: "Email de contacto visible en el PDF." },
      { key: "web",      label: "Sitio web",             type: "text",  hint: "URL completa del sitio web de la empresa." },
      { key: "nit",      label: "NIT",                   type: "text",  hint: "Número de identificación tributaria." },
      { key: "ciudad",   label: "Ciudad / País",         type: "text",  hint: "Ciudad y país de la empresa." },
    ],
  },
];

const ALL_NUM_KEYS = [
  "costokWp","potenciaPanel","capacidadInversor","radiacionSolar",
  "margenCobertura","sobredimension","factorAreaM2PorKwp","maxAC100kWp",
  "ivaPct","descuentoRentaPct","costoGeneracion","costoComercializacion",
  "mantenimientoKwp","inflacion",
  "anticipo1Pct","anticipo2Pct","anticipo3Pct",
  "factorCO2","factorArboles","factorGalones",
  "longitudRiel","cableSolar",
];

function SumaPagos({ config }) {
  const suma = (Number(config.anticipo1Pct) || 0)
    + (Number(config.anticipo2Pct) || 0)
    + (Number(config.anticipo3Pct) || 0);
  if (suma === 100) return null;
  return (
    <div style={{
      marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
      background: "rgba(231,76,60,.1)", border: "1px solid rgba(231,76,60,.3)", color: "#dc2626",
    }}>
      ⚠ Los porcentajes de pago suman {suma}% (deben sumar 100%)
    </div>
  );
}

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
            return (
              <div key={f.key} className="field">
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{f.label}</span>
                  {f.unit && <span style={{ color: "var(--muted2)", fontSize: 11 }}>{f.unit}</span>}
                </label>
                <input
                  type={f.type || "text"}
                  step={f.step || undefined}
                  value={raw}
                  onChange={(e) => onChange(f.key, e.target.value, section.isEmpresa)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                {f.hint && (
                  <span style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2, display: "block" }}>{f.hint}</span>
                )}
              </div>
            );
          })}
        </div>
        {section.id === "formasPago" && <SumaPagos config={values} />}
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
      .catch(() => setMsg({ type: "error", text: "No se pudo cargar la configuración." }));
  }, []);

  const handleChange = (key, value, isEmpresa) => {
    setConfig((prev) => {
      if (isEmpresa) return { ...prev, empresa: { ...prev.empresa, [key]: value } };
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
      ALL_NUM_KEYS.forEach((k) => {
        if (payload[k] !== undefined) payload[k] = Number(String(payload[k]).replace(",", ".")) || payload[k];
      });

      const res = await fetch(`${API}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error guardando");
      setMsg({ type: "ok", text: "Configuración guardada. Los próximos cálculos usarán estos valores." });
    } catch (err) {
      const noConexion = err instanceof TypeError && err.message.includes("fetch");
      setMsg({
        type: "error",
        text: noConexion
          ? "No se puede conectar con el servidor. Verifica que el backend esté corriendo."
          : "Error al guardar. Verifica tu sesión (vuelve a iniciar sesión si expiró).",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (!config) {
    return <p style={{ color: "var(--muted)", padding: 20 }}>Cargando configuración…</p>;
  }

  const suma = (Number(config.anticipo1Pct) || 0) + (Number(config.anticipo2Pct) || 0) + (Number(config.anticipo3Pct) || 0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>Configuración del Sistema</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            Los cambios aquí afectan todos los cálculos y PDF generados a partir de este momento.
          </p>
        </div>
        <button
          onClick={guardar}
          disabled={guardando || suma !== 100}
          title={suma !== 100 ? "Los porcentajes de pago deben sumar 100%" : ""}
          style={{
            background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 10, padding: "10px 24px",
            fontSize: "0.9rem", fontWeight: 700, cursor: guardando || suma !== 100 ? "not-allowed" : "pointer",
            opacity: guardando || suma !== 100 ? 0.5 : 1, whiteSpace: "nowrap",
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

      {/* Resumen visual */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel__head"><h2>Resumen de valores clave</h2></div>
        <div className="panel__body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {[
              { label: "Costo/kWp",        value: `$${Number(config.costokWp || 0).toLocaleString("es-CO")}` },
              { label: "Panel",            value: `${config.potenciaPanel} W` },
              { label: "Margen (PR)",      value: `${Math.round((Number(config.margenCobertura) || 0) * 100)}%` },
              { label: "Sobredimensión",   value: `${Math.round((Number(config.sobredimension) || 0) * 100)}%` },
              { label: "IVA",              value: `${config.ivaPct}%` },
              { label: "Mantenimiento",    value: `$${Number(config.mantenimientoKwp || 0).toLocaleString("es-CO")}/kWp` },
              { label: "Inflación IPC",    value: `${Math.round((Number(config.inflacion) || 0) * 100)}%` },
              { label: "Formas de pago",   value: `${config.anticipo1Pct}% / ${config.anticipo2Pct}% / ${config.anticipo3Pct}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "var(--bg)", borderRadius: 10, padding: "10px 14px",
                border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent)" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
