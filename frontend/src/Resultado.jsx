import { useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo_solartech.webp";
import { useMemo, useState, useEffect } from "react";
import "./cotizadorSolar.css"; // usa tu misma hoja
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";

// ── Replica las fórmulas del backend para calcular en el frontend ──
function calcularLocal(kwpInput, costoKwh, costokWpInput, base = {}) {
  const kwp = Number(kwpInput);
  const costoUnidad = Number(costoKwh);
  const costokWp = Number(costokWpInput) > 0 ? Number(costokWpInput) : 3500000;
  if (!kwp || !costoUnidad) return null;

  // Consumo real del cliente (factura original) — capturado antes de derivar el propio consumo
  const consumoRealFactura = Number(base.consumoKwh) || 0;

  const potenciaPanel = Number(base.potenciaPanel) || 585;
  const radiacionSolar = Number(base.radiacionSolar) || 3.8;
  const margenCobertura = Number(base.margenCobertura) || 0.8;
  const capacidadInversor = kwp; // 1 inversor dimensionado al sistema
  const longitudRiel = Number(base.longitudRiel) || 4.7;
  const cableSolar = Number(base.cableSolar) || 10;

  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));
  const wPromedioDia = Number((kwp * radiacionSolarCobertura * 1000).toFixed(1));
  const consumo = Number(((wPromedioDia * 365) / (1000 * 12)).toFixed(1));

  const npaneles = Math.ceil((kwp * 1000) / potenciaPanel);
  const ninversores = 1;
  const riel47 = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland = Math.ceil((npaneles * 2) - 2);
  const endCland = Math.ceil(npaneles / 2);
  const lFoot = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;
  const produccionDeEnergia = Math.round((potenciaPanel * npaneles * radiacionSolarCobertura * 30) / 1000);
  const areaMinima = Math.round(kwp * 5.8);

  // Cobertura de la factura energética: qué % del consumo real cubre el sistema
  const coberturaFactura = consumoRealFactura > 0
    ? Math.min(100, Number(((produccionDeEnergia / consumoRealFactura) * 100).toFixed(1)))
    : 0;

  // Cobertura por área disponible vs área mínima requerida
  const areaDisp = Number(base.areaDisponible ?? 0);
  let porcentajeCoberturaProyecto = 0;
  if (areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }

  const costoProyecto       = Math.round(kwp * costokWp);
  const ivaProyecto         = Math.round(costoProyecto * 0.05);
  const costoProyectoMasIva = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto    = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto / 2);
  // facturaPromedio = consumo × tarifa (lo que el cliente paga al mes)
  const facturaPromedio = Math.round(consumo * costoUnidad);
  const ahorroMensual   = facturaPromedio;
  const ahorroAnual     = facturaPromedio * 12;
  const consumoKwh      = consumo;
  const ahorro10Anos    = Math.round(ahorroAnual * 10);
  // Tiempo de retorno = Costo total (con IVA) / Factura mensual / 12 → AÑOS
  const tiempoRetorno = facturaPromedio > 0 ? Number((costoProyectoMasIva / facturaPromedio / 12).toFixed(1)) : null;

  // Ambiental
  const co2EvitadoToneladas = Number((kwp * 1.2 * 0.7 * 0.43).toFixed(2));
  const arbolesEquivalentes = Math.round(co2EvitadoToneladas / 0.02);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * 117.6);

  return {
    consumoKwh, costoKwh: costoUnidad, wPromedioDia,
    kwp, potenciaPanel, capacidadInversor, radiacionSolar, radiacionSolarCobertura, margenCobertura,
    npaneles, ninversores, riel47, midCland, endCland, lFoot, groundingLoop, cableSolar,
    produccionDeEnergia, areaMinima, porcentajeCoberturaProyecto, coberturaFactura,
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
  const [cfg, setCfg] = useState({});
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [versiones, setVersiones] = useState([]);
  const [guardandoVersion, setGuardandoVersion] = useState(null);
  const [linkVersionCopiado, setLinkVersionCopiado] = useState(null);
  const [generandoPdfVersion, setGenerandoPdfVersion] = useState(null);

  const compartirLink = () => {
    const url = `${window.location.origin}/propuesta/${resultado.numeroCotizacion}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    });
  };

  const [opciones, setOpciones] = useState(() => resultado ? [
    { label: "Opción A", kwp: String(resultado.kwp ?? ""), costokWp: "3500000" },
    { label: "Opción B", kwp: "", costokWp: "3500000" },
    { label: "Opción C", kwp: "", costokWp: "3500000" },
  ] : []);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/config`)
      .then((r) => r.json())
      .then((data) => {
        setCfg(data);
        if (data.costokWp) {
          setOpciones((prev) =>
            prev.map((op) => ({ ...op, costokWp: String(data.costokWp) }))
          );
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resultado?.numeroCotizacion) return;
    const token = localStorage.getItem('token');
    fetch(`${process.env.REACT_APP_API_URL}/api/leads/${resultado.numeroCotizacion}/versiones`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setVersiones(data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado?.numeroCotizacion]);

  const guardarVersion = async (idx) => {
    const calc = calculos[idx];
    if (!calc || !resultado?.numeroCotizacion) return;
    setGuardandoVersion(idx);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/leads/${resultado.numeroCotizacion}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...resultado, ...calc, costokWp: Number(opciones[idx].costokWp), label: opciones[idx].label }),
      });
      const data = await res.json();
      if (data.ok) {
        setVersiones(prev => [...prev, {
          ...resultado, ...calc,
          numeroCotizacion: data.versionId,
          label: opciones[idx].label,
          pdfUrl: '',
        }]);
      }
    } catch (e) {
      alert('Error guardando versión');
    } finally {
      setGuardandoVersion(null);
    }
  };

  const copiarLinkVersion = (vid) => {
    navigator.clipboard.writeText(`${window.location.origin}/propuesta/${vid}`).then(() => {
      setLinkVersionCopiado(vid);
      setTimeout(() => setLinkVersionCopiado(null), 2500);
    });
  };

  const descargarPdfVersion = async (ver, vidx) => {
    if (ver.pdfUrl) {
      window.open(ver.pdfUrl.startsWith('http') ? ver.pdfUrl : `${process.env.REACT_APP_API_URL}${ver.pdfUrl}`, '_blank');
      return;
    }
    setGenerandoPdfVersion(vidx);
    try {
      const token = localStorage.getItem('token');
      const costoKwhFinal = Number(ver.costoKwh) || resultado?.costoKwh ||
        (ver.ahorroMensual > 0 && ver.consumoKwh > 0
          ? Math.round(ver.ahorroMensual / ver.consumoKwh)
          : 0);
      const payload = {
        ...ver,
        consumoKwh: Number(ver.consumoKwh) || ver.consumoKwh,
        costoKwh: costoKwhFinal,
      };
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/generar-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.pdfUrl) {
        setVersiones(prev => prev.map((v, i) => i === vidx ? { ...v, pdfUrl: data.pdfUrl } : v));
        const u = data.pdfUrl;
        window.open(u?.startsWith('http') ? u : `${process.env.REACT_APP_API_URL}${u}`, '_blank');
      } else if (data.error) {
        alert(`No se pudo generar el PDF: ${data.error}`);
      }
    } catch (e) {
      alert('Error generando PDF');
    } finally {
      setGenerandoPdfVersion(null);
    }
  };

  const calculos = opciones.map((op) =>
    op.kwp ? calcularLocal(op.kwp, resultado?.costoKwh, op.costokWp, { ...resultado, ...cfg }) : null
  );

  // Datos live para los gráficos: opción activa seleccionada (kWp + costokWp en tiempo real)
  const chartData = calculos[opcionSeleccionada]
    ? { ...resultadoActivo, ...calculos[opcionSeleccionada] }
    : resultadoActivo;

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

        {/* Hero mobile: métricas clave visibles solo en pantallas pequeñas */}
        <div className="mobileHero">
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Potencia</span>
            <span className="mobileHeroValue">{resultadoActivo?.kwp ?? '—'} kWp</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Inversión</span>
            <span className="mobileHeroValue">${money(resultadoActivo?.costoProyectoMasIva)}</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Retorno</span>
            <span className="mobileHeroValue">{resultadoActivo?.tiempoRetorno ?? '—'} años</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Ahorro/mes</span>
            <span className="mobileHeroValue">${money(resultadoActivo?.ahorroMensual)}</span>
          </div>
        </div>

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
                  <button className="cotBtn cotBtnGhost" onClick={compartirLink}>
                    {linkCopiado ? '¡Link copiado! ✓' : 'Compartir Link'}
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
                        <OpRow label="Cobertura factura" value={`${calculos[idx].coberturaFactura}%`} accent />
                        <div style={{ borderTop: '1px solid #e0e0e0', margin: '4px 0' }} />
                        <OpRow label="Inversión + IVA" value={`$${calculos[idx].costoProyectoMasIva.toLocaleString('es-CO')}`} accent />
                        <OpRow label="Ahorro mensual" value={`$${calculos[idx].ahorroMensual.toLocaleString('es-CO')}`} />
                        <OpRow label="Retorno" value={`${calculos[idx].tiempoRetorno} años`} />
                        <button
                          className="cotBtn cotBtnGhost"
                          style={{ marginTop: 6, fontSize: '0.78rem', padding: '5px 0', width: '100%' }}
                          onClick={(e) => { e.stopPropagation(); guardarVersion(idx); }}
                          disabled={guardandoVersion === idx}
                        >
                          {guardandoVersion === idx ? 'Guardando...' : `+ Guardar ${op.label} como versión`}
                        </button>
                      </div>
                    ) : (
                      <p style={{ margin: '12px 0 0', opacity: 0.4, fontSize: '0.8rem' }}>Ingresa el kWp para calcular</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Tabla comparativa */}
              {calculos.some(Boolean) && (
                <div className="tableWrap comparadorTablaWrap" style={{ marginTop: 4 }}>
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
                <Metric label="Cobertura de factura" value={`${resultadoActivo?.coberturaFactura ?? resultadoActivo?.porcentajeCoberturaProyecto ?? "—"}%`} />
                <Metric label="Área mínima requerida" value={`${resultadoActivo?.areaMinima ?? "—"} m²`} />
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartSistemaSolar r={chartData} />
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
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartFinanciero r={chartData} />
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
                    <tr><td>Inversor {resultadoActivo.kwp} kW</td><td className="num">1</td></tr>
                    <tr><td>Estructura (rieles, clamps, L-Foot, puesta a tierra)</td><td className="num">1 kit</td></tr>
                    <tr><td>Cableado, protecciones eléctricas y fusibles</td><td className="num">1 kit</td></tr>
                    <tr><td>Trámites ante operador de red</td><td className="num">1</td></tr>
                    <tr><td>Sistema de monitoreo</td><td className="num">1</td></tr>
                    <tr><td>Servicio de instalación y puesta en marcha</td><td className="num">1</td></tr>
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
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartPropuesta r={chartData} />
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
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartFormasPago r={chartData} />
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
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartEtapas />
            </Card>

            {/* GARANTÍAS */}
            <Card title="Garantías">
              <div className="cotTwoCol">
                <MiniBlock title="Paneles solares" lines={["12 años de garantía"]} />
                <MiniBlock title="Inversores" lines={["5 años de garantía"]} />
                <MiniBlock title="Instalación" lines={["5 años de garantía"]} />
              </div>
            </Card>

            {/* MARCAS */}
            <Card title="Marcas aliadas">
              <div className="marcasAliadas" style={{ marginTop: 10 }}>
                <img src="/logos/logo_longi.png" alt="Longi" style={{ width: 110, height: "auto" }} />
                <img src="/logos/logo_ja_solar.jpg" alt="JA Solar" style={{ width: 110, height: "auto" }} />
                <img src="/logos/huawei.jpeg" alt="Huawei" style={{ width: 110, height: "auto" }} />
                <img src="/logos/growatt.png" alt="Growatt" style={{ width: 110, height: "auto" }} />
                <img src="/logos/goodwe.jpeg" alt="Goodwe" style={{ width: 110, height: "auto" }} />
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
                <li>Capacidad de techo: losa 50kg/m² y teja 15kg/m².</li>
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

            {/* ASESOR COMERCIAL */}
            <Card title="Tu asesor comercial">
              {(() => {
                const nombre = [localStorage.getItem('nombreUsuario'), localStorage.getItem('apellidoUsuario')].filter(Boolean).join(' ');
                const cargo = localStorage.getItem('cargoUsuario') || 'Asesor Comercial';
                const celular = localStorage.getItem('celularUsuario') || '';
                const correo = localStorage.getItem('correoUsuario') || '';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#b03a22', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
                      {nombre ? nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'A'}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{nombre || 'Asesor Comercial'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>{cargo}</p>
                      {celular && <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>📱 {celular}</p>}
                      {correo  && <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>✉ {correo}</p>}
                    </div>
                  </div>
                );
              })()}
            </Card>

            {/* CIERRE */}
            <Card title="Cierre">
              <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                ¡Muchas gracias! Estamos para atender tus dudas e inquietudes.
              </p>

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

            {versiones.length > 0 && (
              <Card title="Versiones guardadas">
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {versiones.map((ver, vidx) => (
                    <div key={vidx} style={{
                      padding: '10px 0',
                      borderBottom: vidx < versiones.length - 1 ? '1px solid #eee' : 'none',
                    }}>
                      <div style={{ marginBottom: 6 }}>
                        <b style={{ color: '#b03a22', fontSize: '0.9rem' }}>N-{ver.numeroCotizacion}</b>
                        {ver.label && <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: 6 }}>{ver.label}</span>}
                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 2 }}>
                          {ver.kwp} kWp · ${Number(ver.costoProyectoMasIva).toLocaleString('es-CO')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="cotBtn cotBtnGhost"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => copiarLinkVersion(ver.numeroCotizacion)}
                        >
                          {linkVersionCopiado === ver.numeroCotizacion ? '¡Copiado! ✓' : 'Copiar link'}
                        </button>
                        <button
                          className="cotBtn cotBtnPrimary"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => descargarPdfVersion(ver, vidx)}
                          disabled={generandoPdfVersion === vidx}
                        >
                          {generandoPdfVersion === vidx ? '...' : 'PDF'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Acciones">
              <div className="cotActions" style={{ marginTop: 0 }}>
                <button className="cotBtn cotBtnPrimary" onClick={descargarPDF} disabled={generandoPdf} style={{ width: '100%' }}>
                  {generandoPdf ? 'Generando...' : `Descargar ${opciones[opcionSeleccionada]?.label ?? ''} PDF`}
                </button>
                <button className="cotBtn cotBtnGhost" onClick={compartirLink} style={{ width: '100%' }}>
                  {linkCopiado ? '¡Copiado! ✓' : 'Compartir Link'}
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
                    <tr><td>Inversor {resultadoActivo.kwp} kW</td><td className="num">1</td></tr>
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

/* ═══════════════════════════════════════════════════════════
   GRÁFICOS VISUALES — solo mejora visual, sin tocar cálculos
   ═══════════════════════════════════════════════════════════ */

const C1 = '#b03a22';
const C2 = '#e07060';
const C3 = '#f0a090';
const CGRAY = '#e8e8e8';

/* 1 ─── Sistema Solar: donut de cobertura + stats clave */
function ChartSistemaSolar({ r }) {
  const cobertura = Number(r?.coberturaFactura) || 0;
  const kwp       = Number(r?.kwp) || 0;
  const paneles   = Number(r?.npaneles) || 0;
  const produccion= Number(r?.produccionDeEnergia) || 0;

  const donutData = [
    { name: 'Cobertura', value: cobertura > 0 ? cobertura : 100 },
    { name: 'Resto',     value: cobertura > 0 ? Math.max(0, 100 - cobertura) : 0 },
  ];

  return (
    <div className="chartBlock">
      <div className="chartDonutWrap">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%"
              innerRadius={52} outerRadius={78}
              startAngle={90} endAngle={-270}
              dataKey="value" strokeWidth={0}>
              <Cell fill={C1} />
              <Cell fill={CGRAY} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="chartDonutLabel">
          <span className="chartDonutValue">{cobertura > 0 ? `${cobertura}%` : `${kwp} kWp`}</span>
          <span className="chartDonutSub">{cobertura > 0 ? 'Cobertura Factura' : 'kWp'}</span>
        </div>
      </div>
      <div className="chartStatRow">
        <ChartStat icon="☀️" label="Potencia" value={`${kwp} kWp`} />
        <ChartStat icon="🔋" label="Producción" value={`${produccion} kWh/mes`} />
        <ChartStat icon="📐" label="Paneles" value={`${paneles} und`} />
      </div>
    </div>
  );
}

/* 2 ─── Análisis financiero: área de ahorro acumulado vs inversión */
function ChartFinanciero({ r }) {
  const ahorroAnual = Number(r?.ahorroAnual) || 0;
  const inversion   = Number(r?.costoProyectoMasIva) || 0;
  const retorno     = Number(r?.tiempoRetorno) || null;

  if (!ahorroAnual || !inversion) return null;

  const data = Array.from({ length: 26 }, (_, i) => ({
    año: i,
    'Ahorro acum.': ahorroAnual * i,
  }));

  const fmtM = (v) => `$${(v / 1_000_000).toFixed(1)}M`;

  return (
    <div className="chartBlock">
      <p className="chartTitle">Ahorro acumulado vs inversión (25 años — vida útil del proyecto)</p>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradAhorro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2ecc71" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2ecc71" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="año"
            type="number"
            domain={[0, 25]}
            ticks={[0, 5, 10, 15, 20, 25]}
            tickFormatter={(v) => `A${v}`}
            tick={{ fontSize: 10, fill: '#888' }}
          />
          <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: '#888' }} width={42} />
          <Tooltip
            formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, 'Ahorro acumulado']}
            labelFormatter={(l) => `Año ${l}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine y={inversion} stroke={C1} strokeDasharray="5 4"
            label={{ value: 'Inversión', position: 'insideTopRight', fontSize: 10, fill: C1 }} />
          <Area type="monotone" dataKey="Ahorro acum." stroke="#2ecc71"
            fill="url(#gradAhorro)" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      {retorno && (
        <p className="chartNote">
          Punto de retorno estimado: <b>año {retorno}</b>
        </p>
      )}
    </div>
  );
}

/* 3 ─── Propuesta económica: breakdown horizontal del costo */
function ChartPropuesta({ r }) {
  const base  = Number(r?.costoProyecto) || 0;
  const iva   = Number(r?.ivaProyecto)   || 0;
  const total = base + iva;
  if (!total) return null;

  const pBase = ((base / total) * 100).toFixed(1);
  const pIva  = ((iva  / total) * 100).toFixed(1);

  return (
    <div className="chartBlock">
      <p className="chartTitle">Composición del costo del proyecto</p>
      <div className="chartBreakBar">
        <div style={{ flex: base, background: C1, borderRadius: '8px 0 0 8px' }} />
        <div style={{ flex: iva,  background: C2, borderRadius: '0 8px 8px 0' }} />
      </div>
      <div className="chartBreakLegend">
        <ChartBreakItem color={C1} label="Inversión base" pct={`${pBase}%`}
          value={`$${base.toLocaleString('es-CO')}`} />
        <ChartBreakItem color={C2} label="IVA (5%)" pct={`${pIva}%`}
          value={`$${iva.toLocaleString('es-CO')}`} />
      </div>
    </div>
  );
}

function ChartBreakItem({ color, label, pct, value }) {
  return (
    <div className="chartBreakItem">
      <div className="chartBreakDot" style={{ background: color }} />
      <div>
        <div className="chartBreakLabel">{label} <b style={{ color }}>{pct}</b></div>
        <div className="chartBreakValue">{value}</div>
      </div>
    </div>
  );
}

/* 4 ─── Formas de pago: barra proporcional con montos */
function ChartFormasPago({ r }) {
  const total = Number(r?.costoProyectoMasIva) || 0;
  const hitos = [
    { label: 'Anticipo',           pct: 50, color: C1 },
    { label: 'Entrega materiales', pct: 40, color: C2 },
    { label: 'RETIE',              pct: 10, color: C3 },
  ];

  return (
    <div className="chartBlock">
      <p className="chartTitle">Distribución del pago</p>
      <div className="chartPayBar">
        {hitos.map((h, i) => (
          <div key={i} style={{ flex: h.pct, background: h.color,
            borderRadius: i === 0 ? '8px 0 0 8px' : i === hitos.length - 1 ? '0 8px 8px 0' : 0 }} />
        ))}
      </div>
      <div className="chartPayCards">
        {hitos.map((h, i) => (
          <div key={i} className="chartPayCard" style={{ borderTop: `3px solid ${h.color}` }}>
            <div className="chartPayPct" style={{ color: h.color }}>{h.pct}%</div>
            <div className="chartPayLabel">{h.label}</div>
            {total > 0 && (
              <div className="chartPayAmount">
                ${Math.round(total * h.pct / 100).toLocaleString('es-CO')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 5 ─── Etapas: timeline visual CSS */
function ChartEtapas() {
  const etapas = [
    { icon: '📋', title: 'Planeación',    sub: 'Diagnóstico · Diseño · Trámites',   dias: '30 días',  color: C1 },
    { icon: '🔧', title: 'Construcción',  sub: 'Instalación · Puesta en marcha',     dias: '90 días',  color: C2 },
    { icon: '⚡', title: 'Operación',     sub: 'Conexión a red · Monitoreo',          dias: '30 días',  color: C3 },
  ];

  return (
    <div className="chartBlock">
      <p className="chartTitle">Línea de tiempo del proyecto</p>
      <div className="chartTimeline">
        {etapas.map((e, i) => (
          <div key={i} className="chartTimelineStep">
            <div className="chartTimelineCircle" style={{ background: e.color }}>
              <span>{e.icon}</span>
            </div>
            {i < etapas.length - 1 && (
              <div className="chartTimelineConnector"
                style={{ background: `linear-gradient(90deg, ${e.color}, ${etapas[i+1].color})` }} />
            )}
            <div className="chartTimelineInfo">
              <b style={{ color: e.color }}>{e.title}</b>
              <span>{e.sub}</span>
              <span className="chartTimelineDias">{e.dias}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="chartTimelineTotal">
        Total estimado: <b>150 días hábiles</b>
      </div>
    </div>
  );
}

/* helpers reutilizables de los gráficos */
function ChartStat({ icon, label, value }) {
  return (
    <div className="chartStatItem">
      <span className="chartStatIcon">{icon}</span>
      <span className="chartStatLabel">{label}</span>
      <b className="chartStatValue">{value}</b>
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