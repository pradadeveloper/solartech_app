import { useParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import logo from "./assets/logo_solartech.webp";
import "./cotizadorSolar.css";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";

const API = process.env.REACT_APP_API_URL;

function calcularLocal(kwpInput, costoKwh, costokWpInput, base = {}) {
  let kwp = Number(kwpInput);
  const costoUnidad = Number(costoKwh);
  const costokWp = Number(costokWpInput) > 0 ? Number(costokWpInput) : 3500000;

  if (!kwp && Number(base.npaneles) > 0) {
    const potPanel = Number(base.potenciaPanel) || 585;
    kwp = Number(((Number(base.npaneles) * potPanel) / 1000).toFixed(1));
  }

  if (!kwp || !costoUnidad) return null;

  // Consumo real del cliente (factura original) — capturado antes de derivar el propio consumo
  const consumoRealFactura = Number(base.consumoKwh) || 0;

  const potenciaPanel   = Number(base.potenciaPanel)   || 585;
  const radiacionSolar  = Number(base.radiacionSolar)  || 3.8;
  const margenCobertura = Number(base.margenCobertura) || 0.8;
  const longitudRiel    = Number(base.longitudRiel)    || 4.7;
  const cableSolar      = Number(base.cableSolar)      || 10;

  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));
  const wPromedioDia = Number((kwp * radiacionSolarCobertura * 1000).toFixed(1));
  const consumo = Number(((wPromedioDia * 365) / (1000 * 12)).toFixed(1));
  const npaneles = Math.ceil((kwp * 1000) / potenciaPanel);
  const ninversores = 1;
  const riel47      = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland    = Math.ceil((npaneles * 2) - 2);
  const endCland    = Math.ceil(npaneles / 2);
  const lFoot       = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;
  const produccionDeEnergia = Math.round((potenciaPanel * npaneles * radiacionSolarCobertura * 30) / 1000);
  const areaMinima = Math.round(kwp * 5.8);

  // Cobertura de la factura energética: qué % del consumo real cubre el sistema
  const coberturaFactura = consumoRealFactura > 0
    ? Math.min(100, Number(((produccionDeEnergia / consumoRealFactura) * 100).toFixed(1)))
    : 0;

  const areaDisp = Number(base.areaDisponible ?? 0);
  let porcentajeCoberturaProyecto = 0;
  if (areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }
  const costoProyecto        = Math.round(kwp * costokWp);
  const ivaProyecto          = Math.round(costoProyecto * 0.05);
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto / 2);
  const facturaPromedio      = Math.round(consumo * costoUnidad);
  const ahorroMensual        = facturaPromedio;
  const ahorroAnual          = facturaPromedio * 12;
  const ahorro10Anos         = Math.round(ahorroAnual * 10);
  const tiempoRetorno        = facturaPromedio > 0 ? Number((costoProyectoMasIva / facturaPromedio / 12).toFixed(1)) : null;
  const co2EvitadoToneladas  = Number((kwp * 1.2 * 0.7 * 0.43).toFixed(2));
  const arbolesEquivalentes  = Math.round(co2EvitadoToneladas / 0.02);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * 117.6);

  return {
    kwp, consumoKwh: consumo, costoKwh: costoUnidad, consumo, wPromedioDia,
    npaneles, ninversores, riel47, midCland, endCland, lFoot, groundingLoop, cableSolar,
    produccionDeEnergia, areaMinima, porcentajeCoberturaProyecto, coberturaFactura,
    costoProyecto, ivaProyecto, costoProyectoMasIva, costokwpproyecto,
    descuentoDeclaracion, ahorroMensual, ahorroAnual, ahorro10Anos, tiempoRetorno,
    co2EvitadoToneladas, arbolesEquivalentes, galonesGasolinaEvitados,
    potenciaPanel, radiacionSolar,
  };
}

