import { useParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import logo from "./assets/logo_solartech.webp";
import "./cotizadorSolar.css";

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

  const potenciaPanel   = Number(base.potenciaPanel)   || 585;
  const radiacionSolar  = Number(base.radiacionSolar)  || 3.8;
  const margenCobertura = Number(base.margenCobertura) || 0.8;

  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));
  const wPromedioDia = Number((kwp * radiacionSolarCobertura * 1000).toFixed(1));
  const consumo = Number(((wPromedioDia * 365) / (1000 * 12)).toFixed(1));
  const npaneles = Math.ceil((kwp * 1000) / potenciaPanel);
  const produccionDeEnergia = Math.round((potenciaPanel * npaneles * radiacionSolarCobertura * 30) / 1000);
  const areaMinima = Math.round(kwp * 5.8);
  const areaDisp = Number(base.areaDisponible ?? 0);
  let porcentajeCoberturaProyecto = 0;
  if (areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }
  const costoProyecto        = Math.round(kwp * costokWp);
  const ivaProyecto          = Math.round(costoProyecto * 0.05);
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const descuentoDeclaracion = Math.round(costoProyecto / 2);
  const facturaPromedio      = Math.round(consumo * costoUnidad);
  const ahorroMensual        = facturaPromedio;
  const ahorroAnual          = facturaPromedio * 12;
  const ahorro10Anos         = Math.round(ahorroAnual * 10);
  const tiempoRetorno        = facturaPromedio > 0 ? Math.round(costoProyectoMasIva / facturaPromedio) : null;
  const co2EvitadoToneladas  = Number((kwp * 1.2 * 0.7 * 0.43).toFixed(2));
  const arbolesEquivalentes  = Math.round(co2EvitadoToneladas / 0.02);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * 117.6);

  return {
    kwp, consumo, wPromedioDia, npaneles, produccionDeEnergia, areaMinima,
    porcentajeCoberturaProyecto, costoProyecto, ivaProyecto, costoProyectoMasIva,
    descuentoDeclaracion, ahorroMensual, ahorroAnual, ahorro10Anos, tiempoRetorno,
    co2EvitadoToneladas, arbolesEquivalentes, galonesGasolinaEvitados,
    potenciaPanel, radiacionSolar,
  };
}

