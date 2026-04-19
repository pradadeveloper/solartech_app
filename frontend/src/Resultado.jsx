import { useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo_solartech.webp";
import { useMemo, useState } from "react";
import "./cotizadorSolar.css"; // usa tu misma hoja

// ── Replica las fórmulas del backend para calcular en el frontend ──
function calcularLocal(kwpInput, costoKwh, costokWpInput, base = {}) {
  const kwp = Number(kwpInput);
  const costoUnidad = Number(costoKwh);
  const costokWp = Number(costokWpInput) > 0 ? Number(costokWpInput) : 3500000;
  if (!kwp || !costoUnidad) return null;

  const potenciaPanel = 585;
  const radiacionSolar = 3.8;
  const margenCobertura = 0.8;
  const capacidadInversor = 3000;
  const longitudRiel = 4.7;
  const cableSolar = 10;

  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));
  const wPromedioDia = Number((kwp * radiacionSolarCobertura * 1000).toFixed(1));
  const consumo = Number(((wPromedioDia * 365) / (1000 * 12)).toFixed(1));

  const npaneles = Math.ceil((kwp * 1000) / potenciaPanel);
  const ninversores = Math.ceil((potenciaPanel * npaneles) / capacidadInversor);
  const riel47 = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland = Math.ceil((npaneles * 2) - 2);
  const endCland = Math.ceil(npaneles / 2);
  const lFoot = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;
  const produccionDeEnergia = Math.round((potenciaPanel * npaneles * radiacionSolarCobertura * 30) / 1000);
  const areaMinima = Math.round(npaneles * 1.13 * 2);

  // Cobertura por área (conserva el área del resultado original)
  const areaDisp = Number(base.areaDisponible ?? 0);
  let porcentajeCoberturaProyecto = 0;
  if (areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }

  const costoProyecto = Math.round(kwp * costokWp);
  const ivaProyecto = Math.round(costoProyecto * 0.05);
  const costoProyectoMasIva = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto / 2);
  const ahorroMensual = Math.round(consumo * costoUnidad);
  const ahorroAnual = ahorroMensual * 12;
  const consumoKwh = consumo;
  const ahorro10Anos = Math.round(ahorroAnual * 10);
  const tiempoRetorno = ahorroAnual > 0 ? Number((costoProyecto / ahorroAnual).toFixed(1)) : null;

  // Ambiental
  const co2EvitadoToneladas = Number((kwp * 1.2 * 0.7 * 0.43).toFixed(2));
  const arbolesEquivalentes = Math.round(co2EvitadoToneladas / 0.02);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * 117.6);

  return {
    consumoKwh, costoKwh: costoUnidad, wPromedioDia,
    kwp, potenciaPanel, capacidadInversor, radiacionSolar, radiacionSolarCobertura, margenCobertura,
    npaneles, ninversores, riel47, midCland, endCland, lFoot, groundingLoop, cableSolar,
    produccionDeEnergia, areaMinima, porcentajeCoberturaProyecto,
    costoProyecto, ivaProyecto, costoProyectoMasIva, costokwpproyecto,
    descuentoDeclaracion, ahorroMensual, ahorroAnual, ahorro10Anos, tiempoRetorno,
    co2EvitadoToneladas, arbolesEquivalentes, galonesGasolinaEvitados,
  };
}

