import { useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo_solartech.webp";
import { useMemo, useState, useEffect, useRef } from "react";
import "./cotizadorSolar.css";
import "./propuestaPublica.css"; // homologa la visual con la propuesta pública
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine,
  BarChart, Bar, LineChart, Line, Legend,
} from "recharts";
import { CALC_DEFAULTS } from "./hooks/useCalculadora";

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FACTORES_MES = [0.85, 0.88, 0.92, 0.95, 0.97, 1.0, 1.02, 1.0, 0.97, 0.93, 0.88, 0.85];

const formatCOP = (v) => `$ ${Math.round(Number(v) || 0).toLocaleString('es-CO')} COP`;

// TIR (Newton-Raphson) — helper del simulador what-if, no toca calcularLocal.
function calcularTIRSimulador(flujos, guess = 0.1) {
  let tasa = guess;
  for (let i = 0; i < 1000; i++) {
    let vpn = 0, dvpn = 0;
    for (let t = 0; t < flujos.length; t++) {
      vpn += flujos[t] / Math.pow(1 + tasa, t);
      dvpn -= (t * flujos[t]) / Math.pow(1 + tasa, t + 1);
    }
    if (dvpn === 0) break;
    const nueva = tasa - vpn / dvpn;
    if (Math.abs(nueva - tasa) < 1e-7) return nueva;
    tasa = nueva;
  }
  return tasa;
}

/* ── Inline SVG icons — sin dependencias ── */
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