export default function PropuestaPublica() {
  const { num } = useParams();
  const [lead, setLead]     = useState(null);
  const [cfg, setCfg]       = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [copiado, setCopiado] = useState(false);

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

  const calc = useMemo(() => {
    if (!lead) return null;
    const storedCostokWp = lead.kwp > 0 && lead.costoProyectoMasIva > 0
      ? Math.round(lead.costoProyectoMasIva / (lead.kwp * 1.05))
      : (cfg.costokWp || 3500000);
    const costoKwh = lead.costoKwh ||
      (lead.ahorroMensual > 0 && lead.consumoKwh > 0
        ? Math.round(lead.ahorroMensual / lead.consumoKwh)
        : 0);
    return calcularLocal(lead.kwp, costoKwh, storedCostokWp, { ...cfg, ...lead });
  }, [lead, cfg]);

  const money = (v) => typeof v === 'number' ? v.toLocaleString('es-CO') : (v ?? '—');

  const ahorroMensual  = lead?.ahorroMensual  || calc?.ahorroMensual  || 0;
  const ahorroAnual    = lead?.ahorroAnual    || calc?.ahorroAnual    || 0;
  const tiempoRetorno  = lead?.tiempoRetorno  || calc?.tiempoRetorno  || null;
  const ahorro10Anos   = calc?.ahorro10Anos   ?? (ahorroAnual > 0 ? ahorroAnual * 10 : null);
  const descuentoDeclaracion = calc?.descuentoDeclaracion ??
    (lead?.costoProyectoMasIva > 0 ? Math.round((lead.costoProyectoMasIva / 1.05) * 0.5) : null);

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
                  {lead.pdfUrl && (
                    <a
                      href={lead.pdfUrl?.startsWith('http') ? lead.pdfUrl : `${API}${lead.pdfUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="cotBtn cotBtnPrimary"
                    >
                      Descargar PDF
                    </a>
                  )}
                  <button className="cotBtn cotBtnGhost" onClick={compartir}>
                    {copiado ? '¡Link copiado! ✓' : 'Compartir Link'}
                  </button>
                </div>
              </div>
            </div>

            {/* Datos del cliente */}
            <Card title="Datos del cliente">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre" value={lead.nombre} />
                <SummaryRow label="Ciudad" value={lead.ubicacion} />
                <SummaryRow label="Correo" value={lead.correo} />
                <SummaryRow label="Teléfono" value={lead.telefono} />
                <SummaryRow label="Tipo de solicitud" value={lead.tipoSolicitud} />
                <SummaryRow label="Tipo de techo" value={lead.tipoTecho} />
                <SummaryRow label="Sistema de interés" value={lead.sistemaInteres} />
              </div>
            </Card>

            {/* Sistema solar */}
            <Card title="Tu sistema solar">
              <div className="cotTwoCol">
                <Metric label="Potencia del sistema" value={`${lead.kwp || calc?.kwp || '—'} kWp`} />
                <Metric label="N° de paneles" value={`${lead.npaneles ?? calc?.npaneles ?? '—'} paneles`} />
                <Metric label="N° de inversores" value={`${lead.ninversores ?? 1} und`} />
                <Metric label="Potencia por panel" value={`${calc?.potenciaPanel ?? cfg.potenciaPanel ?? '—'} W`} />
                <Metric label="Producción estimada" value={`${calc?.produccionDeEnergia ?? '—'} kWh/mes`} />
                <Metric label="Cobertura del sistema" value={`${calc?.porcentajeCoberturaProyecto ?? '—'}%`} />
                <Metric label="Área mínima requerida" value={`${calc?.areaMinima ?? '—'} m²`} />
                <Metric label="Radiación solar local" value={`${lead.radiacionSolar ?? '—'} kWh/m²/día`} />
              </div>
            </Card>

            {/* Análisis financiero */}
            <Card title="Análisis financiero">
              <div className="cotTwoCol">
                <Metric label="Inversión estimada (con IVA)" value={`$ ${money(lead.costoProyectoMasIva || calc?.costoProyectoMasIva)}`} />
                <Metric label="Ahorro mensual estimado" value={`$ ${money(ahorroMensual)}`} />
                <Metric label="Ahorro anual estimado" value={`$ ${money(ahorroAnual)}`} />
                <Metric label="Ahorro proyectado a 10 años" value={`$ ${money(ahorro10Anos)}`} />
                <Metric label="Retorno de inversión" value={`${tiempoRetorno ?? '—'} meses`} />
                <Metric label="Descuento declaración de renta" value={`$ ${money(descuentoDeclaracion)}`} />
                <Metric label="Vida útil estimada" value="25 años" />
              </div>
            </Card>

            {/* Propuesta económica */}
            <Card title="Propuesta económica">
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Resumen inversión</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    <tr><td>Inversión del proyecto solar</td><td className="num">$ {money(calc?.costoProyecto)}</td></tr>
                    <tr><td>IVA (5%)</td><td className="num">$ {money(calc?.ivaProyecto)}</td></tr>
                    <tr><td><b>Total inversión</b></td><td className="num"><b>$ {money(lead.costoProyectoMasIva || calc?.costoProyectoMasIva)}</b></td></tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Formas de pago */}
            <Card title="Formas de pago">
              {[
                ['Pago de contado', 'Pago total antes de iniciar la instalación.'],
                ['Crédito bancario', 'Financiación con tu entidad bancaria. Solartech entrega la documentación técnica.'],
                ['Financiación interna', 'Plan de cuotas acordado directamente con Solartech Energy Systems.'],
                ['Leasing solar', 'Arrendamiento financiero con opción de compra al finalizar el contrato.'],
                ['Subsidio / Fondo Emprender', 'Acceso a fondos de cofinanciación FNCER y subsidios gubernamentales.'],
              ].map(([t, d]) => (
                <div key={t} style={{ marginBottom: 10 }}>
                  <b style={{ color: '#b03a22', fontSize: '0.9rem' }}>{t}</b>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#5a5a5a' }}>{d}</p>
                </div>
              ))}
            </Card>

            {/* Impacto ambiental */}
            <Card title="Impacto ambiental">
              <div className="cotTwoCol">
                <Metric label="CO₂ evitado al año" value={`${calc?.co2EvitadoToneladas ?? '—'} toneladas`} isGreen />
                <Metric label="Árboles equivalentes" value={`${money(calc?.arbolesEquivalentes)} árboles/año`} isGreen />
                <Metric label="Gasolina evitada" value={`${money(calc?.galonesGasolinaEvitados)} galones/año`} isGreen />
              </div>
            </Card>

            {/* Etapas */}
            <Card title="Etapas del proyecto">
              <div className="cotTwoCol">
                <MiniBlock title="Etapa 1 — Planeación, diseño e importación" lines={['Diagnóstico', 'Diseño de la solución', 'Gestión de trámites']} foot="30 días hábiles" />
                <MiniBlock title="Etapa 2 — Construcción y puesta en marcha" lines={['Instalación', 'Puesta en marcha']} foot="90 días hábiles" />
                <MiniBlock title="Etapa 3 — Operación" lines={['Trámites y conexión a la red', 'Monitoreo y mantenimiento']} foot="30 días hábiles" />
              </div>
            </Card>

            {/* Garantías */}
            <Card title="Garantías">
              <div className="cotTwoCol">
                <MiniBlock title="Paneles solares" lines={['15 años de producto', '30 años de generación']} />
                <MiniBlock title="Inversores" lines={['10 años de producto']} />
                <MiniBlock title="Estructuras" lines={['10 años de producto']} />
              </div>
            </Card>

            {/* Marcas */}
            <Card title="Marcas aliadas">
              <div className="marcasAliadas" style={{ marginTop: 10 }}>
                <img src="/logos/logo_longi.png" alt="Longi" style={{ width: 110, height: 'auto' }} />
                <img src="/logos/logo_ja_solar.jpg" alt="JA Solar" style={{ width: 110, height: 'auto' }} />
                <img src="/logos/huawei.jpeg" alt="Huawei" style={{ width: 110, height: 'auto' }} />
                <img src="/logos/growatt.png" alt="Growatt" style={{ width: 110, height: 'auto' }} />
                <img src="/logos/goodwe.jpeg" alt="Goodwe" style={{ width: 110, height: 'auto' }} />
              </div>
            </Card>

            {/* Condiciones */}
            <Card title="Condiciones comerciales">
              <ol className="condicionesComerciales">
                <li>La cantidad de paneles e inversores podrá variar dependiendo de la potencia disponible.</li>
                <li>Con la aceptación se aceptan políticas de servicio post y garantías.</li>
                <li>Incluye viáticos y desplazamiento técnico hasta el lugar de instalación.</li>
                <li>Tiempo de entrega: 120 días a RETIE desde el primer pago.</li>
                <li>Validez de la oferta: 15 días calendario.</li>
                <li>Los ahorros dependen de radiación, precio kWh y excedentes reconocidos por el OR.</li>
              </ol>
            </Card>

            {/* Asesor */}
            {lead.vendedor && (
              <Card title="Tu asesor comercial">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#b03a22', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
                    {lead.vendedor.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{lead.vendedor}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>Asesor Comercial</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Cierre */}
            <Card title="Cierre">
              <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                ¡Muchas gracias por confiar en Solartech Energy Systems! Estamos para atender tus dudas.
              </p>
              <div className="cotActions" style={{ marginTop: 14 }}>
                {lead.pdfUrl && (
                  <a
                    href={lead.pdfUrl?.startsWith('http') ? lead.pdfUrl : `${API}${lead.pdfUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cotBtn cotBtnPrimary"
                  >
                    Descargar PDF
                  </a>
                )}
                <button className="cotBtn cotBtnGhost" onClick={compartir}>
                  {copiado ? '¡Link copiado! ✓' : 'Compartir Link'}
                </button>
              </div>
            </Card>
          </section>

          {/* Sidebar */}
          <aside className="cotSide">
            <Card title="Resumen rápido">
              <SummaryRow label="Cotización" value={`N-${lead.numeroCotizacion}`} />
              <SummaryRow label="Cliente" value={lead.nombre} />
              <SummaryRow label="Ciudad" value={lead.ubicacion} />
              <div className="cotDivider" />
              <SummaryRow label="Potencia" value={`${lead.kwp || calc?.kwp || '—'} kWp`} />
              <SummaryRow label="Producción" value={`${calc?.produccionDeEnergia ?? '—'} kWh/mes`} />
              <SummaryRow label="Cobertura" value={`${calc?.porcentajeCoberturaProyecto ?? '—'}%`} />
              <div className="cotDivider" />
              <SummaryRow label="Total inversión" value={`$ ${money(lead.costoProyectoMasIva || calc?.costoProyectoMasIva)}`} />
              <SummaryRow label="Retorno" value={`${tiempoRetorno ?? '—'} meses`} />
              <SummaryRow label="Ahorro anual" value={`$ ${money(ahorroAnual)}`} />
            </Card>

            <Card title="Acciones">
              <div className="cotActions" style={{ marginTop: 0 }}>
                {lead.pdfUrl && (
                  <a
                    href={lead.pdfUrl?.startsWith('http') ? lead.pdfUrl : `${API}${lead.pdfUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cotBtn cotBtnPrimary"
                    style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}
                  >
                    Descargar PDF
                  </a>
                )}
                <button className="cotBtn cotBtnGhost" onClick={compartir} style={{ width: '100%' }}>
                  {copiado ? '¡Copiado! ✓' : 'Compartir Link'}
                </button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="cotCard">
      <div className="cotCardHead"><h2>{title}</h2></div>
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
