import { useMemo, useState } from "react";
import "./cotizadorSolar.css";
import logo from "./assets/logo_solartech.webp";
import { useNavigate } from "react-router-dom";

export default function CotizadorSolar() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: "Juan Pérez",
    contribucion: false,
    identificacion: "",
    correo: "juan@example.com",
    telefono: "3001234567",
    ubicacion: "Medellín",
    preferenciaContacto: "WhatsApp",
    tipoSolicitud: "Hogar",
    tipoTecho: "Teja de barro",
    recibeFactura: "Sí",
    sistemaInteres: "Interconectado",
    valorMensual: "1000000",
    consumoKwh: "1000",
    costoKwh: "800",
    conociste: "Instagram",
    facturaAdjunta: null,
    notasAdicionales: "Solo pruebas técnicas",
    areaDisponible: "100",
  });

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "file" ? files?.[0] ?? null : value,
    }));
  };

  const areaMinima = useMemo(() => {
    const consumo = Number(formData.consumoKwh);
    if (!consumo || consumo <= 0) return null;
    const wPromedioDia = ((consumo * 1000) * 12) / 365;
    const radiacionSolarCobertura = 3.8 * 0.8; // 3.04
    const potenciaPanel = 585;
    const npaneles = Math.ceil(wPromedioDia / (potenciaPanel * radiacionSolarCobertura));
    return Math.round(npaneles * 1.13 * 2);
  }, [formData.consumoKwh]);

  const areaInsuficiente = useMemo(() => {
    const areaDisp = Number(formData.areaDisponible);
    return areaMinima !== null && areaDisp > 0 && areaDisp < areaMinima;
  }, [formData.areaDisponible, areaMinima]);

  const canGoNext = useMemo(() => {
    // ✅ Validación simple (sin tocar backend)
    const requiredStep1 = [
      "nombre",
      "correo",
      "telefono",
      "ubicacion",
      "consumoKwh",
      "costoKwh",
      "valorMensual",
      "areaDisponible",
      "preferenciaContacto",
      "tipoSolicitud",
    ];
    return requiredStep1.every((k) => String(formData[k] ?? "").trim().length > 0);
  }, [formData]);

  const handleNext = () => {
    if (step === 1 && canGoNext) setStep(2);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      if (canGoNext) setStep(2);
      return;
    }

    setLoading(true);

    try {
      const formToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => formToSend.append(key, value));

      const apiUrl = `${process.env.REACT_APP_API_URL}/api/calcular-proyecto`;
      console.log('🔗 Fetching:', apiUrl);

      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formToSend,
      });

      if (response.status === 409) {
        const err = await response.json();
        alert(`⚠️ ${err.mensaje}`);
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
      alert(`Error al calcular: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cotizador">
      <div className="cotizadorShell">
        {/* Header */}
        <header className="cotHeader">
          <img src={logo} alt="Logo Solartech" className="cotLogo" />
          <div className="cotHeaderText">
            <h1 className="cotTitle">Nuevo Lead — Cotizador Solar</h1>
            <p className="cotSubtitle">Completa los datos y genera la cotización en segundos.</p>
          </div>

          <div className="cotSteps">
            <span className={`cotStep ${step === 1 ? "isActive" : ""}`}>1</span>
            <span className="cotStepLine" />
            <span className={`cotStep ${step === 2 ? "isActive" : ""}`}>2</span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="cotGrid">
          {/* Left: Form */}
          <section className="cotMain">
            {step === 1 && (
              <>
                <Card title="Datos del cliente">
                  <div className="cotTwoCol">
                    <Field label="Nombre completo">
                      <input name="nombre" value={formData.nombre} onChange={handleChange} required />
                    </Field>

                    <Field label="Cédula / NIT">
                      <input name="identificacion" value={formData.identificacion} onChange={handleChange} placeholder="Ej: 1234567890" />
                    </Field>

                    <Field label="Correo electrónico">
                      <input name="correo" type="email" value={formData.correo} onChange={handleChange} required />
                    </Field>

                    <Field label="Teléfono">
                      <input name="telefono" type="tel" value={formData.telefono} onChange={handleChange} required />
                    </Field>

                    <Field label="Ubicación del proyecto">
                      <input name="ubicacion" value={formData.ubicacion} onChange={handleChange} required />
                    </Field>

                    <Field label="Preferencia de contacto">
                      <select name="preferenciaContacto" value={formData.preferenciaContacto} onChange={handleChange} required>
                        <option value="">Selecciona</option>
                        <option value="Llamada">Llamada</option>
                        <option value="WhatsApp">WhatsApp</option>
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

                <Card title="Consumo y dimensionamiento rápido">
                  <div className="cotTwoCol">
                    <Field label="Consumo kWh/mes">
                      <input name="consumoKwh" value={formData.consumoKwh} onChange={handleChange} required />
                    </Field>

                    <Field label={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Costo kWh (COP)
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'normal', fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            name="contribucion"
                            checked={formData.contribucion}
                            onChange={(e) => setFormData((prev) => ({ ...prev, contribucion: e.target.checked }))}
                            style={{ accentColor: '#f5c518', width: '15px', height: '15px' }}
                          />
                          Contribución
                        </label>
                      </span>
                    }>
                      <input name="costoKwh" value={formData.costoKwh} onChange={handleChange} required />
                    </Field>

                    <Field label="Valor mensual factura (COP)">
                      <input name="valorMensual" type="number" value={formData.valorMensual} onChange={handleChange} required />
                    </Field>

                    <Field label="Área disponible (m²)">
                      <input name="areaDisponible" type="number" value={formData.areaDisponible} onChange={handleChange} required />
                    </Field>
                  </div>

                  {!canGoNext && (
                    <div className="cotHint">
                      Completa los campos obligatorios para continuar.
                    </div>
                  )}
                </Card>
              </>
            )}

            {step === 2 && (
              <>
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
                      </select>
                    </Field>

                    <div className="cotRadioBlock">
                      <span className="cotLabel">¿Recibe factura de energía?</span>
                      <div className="cotRadioRow">
                        <label className="cotRadio">
                          <input
                            type="radio"
                            name="recibeFactura"
                            value="Sí"
                            checked={formData.recibeFactura === "Sí"}
                            onChange={handleChange}
                          />
                          <span>Sí</span>
                        </label>

                        <label className="cotRadio">
                          <input
                            type="radio"
                            name="recibeFactura"
                            value="No"
                            checked={formData.recibeFactura === "No"}
                            onChange={handleChange}
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Adjuntos y notas">
                  <Field label="Adjunta una foto de la factura (opcional)">
                    <input type="file" name="facturaAdjunta" onChange={handleChange} />
                  </Field>

                  <Field label="Notas adicionales">
                    <textarea
                      name="notasAdicionales"
                      value={formData.notasAdicionales}
                      onChange={handleChange}
                      placeholder="Ej: sombras, restricciones, urgencia, etc."
                    />
                  </Field>
                </Card>
              </>
            )}

            {/* Footer actions */}
            <div className="cotActions">
              {step === 2 && (
                <button type="button" className="cotBtn cotBtnGhost" onClick={handleBack}>
                  Atrás
                </button>
              )}

              {step === 1 ? (
                <button
                    type="button"
                    className="cotBtn cotBtnPrimary"
                    disabled={!canGoNext}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNext();
                    }}
                  >
                    Siguiente
                </button>
              ) : (
                <button type="submit" className="cotBtn cotBtnPrimary" disabled={loading}>
                  {loading ? "Calculando..." : "Calcular"}
                </button>
              )}
            </div>
          </section>

          {/* Right: Summary */}
          <aside className="cotSide">
            <Card title="Resumen del lead">
              <SummaryRow label="Cliente" value={formData.nombre} />
              <SummaryRow label="Ciudad" value={formData.ubicacion} />
              <SummaryRow label="kWh/mes" value={formData.consumoKwh} />
              <SummaryRow label="Costo kWh" value={formData.costoKwh} />
              <SummaryRow label="Factura mensual" value={formData.valorMensual} />
              <SummaryRow label="Área (m²)" value={formData.areaDisponible} />
              <div className="cotDivider" />
              <SummaryRow label="Canal" value={formData.conociste || "—"} />
              <SummaryRow label="Contacto" value={formData.preferenciaContacto || "—"} />
              <SummaryRow label="Tipo" value={formData.tipoSolicitud || "—"} />
            </Card>

            <Card title="Tips rápidos">
              <ul className="cotTips">
                <li>Verifica consumo (kWh) y costo por kWh.</li>
                <li>Si el área es baja, el sistema se limita por m².</li>
                <li>Adjuntar factura acelera la precisión del cálculo.</li>
              </ul>

              {areaInsuficiente && (
                <div style={{
                  marginTop: '12px',
                  background: 'rgba(231, 76, 60, 0.15)',
                  border: '1px solid #e74c3c',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                }}>
                  ⚠️ <b>Área insuficiente.</b> Se necesitan <b>{areaMinima} m²</b> para el 100% del consumo. El área actual es <b>{formData.areaDisponible} m²</b>.
                </div>
              )}
            </Card>
          </aside>
        </form>
      </div>
    </div>
  );
}

/* ---------- mini componentes UI ---------- */

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