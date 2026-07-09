import { useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo_solartech.webp";
import { useMemo, useState, useEffect } from "react";
import "./cotizadorSolar.css"; // usa tu misma hoja
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { CALC_DEFAULTS } from "./hooks/useCalculadora";

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
  const [guardado, setGuardado] = useState(false);
  const [resultadoActivo, setResultadoActivo] = useState(() => resultado ?? {});
  const [cfg, setCfg] = useState({});
  const [versiones, setVersiones] = useState([]);
  const [linkVersionCopiado, setLinkVersionCopiado] = useState(null);
  const [generandoPdfVersion, setGenerandoPdfVersion] = useState(null);
  const [guardandoPropuesta, setGuardandoPropuesta] = useState(null); // idx de la opción en progreso
  const [propuestaGuardada, setPropuestaGuardada] = useState(null);   // { propuestaId, pdfUrl, shareUrl }

  // ── Comparador: cada opción (A/B/C) tiene sus propias 6 variables editables ──
  // Todos los resultados de la opción se recalculan a partir de estas variables.
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

  // Guarda la opción elegida como una propuesta real y compartible (POST /api/propuestas/guardar).
  // Este es el único punto del flujo donde se genera un ID público y su PDF.
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

  const fechaPropuesta = useMemo(() => new Date().toLocaleDateString("es-CO"), []);

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

        {/* KPIs clave: visibles en todos los tamaños de pantalla */}
        <div className="mobileHero">
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Inversión</span>
            <span className="mobileHeroValue">${money(resultadoActivo?.costoProyectoMasIva)}</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Ahorro/mes</span>
            <span className="mobileHeroValue">${money(resultadoActivo?.ahorroMensual)}</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Retorno</span>
            <span className="mobileHeroValue">{resultadoActivo?.tiempoRetorno ?? '—'} años</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">Potencia</span>
            <span className="mobileHeroValue">{resultadoActivo?.kwp ?? '—'} kWp</span>
          </div>
          <div className="mobileHeroDivider" />
          <div className="mobileHeroItem">
            <span className="mobileHeroLabel">N° paneles</span>
            <span className="mobileHeroValue">{resultadoActivo?.npaneles ?? '—'}</span>
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
              </div>
            </div>

            {/* INFO INICIAL — datos del cliente */}
            <Card title="Información inicial">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre" value={resultado.nombre} />
                <SummaryRow label="Correo" value={resultado.correo} />
                <SummaryRow label="Teléfono" value={resultado.telefono} />
                <SummaryRow label="Ubicación" value={resultado.ubicacion} />
                <SummaryRow label="Ciudad solar" value={resultado.ciudadSolar ?? resultado.ubicacion} />
                <SummaryRow label="Tipo de solicitud" value={resultado.tipoSolicitud} />
                <SummaryRow label="Tipo de techo" value={resultado.tipoTecho} />
                <SummaryRow label="Sistema de interés" value={resultado.sistemaInteres} />
              </div>
            </Card>

            {/* TU SISTEMA SOLAR — detalles técnicos */}
            <Card title="Tu sistema solar">
              <div className="cotTwoCol">
                <Metric label="Potencia instalada (kWp DC)" value={`${resultadoActivo?.kwp ?? "—"} kWp`} />
                <Metric label="Potencia AC del inversor" value={`${resultadoActivo?.potenciaAC ?? "—"} kW`} />
                <Metric label="N° paneles" value={`${resultadoActivo?.npaneles ?? "—"} und`} />
                <Metric label="N° inversores" value={`${resultadoActivo?.ninversores ?? "—"} und`} />
                <Metric label="Generación mensual" value={`${money(resultadoActivo?.generacionMes ?? resultadoActivo?.produccionDeEnergia)} kWh/mes`} />
                <Metric label="Consumo mensual cliente" value={`${money(resultadoActivo?.consumoKwh)} kWh/mes`} />
                <Metric label="Cobertura de factura" value={`${resultadoActivo?.porcentajeCoberturaProyecto ?? "—"}%`} />
                <Metric label="Radiación solar (HSP/día)" value={`${resultadoActivo?.radiacionSolar ?? "—"} h/día`} />
                <Metric label="Radiación anual equiv." value={`${resultadoActivo?.radiacionAnual ?? "—"} kWh/kWp`} />
                <Metric label="Producción promedio/día" value={`${money(resultadoActivo?.wPromedioDia)} Wh/día`} />
                <Metric label="Área disponible" value={`${money(resultadoActivo?.areaDisponible)} m²`} />
                <Metric label="Área mínima requerida" value={`${resultadoActivo?.areaMinima ?? "—"} m²`} />
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartSistemaSolar r={chartData} />
            </Card>

            {/* FINANCIERO */}
            <Card title="Análisis financiero">
              <div className="cotTwoCol">
                <Metric label="Inversión estimada (con IVA)" value={`$ ${money(resultadoActivo?.costoProyectoMasIva)}`} />
                <Metric label="$/kWp instalado" value={`$ ${money(resultadoActivo?.valorKwp ?? resultadoActivo?.costokwpproyecto)}`} />
                <Metric label="Ahorro mensual estimado" value={`$ ${money(resultadoActivo?.ahorroMensual)}`} />
                <Metric label="Ahorro anual estimado" value={`$ ${money(resultadoActivo?.ahorroAnual)}`} />
                <Metric label="Ahorro proyectado a 10 años" value={`$ ${money(resultadoActivo?.ahorro10Anos)}`} />
                <Metric label="Retorno de inversión" value={`${resultadoActivo?.tiempoRetorno ?? "—"} años`} />
                <Metric label="TIR a 5 años" value={`${resultadoActivo?.tir5Anos ?? "—"}%`} />
                <Metric label="TIR a 10 años" value={`${resultadoActivo?.tir10Anos ?? "—"}%`} />
                <Metric label="TIR a 15 años" value={`${resultadoActivo?.tir15Anos ?? "—"}%`} />
                <Metric label="Precio kWh ahorro (E25)" value={`$ ${money(resultadoActivo?.valorKwhAhorro)}/kWh`} />
                <Metric label="Precio kWh venta excedentes (E26)" value={`$ ${money(resultadoActivo?.valorKwhVenta)}/kWh`} />
                <Metric label="% Autoconsumo" value={`${resultadoActivo?.porcentajeAhorro ?? "—"}%`} />
                <Metric label="% Excedentes a la red" value={`${resultadoActivo?.porcentajeVenta ?? "—"}%`} />
                <Metric label="Mantenimiento anual estimado" value={`$ ${money(resultadoActivo?.mantenimientoAnual)}`} />
                <Metric label="Indexación IPC anual" value={`${resultadoActivo?.indexacionIPC != null ? (resultadoActivo.indexacionIPC * 100).toFixed(0) + '%' : "—"}`} />
                <Metric label="Descuento declaración de renta" value={`$ ${money(resultadoActivo?.descuentoDeclaracion)}`} />
                <Metric label="Vida útil estimada" value={`25 años`} />
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartFinanciero r={chartData} />
            </Card>

            {/* ── COMPARADOR DE OPCIONES ── */}
            <Card
              title="Comparador de opciones"
              right={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {guardado && <span style={{ fontSize: '0.8rem', color: '#2ecc71' }}>✓ Actualizado</span>}
                  <button
                    onClick={guardarOpciones}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      background: 'linear-gradient(135deg, #1a6edc 0%, #0d4fa8 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(13,79,168,0.35)',
                      textTransform: 'uppercase',
                    }}
                  >
                    ↻ Refrescar datos
                  </button>
                </div>
              }
            >
              <p style={{ margin: '0 0 14px', opacity: 0.8, fontSize: '0.85rem' }}>
                Edita las variables de cada opción (kWp, costo por kWp, consumo, costo kWh, área y radiación)
                para comparar escenarios. Marca la opción a enviar al cliente.
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
                          className="cotBtn cotBtnPrimary"
                          style={{ marginTop: 6, fontSize: '0.8rem', padding: '8px 0', width: '100%' }}
                          onClick={(e) => { e.stopPropagation(); guardarYCompartir(idx); }}
                          disabled={guardandoPropuesta === idx}
                        >
                          {guardandoPropuesta === idx ? 'Guardando...' : 'Guardar y compartir esta →'}
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

            {/* PROPUESTA ECONÓMICA */}
            <Card
              title="Propuesta económica"
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
                    <tr><td>Paneles</td><td className="num">{resultadoActivo.cantidadPaneles ?? resultadoActivo.npaneles}</td></tr>
                    <tr><td>Inversor</td><td className="num">1</td></tr>
                    <tr><td>Diseño e ingeniería</td><td className="num">{resultadoActivo.cantidadDisenoIngenieria ?? 1}</td></tr>
                    <tr><td>Certificado RETIE</td><td className="num">{resultadoActivo.cantidadCertificadoRetie ?? 1}</td></tr>
                    {(resultadoActivo.cantidadEstudioConexion ?? 0) > 0 && (
                      <tr><td>Estudio de conexión</td><td className="num">{resultadoActivo.cantidadEstudioConexion}</td></tr>
                    )}
                    <tr><td>Trámites ante operador de red</td><td className="num">{resultadoActivo.cantidadTramitesOperador ?? 1}</td></tr>
                    <tr><td>Sistema de monitoreo</td><td className="num">{resultadoActivo.cantidadSistemaMonitoreo ?? 1}</td></tr>
                    <tr><td>Pólizas</td><td className="num">{resultadoActivo.cantidadPolizas ?? 1}</td></tr>
                    <tr><td>Servicio de instalación y puesta en marcha</td><td className="num">{resultadoActivo.cantidadServicioInstalacion ?? 1}</td></tr>
                    <tr><td>Beneficios tributarios (gestión)</td><td className="num">{resultadoActivo.cantidadBeneficiosTributarios ?? 1}</td></tr>
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
                    <tr><td>Anticipo</td><td className="num">{resultadoActivo?.porcentajeAnticipo ?? 50}%</td></tr>
                    <tr><td>Entrega de materiales</td><td className="num">{resultadoActivo?.porcentajeEntregaMateriales ?? 40}%</td></tr>
                    <tr><td>RETIE</td><td className="num">{resultadoActivo?.porcentajeRetie ?? 10}%</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="cotDivider" style={{ margin: '16px 0 0' }} />
              <ChartFormasPago r={chartData} />
            </Card>

            {/* IMPACTO AMBIENTAL */}
            <Card title="Impacto ambiental">
              <div className="cotTwoCol">
                <Metric label="CO₂ evitado al año" value={`${resultadoActivo?.co2EvitadoToneladas ?? "—"} toneladas`} isGreen />
                <Metric label="Equivalente en árboles sembrados" value={`${money(resultadoActivo?.arbolesEquivalentes)} árboles`} isGreen />
                <Metric label="Gasolina no consumida" value={`${money(resultadoActivo?.galonesGasolinaEvitados)} galones`} isGreen />
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
                <img src="/logos/logo_longi.png" alt="Longi"  style={{ width: 110, height: "auto" }} />
                <img src="/logos/huawei.jpeg"    alt="Huawei" style={{ width: 110, height: "auto" }} />
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
            </Card>
          </section>

          {/* Right: Side summary */}
          <aside className="cotSide">
            <button
              type="button"
              className="cotBtn cotBtnGhost"
              style={{ width: "100%", marginBottom: 12, justifyContent: "center" }}
              onClick={() => navigate("/cliente")}
            >
              + Nueva cotización
            </button>

            <Card title="Variables del proyecto">
              {/* Datos del cliente (readonly) */}
              <div className="varSectionTitle">Datos del cliente</div>
              <SummaryRow label="Cotización" value={`N-${resultado.numeroCotizacion}`} />
              <SummaryRow label="Cliente" value={resultado.nombre} />
              <SummaryRow label="Ciudad" value={resultado.ubicacion} />
              <SummaryRow
                label="Asesor"
                value={resultado.vendedor || [localStorage.getItem("nombreUsuario"), localStorage.getItem("apellidoUsuario")].filter(Boolean).join(" ") || "—"}
              />

              <div className="cotDivider" />

              {/* Resultados de la opción seleccionada en el comparador */}
              <div className="varSectionTitle">
                Resultados — {opciones[opcionSeleccionada]?.label ?? "Opción A"}
              </div>
              <SummaryRow label="Potencia DC" value={`${chartData?.kwp ?? "—"} kWp`} />
              <SummaryRow label="Potencia AC" value={`${chartData?.potenciaAC ?? "—"} kW`} />
              <SummaryRow label="N° paneles" value={`${chartData?.npaneles ?? "—"} und`} />
              <SummaryRow label="N° inversores" value={`${chartData?.ninversores ?? "—"} und`} />
              <SummaryRow label="Generación mensual" value={`${money(chartData?.generacionMes)} kWh/mes`} />
              <SummaryRow label="Cobertura factura" value={`${chartData?.porcentajeCoberturaProyecto ?? "—"}%`} />
              <SummaryRow label="Autoconsumo / Excedentes" value={`${chartData?.porcentajeAhorro ?? "—"}% / ${chartData?.porcentajeVenta ?? "—"}%`} />
              <SummaryRow label="Inversión total" value={`$ ${money(chartData?.costoProyectoMasIva)}`} />
              <SummaryRow label="$/kWp" value={`$ ${money(chartData?.valorKwp ?? chartData?.costokwpproyecto)}`} />
              <SummaryRow label="Ahorro mensual" value={`$ ${money(chartData?.ahorroMensual)}`} />
              <SummaryRow label="Ahorro anual" value={`$ ${money(chartData?.ahorroAnual)}`} />
              <SummaryRow label="Retorno de inversión" value={`${chartData?.tiempoRetorno ?? "—"} años`} />
              <SummaryRow label="TIR 10 años" value={`${chartData?.tir10Anos ?? "—"}%`} />
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
                    <div key={vidx} style={{
                      padding: '10px 0',
                      borderBottom: vidx < versiones.length - 1 ? '1px solid #eee' : 'none',
                    }}>
                      <div style={{ marginBottom: 6 }}>
                        <b style={{ color: '#b03a22', fontSize: '0.9rem' }}>N-{ver.numeroCotizacion}</b>
                        {ver.label && <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: 6 }}>{ver.label}</span>}
                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 2 }}>
                          {ver.kwp} kWp · ${Number(ver.costoProyectoMasIva).toLocaleString('es-CO')}{cobVer !== null ? ` · ${cobVer}%` : ''}
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
                  ); })}
                </div>
              </Card>
            )}

          </aside>
        </div>


        {/* MODAL: propuesta guardada — único lugar donde se ve el link público */}
        {propuestaGuardada && (
          <PropuestaGuardadaModal
            data={propuestaGuardada}
            onClose={() => setPropuestaGuardada(null)}
            onVolverDashboard={() => navigate("/")}
          />
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
  const cobertura = Number(r?.porcentajeCoberturaProyecto) || 0;
  const kwp       = Number(r?.kwp) || 0;
  const paneles   = Number(r?.npaneles) || 0;
  const produccion= Number(r?.generacionMes ?? r?.produccionDeEnergia) || 0;

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
    { label: 'Anticipo',           pct: Number(r?.porcentajeAnticipo)          || 50, color: C1 },
    { label: 'Entrega materiales', pct: Number(r?.porcentajeEntregaMateriales) || 40, color: C2 },
    { label: 'RETIE',              pct: Number(r?.porcentajeRetie)             || 10, color: C3 },
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 16,
    }}>
      <div style={{
        position: 'relative',
        background: '#fff', borderRadius: 16, padding: 26, maxWidth: 440, width: '100%',
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)', textAlign: 'center',
      }}>
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
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            style={{
              flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8,
              border: '1px solid #dedede', fontSize: 12, color: '#1a1a1a', background: '#f8f9fa',
            }}
          />
          <button className="cotBtn cotBtnPrimary" onClick={copiarLink} style={{ whiteSpace: 'nowrap' }}>
            {copiado ? '¡Copiado! ✓' : 'Copiar'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="cotBtn cotBtnPrimary" onClick={abrirPdf} style={{ width: '100%', justifyContent: 'center' }}>
            📥 Descargar PDF
          </button>
          <button className="cotBtn cotBtnGhost" onClick={enviarWhatsApp} style={{ width: '100%', justifyContent: 'center', borderColor: '#25d366', color: '#1a1a1a' }}>
            💬 Enviar por WhatsApp
          </button>
          <button className="cotBtn cotBtnGhost" onClick={() => { onClose(); onVolverDashboard(); }} style={{ width: '100%', justifyContent: 'center' }}>
            ← Volver al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

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

// Input editable de una variable dentro de la tarjeta de cada opción (A/B/C)
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