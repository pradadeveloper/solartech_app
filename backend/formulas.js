// ============================================================
//  FÓRMULAS Y CÁLCULOS — Solartech Energy Systems
//  Modificar este archivo para ajustar cualquier cálculo del
//  sistema sin tocar la lógica del servidor (index.js).
//  Referencias Excel: formulasJuan.js (24/06/2026)
// ============================================================

// ── Utilidad numérica ────────────────────────────────────────
function toNumber(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// ── TIR (Newton-Raphson) — mismo algoritmo del Excel ────────
function calcularTIR(flujos, guess = 0.1) {
  let tasa = guess;
  for (let i = 0; i < 1000; i++) {
    let vpn = 0, dvpn = 0;
    for (let t = 0; t < flujos.length; t++) {
      vpn  += flujos[t] / Math.pow(1 + tasa, t);
      dvpn -= t * flujos[t] / Math.pow(1 + tasa, t + 1);
    }
    if (dvpn === 0) break;
    const nueva = tasa - vpn / dvpn;
    if (Math.abs(nueva - tasa) < 1e-7) return nueva;
    tasa = nueva;
  }
  return tasa;
}

// ── Valores por defecto de configuración ────────────────────
// Estos son los fallback cuando no hay config guardada en BD.
// Los valores reales se administran desde el panel de Configuración.
const DEFAULTS = {
  potenciaPanel:         610,       // Wp por panel
  radiacionSolar:        3.8,       // HSP promedio (horas sol pico diario)
  margenCobertura:       0.9,       // Factor de eficiencia del sistema (PR)
  capacidadInversor:     3000,      // W por inversor
  costokWp:              4500000,   // COP por kWp instalado
  longitudRiel:          4.7,       // metros por riel
  cableSolar:            10,        // metros de cable solar incluidos
  ivaPct:                5,         // % IVA sobre el proyecto (Ley 1715)
  descuentoRentaPct:     50,        // % de descuento en renta (beneficio tributario)
  costoGeneracion:       330,       // COP/kWh — tarifa de generación CREG
  costoComercializacion: 120,       // COP/kWh — cargo de comercialización CREG
  factorAreaM2PorKwp:    5.5,       // m²/kWp de techo requerido (Excel: 5.5)
  factorCO2:             0.3612,    // tonCO2/kWp·año
  factorArboles:         0.02,      // tonCO2 absorbidas por árbol/año
  factorGalones:         117.6,     // galones equivalentes por tonCO2
  sobredimension:        0.30,      // factor de sobredimensionamiento DC/AC (Excel: 30%)
  maxAC100kWp:           135,       // kWp DC umbral pequeño/gran autogenerador
  mantenimientoKwp:      45000,     // COP/kWp/año de mantenimiento
  inflacion:             0.08,      // tasa de indexación IPC anual (8%)
  anticipo1Pct:          50,        // % anticipo al inicio del proyecto
  anticipo2Pct:          40,        // % pago entrega de materiales
  anticipo3Pct:          10,        // % pago final (RETIE)
};

// ── Motor de cálculo principal ───────────────────────────────
function calcularProyecto({
  nombre,
  correo,
  telefono,
  ubicacion,
  preferenciaContacto,
  areaDisponible,
  tipoSolicitud,
  tipoTecho,
  recibeFactura,
  sistemaInteres,
  valorMensual,
  consumoKwh,
  costoKwh,
  contribucion,
  radiacionSolar: radiacionData,
  ciudadSolar,
}, cfg = {}) {

  const consumo     = toNumber(consumoKwh);
  const costoUnidad = toNumber(costoKwh);
  const areaDisp    = toNumber(areaDisponible);

  if ([consumo, costoUnidad].some((n) => Number.isNaN(n))) {
    throw new Error('Valores numéricos inválidos: consumoKwh o costoKwh');
  }

  // Parámetros de configuración (config de BD con fallback a DEFAULTS)
  const potenciaPanel      = cfg.potenciaPanel      || DEFAULTS.potenciaPanel;
  const radiacionSolar     = Number(radiacionData) > 0 ? Number(radiacionData) : (cfg.radiacionSolar || DEFAULTS.radiacionSolar);
  const margenCobertura    = cfg.margenCobertura    || DEFAULTS.margenCobertura;
  const capacidadInversor  = cfg.capacidadInversor  || DEFAULTS.capacidadInversor;
  const costokWp           = cfg.costokWp           || DEFAULTS.costokWp;
  const longitudRiel       = cfg.longitudRiel       || DEFAULTS.longitudRiel;
  const cableSolar         = cfg.cableSolar         || DEFAULTS.cableSolar;
  const ivaPct             = cfg.ivaPct             ?? DEFAULTS.ivaPct;
  const descuentoRentaPct  = cfg.descuentoRentaPct  ?? DEFAULTS.descuentoRentaPct;
  const factorCO2          = cfg.factorCO2          || DEFAULTS.factorCO2;
  const factorAreaM2PorKwp = cfg.factorAreaM2PorKwp || DEFAULTS.factorAreaM2PorKwp;
  const factorArboles      = cfg.factorArboles      || DEFAULTS.factorArboles;
  const factorGalones      = cfg.factorGalones      || DEFAULTS.factorGalones;
  const sobredimension     = cfg.sobredimension     ?? DEFAULTS.sobredimension;
  const maxAC100kWp        = cfg.maxAC100kWp        || DEFAULTS.maxAC100kWp;
  const mantenimientoKwp   = cfg.mantenimientoKwp   || DEFAULTS.mantenimientoKwp;
  const inflacion          = cfg.inflacion          ?? DEFAULTS.inflacion;
  const anticipo1Pct       = cfg.anticipo1Pct       ?? DEFAULTS.anticipo1Pct;
  const anticipo2Pct       = cfg.anticipo2Pct       ?? DEFAULTS.anticipo2Pct;
  const anticipo3Pct       = cfg.anticipo3Pct       ?? DEFAULTS.anticipo3Pct;

  // ── 1. Radiación ────────────────────────────────────────
  // radiacionSolar = HSP diario; radiacion_anual = HSP * 365 (igual que Excel 1387)
  // margenCobertura solo se usa para display (radiacionSolarCobertura), no en cálculos.
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(2));
  const radiacionAnual          = Number((radiacionSolar * 365).toFixed(1));

  // ── 2. Tamaño del sistema (kWp) — E6 ────────────────────
  const kWpPorConsumo    = (consumo * 12) / (radiacionSolar * 365);
  const kWpMaximoPorArea = (!Number.isNaN(areaDisp) && areaDisp > 0)
    ? areaDisp / factorAreaM2PorKwp
    : Infinity;
  const kwp1 = Math.min(kWpMaximoPorArea, kWpPorConsumo);

  // G3 — límite gran autogenerador CREG
  const maxGrandeCalc = kWpPorConsumo * 0.52;

  // F7 — kWp limitado por regulación
  const kWpPorPanel = potenciaPanel / 1000;
  let kwpLimitado;
  if      (kwp1 < maxAC100kWp)          kwpLimitado = kwp1;
  else if (kwp1 < maxGrandeCalc)         kwpLimitado = kwp1;
  else if (maxGrandeCalc < maxAC100kWp)  kwpLimitado = maxAC100kWp;
  else                                   kwpLimitado = maxGrandeCalc;

  // E7 — kWp instalado (FLOOR al panel entero, igual que Excel)
  const kwp = Math.floor(kwpLimitado / kWpPorPanel) * kWpPorPanel;

  // E8 — Potencia AC
  const potenciaAC = Number((kwp / (1 + sobredimension)).toFixed(2));

  // ── 3. Producción ────────────────────────────────────────
  const wPromedioDia    = Math.round(kwp * radiacionSolar * 1000);                   // Wh/día
  const generacionMes   = Math.round(kwp * radiacionSolar * 365 / 12);              // E10 kWh/mes
  const facturaPromedio = Math.round(consumo * costoUnidad);

  // ── 4. Excedentes — E11, E12 ─────────────────────────────
  const costoKwhAjustado = contribucion ? costoUnidad * 1.2 : costoUnidad;          // E25
  const ratioGenConsumo  = consumo > 0 ? generacionMes / consumo : 0;              // E11

  let excedentes;
  if (ratioGenConsumo <= 0.33) {
    excedentes = 0;
  } else if (ratioGenConsumo <= 1) {
    excedentes = (5 / 7) * ratioGenConsumo - (15 / 67);                             // E12 Excel
  } else {
    excedentes = (0.5 * consumo + generacionMes - consumo) / generacionMes;
  }

  const costoGeneracion       = cfg.costoGeneracion       || DEFAULTS.costoGeneracion;
  const costoComercializacion = cfg.costoComercializacion || DEFAULTS.costoComercializacion;

  // E26 — precio venta excedentes
  const costoExcedentes = kwp > maxAC100kWp
    ? costoGeneracion
    : costoKwhAjustado - costoComercializacion;

  // ── 5. Ahorro y rentabilidad ─────────────────────────────
  const ahorroMensual = Math.round(
    generacionMes * costoKwhAjustado * (1 - excedentes) +
    generacionMes * costoExcedentes  * excedentes
  );
  const ahorroAnual  = Math.round(ahorroMensual * 12);
  const ahorro10Anos = Math.round(ahorroAnual * 10);

  const valorKwhAhorro    = costoKwhAjustado;                                        // E25
  const valorKwhVenta     = costoExcedentes;                                         // E26
  const porcentajeAhorro  = Number(((1 - excedentes) * 100).toFixed(1));            // % autoconsumo
  const porcentajeVenta   = Number((excedentes * 100).toFixed(1));                  // % venta red

  // ── 6. Costos del proyecto ───────────────────────────────
  const costoProyecto        = Math.round(kwp * costokWp);
  const ivaProyecto          = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));
  const valorKwp             = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  const tiempoRetorno = ahorroMensual > 0
    ? Number((costoProyectoMasIva / ahorroMensual / 12).toFixed(1))
    : null;

  // ── 7. TIR — perspectiva del cliente ─────────────────────
  // Flujos: inversión inicial negativa + ahorros anuales indexados por IPC
  let tir5Anos = null, tir10Anos = null, tir15Anos = null;
  if (ahorroAnual > 0 && costoProyectoMasIva > 0) {
    const flujos = [-costoProyectoMasIva];
    for (let i = 1; i <= 15; i++) {
      flujos.push(Math.round(ahorroAnual * Math.pow(1 + inflacion, i - 1)));
    }
    try { tir5Anos  = Number((calcularTIR(flujos.slice(0, 6))  * 100).toFixed(1)); } catch(e) {}
    try { tir10Anos = Number((calcularTIR(flujos.slice(0, 11)) * 100).toFixed(1)); } catch(e) {}
    try { tir15Anos = Number((calcularTIR(flujos.slice(0, 16)) * 100).toFixed(1)); } catch(e) {}
  }

  // ── 8. Equipos ───────────────────────────────────────────
  const npaneles    = Math.round(kwp / kWpPorPanel);                                // E24
  const ninversores = potenciaAC <= 50 ? 1 : Math.ceil(potenciaAC / 50);           // E21

  const riel47        = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland      = Math.ceil((npaneles * 2) - 2);
  const endCland      = Math.ceil(npaneles / 2);
  const lFoot         = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;

  // ── 9. Propuesta económica — ítems de la cotización ──────
  const cantidadPaneles               = npaneles;
  const cantidadInversores            = ninversores;
  const cantidadDisenoIngenieria      = 1;
  const cantidadCertificadoRetie      = 1;
  const cantidadEstudioConexion       = kwp > 145 ? 1 : 0;
  const cantidadTramitesOperador      = 1;
  const cantidadSistemaMonitoreo      = 1;
  const cantidadPolizas               = 1;
  const cantidadServicioInstalacion   = 1;
  const cantidadBeneficiosTributarios = 1;
  const valorExtras                   = 0;
  const valorProyecto                 = costoProyecto;
  const valorIVA                      = ivaProyecto;
  const valorTotalProyecto            = costoProyectoMasIva;

  // ── 10. Forma de pago ────────────────────────────────────
  const porcentajeAnticipo            = anticipo1Pct;
  const porcentajeEntregaMateriales   = anticipo2Pct;
  const porcentajeRetie               = anticipo3Pct;

  // ── 11. Mantenimiento ────────────────────────────────────
  const mantenimientoAnual = Math.round(kwp * mantenimientoKwp);
  const indexacionIPC      = inflacion;

  // ── 12. Producción y área ────────────────────────────────
  const produccionDeEnergia = Math.round(
    (potenciaPanel * npaneles * radiacionSolar * 365 / 12) / 1000
  );
  const areaMinima                  = Math.round(kwp * factorAreaM2PorKwp);
  const porcentajeCoberturaProyecto = consumo > 0
    ? Math.min(100, Number(((generacionMes / consumo) * 100).toFixed(1)))
    : 0;

  // ── 13. Impacto ambiental ────────────────────────────────
  const co2EvitadoToneladas     = Number((kwp * factorCO2).toFixed(2));
  const arbolesEquivalentes     = Math.round(co2EvitadoToneladas / factorArboles);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * factorGalones);

  const equipos = ['Paneles solares', 'Inversor', 'Estructuras', 'Cableado'];

  // ── LOG DE VALIDACIÓN ────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              SOLARTECH — CÁLCULO GENERADO               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n[cliente]');
  console.log({
    nombreCliente : nombre,
    proyecto      : tipoSolicitud,
    ciudad        : ciudadSolar || ubicacion,
  });
  console.log('\n[entrada]');
  console.log({
    consumoKwhMes : consumo,
    costoKwh      : costoUnidad,
    areaDisponible: Number.isNaN(areaDisp) ? null : areaDisp,
    tipoCubierta  : tipoTecho,
  });
  console.log('\n[sistemaSolar]');
  console.log({
    potenciaInstalada : kwp,
    capacidadInstalada: Math.round(kwp * 1000),
    generacionMensual : generacionMes,
    radiacionAnual    : radiacionAnual,
    areaNecesaria     : areaMinima,
    co2EvitadoAnual   : co2EvitadoToneladas,
  });
  console.log('\n[indicadores]');
  console.log({
    tir5Anos,
    tir10Anos,
    tir15Anos,
    costoProyecto,
    ahorroMensual,
    ahorroAnual,
    valorKwhAhorro,
    valorKwhVenta,
    porcentajeAhorro,
    porcentajeVenta,
  });
  console.log('\n[propuestaEconomica]');
  console.log({
    cantidadPaneles,
    cantidadInversores,
    cantidadDisenoIngenieria,
    cantidadCertificadoRetie,
    cantidadEstudioConexion,
    cantidadTramitesOperador,
    cantidadSistemaMonitoreo,
    cantidadPolizas,
    cantidadServicioInstalacion,
    cantidadBeneficiosTributarios,
    valorExtras,
    valorProyecto,
    valorIVA,
    valorTotalProyecto,
    valorKwp,
  });
  console.log('\n[formaPago]');
  console.log({
    porcentajeAnticipo,
    porcentajeEntregaMateriales,
    porcentajeRetie,
  });
  console.log('\n[mantenimiento]');
  console.log({
    mantenimientoAnual,
    indexacionIPC,
  });
  console.log('──────────────────────────────────────────────────────────\n');

  return {
    nombre, correo, telefono, ubicacion, preferenciaContacto,
    tipoSolicitud, tipoTecho, recibeFactura, sistemaInteres,

    consumoKwh: consumo,
    costoKwh: costoUnidad,
    costoKwhAjustado,
    contribucion: !!contribucion,
    valorMensual: facturaPromedio,
    areaDisponible: Number.isNaN(areaDisp) ? null : areaDisp,

    wPromedioDia,
    potenciaPanel,
    capacidadInversor,
    kwp,
    potenciaAC,
    sobredimension,

    costoProyecto,
    ivaProyecto,
    costoProyectoMasIva,
    costokwpproyecto,
    descuentoDeclaracion,
    tiempoRetorno,
    valorKwp,

    npaneles,
    ninversores,
    riel47,
    midCland,
    endCland,
    lFoot,
    groundingLoop,
    cableSolar,

    produccionDeEnergia,
    porcentajeCoberturaProyecto,
    margenCobertura,
    radiacionSolar,
    radiacionSolarCobertura,
    radiacionAnual,

    generacionMes,
    excedentes,
    ratioGenConsumo,
    costoExcedentes,
    ahorroAnual,
    ahorroMensual,
    ahorro10Anos,

    valorKwhAhorro,
    valorKwhVenta,
    porcentajeAhorro,
    porcentajeVenta,

    tir5Anos,
    tir10Anos,
    tir15Anos,

    equipos,
    areaMinima,

    arbolesEquivalentes,
    galonesGasolinaEvitados,
    co2EvitadoToneladas,

    cantidadPaneles,
    cantidadInversores,
    cantidadDisenoIngenieria,
    cantidadCertificadoRetie,
    cantidadEstudioConexion,
    cantidadTramitesOperador,
    cantidadSistemaMonitoreo,
    cantidadPolizas,
    cantidadServicioInstalacion,
    cantidadBeneficiosTributarios,
    valorExtras,
    valorProyecto,
    valorIVA,
    valorTotalProyecto,

    porcentajeAnticipo,
    porcentajeEntregaMateriales,
    porcentajeRetie,

    mantenimientoAnual,
    indexacionIPC,
  };
}

module.exports = { calcularProyecto, toNumber, DEFAULTS };
