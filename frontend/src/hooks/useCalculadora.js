import { useMemo } from "react";

// ============================================================
//  useCalculadora — réplica en frontend de backend/formulas.js
//  Permite recalcular instantáneamente (sin roundtrip al backend)
//  cuando el asesor edita una variable en el panel "Variables del
//  proyecto" de Resultado.jsx.
//
//  IMPORTANTE: si backend/formulas.js cambia, esta función debe
//  actualizarse igual — ver memoria "formulas-duplication-gotcha".
// ============================================================

export const CALC_DEFAULTS = {
  potenciaPanel: 610,
  radiacionSolar: 3.8,
  margenCobertura: 0.9,
  capacidadInversor: 3000,
  costokWp: 4500000,
  longitudRiel: 4.7,
  cableSolar: 10,
  ivaPct: 5,
  descuentoRentaPct: 50,
  costoGeneracion: 330,
  costoComercializacion: 120,
  factorAreaM2PorKwp: 5.5,
  factorCO2: 0.3612,
  factorArboles: 0.02,
  factorGalones: 117.6,
  sobredimension: 0.30,
  maxAC100kWp: 135,
  mantenimientoKwp: 45000,
  inflacion: 0.08,
  anticipo1Pct: 50,
  anticipo2Pct: 40,
  anticipo3Pct: 10,
};