/* ── Metric icons (18px, stroke-based, inherit currentColor) ── */
const mkIcon = (children) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IconBolt    = mkIcon(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />);
const IconGauge   = mkIcon(<><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M13.4 12.6 19 7" /><path d="M6.34 17.66A8 8 0 1 1 20 12" /></>);
const IconActivity= mkIcon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const IconTrendUp = mkIcon(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>);
const IconClock   = mkIcon(<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>);
const IconMaximize= mkIcon(<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />);
const IconRuler   = mkIcon(<><path d="M3 8l13 13 5-5L8 3z" /><path d="M7 7l1.5 1.5M10 4l1.5 1.5M13 10l1.5 1.5M16 7l1.5 1.5" /></>);
const IconPie     = mkIcon(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>);
const IconWallet  = mkIcon(<><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></>);
const IconPiggy   = mkIcon(<><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h2.5l1-1.5h4l1 1.5H18v-3c1-.7 1.7-1.6 2-2.5h2v-4h-2c0-1-.5-1.5-1-2z" /><path d="M9 8h4" /><circle cx="16" cy="11" r="0.5" /></>);
const IconCoins   = mkIcon(<><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /></>);
const IconReceipt = mkIcon(<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" /><path d="M8 8h8M8 12h6" /></>);
const IconCalendar= mkIcon(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
const IconLeaf    = mkIcon(<><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></>);
const IconTree    = mkIcon(<><path d="M12 22v-7" /><path d="M9 8a3 3 0 0 1 0-6c1 0 1.7.4 2.2 1A3 3 0 0 1 16 5a3 3 0 0 1-1 5" /><path d="M12 15l-3.5-3.5a3 3 0 1 1 4.2-4.2" /><path d="M12 15l3.5-3.5a3 3 0 1 0-4.2-4.2" /></>);
const IconFuel    = mkIcon(<><path d="M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18" /><path d="M2 22h12" /><path d="M13 8h3l3 3v6a2 2 0 0 1-4 0v-4" /><path d="M6 6h4" /></>);

/* ═══ UX helpers: scroll-reveal + count-up (respetan reduced-motion) ═══ */
function useInView(rootMargin = '0px 0px -40px 0px') {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.unobserve(el); }
    }, { threshold: 0.1, rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return [ref, inView];
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

function CountUp({ value, prefix = '', suffix = '', money = false, className }) {
  const [ref, inView] = useInView();
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) { setDisplay(target); return; }
    let raf, start = null;
    const dur = 1100;
    const step = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);
  const dec = money ? 0 : (Number.isInteger(target) ? 0 : 1);
  const formatted = money
    ? Math.round(display).toLocaleString('es-CO')
    : display.toFixed(dec);
  return <span ref={ref} className={className}>{prefix}{formatted}{suffix}</span>;
}

// ── Replica las fórmulas del backend (formulas.js) para el comparador ──
// Las mismas fórmulas que el servidor: sin PR en generación, excedentes CREG, FLOOR en paneles.
function calcularLocal(kwpInput, costoKwh, costokWpInput, base = {}) {
  const kwp = Number(kwpInput);
  const costoUnidad = Number(costoKwh) || Number(base.costoKwh) || 0;
  const costokWp = Number(costokWpInput) > 0 ? Number(costokWpInput) : 4500000;
  if (!kwp || !costoUnidad) return null;

  const consumo              = Number(base.consumoKwh) || 0;
  const potenciaPanel        = Number(base.potenciaPanel) || 610;
  const radiacionSolar       = Number(base.radiacionSolar) || 3.8;
  const margenCobertura      = Number(base.margenCobertura) || 0.9;
  const sobredimension       = Number(base.sobredimension) || 0.30;
  const maxAC100kWp          = Number(base.maxAC100kWp) || 135;
  const longitudRiel         = Number(base.longitudRiel) || 4.7;
  const cableSolar           = Number(base.cableSolar) || 10;
  const contribucion         = base.contribucion || false;
  const ivaPct               = Number(base.ivaPct) || 5;
  const descuentoRentaPct    = Number(base.descuentoRentaPct) || 50;
  const costoGeneracion      = Number(base.costoGeneracion) || 330;
  const costoComercializacion= Number(base.costoComercializacion) || 120;
  const factorAreaM2PorKwp   = Number(base.factorAreaM2PorKwp) || 5.5;
  const factorCO2            = Number(base.factorCO2) || 0.3612;
  const factorArboles        = Number(base.factorArboles) || 0.02;
  const factorGalones        = Number(base.factorGalones) || 117.6;
  const inflacion            = Number(base.inflacion) || 0.08;

  // Misma fórmula que E7: FLOOR al panel entero
  const kWpPorPanel  = potenciaPanel / 1000;
  const npaneles     = Math.round(kwp / kWpPorPanel);

  // E8 — Potencia AC
  const potenciaAC   = Number((kwp / (1 + sobredimension)).toFixed(2));
  const ninversores  = potenciaAC <= 50 ? 1 : Math.ceil(potenciaAC / 50);        // E21

  const riel47       = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland     = Math.ceil((npaneles * 2) - 2);
  const endCland     = Math.ceil(npaneles / 2);
  const lFoot        = Math.ceil(riel47 * 3);
  const groundingLoop= Math.round(riel47 / 2) * 2;

  // E10 — Generación mensual sin PR (igual que formulas.js)
  const generacionMes      = Math.round(kwp * radiacionSolar * 365 / 12);
  const produccionDeEnergia= generacionMes;
  const areaMinima         = Math.round(kwp * factorAreaM2PorKwp);
  const wPromedioDia       = Math.round(kwp * radiacionSolar * 1000);
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(2));

  // Cobertura = generación / consumo real (misma métrica que backend)
  const porcentajeCoberturaProyecto = consumo > 0
    ? Math.min(100, Number(((generacionMes / consumo) * 100).toFixed(1)))
    : 0;

  // E25 — tarifa ajustada por contribución
  const costoKwhAjustado = contribucion ? costoUnidad * 1.2 : costoUnidad;
  // E11 — ratio gen/consumo
  const ratioGenConsumo  = consumo > 0 ? generacionMes / consumo : 0;

  // E12 — excedentes (igual que formulas.js)
  let excedentes;
  if (ratioGenConsumo <= 0.33) {
    excedentes = 0;
  } else if (ratioGenConsumo <= 1) {
    excedentes = (5 / 7) * ratioGenConsumo - (15 / 67);
  } else {
    excedentes = (0.5 * consumo + generacionMes - consumo) / generacionMes;
  }

  // E26 — precio venta excedentes
  const costoExcedentes = kwp > maxAC100kWp
    ? costoGeneracion
    : costoKwhAjustado - costoComercializacion;

  const ahorroMensual = Math.round(
    generacionMes * costoKwhAjustado * (1 - excedentes) +
    generacionMes * costoExcedentes  * excedentes
  );
  const ahorroAnual   = Math.round(ahorroMensual * 12);
  const ahorro10Anos  = Math.round(ahorroAnual * 10);

  const costoProyecto        = Math.round(kwp * costokWp);
  const ivaProyecto          = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));
  const valorKwp             = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  const tiempoRetorno = ahorroMensual > 0
    ? Number((costoProyectoMasIva / ahorroMensual / 12).toFixed(1))
    : null;

  const valorKwhAhorro = costoKwhAjustado;
  const valorKwhVenta  = costoExcedentes;
  const porcentajeAhorro = Number(((1 - excedentes) * 100).toFixed(1));
  const porcentajeVenta  = Number((excedentes * 100).toFixed(1));

  // TIR perspectiva cliente
  let tir5Anos = null, tir10Anos = null, tir15Anos = null;
  if (ahorroAnual > 0 && costoProyectoMasIva > 0) {
    const fl = [-costoProyectoMasIva];
    for (let i = 1; i <= 15; i++) fl.push(Math.round(ahorroAnual * Math.pow(1 + inflacion, i - 1)));
    const tir = (flujos) => {
      let tasa = 0.1;
      for (let it = 0; it < 1000; it++) {
        let vpn = 0, dvpn = 0;
        for (let t = 0; t < flujos.length; t++) {
          vpn  += flujos[t] / Math.pow(1 + tasa, t);
          dvpn -= t * flujos[t] / Math.pow(1 + tasa, t + 1);
        }
        if (!dvpn) break;
        const n = tasa - vpn / dvpn;
        if (Math.abs(n - tasa) < 1e-7) return n;
        tasa = n;
      }
      return tasa;
    };
    try { tir5Anos  = Number((tir(fl.slice(0, 6))  * 100).toFixed(1)); } catch(e) {}
    try { tir10Anos = Number((tir(fl.slice(0, 11)) * 100).toFixed(1)); } catch(e) {}
    try { tir15Anos = Number((tir(fl.slice(0, 16)) * 100).toFixed(1)); } catch(e) {}
  }

  const co2EvitadoToneladas     = Number((kwp * factorCO2).toFixed(2));
  const arbolesEquivalentes     = Math.round(co2EvitadoToneladas / factorArboles);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * factorGalones);

  return {
    consumoKwh: consumo, costoKwh: costoUnidad, wPromedioDia,
    kwp, potenciaPanel, potenciaAC, sobredimension,
    radiacionSolar, radiacionSolarCobertura, margenCobertura,
    npaneles, ninversores, riel47, midCland, endCland, lFoot, groundingLoop, cableSolar,
    produccionDeEnergia, generacionMes, areaMinima, porcentajeCoberturaProyecto,
    costoProyecto, ivaProyecto, costoProyectoMasIva, costokwpproyecto,
    descuentoDeclaracion, valorKwp,
    ahorroMensual, ahorroAnual, ahorro10Anos, tiempoRetorno,
    valorKwhAhorro, valorKwhVenta, porcentajeAhorro, porcentajeVenta,
    excedentes, ratioGenConsumo, costoExcedentes,
    tir5Anos, tir10Anos, tir15Anos,
    co2EvitadoToneladas, arbolesEquivalentes, galonesGasolinaEvitados,
  };
}