export default function Resultado() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { resultado } = location.state || {};

  const [opcionSeleccionada, setOpcionSeleccionada] = useState(0);
  const [guardado, setGuardado] = useState(false);
  const [resultadoActivo, setResultadoActivo] = useState(() => resultado ?? {});
  const [pdfUrls, setPdfUrls] = useState(() => resultado ? [resultado.pdfUrl, null, null] : []);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [opciones, setOpciones] = useState(() => resultado ? [
    { label: "Opción A", kwp: String(resultado.kwp ?? ""), costokWp: "3500000" },
    { label: "Opción B", kwp: "", costokWp: "3500000" },
    { label: "Opción C", kwp: "", costokWp: "3500000" },
  ] : []);

  const calculos = opciones.map((op) =>
    op.kwp ? calcularLocal(op.kwp, resultado?.costoKwh, op.costokWp, resultado) : null
  );

  const actualizarOpcion = (idx, campo, valor) => {
    setOpciones((prev) => prev.map((op, i) => i === idx ? { ...op, [campo]: valor } : op));
    setGuardado(false);
  };

  const guardarOpciones = async () => {
    // Actualiza los valores visibles con la opción seleccionada
    const calc = calculos[opcionSeleccionada];
    if (calc) {
      setResultadoActivo({ ...resultado, ...calc });
    }

    // Guarda en backend
    if (resultado?.numeroCotizacion) {
      const token = localStorage.getItem('token');
      await fetch(`${process.env.REACT_APP_API_URL}/api/leads/${resultado.numeroCotizacion}/opciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ opciones: calculos.map((c, i) => ({ ...opciones[i], ...c, seleccionada: i === opcionSeleccionada })) }),
      });
    }
    setGuardado(true);
  };

  const descargarPDF = async () => {
    if (pdfUrls[opcionSeleccionada]) {
      const u = pdfUrls[opcionSeleccionada];
      window.open(u?.startsWith('http') ? u : `${process.env.REACT_APP_API_URL}${u}`, '_blank');
      return;
    }
    const calc = calculos[opcionSeleccionada];
    if (!calc) return;
    setGenerandoPdf(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/generar-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...resultado, ...calc, kwp: calc.kwp, consumoKwh: calc.consumoKwh, label: opciones[opcionSeleccionada].label }),
      });
      const data = await res.json();
      setPdfUrls((prev) => prev.map((u, i) => i === opcionSeleccionada ? data.pdfUrl : u));
      const u = data.pdfUrl;
      window.open(u?.startsWith('http') ? u : `${process.env.REACT_APP_API_URL}${u}`, '_blank');
    } catch (e) {
      alert('Error generando PDF');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const fechaPropuesta = useMemo(() => new Date().toLocaleDateString("es-CO"), []);

  const styles = {
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
      padding: "16px",
    },
    modalContent: {
      backgroundColor: "#fff",
      padding: "18px",
      borderRadius: "14px",
      maxWidth: "860px",
      width: "100%",
      boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
      maxHeight: "80vh",
      overflow: "auto",
    },
  };

  if (!resultado) {
    return (
      <div className="cotizador cotizador--light">
        <div className="cotizadorShell">
          <div className="cotCard">
            <div className="cotCardBody" style={{ textAlign: "center" }}>
              <h2 className="cotTitle" style={{ margin: 0 }}>No se encontraron datos</h2>
              <p style={{ opacity: 0.9 }}>Vuelve al formulario y genera una nueva cotización.</p>
              <button className="cotBtn cotBtnPrimary" onClick={() => navigate("/")}>
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const money = (v) =>
    typeof v === "number" ? v.toLocaleString("es-CO") : (v ?? "—");

  return (
    <div className="cotizador cotizador--light">
      <div className="cotizadorShell">
        {/* Header */}
        <header className="cotHeader">
          <img src={logo} alt="Logo Solartech" className="cotLogo" />

          <div className="cotHeaderText">
            <h1 className="cotTitle">Cotización N-{resultado.numeroCotizacion}</h1>
            <p className="cotSubtitle">Fecha de la propuesta: {fechaPropuesta}</p>
          </div>

          <div className="cotSteps">
            <span className="cotStep isActive">✓</span>
            <span className="cotStepLine" />
            <span className="cotStep isActive">✓</span>
          </div>
        </header>

        {/* Intro */}
        <div className="cotGrid">
          <section className="cotMain">
            <div className="cotCard">
              <div className="cotCardHead">
                <h2>Resumen</h2>
              </div>
              <div className="cotCardBody">
                <h3 className="title" style={{ marginTop: 0 }}>
                  Hola {resultado.nombre}! Aquí tienes el resultado de tu cotización:
                </h3>

                <p style={{ marginTop: 10, lineHeight: 1.6 }}>
                  En Solartech tenemos la mejor solución para ayudarte a ahorrar en tu factura de energía.
                  Los valores proporcionados son estimaciones basadas en los datos seleccionados y no deben
                  ser considerados como una cotización formal. <b>¡Ten en cuenta!</b> Si requieres más información,
                  ponte en contacto con un asesor.
                </p>

                <div className="cotActions" style={{ marginTop: 14 }}>
                  <button className="cotBtn cotBtnPrimary" onClick={descargarPDF} disabled={generandoPdf}>
                    {generandoPdf ? 'Generando PDF...' : `Descargar ${opciones[opcionSeleccionada]?.label ?? 'propuesta'} en PDF`}
                  </button>
                  <button className="cotBtn cotBtnGhost" onClick={() => navigate("/")}>
                    Volver al formulario
                  </button>
                </div>
              </div>
            </div>

            {/* ── COMPARADOR DE OPCIONES ── */}
            <Card
              title="Comparador de opciones"
              right={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {guardado && <span style={{ fontSize: '0.8rem', color: '#2ecc71' }}>✓ Guardado</span>}
                  <button className="cotBtn cotBtnGhost" style={{ padding: '4px 12px', fontSize: '0.82rem' }} onClick={guardarOpciones}>
                    Guardar cambios
                  </button>
                </div>
              }
            >
              <p style={{ margin: '0 0 14px', opacity: 0.8, fontSize: '0.85rem' }}>
                Edita el kWp y el costo por kWp de cada opción para comparar escenarios. Marca la opción a enviar al cliente.
              </p>

              {/* Inputs de cada opción */}
              <div className="opcionesGrid">
                {opciones.map((op, idx) => (
                  <div
                    key={idx}
                    onClick={() => op.kwp && setOpcionSeleccionada(idx)}
                    style={{
                      background: opcionSeleccionada === idx ? 'rgba(176,58,34,0.08)' : '#f8f9fa',
                      border: opcionSeleccionada === idx ? '1.5px solid #b03a22' : '1px solid #e0e0e0',
                      borderRadius: 10,
                      padding: '14px 12px',
                      cursor: op.kwp ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <b style={{ fontSize: '0.9rem', color: '#1a1a1a' }}>{op.label}</b>
                      {opcionSeleccionada === idx && (
                        <span style={{ background: '#b03a22', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                          PRINCIPAL
                        </span>
                      )}
                    </div>

                    <label style={{ fontSize: '0.75rem', color: '#5a5a5a', display: 'block', marginBottom: 4 }}>kWp del sistema</label>
                    <input
                      type="number"
                      value={op.kwp}
                      placeholder="Ej: 11"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => actualizarOpcion(idx, 'kwp', e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#fff', border: '1px solid #dedede',
                        borderRadius: 6, padding: '6px 10px', color: '#1a1a1a', fontSize: '0.9rem',
                        marginBottom: 8,
                      }}
                    />
                    <label style={{ fontSize: '0.75rem', color: '#5a5a5a', display: 'block', marginBottom: 4 }}>Costo base por kWp ($)</label>
                    <input
                      type="number"
                      value={op.costokWp}
                      placeholder="Ej: 3500000"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => actualizarOpcion(idx, 'costokWp', e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#fff', border: '1px solid #dedede',
                        borderRadius: 6, padding: '6px 10px', color: '#1a1a1a', fontSize: '0.9rem',
                      }}
                    />

                    {calculos[idx] ? (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <OpRow label="Consumo kWh/mes" value={`${calculos[idx].consumoKwh} kWh/mes`} accent />
                        <OpRow label="Paneles" value={calculos[idx].npaneles} />
                        <OpRow label="Inversores" value={calculos[idx].ninversores} />
                        <OpRow label="Producción" value={`${calculos[idx].produccionDeEnergia} kWh/mes`} />
                        <OpRow label="Área mínima" value={`${calculos[idx].areaMinima} m²`} />
                        <div style={{ borderTop: '1px solid #e0e0e0', margin: '4px 0' }} />
                        <OpRow label="Inversión + IVA" value={`$${calculos[idx].costoProyectoMasIva.toLocaleString('es-CO')}`} accent />
                        <OpRow label="Ahorro mensual" value={`$${calculos[idx].ahorroMensual.toLocaleString('es-CO')}`} />
                        <OpRow label="Retorno" value={`${calculos[idx].tiempoRetorno} años`} />
                      </div>
                    ) : (
                      <p style={{ margin: '12px 0 0', opacity: 0.4, fontSize: '0.8rem' }}>Ingresa el kWp para calcular</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Tabla comparativa */}
              {calculos.some(Boolean) && (
                <div className="tableWrap" style={{ marginTop: 4 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Métrica</th>
                        {opciones.map((op, i) => (
                          <th key={i} className="num" style={{ color: opcionSeleccionada === i ? '#b03a22' : undefined }}>
                            {op.label} {opcionSeleccionada === i ? '★' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'kWp', key: 'kwp' },
                        { label: 'Consumo kWh/mes (calc.)', key: 'consumoKwh' },
                        { label: 'N° Paneles', key: 'npaneles' },
                        { label: 'Inversión + IVA', key: 'costoProyectoMasIva', fmt: true },
                        { label: 'Ahorro mensual', key: 'ahorroMensual', fmt: true },
                        { label: 'Ahorro anual', key: 'ahorroAnual', fmt: true },
                        { label: 'Retorno (años)', key: 'tiempoRetorno' },
                      ].map(({ label, key, fmt }) => (
                        <tr key={key}>
                          <td>{label}</td>
                          {calculos.map((c, i) => (
                            <td key={i} className="num" style={{ color: opcionSeleccionada === i ? '#b03a22' : undefined }}>
                              {c ? (fmt ? `$${Number(c[key]).toLocaleString('es-CO')}` : c[key]) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* INFO INICIAL */}
            <Card title="Información inicial">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre" value={resultado.nombre} />
                <SummaryRow label="Correo" value={resultado.correo} />
                <SummaryRow label="Teléfono" value={resultado.telefono} />
                <SummaryRow label="Ubicación" value={resultado.ubicacion} />
                <SummaryRow label="Preferencia de contacto" value={resultado.preferenciaContacto} />
                <SummaryRow label="Tipo de solicitud" value={resultado.tipoSolicitud} />
                <SummaryRow label="Tipo de techo" value={resultado.tipoTecho} />
                <SummaryRow label="Recibe factura" value={resultado.recibeFactura} />
                <SummaryRow label="Sistema de interés" value={resultado.sistemaInteres} />
              </div>
            </Card>

            {/* TU SISTEMA SOLAR */}
            <Card title="Tu sistema solar">
              <div className="cotTwoCol">
                <Metric label="Potencia del sistema" value={`${resultadoActivo?.kwp ?? "—"} kWp`} />
                <Metric label="Consumo mensual" value={`${money(resultadoActivo?.consumoKwh)} kWh/mes`} />
                <Metric label="Producción mensual" value={`${money(resultadoActivo?.produccionDeEnergia)} kWh/mes`} />
                <Metric label="Consumo promedio día" value={`${money(resultadoActivo?.wPromedioDia)} W/día`} />
                <Metric label="Radiación promedio" value={`${resultadoActivo?.radiacionSolar ?? "—"}`} />
                <Metric label="Área disponible" value={`${money(resultadoActivo?.areaDisponible)} m²`} />
                <Metric label="Cobertura estimada" value={`${resultadoActivo?.porcentajeCoberturaProyecto ?? "—"}%`} />
                <Metric label="Área mínima requerida" value={`${resultadoActivo?.areaMinima ?? "—"} m²`} />
              </div>
            </Card>

            {/* FINANCIERO */}
            <Card title="Análisis financiero">
              <div className="cotTwoCol">
                <Metric label="Inversión estimada (con IVA)" value={`$ ${money(resultadoActivo?.costoProyectoMasIva)}`} />
                <Metric label="Ahorro anual estimado" value={`$ ${money(resultadoActivo?.ahorroAnual)}`} />
                <Metric label="Ahorro mensual estimado" value={`$ ${money(resultadoActivo?.ahorroMensual)}`} />
                <Metric label="Retorno de inversión" value={`${resultadoActivo?.tiempoRetorno ?? "—"} años`} />
                <Metric label="Vida útil estimada" value={`25 años`} />
                <Metric label="Descuento declaración de renta" value={`$ ${money(resultadoActivo?.descuentoDeclaracion)}`} />
                <Metric label="Ahorro proyectado a 10 años" value={`$ ${money(resultadoActivo?.ahorro10Anos)}`} />
                <Metric label="Valorización aproximada" value={`4–10%`} />
              </div>
            </Card>

            {/* PROPUESTA ECONÓMICA */}
            <Card
              title="Propuesta económica"
              right={
                <button
                  type="button"
                  className="cotBtn cotBtnGhost"
                  onClick={() => setMostrarModal(true)}
                >
                  Detalle de los equipos
                </button>
              }
            >
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Paneles {resultadoActivo.potenciaPanel}W</td><td className="num">{resultadoActivo.npaneles}</td></tr>
                    <tr><td>Inversor {resultadoActivo.capacidadInversor}W</td><td className="num">{resultadoActivo.ninversores}</td></tr>
                    <tr><td>Trámites ante operador de red</td><td className="num">1</td></tr>
                    <tr><td>Sistema de monitoreo</td><td className="num">1</td></tr>
                    <tr><td>Pólizas</td><td className="num">1</td></tr>
                    <tr><td>Servicio de instalación</td><td className="num">1</td></tr>
                    <tr><td>Beneficios tributarios</td><td className="num">1</td></tr>
                    <tr><td>Extras</td><td className="num">1</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="cotDivider" />

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Resumen inversión</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Inversión del proyecto solar</td><td className="num">$ {money(resultadoActivo.costoProyecto)}</td></tr>
                    <tr><td>IVA</td><td className="num">$ {money(resultadoActivo.ivaProyecto)}</td></tr>
                    <tr><td><b>Total inversión</b></td><td className="num"><b>$ {money(resultadoActivo.costoProyectoMasIva)}</b></td></tr>
                    <tr><td>$/kWp</td><td className="num"><b>$ {money(resultadoActivo.costokwpproyecto)}</b></td></tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* FORMAS DE PAGO */}
            <Card title="Formas de pago">
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hito</th>
                      <th className="num">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Anticipo</td><td className="num">50%</td></tr>
                    <tr><td>Entrega de materiales</td><td className="num">40%</td></tr>
                    <tr><td>RETIE</td><td className="num">10%</td></tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* IMPACTO AMBIENTAL */}
            <Card title="Impacto ambiental">
              <div className="cotTwoCol">
                <Metric label="CO₂ evitado al año" value={`${money(resultadoActivo?.arbolesEquivalentes)} toneladas`} isGreen />
                <Metric label="Equivalente en árboles sembrados" value={`${money(resultadoActivo?.galonesGasolinaEvitados)} árboles`} isGreen />
                <Metric label="Gasolina no consumida" value={`${resultadoActivo?.co2EvitadoToneladas ?? "—"} galones`} isGreen />
              </div>
            </Card>

            {/* ETAPAS */}
            <Card title="Etapas del proyecto">
              <div className="cotTwoCol">
                <MiniBlock
                  title="Etapa 1 — Planeación, diseño e importación"
                  lines={["1. Diagnóstico", "2. Diseño de la solución", "3. Gestión de trámites"]}
                  foot="30 días hábiles"
                />
                <MiniBlock
                  title="Etapa 2 — Construcción y puesta en marcha"
                  lines={["4. Instalación", "5. Puesta en marcha"]}
                  foot="90 días hábiles"
                />
                <MiniBlock
                  title="Etapa 3 — Operación"
                  lines={["6. Trámites y conexión a la red", "7. Monitoreo y mantenimiento"]}
                  foot="30 días hábiles"
                />
              </div>
            </Card>

            {/* GARANTÍAS */}
            <Card title="Garantías">
              <div className="cotTwoCol">
                <MiniBlock title="Paneles solares" lines={["15 años de producto", "30 años de generación"]} />
                <MiniBlock title="Inversores" lines={["10 años de producto"]} />
                <MiniBlock title="Estructuras" lines={["10 años de producto"]} />
              </div>
            </Card>

            {/* MARCAS */}
            <Card title="Marcas aliadas">
              <div className="marcasAliadas" style={{ marginTop: 10 }}>
                <img src="/logos/huawei.jpeg" alt="Huawei" style={{ width: 120, height: "auto" }} />
                <img src="/logos/logo_longi.png" alt="Longi" style={{ width: 120, height: "auto" }} />
                <img src="/logos/growatt.png" alt="Growatt" style={{ width: 120, height: "auto" }} />
                <img src="/logos/goodwe.jpeg" alt="Goodwe" style={{ width: 120, height: "auto" }} />
              </div>
            </Card>

            {/* CONDICIONES */}
            <Card title="Condiciones comerciales">
              <ol className="condicionesComerciales">
                <li>La cantidad de paneles e inversores podrá variar dependiendo de la potencia disponible.</li>
                <li>Con la aceptación se aceptan políticas de servicio post y garantías.</li>
                <li>Incluye viáticos y desplazamiento técnico hasta el lugar de instalación.</li>
                <li>Tiempo de entrega: 120 días a RETIE desde el primer pago.</li>
                <li>Repuestos/reparaciones solo por el tiempo restante de garantía vigente.</li>
                <li>Puede haber costos adicionales tras visita técnica.</li>
                <li>El sistema no opera durante interrupciones de la red (si aplica al tipo de sistema).</li>
                <li>Capacidad de techo: loza 50kg/m² y teja 15kg/m².</li>
                <li>
                  Garantías:
                  <ul>
                    <li>Paneles: 12 años</li>
                    <li>Inversores: 5 años</li>
                    <li>Instalación: 5 años</li>
                  </ul>
                  *(Sujeto a mantenimientos anuales con Solartech)*
                </li>
                <li>Legalización sujeta a CREG 174 de 2021 y resoluciones aplicables (cuando aplique).</li>
                <li>Los ahorros dependen de radiación, precio kWh y excedentes reconocidos por el OR.</li>
                <li>No incluye adecuación de frontera comercial; se define tras visita del OR.</li>
                <li>Validez de la oferta: 15 días calendario.</li>
              </ol>
            </Card>

            {/* CIERRE */}
            <Card title="Cierre">
              <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                ¡Muchas gracias! Estamos para atender tus dudas e inquietudes.
              </p>
              <p style={{ margin: 0 }}>
                <b>{[localStorage.getItem('nombreUsuario'), localStorage.getItem('apellidoUsuario')].filter(Boolean).join(' ')}</b>
              </p>
              <p style={{ margin: "6px 0 0", opacity: 0.9 }}>{localStorage.getItem('cargoUsuario') || 'Asesor Comercial'}</p>

              <div className="cotActions" style={{ marginTop: 14 }}>
                <button className="cotBtn cotBtnPrimary" onClick={descargarPDF} disabled={generandoPdf}>
                  {generandoPdf ? 'Generando PDF...' : `Descargar ${opciones[opcionSeleccionada]?.label ?? 'propuesta'} en PDF`}
                </button>
                <button className="cotBtn cotBtnGhost" onClick={() => navigate("/")}>
                  Volver al formulario
                </button>
              </div>
            </Card>
          </section>

          {/* Right: Side summary */}
          <aside className="cotSide">
            <Card title="Resumen rápido">
              <SummaryRow label="Cotización" value={`N-${resultado.numeroCotizacion}`} />
              <SummaryRow label="Cliente" value={resultado.nombre} />
              <SummaryRow label="Ciudad" value={resultado.ubicacion} />
              <div className="cotDivider" />
              <SummaryRow label="Potencia" value={`${resultadoActivo?.kwp ?? "—"} kWp`} />
              <SummaryRow label="Producción" value={`${money(resultadoActivo?.produccionDeEnergia)} kWh/mes`} />
              <SummaryRow label="Cobertura" value={`${resultadoActivo?.porcentajeCoberturaProyecto ?? "—"}%`} />
              <div className="cotDivider" />
              <SummaryRow label="Total inversión" value={`$ ${money(resultadoActivo?.costoProyectoMasIva)}`} />
              <SummaryRow label="Retorno" value={`${resultadoActivo?.tiempoRetorno ?? "—"} años`} />
              <SummaryRow label="Ahorro anual" value={`$ ${money(resultadoActivo?.ahorroAnual)}`} />
            </Card>

            <Card title="Acciones">
              <div className="cotActions" style={{ marginTop: 0 }}>
                <button className="cotBtn cotBtnPrimary" onClick={descargarPDF} disabled={generandoPdf} style={{ width: '100%' }}>
                  {generandoPdf ? 'Generando...' : `Descargar ${opciones[opcionSeleccionada]?.label ?? ''} PDF`}
                </button>
                <button className="cotBtn cotBtnGhost" onClick={() => navigate("/")}>
                  Nueva cotización
                </button>
              </div>
            </Card>
          </aside>
        </div>

        {/* MODAL DETALLE EQUIPOS */}
        {mostrarModal && (
          <div style={styles.modalOverlay} onClick={() => setMostrarModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 className="title" style={{ marginTop: 0 }}>Detalle de equipos</h3>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Equipo</th>
                      <th className="num">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Paneles {resultadoActivo.potenciaPanel}W</td><td className="num">{resultadoActivo.npaneles}</td></tr>
                    <tr><td>Inversores {resultadoActivo.capacidadInversor}W</td><td className="num">{resultadoActivo.ninversores}</td></tr>
                    <tr><td>Riel 47</td><td className="num">{resultadoActivo.riel47}</td></tr>
                    <tr><td>Mid Clamp</td><td className="num">{resultadoActivo.midCland}</td></tr>
                    <tr><td>End Clamp</td><td className="num">{resultadoActivo.endCland}</td></tr>
                    <tr><td>L-Foot</td><td className="num">{resultadoActivo.lFoot}</td></tr>
                    <tr><td>Grounding Loop</td><td className="num">{resultadoActivo.groundingLoop}</td></tr>
                    <tr><td>Cable solar</td><td className="num">{resultadoActivo.cableSolar}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="cotActions" style={{ marginTop: 14 }}>
                <button className="cotBtn cotBtnPrimary" onClick={() => setMostrarModal(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- mini componentes UI (mismo estilo del cotizador) ---------- */

function Card({ title, right, children }) {
  return (
    <div className="cotCard">
      <div className="cotCardHead">
        <h2>{title}</h2>
        {right}
      </div>
      <div className="cotCardBody">{children}</div>
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

function Metric({ label, value, isGreen }) {
  return (
    <div className="pgenerales" style={{ margin: 0 }}>
      <p className="pgeneralesDetalle" style={{ margin: 0 }}>
        <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>{label}</span>
        <b className={isGreen ? "resultadoGreen" : "resultado"} style={{ fontSize: 18 }}>
          {value}
        </b>
      </p>
    </div>
  );
}

function OpRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
      <span style={{ color: '#5a5a5a' }}>{label}</span>
      <b style={{ color: accent ? '#b03a22' : '#1a1a1a' }}>{value ?? '—'}</b>
    </div>
  );
}

function MiniBlock({ title, lines = [], foot }) {
  return (
    <div className="pgenerales" style={{ margin: 0, textAlign: "left" }}>
      <p className="pgeneralesDetalle" style={{ margin: 0, textAlign: "left" }}>
        <b className="resultado" style={{ display: "block", marginBottom: 6 }}>
          {title}
        </b>
        {lines.map((l, idx) => (
          <span key={idx} style={{ display: "block", opacity: 0.9 }}>{l}</span>
        ))}
        {foot ? <span style={{ display: "block", marginTop: 8 }}><b>{foot}</b></span> : null}
      </p>
    </div>
  );
}