export default function PropuestaPublica() {
  const { num } = useParams();
  const [lead, setLead]         = useState(null);
  const [cfg, setCfg]           = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [copiado, setCopiado]   = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfUrlLocal, setPdfUrlLocal]   = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [baseLead, setBaseLead] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/propuesta/${num}`).then(r => r.json()),
      fetch(`${API}/api/config`).then(r => r.json()).catch(() => ({})),
    ]).then(([leadData, cfgData]) => {
      if (leadData.error) { setError(leadData.error); }
      else { setLead(leadData); }
      setCfg(cfgData);
      setLoading(false);
    }).catch(() => { setError('No se pudo cargar la propuesta.'); setLoading(false); });
  }, [num]);

  useEffect(() => {
    if (!String(num).includes('_')) return;
    const baseNum = String(num).split('_')[0];
    fetch(`${API}/api/propuesta/${baseNum}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setBaseLead(data); })
      .catch(() => {});
  }, [num]);

  const calc = useMemo(() => {
    if (!lead) return null;
    const storedCostokWp = lead.kwp > 0 && lead.costoProyectoMasIva > 0
      ? Math.round(lead.costoProyectoMasIva / (lead.kwp * 1.05))
      : (cfg.costokWp || 3500000);
    const costoKwh = lead.costoKwh ||
      (lead.ahorroMensual > 0 && lead.consumoKwh > 0
        ? Math.round(lead.ahorroMensual / lead.consumoKwh)
        : 0) ||
      cfg.costoKwh || 700;
    const consumoKwhBase = baseLead?.consumoKwh || lead.consumoKwh;
    return calcularLocal(lead.kwp, costoKwh, storedCostokWp, { ...cfg, ...lead, consumoKwh: consumoKwhBase });
  }, [lead, cfg, baseLead]);

  // Datos unificados: prioriza calc (fresco) sobre lead (almacenado)
  const r = useMemo(() => ({ ...lead, ...calc }), [lead, calc]);

  const money = (v) => typeof v === 'number' ? v.toLocaleString('es-CO') : (v ?? '—');

  const ahorroMensual        = r?.ahorroMensual  || 0;
  const ahorroAnual          = r?.ahorroAnual    || 0;
  const tiempoRetorno        = r?.tiempoRetorno  || null;
  const ahorro10Anos         = r?.ahorro10Anos   ?? (ahorroAnual > 0 ? ahorroAnual * 10 : null);
  const descuentoDeclaracion = r?.descuentoDeclaracion ??
    (lead?.costoProyectoMasIva > 0 ? Math.round((lead.costoProyectoMasIva / 1.05) * 0.5) : null);

  const descargarPdf = async () => {
    const url = pdfUrlLocal || lead?.pdfUrl;
    if (url) {
      window.open(url.startsWith('http') ? url : `${API}${url}`, '_blank');
      return;
    }
    if (!lead) return;
    setGenerandoPdf(true);
    try {
      const costoKwhFinal = calc?.costoKwh || lead.costoKwh ||
        (lead.ahorroMensual > 0 && lead.consumoKwh > 0
          ? Math.round(lead.ahorroMensual / lead.consumoKwh)
          : 0);
      const payload = {
        ...lead,
        ...calc,
        consumoKwh: calc?.consumoKwh || lead.consumoKwh,
        costoKwh: costoKwhFinal,
      };
      const res = await fetch(`${API}/api/generar-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.pdfUrl) {
        setPdfUrlLocal(data.pdfUrl);
        window.open(data.pdfUrl.startsWith('http') ? data.pdfUrl : `${API}${data.pdfUrl}`, '_blank');
      } else if (data.error) {
        alert(`No se pudo generar el PDF: ${data.error}`);
      }
    } catch (e) {
      alert('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const compartir = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="cotizador cotizador--light" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#5a5a5a' }}>Cargando propuesta…</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="cotizador cotizador--light" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cotCard" style={{ maxWidth: 400, textAlign: 'center' }}>
          <div className="cotCardBody">
            <h2 style={{ color: '#b03a22' }}>Propuesta no encontrada</h2>
            <p style={{ opacity: 0.7 }}>{error || 'El enlace puede estar vencido o ser incorrecto.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const fechaDisplay = lead.fecha
    ? new Date(lead.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="cotizador cotizador--light">
      <div className="cotizadorShell">

        {/* Header */}
        <header className="cotHeader">
          <img src={logo} alt="Solartech" className="cotLogo" />
          <div className="cotHeaderText">
            <h1 className="cotTitle">Cotización N-{lead.numeroCotizacion}</h1>
            <p className="cotSubtitle">Fecha de la propuesta: {fechaDisplay}</p>
          </div>
        </header>

        {/* Hero mobile */}
        <div className="mobileHero">
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Potencia</span>
            <span className="mobileHeroValue">{r?.kwp ?? '—'} kWp</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Inversión</span>
            <span className="mobileHeroValue">${money(r?.costoProyectoMasIva)}</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Retorno</span>
            <span className="mobileHeroValue">{tiempoRetorno ?? '—'} años</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Ahorro/mes</span>
            <span className="mobileHeroValue">${money(ahorroMensual)}</span>
          </div>
        </div>

        <div className="cotGrid">
          <section className="cotMain">

            {/* Resumen */}
            <div className="cotCard">
              <div className="cotCardHead"><h2>Resumen</h2></div>
              <div className="cotCardBody">
                <h3 className="title" style={{ marginTop: 0, color: '#b03a22' }}>
                  Hola {lead.nombre}! Aquí tienes el resultado de tu cotización:
                </h3>
                <p style={{ marginTop: 10, lineHeight: 1.6 }}>
                  En Solartech tenemos la mejor solución para ayudarte a ahorrar en tu factura de energía.
                  Los valores son estimaciones basadas en los datos seleccionados.{' '}
                  <b>¡Ten en cuenta!</b> Si requieres más información, ponte en contacto con tu asesor.
                </p>
                <div className="cotActions" style={{ marginTop: 14 }}>
                  <button className="cotBtn cotBtnPrimary" onClick={descargarPdf} disabled={generandoPdf}>
                    {generandoPdf ? 'Generando PDF...' : 'Descargar PDF'}
                  </button>
                  <button className="cotBtn cotBtnGhost" onClick={compartir}>
                    {copiado ? '¡Link copiado! ✓' : 'Compartir Link'}
                  </button>
                </div>
              </div>
            </div>

            {/* Datos del cliente */}
            <Card title="Información del cliente">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre"                  value={lead.nombre} />
                <SummaryRow label="Correo"                  value={lead.correo} />
                <SummaryRow label="Teléfono"                value={lead.telefono} />
                <SummaryRow label="Ciudad"                  value={lead.ubicacion} />
                <SummaryRow label="Preferencia contacto"    value={lead.preferenciaContacto} />
                <SummaryRow label="Tipo de solicitud"       value={lead.tipoSolicitud} />
                <SummaryRow label="Tipo de techo"           value={lead.tipoTecho} />
                <SummaryRow label="Sistema de interés"      value={lead.sistemaInteres} />
              </div>
            </Card>

            {/* Tu sistema solar */}
            <Card title="Tu sistema solar">
              <div className="cotTwoCol">
                <Metric label="Potencia del sistema"       value={`${r?.kwp ?? '—'} kWp`} />
                <Metric label="Consumo mensual"            value={`${money(r?.consumoKwh)} kWh/mes`} />
                <Metric label="Producción mensual"         value={`${money(r?.produccionDeEnergia)} kWh/mes`} />
                <Metric label="Consumo promedio día"       value={`${money(r?.wPromedioDia)} W/día`} />
                <Metric label="Radiación solar local"      value={`${r?.radiacionSolar ?? '—'} kWh/m²/día`} />
                <Metric label="Área disponible"            value={`${money(lead?.areaDisponible)} m²`} />
                <Metric label="Cobertura de factura"        value={`${r?.coberturaFactura ?? r?.porcentajeCoberturaProyecto ?? '—'}%`} />
                <Metric label="Área mínima requerida"      value={`${r?.areaMinima ?? '—'} m²`} />
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartSistemaSolar r={r} />
            </Card>

            {/* Análisis financiero */}
            <Card title="Análisis financiero">
              <div className="cotTwoCol">
                <Metric label="Inversión estimada (con IVA)"      value={`$ ${money(r?.costoProyectoMasIva)}`} />
                <Metric label="Ahorro mensual estimado"           value={`$ ${money(ahorroMensual)}`} />
                <Metric label="Ahorro anual estimado"             value={`$ ${money(ahorroAnual)}`} />
                <Metric label="Ahorro proyectado a 10 años"       value={`$ ${money(ahorro10Anos)}`} />
                <Metric label="Retorno de inversión"              value={`${tiempoRetorno ?? '—'} años`} />
                <Metric label="Descuento declaración de renta"    value={`$ ${money(descuentoDeclaracion)}`} />
                <Metric label="Vida útil estimada"                value="25 años" />
                <Metric label="Valorización aproximada"           value="4–10%" />
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartFinanciero r={r} />
            </Card>

            {/* Propuesta económica */}
            <Card
              title="Propuesta económica"
              right={
                <button type="button" className="cotBtn cotBtnGhost" onClick={() => setMostrarModal(true)}>
                  Detalle de equipos
                </button>
              }
            >
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Ítem</th><th>Cantidad</th></tr></thead>
                  <tbody>
                    <tr><td>Paneles {r?.potenciaPanel ?? calc?.potenciaPanel ?? cfg.potenciaPanel}W</td><td className="num">{r?.npaneles}</td></tr>
                    <tr><td>Capacidad aprox. Inversor {r?.kwp} kW</td><td className="num">1</td></tr>
                    <tr><td>Estructura (rieles, clamps, L-Foot, puesta a tierra)</td><td className="num">1</td></tr>
                    <tr><td>Cableado, protecciones eléctricas y fusibles</td><td className="num">1</td></tr>
                    <tr><td>Trámites ante operador de red</td><td className="num">1</td></tr>
                    <tr><td>Sistema de monitoreo</td><td className="num">1</td></tr>
                    <tr><td>Servicio de instalación y puesta en marcha</td><td className="num">1</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="cotDivider" />

              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Resumen inversión</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    <tr><td>Inversión del proyecto solar</td><td className="num">$ {money(r?.costoProyecto)}</td></tr>
                    <tr><td>IVA (5%)</td><td className="num">$ {money(r?.ivaProyecto)}</td></tr>
                    <tr><td><b>Total inversión</b></td><td className="num"><b>$ {money(r?.costoProyectoMasIva)}</b></td></tr>
                    <tr><td>$/kWp</td><td className="num"><b>$ {money(r?.costokwpproyecto)}</b></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartPropuesta r={r} />
            </Card>

            {/* Formas de pago */}
            <Card title="Formas de pago">
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Hito</th><th className="num">Porcentaje</th></tr></thead>
                  <tbody>
                    <tr><td>Anticipo</td><td className="num">50%</td></tr>
                    <tr><td>Entrega de materiales</td><td className="num">40%</td></tr>
                    <tr><td>RETIE</td><td className="num">10%</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartFormasPago r={r} />
            </Card>

            {/* Impacto ambiental */}
            <Card title="Impacto ambiental">
              <div className="cotTwoCol">
                <Metric label="CO₂ evitado al año"              value={`${r?.co2EvitadoToneladas ?? '—'} toneladas`} isGreen />
                <Metric label="Árboles equivalentes sembrados"  value={`${money(r?.arbolesEquivalentes)} árboles/año`} isGreen />
                <Metric label="Gasolina no consumida"           value={`${money(r?.galonesGasolinaEvitados)} galones/año`} isGreen />
              </div>
            </Card>

            {/* Etapas del proyecto */}
            <Card title="Etapas del proyecto">
              <div className="cotTwoCol">
                <MiniBlock title="Etapa 1 — Planeación, diseño e importación"
                  lines={['1. Diagnóstico', '2. Diseño de la solución', '3. Gestión de trámites']}
                  foot="30 días hábiles" />
                <MiniBlock title="Etapa 2 — Construcción y puesta en marcha"
                  lines={['4. Instalación', '5. Puesta en marcha']}
                  foot="90 días hábiles" />
                <MiniBlock title="Etapa 3 — Operación"
                  lines={['6. Trámites y conexión a la red', '7. Monitoreo y mantenimiento']}
                  foot="30 días hábiles" />
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartEtapas />
            </Card>

            {/* Garantías */}
            <Card title="Garantías">
              <div className="cotTwoCol">
                <MiniBlock title="Paneles solares"  lines={['12 años de garantía']} />
                <MiniBlock title="Inversores"       lines={['5 años de garantía']} />
                <MiniBlock title="Instalación"      lines={['5 años de garantía']} />
              </div>
            </Card>

            {/* Marcas aliadas */}
            <Card title="Marcas aliadas">
              <div className="marcasAliadas" style={{ marginTop: 10 }}>
                <img src="/logos/logo_longi.png" alt="Longi"  style={{ width: 110, height: 'auto' }} />
                <img src="/logos/huawei.jpeg"    alt="Huawei" style={{ width: 110, height: 'auto' }} />
                <img src="/logos/growatt.png"        alt="Growatt"  style={{ width: 110, height: 'auto' }} />
                <img src="/logos/goodwe.jpeg"        alt="Goodwe"   style={{ width: 110, height: 'auto' }} />
              </div>
            </Card>

            {/* Condiciones comerciales */}
            <Card title="Condiciones comerciales">
              <ol className="condicionesComerciales">
                <li>La cantidad de paneles e inversores podrá variar dependiendo de la potencia disponible.</li>
                <li>Con la aceptación se aceptan políticas de servicio post y garantías.</li>
                <li>Incluye viáticos y desplazamiento técnico hasta el lugar de instalación.</li>
                <li>Tiempo de entrega: 120 días a RETIE desde el primer pago.</li>
                <li>Repuestos/reparaciones solo por el tiempo restante de garantía vigente.</li>
                <li>Puede haber costos adicionales tras visita técnica.</li>
                <li>El sistema no opera durante interrupciones de la red (si aplica al tipo de sistema).</li>
                <li>Capacidad de techo: losa 50 kg/m² y teja 15 kg/m².</li>
                <li>Garantías: Paneles 12 años · Inversores 5 años · Instalación 5 años *(sujeto a mantenimientos anuales)*</li>
                <li>Legalización sujeta a CREG 174 de 2021 y resoluciones aplicables (cuando aplique).</li>
                <li>Los ahorros dependen de radiación, precio kWh y excedentes reconocidos por el OR.</li>
                <li>No incluye adecuación de frontera comercial; se define tras visita del OR.</li>
                <li>Validez de la oferta: 15 días calendario.</li>
              </ol>
            </Card>

            {/* Asesor comercial */}
            {lead.vendedor && (() => {
              const ai = lead.asesorInfo;
              const nombreCompleto = ai ? `${ai.nombre} ${ai.apellido}`.trim() : lead.vendedor;
              const cargo = ai?.cargo || 'Asesor Comercial';
              const initials = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
              return (
                <Card title="Tu asesor comercial">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#b03a22', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.3rem', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{nombreCompleto}</p>
                      <p style={{ margin: '2px 0 6px', fontSize: '0.82rem', opacity: 0.65 }}>{cargo} · Solartech Energy Systems</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
                        {ai?.celular && (
                          <a href={`https://wa.me/57${ai.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: '0.82rem', color: '#25d366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📱 {ai.celular}
                          </a>
                        )}
                        {ai?.correo && (
                          <a href={`mailto:${ai.correo}`}
                            style={{ fontSize: '0.82rem', color: '#b03a22', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✉ {ai.correo}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Cierre */}
            <Card title="Cierre">
              <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                ¡Muchas gracias por confiar en Solartech Energy Systems! Estamos para atender tus dudas e inquietudes.
              </p>
              <div className="cotActions" style={{ marginTop: 14 }}>
                <button className="cotBtn cotBtnPrimary" onClick={descargarPdf} disabled={generandoPdf}>
                  {generandoPdf ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
                <button className="cotBtn cotBtnGhost" onClick={compartir}>
                  {copiado ? '¡Link copiado! ✓' : 'Compartir Link'}
                </button>
              </div>
            </Card>

          </section>

          {/* Sidebar */}
          <aside className="cotSide">
            <Card title="Resumen rápido">
              <SummaryRow label="Cotización"    value={`N-${lead.numeroCotizacion}`} />
              <SummaryRow label="Cliente"       value={lead.nombre} />
              <SummaryRow label="Ciudad"        value={lead.ubicacion} />
              <div className="cotDivider" />
              <SummaryRow label="Potencia"      value={`${r?.kwp ?? '—'} kWp`} />
              <SummaryRow label="Producción"    value={`${money(r?.produccionDeEnergia)} kWh/mes`} />
              <SummaryRow label="Cobertura"     value={`${r?.coberturaFactura ?? r?.porcentajeCoberturaProyecto ?? '—'}%`} />
              <div className="cotDivider" />
              <SummaryRow label="Total inversión" value={`$ ${money(r?.costoProyectoMasIva)}`} />
              <SummaryRow label="Retorno"         value={`${tiempoRetorno ?? '—'} años`} />
              <SummaryRow label="Ahorro anual"    value={`$ ${money(ahorroAnual)}`} />
            </Card>

            <Card title="Acciones">
              <div className="cotActions" style={{ marginTop: 0 }}>
                <button className="cotBtn cotBtnPrimary" onClick={descargarPdf} disabled={generandoPdf} style={{ width: '100%' }}>
                  {generandoPdf ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
                <button className="cotBtn cotBtnGhost" onClick={compartir} style={{ width: '100%' }}>
                  {copiado ? '¡Copiado! ✓' : 'Compartir Link'}
                </button>
              </div>
            </Card>
          </aside>
        </div>

        {/* Modal detalle de equipos */}
        {mostrarModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}
            onClick={() => setMostrarModal(false)}
          >
            <div
              style={{ background: '#fff', padding: 18, borderRadius: 14, maxWidth: 860, width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.35)', maxHeight: '80vh', overflow: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="title" style={{ marginTop: 0 }}>Detalle de equipos</h3>
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Equipo</th><th className="num">Cantidad</th></tr></thead>
                  <tbody>
                    <tr><td>Paneles {r?.potenciaPanel}W</td><td className="num">{r?.npaneles}</td></tr>
                    <tr><td>Inversor {r?.kwp} kW</td><td className="num">1</td></tr>
                    <tr><td>Riel 47</td><td className="num">{r?.riel47}</td></tr>
                    <tr><td>Mid Clamp</td><td className="num">{r?.midCland}</td></tr>
                    <tr><td>End Clamp</td><td className="num">{r?.endCland}</td></tr>
                    <tr><td>L-Foot</td><td className="num">{r?.lFoot}</td></tr>
                    <tr><td>Grounding Loop</td><td className="num">{r?.groundingLoop}</td></tr>
                    <tr><td>Cable solar</td><td className="num">{r?.cableSolar} m</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="cotActions" style={{ marginTop: 14 }}>
                <button className="cotBtn cotBtnPrimary" onClick={() => setMostrarModal(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GRÁFICOS VISUALES
   ═══════════════════════════════════════════════════════════ */

const C1 = '#b03a22';
const C2 = '#e07060';
const C3 = '#f0a090';
const CGRAY = '#e8e8e8';

/* 1 ─── Sistema Solar: donut de cobertura + stats clave */
function ChartSistemaSolar({ r }) {
  const cobertura = Number(r?.coberturaFactura) || 0;
  const kwp       = Number(r?.kwp)       || 0;
  const paneles   = Number(r?.npaneles)  || 0;
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
        <ChartStat icon="☀️" label="Potencia"    value={`${kwp} kWp`} />
        <ChartStat icon="🔋" label="Producción"  value={`${produccion} kWh/mes`} />
        <ChartStat icon="📐" label="Paneles"     value={`${paneles} und`} />
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
            <linearGradient id="gradAhorroPub" x1="0" y1="0" x2="0" y2="1">
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
            fill="url(#gradAhorroPub)" strokeWidth={2.5} dot={false} />
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
    { icon: '📋', title: 'Planeación',   sub: 'Diagnóstico · Diseño · Trámites',  dias: '30 días', color: C1 },
    { icon: '🔧', title: 'Construcción', sub: 'Instalación · Puesta en marcha',    dias: '90 días', color: C2 },
    { icon: '⚡', title: 'Operación',    sub: 'Conexión a red · Monitoreo',         dias: '30 días', color: C3 },
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

/* Helpers de gráficos */
function ChartStat({ icon, label, value }) {
  return (
    <div className="chartStatItem">
      <span className="chartStatIcon">{icon}</span>
      <span className="chartStatLabel">{label}</span>
      <b className="chartStatValue">{value}</b>
    </div>
  );
}

/* Componentes UI */
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
      <span className="cotSummaryValue">{String(value ?? '—')}</span>
    </div>
  );
}

function Metric({ label, value, isGreen }) {
  return (
    <div className="pgenerales" style={{ margin: 0 }}>
      <p className="pgeneralesDetalle" style={{ margin: 0 }}>
        <span style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{label}</span>
        <b className={isGreen ? 'resultadoGreen' : 'resultado'} style={{ fontSize: 18 }}>{value}</b>
      </p>
    </div>
  );
}

function MiniBlock({ title, lines = [], foot }) {
  return (
    <div className="pgenerales" style={{ margin: 0, textAlign: 'left' }}>
      <p className="pgeneralesDetalle" style={{ margin: 0, textAlign: 'left' }}>
        <b className="resultado" style={{ display: 'block', marginBottom: 6 }}>{title}</b>
        {lines.map((l, i) => <span key={i} style={{ display: 'block', opacity: 0.9 }}>{l}</span>)}
        {foot && <span style={{ display: 'block', marginTop: 8 }}><b>{foot}</b></span>}
      </p>
    </div>
  );
}