export default function Resultado() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resultado } = location.state || {};

  const [opcionSeleccionada, setOpcionSeleccionada] = useState(0);
  const [cfg, setCfg] = useState({});
  const [versiones, setVersiones] = useState([]);
  const [linkVersionCopiado, setLinkVersionCopiado] = useState(null);
  const [generandoPdfVersion, setGenerandoPdfVersion] = useState(null);
  const [guardandoPropuesta, setGuardandoPropuesta] = useState(null); // idx de la opción en progreso
  const [propuestaGuardada, setPropuestaGuardada] = useState(null);   // { propuestaId, pdfUrl, shareUrl }
  const [mostrarModal, setMostrarModal] = useState(false);

  // ── Simulador financiero what-if ──
  const [simTarifa, setSimTarifa] = useState(null);
  const [simHorizonte, setSimHorizonte] = useState(25);
  const [simInflacion, setSimInflacion] = useState(8);
  const [simDeduccionRenta, setSimDeduccionRenta] = useState(false);
  const [simDepreciacion, setSimDepreciacion] = useState(false);

  // ── Comparador: cada opción (A/B/C) tiene sus propias 6 variables editables ──
  const [opciones, setOpciones] = useState(() => {
    if (!resultado) return [];
    const base = {
      costokWp: String(resultado.costokwpproyecto || CALC_DEFAULTS.costokWp),
      consumoKwh: String(resultado.consumoKwh ?? ""),
      costoKwh: String(resultado.costoKwh ?? ""),
      areaM2: String(resultado.areaDisponible ?? ""),
      radiacion: String(resultado.radiacionSolar ?? CALC_DEFAULTS.radiacionSolar),
    };
    return [
      { label: "Opción A", kwp: String(resultado.kwp ?? ""), ...base },
      { label: "Opción B", kwp: "", ...base },
      { label: "Opción C", kwp: "", ...base },
    ];
  });

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/config`)
      .then((r) => r.json())
      .then((data) => {
        setCfg(data);
        if (data.costokWp) {
          setOpciones((prev) => prev.map((op) => ({ ...op, costokWp: String(data.costokWp) })));
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

  // Cada opción A/B/C se calcula con sus propias 6 variables editables:
  // kWp, costo base por kWp, consumo, costo kWh, área y radiación.
  const calculos = opciones.map((op) =>
    op.kwp ? calcularLocal(op.kwp, op.costoKwh, op.costokWp, {
      ...cfg, ...resultado,
      consumoKwh: op.consumoKwh,
      costoKwh: op.costoKwh,
      radiacionSolar: op.radiacion,
      areaDisponible: op.areaM2,
      contribucion: resultado?.contribucion,
    }) : null
  );

  // Toda la propuesta visible refleja la opción marcada como principal.
  const sel = calculos[opcionSeleccionada];
  const r = sel ? { ...resultado, ...sel } : (resultado ?? {});

  // Seed la tarifa del simulador con el costo kWh de la opción activa (una sola vez).
  useEffect(() => {
    if (simTarifa === null && Number(r?.costoKwh) > 0) setSimTarifa(Number(r.costoKwh));
  }, [simTarifa, r?.costoKwh]);

  const actualizarOpcion = (idx, campo, valor) => {
    setOpciones((prev) => prev.map((op, i) => i === idx ? { ...op, [campo]: valor } : op));
  };

  // Guarda la opción elegida como propuesta real y compartible (POST /api/propuestas/guardar).
  // ÚNICO punto donde se persiste en el back-end: solo al presionar "Guardar y compartir".
  const guardarYCompartir = async (idx) => {
    const calc = calculos[idx];
    if (!calc) return;
    setGuardandoPropuesta(idx);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/propuestas/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          leadId: resultado?.numeroCotizacion,
          opcionSeleccionada: opciones[idx].label,
          datosOpcion: { ...calc, costokWp: Number(opciones[idx].costokWp) },
          datosCliente: resultado,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'No se pudo guardar la propuesta'); return; }
      setOpcionSeleccionada(idx);
      setPropuestaGuardada({
        propuestaId: data.propuestaId,
        pdfUrl: data.pdfUrl,
        shareUrl: `${window.location.origin}/propuesta/${data.propuestaId}`,
      });
    } catch (e) {
      alert('Error guardando la propuesta');
    } finally {
      setGuardandoPropuesta(null);
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
        (ver.ahorroMensual > 0 && ver.consumoKwh > 0 ? Math.round(ver.ahorroMensual / ver.consumoKwh) : 0);
      const payload = { ...ver, consumoKwh: Number(ver.consumoKwh) || ver.consumoKwh, costoKwh: costoKwhFinal };
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

  // ── Simulador what-if: recalcula en vivo con los sliders/toggles ──
  const simulador = useMemo(() => {
    const consumoKwh = Number(r?.consumoKwh) || 0;
    const inversionTotal = Number(r?.costoProyectoMasIva) || 0;
    const inversionSinIva = Number(r?.costoProyecto) || 0;
    const tarifa = Number(simTarifa) || 0;
    const inflacion = Number(simInflacion) / 100;
    const horizonte = Number(simHorizonte) || 25;

    if (!consumoKwh || !inversionTotal || !tarifa) return null;

    const ahorroAnualBase = consumoKwh * 12 * tarifa;
    const beneficioRenta = simDeduccionRenta ? inversionSinIva * 0.25 * 0.35 : 0;
    const beneficioDepreciacion = simDepreciacion ? inversionSinIva * 0.20 * 5 : 0;
    const inversionNeta = Math.max(0, inversionTotal - beneficioRenta - beneficioDepreciacion);

    const payback = ahorroAnualBase > 0 ? Number((inversionNeta / ahorroAnualBase).toFixed(1)) : null;

    const flujos = [-inversionNeta];
    for (let i = 1; i <= horizonte; i++) flujos.push(ahorroAnualBase * Math.pow(1 + inflacion, i - 1));

    let tir = null;
    try { tir = Number((calcularTIRSimulador(flujos) * 100).toFixed(1)); } catch (e) {}

    const tasaDescuento = 0.10;
    const vpn = Math.round(flujos.reduce((acc, flujo, t) => acc + flujo / Math.pow(1 + tasaDescuento, t), 0));
    const ahorroTotalNominal = flujos.slice(1).reduce((a, b) => a + b, 0);
    const roi = inversionNeta > 0 ? Number((((ahorroTotalNominal - inversionNeta) / inversionNeta) * 100).toFixed(1)) : null;

    const cashflow = Array.from({ length: horizonte + 1 }, (_, N) => ({
      year: N,
      'Con solar': Math.round(-inversionTotal + ahorroAnualBase * N * Math.pow(1 + inflacion, N)),
      'Sin solar': Math.round(-(consumoKwh * 12 * tarifa * N * Math.pow(1 + inflacion, N))),
    }));

    return { inversionTotal, ahorroAnualBase, payback, tir, vpn, roi, cashflow };
  }, [r?.consumoKwh, r?.costoProyectoMasIva, r?.costoProyecto, simTarifa, simInflacion, simHorizonte, simDeduccionRenta, simDepreciacion]);

  const fechaDisplay = useMemo(() => new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }), []);

  if (!resultado) {
    return (
      <div className="cotizador cotizador--light pp-page">
        <div className="cotizadorShell">
          <div className="cotCard">
            <div className="cotCardBody" style={{ textAlign: "center" }}>
              <h2 className="cotTitle" style={{ margin: 0 }}>No se encontraron datos</h2>
              <p style={{ opacity: 0.9 }}>Vuelve al formulario y genera una nueva cotización.</p>
              <button className="pp-btn-primary" onClick={() => navigate("/")}>Volver al inicio</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const money = (v) => typeof v === "number" ? v.toLocaleString("es-CO") : (v ?? "—");

  return (
    <div className="cotizador cotizador--light pp-page">

      {/* ── Header sticky ── */}
      <header className="pp-header">
        <div className="pp-header-inner">
          <img src={logo} alt="Solartech" className="pp-logo" />
          <div className="pp-header-right">
            <span className="pp-quote-num">Cotización N-{resultado.numeroCotizacion}</span>
            <span className="pp-quote-date">{fechaDisplay}</span>
            <button className="pp-btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => navigate("/cliente")}>
              + Nueva cotización
            </button>
          </div>
        </div>
      </header>

      <div className="cotizadorShell">

        {/* ── Hero métricas (opción activa) ── */}
        <div className="pp-hero">
          <div className="pp-hero-metric">
            <span className="pp-hero-icon"><IconBolt /></span>
            {r?.kwp != null
              ? <CountUp className="pp-hero-value" value={r.kwp} suffix=" kWp" />
              : <span className="pp-hero-value">— kWp</span>}
            <span className="pp-hero-label">Potencia</span>
          </div>
          <div className="pp-hero-metric">
            <span className="pp-hero-icon"><IconWallet /></span>
            <CountUp className="pp-hero-value pp-hero-value--accent" value={r?.costoProyectoMasIva} prefix="$" money />
            <span className="pp-hero-label">Inversión total</span>
          </div>
          <div className="pp-hero-metric">
            <span className="pp-hero-icon"><IconClock /></span>
            {r?.tiempoRetorno != null
              ? <CountUp className="pp-hero-value" value={r.tiempoRetorno} suffix=" años" />
              : <span className="pp-hero-value">— años</span>}
            <span className="pp-hero-label">Retorno</span>
          </div>
          <div className="pp-hero-metric">
            <span className="pp-hero-icon"><IconPiggy /></span>
            <CountUp className="pp-hero-value" value={r?.ahorroMensual} prefix="$" money />
            <span className="pp-hero-label">Ahorro / mes</span>
          </div>
        </div>

        <div className="cotGrid">
          <section className="cotMain">

            {/* Bienvenida / contexto del asesor */}
            <Card title="Propuesta del cliente">
              <div className="pp-welcome-title">
                Cotización de <span className="pp-accent">{resultado.nombre}</span>
              </div>
              <div className="pp-welcome-body">
                Configura las opciones en el comparador de abajo. Toda la propuesta refleja la opción marcada
                como <b>principal</b>. Cuando tengas lista la opción a enviar, presiona
                <b> “Guardar y compartir”</b> — solo entonces se guarda en el sistema y se genera el PDF y el link del cliente.
              </div>
            </Card>

            {/* ── COMPARADOR DE OPCIONES ── */}
            <Card title="Comparador de opciones">
              <p className="pp-welcome-body" style={{ marginTop: 0 }}>
                Edita las variables de cada opción (kWp, costo por kWp, consumo, costo kWh, área y radiación).
                Marca la opción principal para reflejarla en toda la propuesta.
              </p>

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

                    <OpInput label="kWp del sistema" value={op.kwp} placeholder="Ej: 11" step="0.01" onChange={(v) => actualizarOpcion(idx, 'kwp', v)} />
                    <OpInput label="Costo base por kWp ($)" value={op.costokWp} placeholder="Ej: 4500000" onChange={(v) => actualizarOpcion(idx, 'costokWp', v)} />
                    <OpInput label="Consumo kWh/mes" value={op.consumoKwh} placeholder="Ej: 210" onChange={(v) => actualizarOpcion(idx, 'consumoKwh', v)} />
                    <OpInput label="Costo kWh (COP)" value={op.costoKwh} placeholder="Ej: 880" onChange={(v) => actualizarOpcion(idx, 'costoKwh', v)} />
                    <OpInput label="Área disponible (m²)" value={op.areaM2} placeholder="Ej: 247" onChange={(v) => actualizarOpcion(idx, 'areaM2', v)} />
                    <OpInput label="Radiación solar (kWh/m²/día)" value={op.radiacion} placeholder="Ej: 3.8" step="0.1" onChange={(v) => actualizarOpcion(idx, 'radiacion', v)} />

                    {calculos[idx] ? (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <OpRow label="Consumo real" value={`${calculos[idx].consumoKwh} kWh/mes`} />
                        <OpRow label="Producción" value={`${calculos[idx].generacionMes} kWh/mes`} accent />
                        <OpRow label="Cobertura factura" value={`${calculos[idx].porcentajeCoberturaProyecto}%`} accent />
                        <OpRow label="Paneles" value={calculos[idx].npaneles} />
                        <OpRow label="Inversores" value={calculos[idx].ninversores} />
                        <OpRow label="Área disponible" value={`${op.areaM2 || '—'} m²`} />
                        <OpRow label="Área mínima" value={`${calculos[idx].areaMinima} m²`} />
                        <div style={{ borderTop: '1px solid #e0e0e0', margin: '4px 0' }} />
                        <OpRow label="Inversión + IVA" value={`$${calculos[idx].costoProyectoMasIva.toLocaleString('es-CO')}`} accent />
                        <OpRow label="Ahorro mensual" value={`$${calculos[idx].ahorroMensual.toLocaleString('es-CO')}`} />
                        <OpRow label="Retorno" value={`${calculos[idx].tiempoRetorno} años`} />
                        <button
                          className="pp-btn-primary"
                          style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); guardarYCompartir(idx); }}
                          disabled={guardandoPropuesta === idx}
                        >
                          {guardandoPropuesta === idx ? 'Guardando…' : 'Guardar y compartir esta →'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ margin: '12px 0 0', opacity: 0.4, fontSize: '0.8rem' }}>Ingresa el kWp para calcular</p>
                    )}
                  </div>
                ))}
              </div>

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
                        { label: 'kWp instalado', key: 'kwp' },
                        { label: 'Consumo real', key: 'consumoKwh' },
                        { label: 'Costo kWh', key: 'costoKwh', fmt: true },
                        { label: 'Radiación solar', key: 'radiacionSolar' },
                        { label: 'Generación mensual', key: 'generacionMes' },
                        { label: 'Cobertura factura (%)', key: 'porcentajeCoberturaProyecto' },
                        { label: 'N° Paneles', key: 'npaneles' },
                        { label: 'Área mínima (m²)', key: 'areaMinima' },
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

            {/* Información del cliente */}
            <Card title="Información del cliente">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre"             value={resultado.nombre} />
                <SummaryRow label="Correo"             value={resultado.correo} />
                <SummaryRow label="Teléfono"           value={resultado.telefono} />
                <SummaryRow label="Ciudad"             value={resultado.ubicacion} />
                <SummaryRow label="Ciudad solar"       value={resultado.ciudadSolar ?? resultado.ubicacion} />
                <SummaryRow label="Tipo de solicitud"  value={resultado.tipoSolicitud} />
                <SummaryRow label="Tipo de techo"      value={resultado.tipoTecho} />
                <SummaryRow label="Sistema de interés" value={resultado.sistemaInteres} />
              </div>
            </Card>

            {/* Tu sistema solar */}
            <Card title="Tu sistema solar">
              <div className="pp-metrics-grid">
                <Metric icon={<IconBolt />}     label="Potencia del sistema"  value={`${r?.kwp ?? '—'} kWp`} />
                <Metric icon={<IconActivity />} label="Potencia AC inversor"  value={`${r?.potenciaAC ?? '—'} kW`} />
                <Metric icon={<IconPanel />}    label="N° paneles"            value={`${r?.npaneles ?? '—'} und`} />
                <Metric icon={<IconBattery />}  label="N° inversores"         value={`${r?.ninversores ?? '—'} und`} />
                <Metric icon={<IconGauge />}    label="Consumo mensual"       value={`${money(r?.consumoKwh)} kWh/mes`} />
                <Metric icon={<IconTrendUp />}  label="Producción mensual"    value={`${money(r?.produccionDeEnergia ?? r?.generacionMes)} kWh/mes`} />
                <Metric icon={<IconSun />}      label="Radiación solar local" value={`${r?.radiacionSolar ?? '—'} kWh/m²/día`} />
                <Metric icon={<IconMaximize />} label="Área disponible"       value={`${money(resultado?.areaDisponible)} m²`} />
                <Metric icon={<IconPie />}      label="Cobertura de factura"  value={`${r?.porcentajeCoberturaProyecto ?? '—'}%`} />
                <Metric icon={<IconRuler />}    label="Área mínima requerida" value={`${r?.areaMinima ?? '—'} m²`} />
              </div>
              <div className="pp-divider" />
              <ChartSistemaSolar r={r} />
            </Card>

            {/* Generación vs Consumo mensual */}
            <ChartGeneracionConsumo r={r} ciudad={resultado.ubicacion} />

            {/* Análisis financiero */}
            <Card title="Análisis financiero">
              <div className="pp-metrics-grid">
                <Metric icon={<IconWallet />}   label="Inversión estimada (con IVA)"   value={`$ ${money(r?.costoProyectoMasIva)}`} />
                <Metric icon={<IconCoins />}    label="$/kWp instalado"                value={`$ ${money(r?.valorKwp ?? r?.costokwpproyecto)}`} />
                <Metric icon={<IconPiggy />}    label="Ahorro mensual estimado"        value={`$ ${money(r?.ahorroMensual)}`} />
                <Metric icon={<IconCoins />}    label="Ahorro anual estimado"          value={`$ ${money(r?.ahorroAnual)}`} />
                <Metric icon={<IconTrendUp />}  label="Ahorro proyectado a 10 años"    value={`$ ${money(r?.ahorro10Anos)}`} />
                <Metric icon={<IconClock />}    label="Retorno de inversión"           value={`${r?.tiempoRetorno ?? '—'} años`} />
                <Metric icon={<IconActivity />} label="TIR a 10 años"                  value={`${r?.tir10Anos ?? '—'}%`} />
                <Metric icon={<IconActivity />} label="TIR a 15 años"                  value={`${r?.tir15Anos ?? '—'}%`} />
                <Metric icon={<IconPie />}      label="% Autoconsumo"                  value={`${r?.porcentajeAhorro ?? '—'}%`} />
                <Metric icon={<IconGauge />}    label="% Excedentes a la red"          value={`${r?.porcentajeVenta ?? '—'}%`} />
                <Metric icon={<IconReceipt />}  label="Descuento declaración de renta" value={`$ ${money(r?.descuentoDeclaracion)}`} />
                <Metric icon={<IconCalendar />} label="Vida útil estimada"             value="25 años" />
              </div>
              <div className="pp-divider" />
              <ChartFinanciero r={r} />
            </Card>

            {/* Simulador financiero what-if */}
            <SimuladorFinanciero
              simTarifa={simTarifa} setSimTarifa={setSimTarifa}
              simHorizonte={simHorizonte} setSimHorizonte={setSimHorizonte}
              simInflacion={simInflacion} setSimInflacion={setSimInflacion}
              simDeduccionRenta={simDeduccionRenta} setSimDeduccionRenta={setSimDeduccionRenta}
              simDepreciacion={simDepreciacion} setSimDepreciacion={setSimDepreciacion}
              simulador={simulador}
            />

            {/* El costo de no hacer nada */}
            <CostoNoHacerNada r={r} />

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
                    <tr><td>Paneles {r?.potenciaPanel}W</td><td className="num">{r?.npaneles}</td></tr>
                    <tr><td>Inversor {r?.potenciaAC != null ? `${r.potenciaAC} kW` : ''}</td><td className="num">{r?.ninversores}</td></tr>
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
                  <Metric icon={<IconLeaf />} label="CO₂ evitado al año"             value={`${r?.co2EvitadoToneladas ?? '—'} toneladas`} isGreen />
                  <Metric icon={<IconTree />} label="Árboles equivalentes sembrados" value={`${money(r?.arbolesEquivalentes)} árboles/año`} isGreen />
                  <Metric icon={<IconFuel />} label="Gasolina no consumida"          value={`${money(r?.galonesGasolinaEvitados)} galones/año`} isGreen />
                </div>
              </div>
            </Card>

            {/* Etapas del proyecto */}
            <Card title="Etapas del proyecto">
              <div className="pp-blocks-grid">
                <MiniBlock title="Etapa 1 — Planificación y diseño"
                  lines={['Visita técnica', 'Diseño de la solución', 'Firma del contrato']}
                  foot="30 días hábiles" />
                <MiniBlock title="Etapa 2 — Construcción"
                  lines={['Fabricación y entrega de equipos', 'Instalación fotovoltaica', 'Puesta en marcha']}
                  foot="90 días hábiles" />
                <MiniBlock title="Etapa 3 — Operación"
                  lines={['Conexión a la red', 'Capacitación y acompañamiento']}
                  foot="Continua" />
              </div>
              <div className="pp-divider" />
              <ChartEtapas />
            </Card>

            {/* Garantías */}
            <Card title="Garantías del sistema">
              <div className="pp-blocks-grid">
                <MiniBlock title="Paneles solares" lines={['12 años de garantía de producto']} />
                <MiniBlock title="Inversores"      lines={['5 años de garantía de fábrica']} />
                <MiniBlock title="Instalación"     lines={['5 años de garantía de mano de obra']} />
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

            {/* Tu asesor comercial */}
            {(() => {
              const nombre = [localStorage.getItem('nombreUsuario'), localStorage.getItem('apellidoUsuario')].filter(Boolean).join(' ') || resultado.vendedor || 'Asesor Comercial';
              const celular = localStorage.getItem('celularUsuario') || '';
              const correo = localStorage.getItem('correoUsuario') || '';
              const initials = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
              return (
                <Card title="Tu asesor comercial">
                  <div className="pp-advisor pp-advisor--signature">
                    <div className="pp-advisor-avatar">{initials}</div>
                    <div className="pp-advisor-info">
                      <p className="pp-advisor-name">{nombre}</p>
                      <p className="pp-advisor-role">Asesor Comercial — Solartech Energy S.A.S</p>
                      <div className="pp-advisor-contacts">
                        {celular && <span className="pp-advisor-link pp-advisor-link--wa">📱 {celular}</span>}
                        {correo  && <span className="pp-advisor-link pp-advisor-link--email">✉ {correo}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })()}

          </section>

          {/* ── Sidebar ── */}
          <aside className="cotSide pp-side">
            <Card title="Resumen rápido">
              <SummaryRow label="Cotización"    value={`N-${resultado.numeroCotizacion}`} />
              <SummaryRow label="Cliente"       value={resultado.nombre} />
              <SummaryRow label="Ciudad"        value={resultado.ubicacion} />
              <SummaryRow label="Opción activa" value={opciones[opcionSeleccionada]?.label ?? 'Opción A'} />
              <div className="pp-divider" style={{ margin: '4px 0' }} />
              <SummaryRow label="Potencia"    value={`${r?.kwp ?? '—'} kWp`} />
              <SummaryRow label="Producción"  value={`${money(r?.produccionDeEnergia ?? r?.generacionMes)} kWh/mes`} />
              <SummaryRow label="Cobertura"   value={`${r?.porcentajeCoberturaProyecto ?? '—'}%`} />
              <div className="pp-divider" style={{ margin: '4px 0' }} />
              <SummaryRow label="Total inversión" value={`$ ${money(r?.costoProyectoMasIva)}`} />
              <SummaryRow label="Retorno"         value={`${r?.tiempoRetorno ?? '—'} años`} />
              <SummaryRow label="Ahorro anual"    value={`$ ${money(r?.ahorroAnual)}`} />
              <div className="pp-divider" style={{ margin: '4px 0' }} />
              <SummaryRow label="CO₂ evitado/año"      value={`${r?.co2EvitadoToneladas ?? '—'} ton`} />
              <SummaryRow label="Árboles equivalentes" value={`${money(r?.arbolesEquivalentes)} árboles/año`} />
              <SummaryRow label="Vida útil sistema"    value="25 años garantizados" />
            </Card>

            <Card title="Acciones">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="pp-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => guardarYCompartir(opcionSeleccionada)} disabled={guardandoPropuesta !== null || !calculos[opcionSeleccionada]}>
                  {guardandoPropuesta !== null ? 'Guardando…' : 'Guardar y compartir opción activa'}
                </button>
                <button className="pp-btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate("/cliente")}>
                  + Nueva cotización
                </button>
              </div>
            </Card>

            {versiones.length > 0 && (
              <Card title="Versiones guardadas">
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {versiones.map((ver, vidx) => {
                    const cobVer = ver.porcentajeCoberturaProyecto > 0
                      ? ver.porcentajeCoberturaProyecto
                      : (resultado?.consumoKwh > 0 && ver.produccionDeEnergia > 0
                          ? Math.min(100, Number(((ver.produccionDeEnergia / resultado.consumoKwh) * 100).toFixed(1)))
                          : null);
                    return (
                      <div key={vidx} style={{ padding: '10px 0', borderBottom: vidx < versiones.length - 1 ? '1px solid #eee' : 'none' }}>
                        <div style={{ marginBottom: 6 }}>
                          <b style={{ color: '#b03a22', fontSize: '0.9rem' }}>N-{ver.numeroCotizacion}</b>
                          {ver.label && <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: 6 }}>{ver.label}</span>}
                          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 2 }}>
                            {ver.kwp} kWp · ${Number(ver.costoProyectoMasIva).toLocaleString('es-CO')}{cobVer !== null ? ` · ${cobVer}%` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="pp-btn-ghost" style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', justifyContent: 'center' }} onClick={() => copiarLinkVersion(ver.numeroCotizacion)}>
                            {linkVersionCopiado === ver.numeroCotizacion ? '¡Copiado! ✓' : 'Copiar link'}
                          </button>
                          <button className="pp-btn-primary" style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', justifyContent: 'center' }} onClick={() => descargarPdfVersion(ver, vidx)} disabled={generandoPdfVersion === vidx}>
                            {generandoPdfVersion === vidx ? '…' : 'PDF'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
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
                    <tr><td>Inversor {r?.potenciaAC != null ? `${r.potenciaAC} kW` : ''}</td><td className="num">{r?.ninversores}</td></tr>
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

        {/* ── Modal propuesta guardada ── */}
        {propuestaGuardada && (
          <PropuestaGuardadaModal
            data={propuestaGuardada}
            onClose={() => setPropuestaGuardada(null)}
            onVolverDashboard={() => navigate("/")}
          />
        )}

      </div>

      {/* CTA final */}
      <section className="pp-cta-final">
        <div className="pp-cta-inner">
          <h2 className="pp-cta-title">Configura y envía la propuesta</h2>
          <p className="pp-cta-subtitle">Ajusta las opciones en el comparador y guarda la elegida para generar el PDF y el link del cliente.</p>
          <div className="pp-cta-actions">
            <button className="pp-btn-outline-white" onClick={() => navigate('/cliente')}>+ Nueva cotización</button>
          </div>
        </div>
      </section>
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

/* 1 ─── Sistema Solar */
function ChartSistemaSolar({ r }) {
  const cobertura = Number(r?.porcentajeCoberturaProyecto) || 0;
  const kwp       = Number(r?.kwp)       || 0;
  const paneles   = Number(r?.npaneles)  || 0;
  const produccion= Number(r?.produccionDeEnergia ?? r?.generacionMes) || 0;

  const donutData = [
    { name: 'Cobertura', value: cobertura > 0 ? cobertura : 100 },
    { name: 'Resto',     value: cobertura > 0 ? Math.max(0, 100 - cobertura) : 0 },
  ];

  return (
    <div className="chartBlock">
      <div className="chartDonutWrap">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
              startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
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

  const data = Array.from({ length: 26 }, (_, i) => ({ año: i, 'Ahorro acum.': ahorroAnual * i }));
  const fmtM = (v) => `$${(v / 1_000_000).toFixed(1)}M`;

  return (
    <div className="chartBlock">
      <p className="chartTitle">Ahorro acumulado vs inversión (25 años — vida útil del proyecto)</p>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradAhorroRes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2ecc71" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2ecc71" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="año" type="number" domain={[0, 25]} ticks={[0, 5, 10, 15, 20, 25]}
            tickFormatter={(v) => `A${v}`} tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: '#888' }} width={42} />
          <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, 'Ahorro acumulado']}
            labelFormatter={(l) => `Año ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <ReferenceLine y={inversion} stroke={C1} strokeDasharray="5 4"
            label={{ value: 'Inversión', position: 'insideTopRight', fontSize: 10, fill: C1 }} />
          <Area type="monotone" dataKey="Ahorro acum." stroke="#2ecc71"
            fill="url(#gradAhorroRes)" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      {retorno && <p className="chartNote">Punto de retorno estimado: <b>año {retorno}</b></p>}
    </div>
  );
}