function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// TIR (Newton-Raphson) — mismo algoritmo que backend/formulas.js
function calcularTIR(flujos, guess = 0.1) {
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

// ── Motor de cálculo — misma lógica que calcularProyecto() del backend ──
export function calcularProyectoLocal(vars = {}) {
  const consumo = toNumber(vars.consumoKwh);
  const costoUnidad = toNumber(vars.costoKwh);
  const areaDisp = toNumber(vars.areaM2);

  if ([consumo, costoUnidad].some((x) => Number.isNaN(x))) return null;

  const n = (v, fb) => { const x = toNumber(v); return Number.isFinite(x) && x !== 0 ? x : fb; };
  const tn = (v, fb) => { const x = toNumber(v); return Number.isFinite(x) ? x : fb; }; // permite 0

  const potenciaPanel         = n(vars.potenciaPanel,        CALC_DEFAULTS.potenciaPanel);
  const radiacionSolar        = n(vars.radiacion,            CALC_DEFAULTS.radiacionSolar);
  const margenCobertura       = n(vars.margenCobertura,      CALC_DEFAULTS.margenCobertura);
  const capacidadInversor     = n(vars.capacidadInversor,    CALC_DEFAULTS.capacidadInversor);
  const costokWp              = n(vars.costoKwp,             CALC_DEFAULTS.costokWp);
  const longitudRiel          = n(vars.longitudRiel,         CALC_DEFAULTS.longitudRiel);
  const cableSolar            = n(vars.cableSolar,           CALC_DEFAULTS.cableSolar);
  const ivaPct                = tn(vars.ivaPct,              CALC_DEFAULTS.ivaPct);
  const descuentoRentaPct     = tn(vars.descuentoRenta,      CALC_DEFAULTS.descuentoRentaPct);
  const factorCO2             = n(vars.factorCO2,            CALC_DEFAULTS.factorCO2);
  const factorAreaM2PorKwp    = n(vars.factorAreaM2PorKwp,   CALC_DEFAULTS.factorAreaM2PorKwp);
  const factorArboles         = n(vars.factorArboles,        CALC_DEFAULTS.factorArboles);
  const factorGalones         = n(vars.factorGalones,        CALC_DEFAULTS.factorGalones);
  const sobredimension        = tn(vars.sobredimension,      CALC_DEFAULTS.sobredimension);
  const maxAC100kWp           = n(vars.maxAC100kWp,          CALC_DEFAULTS.maxAC100kWp);
  const mantenimientoKwp      = n(vars.mantenimientoKwp,     CALC_DEFAULTS.mantenimientoKwp);
  const inflacion             = tn(vars.inflacion,           CALC_DEFAULTS.inflacion);
  const anticipo1Pct          = tn(vars.anticipo1Pct,        CALC_DEFAULTS.anticipo1Pct);
  const anticipo2Pct          = tn(vars.anticipo2Pct,        CALC_DEFAULTS.anticipo2Pct);
  const anticipo3Pct          = tn(vars.anticipo3Pct,        CALC_DEFAULTS.anticipo3Pct);
  const costoGeneracion       = tn(vars.costoGeneracion,     CALC_DEFAULTS.costoGeneracion);
  const costoComercializacion = tn(vars.costoComercializacion, CALC_DEFAULTS.costoComercializacion);
  const contribucion          = !!vars.contribucion;

  // ── 1. Radiación ──
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(2));
  const radiacionAnual          = Number((radiacionSolar * 365).toFixed(1));

  // ── 2. Tamaño del sistema (kWp) ──
  const kWpPorConsumo    = (consumo * 12) / (radiacionSolar * 365);
  const _areaLimit = (!Number.isNaN(areaDisp) && areaDisp > 0 && factorAreaM2PorKwp > 0)
    ? areaDisp / factorAreaM2PorKwp
    : Infinity;
  const kWpMaximoPorArea = Number.isFinite(_areaLimit) ? _areaLimit : Infinity;
  const kwp1 = Math.min(kWpMaximoPorArea, kWpPorConsumo);

  const maxGrandeCalc = kWpPorConsumo * 0.52;
  const kWpPorPanel = potenciaPanel / 1000;
  let kwpLimitado;
  if      (kwp1 < maxAC100kWp)          kwpLimitado = kwp1;
  else if (kwp1 < maxGrandeCalc)         kwpLimitado = kwp1;
  else if (maxGrandeCalc < maxAC100kWp)  kwpLimitado = maxAC100kWp;
  else                                   kwpLimitado = maxGrandeCalc;

  const kwp = Math.floor(kwpLimitado / kWpPorPanel) * kWpPorPanel;
  const potenciaAC = Number((kwp / (1 + sobredimension)).toFixed(2));

  // ── 3. Producción ──
  const wPromedioDia    = Math.round(kwp * radiacionSolar * 1000);
  const generacionMes   = Math.round((kwp * radiacionSolar * 365) / 12);

  // ── 4. Excedentes ──
  const costoKwhAjustado = contribucion ? costoUnidad * 1.2 : costoUnidad;
  const ratioGenConsumo  = consumo > 0 ? generacionMes / consumo : 0;

  let excedentes;
  if (ratioGenConsumo <= 0.33) {
    excedentes = 0;
  } else if (ratioGenConsumo <= 1) {
    excedentes = (5 / 7) * ratioGenConsumo - (15 / 67);
  } else {
    excedentes = (0.5 * consumo + generacionMes - consumo) / generacionMes;
  }

  const costoExcedentes = kwp > maxAC100kWp
    ? costoGeneracion
    : costoKwhAjustado - costoComercializacion;

  // ── 5. Ahorro y rentabilidad ──
  const ahorroMensual = Math.round(
    generacionMes * costoKwhAjustado * (1 - excedentes) +
    generacionMes * costoExcedentes  * excedentes
  );
  const ahorroAnual  = Math.round(ahorroMensual * 12);
  const ahorro10Anos = Math.round(ahorroAnual * 10);

  const valorKwhAhorro   = costoKwhAjustado;
  const valorKwhVenta    = costoExcedentes;
  const porcentajeAhorro = Number(((1 - excedentes) * 100).toFixed(1));
  const porcentajeVenta  = Number((excedentes * 100).toFixed(1));

  // ── 6. Costos del proyecto ──
  const costoProyecto        = Math.round(kwp * costokWp);
  const ivaProyecto          = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));
  const valorKwp             = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  const tiempoRetorno = ahorroMensual > 0
    ? Number((costoProyectoMasIva / ahorroMensual / 12).toFixed(1))
    : null;

  // ── 7. TIR — perspectiva del cliente ──
  let tir5Anos = null, tir10Anos = null, tir15Anos = null;
  if (ahorroAnual > 0 && costoProyectoMasIva > 0) {
    const flujos = [-costoProyectoMasIva];
    for (let i = 1; i <= 15; i++) flujos.push(Math.round(ahorroAnual * Math.pow(1 + inflacion, i - 1)));
    try { tir5Anos  = Number((calcularTIR(flujos.slice(0, 6))  * 100).toFixed(1)); } catch (e) {}
    try { tir10Anos = Number((calcularTIR(flujos.slice(0, 11)) * 100).toFixed(1)); } catch (e) {}
    try { tir15Anos = Number((calcularTIR(flujos.slice(0, 16)) * 100).toFixed(1)); } catch (e) {}
  }

  // ── 8. Equipos ──
  const npaneles    = Math.round(kwp / kWpPorPanel);
  const ninversores = potenciaAC <= 50 ? 1 : Math.ceil(potenciaAC / 50);
  const riel47        = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland      = Math.ceil(npaneles * 2 - 2);
  const endCland      = Math.ceil(npaneles / 2);
  const lFoot         = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;

  // ── 9. Mantenimiento / área / cobertura ──
  const mantenimientoAnual = Math.round(kwp * mantenimientoKwp);
  const areaMinima = Math.round(kwp * factorAreaM2PorKwp);
  const porcentajeCoberturaProyecto = consumo > 0
    ? Math.min(100, Number(((generacionMes / consumo) * 100).toFixed(1)))
    : 0;

  // ── 10. Impacto ambiental ──
  const co2EvitadoToneladas     = Number((kwp * factorCO2).toFixed(2));
  const arbolesEquivalentes     = Math.round(co2EvitadoToneladas / factorArboles);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * factorGalones);

  return {
    consumoKwh: consumo,
    costoKwh: costoUnidad,
    costoKwhAjustado,
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

    produccionDeEnergia: generacionMes,
    generacionMes,
    porcentajeCoberturaProyecto,
    margenCobertura,
    radiacionSolar,
    radiacionSolarCobertura,
    radiacionAnual,

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

    areaMinima,
    arbolesEquivalentes,
    galonesGasolinaEvitados,
    co2EvitadoToneladas,

    mantenimientoAnual,
    indexacionIPC: inflacion,

    porcentajeAnticipo: anticipo1Pct,
    porcentajeEntregaMateriales: anticipo2Pct,
    porcentajeRetie: anticipo3Pct,
  };
}

export function useCalculadora(vars) {
  return useMemo(() => calcularProyectoLocal(vars), [vars]);
}
