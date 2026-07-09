import { useMemo, useState, useEffect } from "react";
import "./cotizadorSolar.css";
import logo from "./assets/logo_solartech.webp";
import { useNavigate } from "react-router-dom";
import departamentos from "./data/colombiaMunicipios";

export default function CotizadorSolar() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: "",
    contribucion: false,
    identificacion: "",
    correo: "",
    telefono: "",
    ubicacion: "",

    tipoSolicitud: "",
    tipoTecho: "",
    sistemaInteres: "Interconectado",
    consumoKwh: "",
    costoKwh: "",
    conociste: "",
    departamentoSolar: "",
    ciudadSolar: "",
    radiacionSolar: "",
    areaDisponible: "",
  });

  const [loading, setLoading] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [clienteExistente, setClienteExistente] = useState(null); // { asesor, cotNum }
  const [dismissed, setDismissed] = useState({ area: false, radiacion: false });

  const municipiosDisponibles = useMemo(() => {
    const depto = departamentos.find((d) => d.nombre === formData.departamentoSolar);
    return depto ? depto.municipios : [];
  }, [formData.departamentoSolar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // m² necesarios para cubrir el 100% del consumo con la radiación de la ciudad seleccionada
  const areaMinima = useMemo(() => {
    const consumo = Number(formData.consumoKwh);
    const radiacion = Number(formData.radiacionSolar);
    if (!consumo || consumo <= 0 || !radiacion || radiacion <= 0) return null;
    const mNecesarios = (consumo * 1000) / (radiacion * 0.18 * (365 / 12) * 1000);
    return Math.round(mNecesarios);
  }, [formData.consumoKwh, formData.radiacionSolar]);

  const areaInsuficiente = useMemo(() => {
    const areaDisp = Number(formData.areaDisponible);
    return areaMinima !== null && areaDisp > 0 && areaDisp < areaMinima;
  }, [formData.areaDisponible, areaMinima]);

  const valorMensual = useMemo(() => {
    const c = Number(formData.consumoKwh);
    const k = Number(formData.costoKwh);
    return c > 0 && k > 0 ? String(Math.round(c * k)) : "";
  }, [formData.consumoKwh, formData.costoKwh]);

  const requiredFields = [
    "nombre", "identificacion", "correo", "telefono",
    "departamentoSolar", "ciudadSolar", "tipoSolicitud",
    "consumoKwh", "costoKwh", "areaDisponible", "tipoTecho",
  ];
  const canSubmit = useMemo(
    () => requiredFields.every((k) => String(formData[k] ?? "").trim().length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData]
  );

  // La alerta de cédula duplicada se limpia apenas el usuario edita el campo;
  // se vuelve a verificar recién al perder foco (onBlur).
  useEffect(() => {
    setClienteExistente(null);
  }, [formData.identificacion]);

  useEffect(() => {
    setDismissed((d) => ({ ...d, area: false }));
  }, [formData.areaDisponible, formData.consumoKwh, formData.radiacionSolar]);

  useEffect(() => {
    setDismissed((d) => ({ ...d, radiacion: false }));
  }, [formData.ciudadSolar]);

  const fillRandomData = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const nombres = ["Juan Perez", "Maria Gomez", "Carlos Rodriguez", "Ana Martinez", "Luis Ramirez", "Laura Torres", "Andres Castro", "Sofia Vargas"];
    const dominios = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"];
    const nombre = pick(nombres);
    const correoUser = nombre.toLowerCase().replace(/\s+/g, ".");

    const depto = departamentos.length ? pick(departamentos) : null;
    const municipio = depto && depto.municipios.length ? pick(depto.municipios) : null;
    const radiacion = municipio?.radiacion ?? depto?.radiacion ?? "";

    setFormData((prev) => ({
      ...prev,
      nombre,
      identificacion: String(rand(10000000, 1999999999)),
      correo: `${correoUser}${rand(1, 99)}@${pick(dominios)}`,
      telefono: `3${rand(100000000, 199999999)}`,
      departamentoSolar: depto ? depto.nombre : "",
      ciudadSolar: municipio ? municipio.nombre : "",
      ubicacion: municipio ? municipio.nombre : "",
      radiacionSolar: radiacion !== "" ? String(radiacion) : "",
      tipoSolicitud: pick(["Hogar", "Comercial", "Empresa", "Gran Escala"]),
      consumoKwh: String(rand(200, 2500)),
      costoKwh: String(rand(600, 1100)),
      areaDisponible: String(rand(40, 500)),
      tipoTecho: pick(["Standing Seam", "Termoacústica", "Teja de barro", "Manto Asfáltico", "Teja Eternit", "Losa"]),
      sistemaInteres: pick(["Interconectado", "Aislado", "Híbrido"]),
      conociste: pick(["Instagram", "Facebook", "LinkedIn", "Google", "Referido"]),
    }));
  };

  const checkCedula = async () => {
    const cedula = formData.identificacion.trim();
    if (!cedula) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/leads/check-cedula/${encodeURIComponent(cedula)}`);
      const data = await res.json();
      setClienteExistente(data.exists ? { asesor: data.asesor, cotNum: data.cotNum } : null);
    } catch (_) {}
  };

  const alerts = useMemo(() => {
    const list = [];

    if (clienteExistente) {
      list.push({
        id: "cedula",
        icon: "🔒",
        variant: "cotAlertYellow",
        title: `Cédula ${formData.identificacion} ya registrada`,
        body: (
          <>
            El documento ya tiene una cotización activa.<br />
            Asesor: <b>{clienteExistente.asesor}</b> — Cot. N-{clienteExistente.cotNum}
          </>
        ),
        onClose: () => setClienteExistente(null),
      });
    }

    if (areaInsuficiente && !dismissed.area) {
      list.push({
        id: "area",
        icon: "⚠️",
        variant: "cotAlertOrange",
        title: "Área insuficiente",
        body: (
          <>
            Se necesitan <b>{areaMinima} m²</b> para el 100% del consumo.<br />
            Área actual: <b>{formData.areaDisponible} m²</b>
          </>
        ),
        onClose: () => setDismissed((d) => ({ ...d, area: true })),
      });
    }

    if (formData.radiacionSolar && formData.ciudadSolar && !dismissed.radiacion) {
      list.push({
        id: "radiacion",
        icon: "☀️",
        variant: "cotAlertBlue",
        title: `Radiación solar: ${formData.radiacionSolar} kWh/m²/día`,
        body: <>Ciudad: <b>{formData.ciudadSolar}</b></>,
        onClose: () => setDismissed((d) => ({ ...d, radiacion: true })),
      });
    }

    return list;
  }, [clienteExistente, areaInsuficiente, areaMinima, formData.areaDisponible, formData.identificacion, formData.radiacionSolar, formData.ciudadSolar, dismissed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);

    try {
      const formToSend = new FormData();
      const payload = { ...formData, valorMensual, ubicacion: formData.ciudadSolar || formData.ubicacion };
      Object.entries(payload).forEach(([key, value]) => formToSend.append(key, value ?? ""));

      const apiUrl = `${process.env.REACT_APP_API_URL}/api/calcular-proyecto`;
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formToSend,
      });

      if (response.status === 409) {
        const err = await response.json();
        setClienteExistente({ asesor: err.vendedor, cotNum: err.cotizacion });
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Error del servidor");
      }

      const data = await response.json();
      navigate("/resultado", { state: { resultado: data } });
    } catch (err) {
      const msg = (err instanceof TypeError && err.message.includes("fetch"))
        ? "No se pudo conectar con el servidor. Verifica que el backend esté corriendo e intenta de nuevo."
        : `Error al calcular: ${err.message}`;
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cotizador">
      <div className="cotizadorShell">
        {/* Header */}
        <header className="cotHeader">
          <div className="cotBrand">
            <img src={logo} alt="Logo Solartech" className="cotLogo" />
            <div className="cotHeaderText">
              <h1 className="cotTitle">Nuevo Cliente — Cotizador Solar</h1>
              <p className="cotSubtitle">Completa los datos y genera la cotización en segundos.</p>
            </div>
          </div>

          <div className="cotHeaderRight">
            <button type="button" className="cotBtnRandom" onClick={fillRandomData} title="Llenar el formulario con datos de prueba">
              🎲 Datos aleatorios
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="cotGrid">
          {/* Formulario único */}
          <section className="cotMain">
            <Card title="Datos del cliente">
              <div className="cotTwoCol">
                <Field label="Nombre completo">
                  <input name="nombre" value={formData.nombre} onChange={handleChange} required />
                </Field>

                <Field label="Cédula / NIT">
                  <input
                    name="identificacion"
                    value={formData.identificacion}
                    onChange={handleChange}
                    onBlur={checkCedula}
                    placeholder="Ej: 1234567890"
                    inputMode="numeric"
                    required
                  />
                </Field>

                <Field label="Correo electrónico">
                  <input name="correo" type="email" value={formData.correo} onChange={handleChange} required />
                </Field>

                <Field label="Teléfono">
                  <input name="telefono" type="tel" value={formData.telefono} onChange={handleChange} required />
                </Field>

                <Field label="Departamento">
                  <select
                    name="departamentoSolar"
                    value={formData.departamentoSolar}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        departamentoSolar: e.target.value,
                        ciudadSolar: "",
                        ubicacion: "",
                        radiacionSolar: "",
                      }));
                    }}
                    required
                  >
                    <option value="">Selecciona departamento</option>
                    {departamentos.map((d) => (
                      <option key={d.nombre} value={d.nombre}>{d.nombre}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Ciudad / Municipio">
                  <select
                    name="ciudadSolar"
                    value={formData.ciudadSolar}
                    disabled={!formData.departamentoSolar}
                    onChange={(e) => {
                      const depto = departamentos.find((d) => d.nombre === formData.departamentoSolar);
                      const municipio = municipiosDisponibles.find((m) => m.nombre === e.target.value);
                      const radiacion = municipio?.radiacion ?? depto?.radiacion ?? "";
                      setFormData((prev) => ({
                        ...prev,
                        ciudadSolar: e.target.value,
                        ubicacion: e.target.value,
                        radiacionSolar: radiacion !== "" ? String(radiacion) : "",
                      }));
                    }}
                    required
                  >
                    <option value="">Selecciona ciudad</option>
                    {municipiosDisponibles.map((m) => (
                      <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de proyecto">
                  <select name="tipoSolicitud" value={formData.tipoSolicitud} onChange={handleChange} required>
                    <option value="">Selecciona</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Empresa">Empresa</option>
                    <option value="Gran Escala">Granja Solar</option>
                  </select>
                </Field>
              </div>
            </Card>

            <Card title="Consumo energético">
              <div className="cotTwoCol">
                <Field label="Consumo kWh/mes">
                  <FormattedInput name="consumoKwh" value={formData.consumoKwh} onChange={handleChange} suffix="kWh/mes" required />
                </Field>

                <Field label="Costo kWh (COP)">
                  <FormattedInput name="costoKwh" value={formData.costoKwh} onChange={handleChange} prefix="$" required />
                </Field>

                <Field label="Área disponible (m²)">
                  <FormattedInput name="areaDisponible" value={formData.areaDisponible} onChange={handleChange} suffix="m²" required />
                  {areaInsuficiente && (
                    <span className="cotInlineWarning">
                      Se necesitan {areaMinima} m² para cubrir el 100%. Tienes {formData.areaDisponible} m².
                    </span>
                  )}
                </Field>

                <Field label="¿Aplica contribución?">
                  <label className="cotCheckField">
                    <input
                      type="checkbox"
                      name="contribucion"
                      checked={formData.contribucion}
                      onChange={(e) => setFormData((prev) => ({ ...prev, contribucion: e.target.checked }))}
                    />
                    <span>Contribución</span>
                  </label>
                </Field>
              </div>
            </Card>

            <Card title="Detalles del proyecto">
              <div className="cotTwoCol">
                <Field label="Tipo de techo">
                  <select name="tipoTecho" value={formData.tipoTecho} onChange={handleChange} required>
                    <option value="">Selecciona</option>
                    <option>Standing Seam</option>
                    <option>Termoacústica</option>
                    <option>Teja de barro</option>
                    <option>Manto Asfáltico</option>
                    <option>Teja Eternit</option>
                    <option>Madera</option>
                    <option>Zinc</option>
                    <option>Suelo</option>
                    <option>Losa</option>
                  </select>
                </Field>

                <Field label="Sistema de interés">
                  <select name="sistemaInteres" value={formData.sistemaInteres} onChange={handleChange}>
                    <option value="">Selecciona</option>
                    <option>Interconectado</option>
                    <option>Aislado</option>
                    <option>Híbrido</option>
                  </select>
                </Field>

                <Field label="¿Cómo nos conociste?">
                  <select name="conociste" value={formData.conociste} onChange={handleChange}>
                    <option value="">Selecciona</option>
                    <option>Instagram</option>
                    <option>Facebook</option>
                    <option>LinkedIn</option>
                    <option>Google</option>
                    <option>Referido</option>
                    <option>Referido Mercadeo</option>
                    <option>Gestión comercial</option>
                    <option>Bancolombia</option>
                    <option>Banco de Bogotá</option>
                    <option>Otro</option>
                  </select>
                </Field>
              </div>
            </Card>

            {!canSubmit && (
              <div className="cotHint">Completa los campos obligatorios para calcular la cotización.</div>
            )}

            <div className="cotActions">
              <button type="submit" className="cotBtn cotBtnPrimary" disabled={loading || !canSubmit}>
                {loading ? "Calculando..." : "Calcular cotización"}
              </button>
            </div>
          </section>

          {/* Panel derecho: resumen + alertas */}
          <aside className="cotSide">
            <button
              type="button"
              className="cotSummaryToggle"
              onClick={() => setMobileSummaryOpen((o) => !o)}
              aria-expanded={mobileSummaryOpen}
            >
              Ver resumen del cliente {mobileSummaryOpen ? "▲" : "▼"}
            </button>

            <div className={`cotSummaryCollapsible${mobileSummaryOpen ? " isOpen" : ""}`}>
              <Card title="Resumen del cliente">
                <SummaryRow label="Cliente" value={formData.nombre} />
                <SummaryRow label="Ciudad" value={formData.ciudadSolar} />
                <SummaryRow label="kWh/mes" value={formData.consumoKwh ? `${Number(formData.consumoKwh).toLocaleString("es-CO")} kWh/mes` : "—"} />
                <SummaryRow label="Costo kWh" value={formData.costoKwh ? `$${Number(formData.costoKwh).toLocaleString("es-CO")}` : "—"} />
                <SummaryRow label="Factura mensual" value={valorMensual ? `$${Number(valorMensual).toLocaleString("es-CO")}` : "—"} />
                <SummaryRow label="Área m²" value={formData.areaDisponible ? `${Number(formData.areaDisponible).toLocaleString("es-CO")} m²` : "—"} />
                <div className="cotDivider" />
                <SummaryRow label="Canal" value={formData.conociste || "—"} />
                <SummaryRow label="Tipo" value={formData.tipoSolicitud || "—"} />
              </Card>
            </div>

            {alerts.length > 0 && (
              <div className="cotAlertsPanel">
                <div className="cotAlertsPanelTitle">Alertas del asesor</div>
                {alerts.map((a) => (
                  <Alert key={a.id} {...a} />
                ))}
              </div>
            )}
          </aside>
        </form>
      </div>
    </div>
  );
}

/* ---------- mini componentes UI ---------- */

// ── Input con formato visual (muestra unidades/$ al perder foco) ──────────
function FormattedInput({ name, value, onChange, required, prefix, suffix }) {
  const [focused, setFocused] = useState(false);

  const display = (() => {
    const raw = String(value).replace(/[^\d]/g, "");
    const num = Number(raw);
    if (!raw || isNaN(num)) return value;
    const formatted = num.toLocaleString("es-CO");
    return `${prefix ?? ""}${formatted}${suffix ? ` ${suffix}` : ""}`;
  })();

  return (
    <input
      name={name}
      value={focused ? value : display}
      onChange={(e) => {
        // Siempre pasar solo dígitos al estado padre — evita que el sufijo/prefijo quede en formData
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange({ target: { name, value: raw } });
      }}
      onFocus={(e) => { setFocused(true); setTimeout(() => e.target.select(), 0); }}
      onBlur={() => setFocused(false)}
      required={required}
      inputMode="numeric"
    />
  );
}

function Card({ title, children }) {
  return (
    <div className="cotCard">
      <div className="cotCardHead">
        <h2>{title}</h2>
      </div>
      <div className="cotCardBody">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="cotField">
      <label className="cotLabel">{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="cotSummaryRow">
      <span className="cotSummaryLabel">{label}</span>
      <span className="cotSummaryValue">{String(value ?? "—")}</span>
    </div>
  );
}

function Alert({ icon, title, body, variant, onClose }) {
  return (
    <div className={`cotAlert ${variant}`}>
      <span className="cotAlertIcon">{icon}</span>
      <div className="cotAlertBody">
        <div className="cotAlertTitle">{title}</div>
        <div className="cotAlertText">{body}</div>
      </div>
      {onClose && (
        <button type="button" className="cotAlertClose" onClick={onClose} aria-label="Cerrar alerta">×</button>
      )}
    </div>
  );
}