/* Generación vs Consumo mensual */
function ChartGeneracionConsumo({ r, ciudad }) {
  const consumo = Number(r?.consumoKwh) || 0;
  const generacionBase = Number(r?.produccionDeEnergia ?? r?.generacionMes) || 0;
  if (!consumo || !generacionBase) return null;

  const data = MESES.map((mes, i) => ({
    mes,
    Consumo: consumo,
    Generación: Math.round(generacionBase * FACTORES_MES[i]),
  }));

  return (
    <Card title="Generación mensual estimada vs Consumo">
      <p className="pp-chart-subtitle">Basado en radiación solar promedio de {ciudad || 'tu ciudad'}</p>
      <div className="pp-chart-responsive">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString('es-CO')} kWh`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Consumo" fill={C1} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Generación" fill="#2ecc71" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* Simulador financiero what-if */
function SimuladorFinanciero({
  simTarifa, setSimTarifa, simHorizonte, setSimHorizonte, simInflacion, setSimInflacion,
  simDeduccionRenta, setSimDeduccionRenta, simDepreciacion, setSimDepreciacion, simulador,
}) {
  if (simTarifa === null) return null;

  return (
    <Card title="Simulador financiero — ¿Qué pasa si...?">
      <div className="pp-sim-grid">
        <div className="pp-sim-controls">
          <div className="pp-slider-group">
            <div className="pp-slider-head">
              <span className="pp-slider-label">Tarifa energía (COP/kWh)</span>
              <span className="pp-slider-badge">${Number(simTarifa).toLocaleString('es-CO')} COP/kWh</span>
            </div>
            <input type="range" min={400} max={1500} step={50} value={simTarifa}
              onChange={(e) => setSimTarifa(Number(e.target.value))} className="pp-slider" />
          </div>

          <div className="pp-slider-group">
            <div className="pp-slider-head">
              <span className="pp-slider-label">Horizonte de evaluación</span>
              <span className="pp-slider-badge">{simHorizonte} años</span>
            </div>
            <input type="range" min={5} max={35} step={5} value={simHorizonte}
              onChange={(e) => setSimHorizonte(Number(e.target.value))} className="pp-slider" />
          </div>

          <div className="pp-slider-group">
            <div className="pp-slider-head">
              <span className="pp-slider-label">Inflación anual estimada</span>
              <span className="pp-slider-badge">{simInflacion}%</span>
            </div>
            <input type="range" min={0} max={15} step={0.5} value={simInflacion}
              onChange={(e) => setSimInflacion(Number(e.target.value))} className="pp-slider" />
          </div>

          <label className="pp-toggle-row">
            <div>
              <span className="pp-toggle-label">Deducción de renta</span>
              <span className="pp-toggle-sublabel">25% del valor sin IVA deducible de renta (Ley 1715, Art. 11) — ahorro ~11.5%</span>
            </div>
            <input type="checkbox" checked={simDeduccionRenta} onChange={(e) => setSimDeduccionRenta(e.target.checked)} />
          </label>

          <label className="pp-toggle-row">
            <div>
              <span className="pp-toggle-label">Depreciación acelerada</span>
              <span className="pp-toggle-sublabel">Deprecia en 5 años (Ley 1715, Art. 14) en vez de 20 años</span>
            </div>
            <input type="checkbox" checked={simDepreciacion} onChange={(e) => setSimDepreciacion(e.target.checked)} />
          </label>
        </div>

        <div className="pp-sim-chart">
          {simulador && (
            <div className="pp-chart-responsive">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulador.cashflow} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `A${v}`} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} width={44} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString('es-CO')}`} labelFormatter={(l) => `Año ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#888" strokeDasharray="4 4" label={{ value: 'Punto de equilibrio', position: 'insideBottomRight', fontSize: 10, fill: '#888' }} />
                  <Line type="monotone" dataKey="Con solar" stroke="#2ecc71" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Sin solar" stroke={C1} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {simulador && (
            <div className="pp-sim-results-grid">
              <Metric label="Inversión total" value={formatCOP(simulador.inversionTotal)} />
              <Metric label="Ahorro anual" value={formatCOP(simulador.ahorroAnualBase)} isGreen />
              <Metric label="Payback" value={`${simulador.payback ?? '—'} años`} />
              <Metric label="TIR" value={`${simulador.tir ?? '—'}%`} />
              <Metric label="VPN" value={formatCOP(simulador.vpn)} />
              <Metric label="ROI" value={`${simulador.roi ?? '—'}%`} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* El costo de no hacer nada */
function CostoNoHacerNada({ r }) {
  const consumo = Number(r?.consumoKwh) || 0;
  const costoKwh = Number(r?.costoKwh) || 0;
  const inversionTotal = Number(r?.costoProyectoMasIva) || 0;
  if (!consumo || !costoKwh || !inversionTotal) return null;

  const HORIZONTE = 5;                 // años
  const INCREMENTO_ANUAL = 0.08;       // alza promedio anual del kWh en Colombia
  const facturaMensual = consumo * costoKwh;
  const cobertura = (Number(r?.porcentajeCoberturaProyecto ?? r?.coberturaFactura) || 0) / 100;

  // Izquierda: lo que pagaría en facturas durante 5 años, indexado por el alza anual.
  let factorAcumulado = 0;
  for (let t = 0; t < HORIZONTE; t++) factorAcumulado += Math.pow(1 + INCREMENTO_ANUAL, t);
  const sinSolar = Math.round(facturaMensual * 12 * factorAcumulado);

  // Derecha: (factura × 12 meses × 5 años × %cobertura) − valor del proyecto.
  const conSolar = Math.round(facturaMensual * 12 * HORIZONTE * cobertura - inversionTotal);
  const enGanancia = conSolar >= 0;

  return (
    <Card title="El costo de no hacer nada">
      <p className="pp-chart-subtitle">
        Comparación a {HORIZONTE} años: lo que pagarías en facturas vs lo que te dejaría el sistema solar
      </p>
      <div className="pp-cost-grid">
        <div className="pp-cost-card pp-cost-card--red">
          <span className="pp-cost-icon">📈</span>
          <span className="pp-cost-label">Sin solar ({HORIZONTE} años)</span>
          <span className="pp-cost-value pp-cost-value--red">~ {formatCOP(sinSolar)}</span>
          <span className="pp-cost-sublabel">
            Pagados en facturas, con alza anual del {INCREMENTO_ANUAL * 100}%
          </span>
        </div>
        <div className="pp-cost-card pp-cost-card--green">
          <span className="pp-cost-icon">☀️</span>
          <span className="pp-cost-label">Con solar ({HORIZONTE} años)</span>
          <span className={`pp-cost-value ${enGanancia ? 'pp-cost-value--green' : 'pp-cost-value--red'}`}>
            {enGanancia ? '+' : '−'} {formatCOP(Math.abs(conSolar))}
          </span>
          <span className="pp-cost-sublabel">
            {enGanancia
              ? 'Ganancia neta acumulada después de la inversión'
              : `Pendiente por recuperar de la inversión a ${HORIZONTE} años`}
          </span>
        </div>
      </div>
    </Card>
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
        <ChartBreakItem color={C1} label="Inversión base" pct={`${pBase}%`} value={`$${base.toLocaleString('es-CO')}`} />
        <ChartBreakItem color={C2} label="IVA (5%)" pct={`${pIva}%`} value={`$${iva.toLocaleString('es-CO')}`} />
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
              <div className="chartPayAmount">${Math.round(total * h.pct / 100).toLocaleString('es-CO')}</div>
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
    { num: '1', title: 'Planificación', sub: 'Visita técnica · Diseño · Contrato',            dias: '30 días', color: C1 },
    { num: '2', title: 'Construcción',  sub: 'Fabricación · Instalación · Puesta en marcha',   dias: '90 días', color: C2 },
    { num: '3', title: 'Operación',     sub: 'Conexión a red · Acompañamiento',                dias: 'Continua', color: C3 },
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
      <div className="chartTimelineTotal">Total estimado: <b>120 días hábiles</b></div>
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
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className={`cotCard pp-reveal${inView ? ' pp-reveal--in' : ''}`}>
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

function Metric({ label, value, isGreen, icon }) {
  return (
    <div className={`pp-metric${isGreen ? ' pp-metric--green' : ''}${icon ? ' pp-metric--hasicon' : ''}`}>
      {icon && <span className="pp-metric-icon">{icon}</span>}
      <span className="pp-metric-text">
        <span className={`pp-metric-value${isGreen ? ' pp-metric-value--green' : ''}`}>{value}</span>
        <span className="pp-metric-label">{label}</span>
      </span>
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

/* Input editable de una variable dentro de la tarjeta de cada opción (A/B/C) */
function OpInput({ label, value, onChange, placeholder, step }) {
  return (
    <>
      <label style={{ fontSize: '0.75rem', color: '#5a5a5a', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#fff', border: '1px solid #dedede',
          borderRadius: 6, padding: '6px 10px', color: '#1a1a1a', fontSize: '0.9rem',
          marginBottom: 8,
        }}
      />
    </>
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

function PropuestaGuardadaModal({ data, onClose, onVolverDashboard }) {
  const [copiado, setCopiado] = useState(false);
  const { propuestaId, pdfUrl, shareUrl } = data;

  const copiarLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  const enviarWhatsApp = () => {
    const texto = `Hola, adjunto tu propuesta solar: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const abrirPdf = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl.startsWith('http') ? pdfUrl : `${process.env.REACT_APP_API_URL}${pdfUrl}`, '_blank');
  };

  return (
    <div className="pp-modal-overlay">
      <div className="pp-modal-body" style={{ position: 'relative', maxWidth: 440, textAlign: 'center' }}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          title="Cerrar"
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 30, height: 30, borderRadius: '50%',
            border: 'none', cursor: 'pointer',
            background: '#f1f1f1', color: '#5a5a5a',
            fontSize: 18, lineHeight: 1, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ margin: '0 0 4px', color: '#1a1a1a', fontSize: 20 }}>Propuesta guardada</h2>
        <p style={{ margin: '0 0 18px', color: '#5a5a5a', fontSize: 13 }}>
          ID: <b style={{ color: '#b03a22' }}>{propuestaId}</b>
        </p>

        <p style={{ margin: '0 0 8px', textAlign: 'left', color: '#5a5a5a', fontSize: 13 }}>
          Comparte este link con el cliente:
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input readOnly value={shareUrl} onFocus={(e) => e.target.select()}
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1px solid #dedede', fontSize: 12, color: '#1a1a1a', background: '#f8f9fa' }} />
          <button className="pp-btn-primary" onClick={copiarLink} style={{ whiteSpace: 'nowrap' }}>
            {copiado ? '¡Copiado! ✓' : 'Copiar'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="pp-btn-primary" onClick={abrirPdf} style={{ width: '100%', justifyContent: 'center' }}>
            📥 Descargar PDF
          </button>
          <button className="pp-btn-ghost" onClick={enviarWhatsApp} style={{ width: '100%', justifyContent: 'center' }}>
            💬 Enviar por WhatsApp
          </button>
          <button className="pp-btn-ghost" onClick={() => { onClose(); onVolverDashboard(); }} style={{ width: '100%', justifyContent: 'center' }}>
            ← Volver al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
