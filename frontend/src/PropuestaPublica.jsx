import { useParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import logo from "./assets/logo_solartech.webp";
import "./cotizadorSolar.css";
import "./propuestaPublica.css";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";

const API = process.env.REACT_APP_API_URL;

/* ── Inline SVG icons — no deps ── */
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconShare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const IconBattery = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/>
    <line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/>
  </svg>
);

const IconPanel = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
  </svg>
);

const IconWhatsApp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   CÁLCULO LOCAL — REGLA CERO: no modificar esta función
   ═══════════════════════════════════════════════════════════ */
function calcularLocal(kwpInput, costoKwh, costokWpInput, base = {}) {
  let kwp = Number(kwpInput);
  const costoUnidad = Number(costoKwh);
  const costokWp = Number(costokWpInput) > 0 ? Number(costokWpInput) : 3500000;

  if (!kwp && Number(base.npaneles) > 0) {
    const potPanel = Number(base.potenciaPanel) || 585;
    kwp = Number(((Number(base.npaneles) * potPanel) / 1000).toFixed(1));
  }

  if (!kwp || !costoUnidad) return null;

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
    // Primero busca en la pestaña "propuestas" (flujo nuevo: guardado explícito
    // desde /resultado). Si no existe, cae al endpoint viejo por compatibilidad
    // con links de "versiones" ya compartidos antes de este cambio.
    const buscarPropuesta = async () => {
      const res = await fetch(`${API}/api/propuestas/${num}`);
      if (res.ok) return res.json();
      return fetch(`${API}/api/propuesta/${num}`).then(r => r.json());
    };

    Promise.all([
      buscarPropuesta(),
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
      <div className="cotizador cotizador--light pp-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #DEDEDE', borderTopColor: '#B03A22', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#5A5A5A', margin: 0, fontSize: 14 }}>Cargando propuesta…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="cotizador cotizador--light pp-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #DEDEDE', borderRadius: 16, padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: 'rgba(176,58,34,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B03A22" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ color: '#1A1A1A', margin: '0 0 8px', fontSize: 18 }}>Propuesta no encontrada</h2>
          <p style={{ color: '#5A5A5A', margin: 0, fontSize: 14 }}>{error || 'El enlace puede estar vencido o ser incorrecto.'}</p>
        </div>
      </div>
    );
  }

  const fechaDisplay = lead.fecha
    ? new Date(lead.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="cotizador cotizador--light pp-page">

      {/* ── Header sticky ── */}
      <header className="pp-header">
        <div className="pp-header-inner">
          <img src={logo} alt="Solartech" className="pp-logo" />
          <div className="pp-header-right">
            <span className="pp-quote-num">Cotización N-{lead.numeroCotizacion}</span>
            <span className="pp-quote-date">{fechaDisplay}</span>
          </div>
        </div>
      </header>

      <div className="cotizadorShell">

        {/* ── Hero métricas ── */}
        <div className="pp-hero">
          <div className="pp-hero-metric">
            <span className="pp-hero-value">{r?.kwp ?? '—'} kWp</span>
            <span className="pp-hero-label">Potencia</span>
          </div>
          <div className="pp-hero-metric">
            <span className="pp-hero-value pp-hero-value--accent">${money(r?.costoProyectoMasIva)}</span>
            <span className="pp-hero-label">Inversión total</span>
          </div>
          <div className="pp-hero-metric">
            <span className="pp-hero-value">{tiempoRetorno ?? '—'} años</span>
            <span className="pp-hero-label">Retorno</span>
          </div>
          <div className="pp-hero-metric">
            <span className="pp-hero-value">${money(ahorroMensual)}</span>
            <span className="pp-hero-label">Ahorro / mes</span>
          </div>
        </div>

        <div className="cotGrid">
          <section className="cotMain">

            {/* Bienvenida */}
            <Card title="Propuesta personalizada">
              <div className="pp-welcome-title">
                Sistema solar para <span className="pp-accent">{lead.nombre}</span>
              </div>
              <div className="pp-welcome-body">
                Te presentamos tu cotización personalizada basada en los datos ingresados.
                Los valores son estimativos y tu asesor los ajustará según la visita técnica.
              </div>
              <div className="cotActions">
                <button className="pp-btn-primary" onClick={descargarPdf} disabled={generandoPdf}>
                  <IconDownload />{generandoPdf ? 'Generando…' : 'Descargar PDF'}
                </button>
                <button className="pp-btn-ghost" onClick={compartir}>
                  <IconShare />{copiado ? 'Link copiado ✓' : 'Compartir link'}
                </button>
              </div>
            </Card>

            {/* Información del cliente */}
            <Card title="Información del cliente">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre"               value={lead.nombre} />
                <SummaryRow label="Correo"               value={lead.correo} />
                <SummaryRow label="Teléfono"             value={lead.telefono} />
                <SummaryRow label="Ciudad"               value={lead.ubicacion} />
                <SummaryRow label="Preferencia contacto" value={lead.preferenciaContacto} />
                <SummaryRow label="Tipo de solicitud"    value={lead.tipoSolicitud} />
                <SummaryRow label="Tipo de techo"        value={lead.tipoTecho} />
                <SummaryRow label="Sistema de interés"   value={lead.sistemaInteres} />
              </div>
            </Card>

            {/* Tu sistema solar */}
            <Card title="Tu sistema solar">
              <div className="pp-metrics-grid">
                <Metric label="Potencia del sistema"   value={`${r?.kwp ?? '—'} kWp`} />
                <Metric label="Consumo mensual"        value={`${money(r?.consumoKwh)} kWh/mes`} />
                <Metric label="Producción mensual"     value={`${money(r?.produccionDeEnergia)} kWh/mes`} />
                <Metric label="Consumo promedio día"   value={`${money(r?.wPromedioDia)} W/día`} />
                <Metric label="Radiación solar local"  value={`${r?.radiacionSolar ?? '—'} kWh/m²/día`} />
                <Metric label="Área disponible"        value={`${money(lead?.areaDisponible)} m²`} />
                <Metric label="Cobertura de factura"   value={`${r?.coberturaFactura ?? r?.porcentajeCoberturaProyecto ?? '—'}%`} />
                <Metric label="Área mínima requerida"  value={`${r?.areaMinima ?? '—'} m²`} />
              </div>
              <div className="pp-divider" />
              <ChartSistemaSolar r={r} />
            </Card>

            {/* Análisis financiero */}
            <Card title="Análisis financiero">
              <div className="pp-metrics-grid">
                <Metric label="Inversión estimada (con IVA)"   value={`$ ${money(r?.costoProyectoMasIva)}`} />
                <Metric label="Ahorro mensual estimado"        value={`$ ${money(ahorroMensual)}`} />
                <Metric label="Ahorro anual estimado"          value={`$ ${money(ahorroAnual)}`} />
                <Metric label="Ahorro proyectado a 10 años"    value={`$ ${money(ahorro10Anos)}`} />
                <Metric label="Retorno de inversión"           value={`${tiempoRetorno ?? '—'} años`} />
                <Metric label="Descuento declaración de renta" value={`$ ${money(descuentoDeclaracion)}`} />
                <Metric label="Vida útil estimada"             value="25 años" />
                <Metric label="Valorización aproximada"        value="4 – 10%" />
              </div>
              <div className="pp-divider" />
              <ChartFinanciero r={r} />
            </Card>

            {/* Propuesta económica */}
            <Card
              title="Propuesta económica"
              right={
                <button type="button" className="pp-btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setMostrarModal(true)}>
                  Ver detalle de equipos
                </button>
              }
            >
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Ítem incluido</th><th className="num">Cant.</th></tr></thead>
                  <tbody>
                    <tr><td>Paneles {r?.potenciaPanel ?? calc?.potenciaPanel ?? cfg.potenciaPanel}W</td><td className="num">{r?.npaneles}</td></tr>
                    <tr><td>Inversor {r?.kwp} kW</td><td className="num">1</td></tr>
                    <tr><td>Estructura (rieles, clamps, L-Foot, puesta a tierra)</td><td className="num">1</td></tr>
                    <tr><td>Cableado, protecciones eléctricas y fusibles</td><td className="num">1</td></tr>
                    <tr><td>Trámites ante operador de red</td><td className="num">1</td></tr>
                    <tr><td>Sistema de monitoreo</td><td className="num">1</td></tr>
                    <tr><td>Instalación y puesta en marcha</td><td className="num">1</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pp-divider" />

              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Resumen de inversión</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    <tr><td>Inversión del proyecto solar</td><td className="num">$ {money(r?.costoProyecto)}</td></tr>
                    <tr><td>IVA (5%)</td><td className="num">$ {money(r?.ivaProyecto)}</td></tr>
                    <tr className="pp-table-total"><td><b>Total inversión</b></td><td className="num"><b>$ {money(r?.costoProyectoMasIva)}</b></td></tr>
                    <tr><td>Costo por kWp</td><td className="num">$ {money(r?.costokwpproyecto)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="pp-divider" />
              <ChartPropuesta r={r} />
            </Card>

            {/* Formas de pago */}
            <Card title="Formas de pago">
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Hito de pago</th><th className="num">Porcentaje</th></tr></thead>
                  <tbody>
                    <tr><td>Anticipo</td><td className="num">50%</td></tr>
                    <tr><td>Entrega de materiales</td><td className="num">40%</td></tr>
                    <tr><td>RETIE</td><td className="num">10%</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="pp-divider" />
              <ChartFormasPago r={r} />
            </Card>

            {/* Impacto ambiental */}
            <Card title="Impacto ambiental">
              <div className="pp-env-wrap">
                <div className="pp-metrics-grid">
                  <Metric label="CO₂ evitado al año"             value={`${r?.co2EvitadoToneladas ?? '—'} toneladas`} isGreen />
                  <Metric label="Árboles equivalentes sembrados" value={`${money(r?.arbolesEquivalentes)} árboles/año`} isGreen />
                  <Metric label="Gasolina no consumida"          value={`${money(r?.galonesGasolinaEvitados)} galones/año`} isGreen />
                </div>
              </div>
            </Card>

            {/* Etapas del proyecto */}
            <Card title="Etapas del proyecto">
              <div className="pp-blocks-grid">
                <MiniBlock title="Etapa 1 — Planeación y diseño"
                  lines={['Diagnóstico técnico', 'Diseño de la solución', 'Gestión de trámites']}
                  foot="30 días hábiles" />
                <MiniBlock title="Etapa 2 — Construcción"
                  lines={['Instalación del sistema', 'Puesta en marcha']}
                  foot="90 días hábiles" />
                <MiniBlock title="Etapa 3 — Operación"
                  lines={['Conexión a la red', 'Monitoreo y mantenimiento']}
                  foot="30 días hábiles" />
              </div>
              <div className="pp-divider" />
              <ChartEtapas />
            </Card>

            {/* Garantías */}
            <Card title="Garantías del sistema">
              <div className="pp-blocks-grid">
                <MiniBlock title="Paneles solares"  lines={['12 años de garantía de producto']} />
                <MiniBlock title="Inversores"       lines={['5 años de garantía de fábrica']} />
                <MiniBlock title="Instalación"      lines={['5 años de garantía de mano de obra']} />
              </div>
            </Card>

            {/* Marcas aliadas */}
            <Card title="Marcas aliadas">
              <div className="pp-brands">
                <img src="/logos/logo_longi.png" alt="Longi" />
                <img src="/logos/huawei.jpeg"    alt="Huawei" />
                <img src="/logos/growatt.png"    alt="Growatt" />
                <img src="/logos/goodwe.jpeg"    alt="Goodwe" />
              </div>
            </Card>

            {/* Condiciones comerciales */}
            <Card title="Condiciones comerciales">
              <ol className="condicionesComerciales">
                <li>La cantidad de paneles e inversores podrá variar dependiendo de la potencia disponible.</li>
                <li>Con la aceptación se aceptan políticas de servicio post y garantías.</li>
                <li>Incluye viáticos y desplazamiento técnico hasta el lugar de instalación.</li>
                <li>Tiempo de entrega: 120 días a RETIE desde el primer pago.</li>
                <li>Repuestos / reparaciones solo por el tiempo restante de garantía vigente.</li>
                <li>Puede haber costos adicionales tras visita técnica.</li>
                <li>El sistema no opera durante interrupciones de la red (si aplica al tipo de sistema).</li>
                <li>Capacidad de techo: losa 50 kg/m² y teja 15 kg/m².</li>
                <li>Garantías: Paneles 12 años · Inversores 5 años · Instalación 5 años *(sujeto a mantenimientos anuales)*</li>
                <li>Legalización sujeta a CREG 174 de 2021 y resoluciones aplicables.</li>
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
                  <div className="pp-advisor">
                    <div className="pp-advisor-avatar">{initials}</div>
                    <div className="pp-advisor-info">
                      <p className="pp-advisor-name">{nombreCompleto}</p>
                      <p className="pp-advisor-role">{cargo} · Solartech Energy Systems</p>
                      <div className="pp-advisor-contacts">
                        {ai?.celular && (
                          <a href={`https://wa.me/57${ai.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                            className="pp-advisor-link pp-advisor-link--wa">
                            <IconWhatsApp />{ai.celular}
                          </a>
                        )}
                        {ai?.correo && (
                          <a href={`mailto:${ai.correo}`} className="pp-advisor-link pp-advisor-link--email">
                            <IconMail />{ai.correo}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Cierre */}
            <Card title="Gracias por tu confianza">
              <div className="pp-closing-text">
                En Solartech Energy Systems estamos comprometidos con brindarte la mejor solución solar.
                No dudes en contactar a tu asesor para resolver cualquier duda.
              </div>
              <div className="cotActions">
                <button className="pp-btn-primary" onClick={descargarPdf} disabled={generandoPdf}>
                  <IconDownload />{generandoPdf ? 'Generando…' : 'Descargar PDF'}
                </button>
                <button className="pp-btn-ghost" onClick={compartir}>
                  <IconShare />{copiado ? 'Link copiado ✓' : 'Compartir link'}
                </button>
              </div>
            </Card>

          </section>

          {/* ── Sidebar ── */}
          <aside className="cotSide pp-side">
            <Card title="Resumen rápido">
              <SummaryRow label="Cotización"    value={`N-${lead.numeroCotizacion}`} />
              <SummaryRow label="Cliente"       value={lead.nombre} />
              <SummaryRow label="Ciudad"        value={lead.ubicacion} />
              <div className="pp-divider" style={{ margin: '4px 0' }} />
              <SummaryRow label="Potencia"      value={`${r?.kwp ?? '—'} kWp`} />
              <SummaryRow label="Producción"    value={`${money(r?.produccionDeEnergia)} kWh/mes`} />
              <SummaryRow label="Cobertura"     value={`${r?.coberturaFactura ?? r?.porcentajeCoberturaProyecto ?? '—'}%`} />
              <div className="pp-divider" style={{ margin: '4px 0' }} />
              <SummaryRow label="Total inversión" value={`$ ${money(r?.costoProyectoMasIva)}`} />
              <SummaryRow label="Retorno"         value={`${tiempoRetorno ?? '—'} años`} />
              <SummaryRow label="Ahorro anual"    value={`$ ${money(ahorroAnual)}`} />
            </Card>

            <Card title="Acciones">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="pp-btn-primary" onClick={descargarPdf} disabled={generandoPdf} style={{ width: '100%', justifyContent: 'center' }}>
                  <IconDownload />{generandoPdf ? 'Generando…' : 'Descargar PDF'}
                </button>
                <button className="pp-btn-ghost" onClick={compartir} style={{ width: '100%', justifyContent: 'center' }}>
                  <IconShare />{copiado ? 'Copiado ✓' : 'Compartir link'}
                </button>
              </div>
            </Card>
          </aside>
        </div>

        {/* ── Modal detalle de equipos ── */}
        {mostrarModal && (
          <div className="pp-modal-overlay" onClick={() => setMostrarModal(false)}>
            <div className="pp-modal-body" onClick={e => e.stopPropagation()}>
              <h3 className="pp-modal-title">Detalle de equipos</h3>
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
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="pp-btn-primary" onClick={() => setMostrarModal(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GRÁFICOS VISUALES — lógica intacta, solo presentación
   ═══════════════════════════════════════════════════════════ */

const C1 = '#b03a22';
const C2 = '#e07060';
const C3 = '#f0a090';
const CGRAY = '#e8e8e8';

/* 1 ─── Sistema Solar */
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
        <ChartStat icon={<IconSun />}     label="Potencia"   value={`${kwp} kWp`} />
        <ChartStat icon={<IconBattery />} label="Producción" value={`${produccion} kWh/mes`} />
        <ChartStat icon={<IconPanel />}   label="Paneles"    value={`${paneles} und`} />
      </div>
    </div>
  );
}

/* 2 ─── Análisis financiero */
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

/* 3 ─── Propuesta económica */
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

/* 4 ─── Formas de pago */
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

/* 5 ─── Etapas del proyecto */
function ChartEtapas() {
  const etapas = [
    { num: '1', title: 'Planeación',   sub: 'Diagnóstico · Diseño · Trámites', dias: '30 días', color: C1 },
    { num: '2', title: 'Construcción', sub: 'Instalación · Puesta en marcha',   dias: '90 días', color: C2 },
    { num: '3', title: 'Operación',    sub: 'Conexión a red · Monitoreo',        dias: '30 días', color: C3 },
  ];

  return (
    <div className="chartBlock">
      <p className="chartTitle">Línea de tiempo del proyecto</p>
      <div className="chartTimeline">
        {etapas.map((e, i) => (
          <div key={i} className="chartTimelineStep">
            <div className="chartTimelineCircle" style={{ background: e.color }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', lineHeight: 1 }}>{e.num}</span>
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

/* ── Chart helpers ── */
function ChartStat({ icon, label, value }) {
  return (
    <div className="chartStatItem">
      <span className="chartStatIcon">{icon}</span>
      <span className="chartStatLabel">{label}</span>
      <b className="chartStatValue">{value}</b>
    </div>
  );
}

/* ── UI Components ── */
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
    <div className="pp-summary-row">
      <span className="pp-summary-label">{label}</span>
      <span className="pp-summary-value">{String(value ?? '—')}</span>
    </div>
  );
}

function Metric({ label, value, isGreen }) {
  return (
    <div className="pp-metric">
      <span className={`pp-metric-value${isGreen ? ' pp-metric-value--green' : ''}`}>{value}</span>
      <span className="pp-metric-label">{label}</span>
    </div>
  );
}

function MiniBlock({ title, lines = [], foot }) {
  return (
    <div className="pp-block">
      <p className="pp-block-title">{title}</p>
      <ul className="pp-block-lines">
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      {foot && <span className="pp-block-foot">{foot}</span>}
    </div>
  );
}
