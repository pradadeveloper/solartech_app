// ============================================================
//  MODELOS FINANCIEROS DE LA PROPUESTA — Solartech
//
//  Fuente: "Análisis Financiero (3).xlsx" (flujo de caja después de
//  impuestos, VPN, TIR, retorno) y "Cotizador WEB.xlsm" (hoja PPA y
//  Tabla PPA). Las diferencias con esos libros están anotadas abajo.
//
//  Este archivo existe dos veces, idéntico:
//    backend/finanzas.js       → lo usa el PDF
//    frontend/src/finanzas.js  → lo usan Resultado y la propuesta pública
//  `node backend/scripts/verificar-finanzas.js` revisa que sean iguales
//  y que reproduzcan las cifras de los dos libros.
// ============================================================

const FIN_DEFAULTS = {
  horizonte: 25,                 // años evaluados (vida útil del sistema)
  incrementoTarifa: 0.05,        // alza anual del kWh (ambos libros)
  degradacion: 0.0055,           // pérdida de generación por año, lineal sobre el año 1
  incrementoMantenimiento: 0.05,
  tasaImpuesto: 0.35,            // renta de personas jurídicas
  tasaDescuento: 0.12,           // WACC del libro para el VPN
  depreciacionAnios: 3,          // depreciación acelerada (Ley 1715)
  deduccionPct: 0.5,             // deducción especial en renta (Ley 1715)
  deduccionAnio: 2,
  reposicionPct: 0.10,           // reposición de inversores
  reposicionAnio: 10,
  // Los libros toman los beneficios y la reposición sobre el valor con IVA;
  // aquí, por prudencia, sobre el valor sin IVA (como Flujos del Cotizador WEB).
  baseConIva: false,

  // ── PPA (Cotizador WEB, DATOS ENTRADA N3:P30) ──
  ppaDescuento: 0.35,            // tarifa PPA = tarifa del cliente × (1 − 35 %)
  ppaPlazo: 15,                  // años de contrato; al final los equipos pasan al cliente
  // Rentabilidad para Solartech (uso interno, no va en la propuesta)
  ppaMargen: 0.15,
  ppaGastosAdmPct: 0.08,         // sobre el ingreso
  ppaMantenimientoPctCapex: 0.01,
  ppaTasaDescuento: 0.20,
  costoPanelPorW: 550,           // COP por W de panel
  costoInversorPorW: 400,        // COP por W AC de inversor
  costoManoObraKwp: 400000,
  costoEstructuraKwp: 200000,
  costoElectricoKwp: 200000,
  costoProteccionesGrandes: 50000000,  // > 340 kWp
  costoEstudioConexion: 10000000,      // > 145 kWp
  costoRetie: 2000000,
  uvt: 49799,                    // UVT para la tarifa de certificación UPME
  imprevistosPct: 0.05,          // sobre paneles + inversores
};

function tir(flujos, guess = 0.1) {
  let tasa = guess;
  for (let i = 0; i < 1000; i++) {
    let vpn = 0, dvpn = 0;
    for (let t = 0; t < flujos.length; t++) {
      vpn += flujos[t] / Math.pow(1 + tasa, t);
      dvpn -= (t * flujos[t]) / Math.pow(1 + tasa, t + 1);
    }
    if (dvpn === 0) return null;
    const nueva = tasa - vpn / dvpn;
    if (!Number.isFinite(nueva)) return null;
    if (Math.abs(nueva - tasa) < 1e-9) return nueva;
    tasa = nueva;
  }
  return null;
}

function vpn(tasa, flujos) {
  return flujos.reduce((s, f, t) => s + f / Math.pow(1 + tasa, t), 0);
}

// Año (con decimales) en que el acumulado pasa de negativo a positivo; null si no ocurre.
function retorno(flujos) {
  let acum = flujos[0];
  if (acum >= 0) return 0;
  for (let t = 1; t < flujos.length; t++) {
    const previo = acum;
    acum += flujos[t];
    if (acum >= 0) return t - 1 + (-previo / flujos[t]);
  }
  return null;
}

const conDefaults = (cfg) => ({ ...FIN_DEFAULTS, ...(cfg || {}) });
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ── Compra con recursos propios: flujo de caja del cliente ───────────────────
// p: { costoProyecto (sin IVA), costoProyectoMasIva, ahorroAnual (año 1),
//      mantenimientoAnual (año 1), esEmpresa (NIT: aplica Ley 1715 e impuestos) }
function analizarRecursosPropios(p, cfg) {
  const c = conDefaults(cfg);
  const inversion = num(p.costoProyectoMasIva);
  const base = c.baseConIva ? inversion : num(p.costoProyecto);
  const ahorro1 = num(p.ahorroAnual);
  const mant1 = num(p.mantenimientoAnual);
  const empresa = !!p.esEmpresa;
  const t = c.tasaImpuesto;

  const anios = [];
  const flujos = [-inversion];
  for (let y = 1; y <= c.horizonte; y++) {
    const ahorro = ahorro1 * Math.pow(1 + c.incrementoTarifa, y - 1) * (1 - c.degradacion * (y - 1));
    const mantenimiento = -mant1 * Math.pow(1 + c.incrementoMantenimiento, y - 1);
    const reposicion = y === c.reposicionAnio ? -base * c.reposicionPct : 0;
    let depreciacion = 0, deduccion = 0, impuestos = 0;
    if (empresa) {
      depreciacion = y <= c.depreciacionAnios ? (base / c.depreciacionAnios) * t : 0;
      deduccion = y === c.deduccionAnio ? base * c.deduccionPct * t : 0;
      // El ahorro sube la renta gravable; mantenimiento y reposición son deducibles.
      impuestos = -(ahorro + mantenimiento + reposicion) * t;
    }
    const neto = ahorro + mantenimiento + reposicion + depreciacion + deduccion + impuestos;
    flujos.push(neto);
    anios.push({ anio: y, ahorro, mantenimiento, reposicion, depreciacion, deduccion, impuestos, neto });
  }

  let acum = flujos[0];
  anios.forEach((a, i) => { acum += flujos[i + 1]; a.acumulado = acum; });
  const descontados = flujos.map((f, k) => f / Math.pow(1 + c.tasaDescuento, k));
  const hasta = (n) => flujos.slice(0, n + 1);

  return {
    modalidad: 'recursos_propios',
    inversion,
    esEmpresa: empresa,
    anios,
    flujos,
    vpn10: vpn(c.tasaDescuento, hasta(10)),
    vpn25: vpn(c.tasaDescuento, hasta(c.horizonte)),
    tir10: tir(hasta(10)),
    tir25: tir(hasta(c.horizonte)),
    retornoAnios: retorno(flujos),
    retornoDescontadoAnios: retorno(descontados),
    ganancia10: anios[9] ? anios[9].acumulado : null,
    ganancia25: anios[c.horizonte - 1].acumulado,
    beneficiosTributarios: empresa
      ? { depreciacion: base * t, deduccion: base * c.deduccionPct * t, total: base * t + base * c.deduccionPct * t }
      : null,
    supuestos: {
      incrementoTarifa: c.incrementoTarifa, degradacion: c.degradacion, tasaImpuesto: t,
      tasaDescuento: c.tasaDescuento, reposicionAnio: c.reposicionAnio, reposicionPct: c.reposicionPct,
    },
  };
}

// ── PPA: el cliente no invierte; paga la energía con descuento ──────────────
// p: { kwp, potenciaAC, npaneles, potenciaPanel (W), generacionAnual (kWh año 1),
//      tarifa (COP/kWh que paga hoy, con contribución si aplica), costoProyecto, extras }
// Igual que el Cotizador WEB, toda la generación se valora a la tarifa de la red.
function calcularPPA(p, cfg) {
  const c = conDefaults(cfg);
  const tarifa = num(p.tarifa);
  const tarifaPPA1 = tarifa * (1 - c.ppaDescuento);
  const gen1 = num(p.generacionAnual);

  const anios = [];
  let acum = 0;
  for (let y = 1; y <= c.horizonte; y++) {
    const f = Math.pow(1 + c.incrementoTarifa, y - 1);
    const tarifaRed = tarifa * f;
    const tarifaPPA = y > c.ppaPlazo ? 0 : tarifaPPA1 * f;
    const kwh = gen1 * (1 - c.degradacion * (y - 1));
    const pagoPPA = kwh * tarifaPPA;
    const costoRed = kwh * tarifaRed;
    const ahorro = costoRed - pagoPPA;
    acum += ahorro;
    anios.push({ anio: y, tarifaRed, tarifaPPA, kwh, pagoPPA, costoRed, ahorro, acumulado: acum });
  }
  const acumuladoA = (n) => (anios[n - 1] ? anios[n - 1].acumulado : null);

  // Rentabilidad para Solartech (DATOS ENTRADA I4:J18 y N3:AL16). Uso interno.
  const kwp = num(p.kwp);
  const extras = num(p.extras);
  const ventaSinIva = num(p.costoProyecto) + extras;
  const U = c.uvt;
  const upme = ventaSinIva < 3305 * U
    ? 13.4 * U
    : Math.min(13.4 * U + (ventaSinIva - 3305 * U) * 0.405 * 0.005, 275 * U);
  const paneles = num(p.npaneles) * c.costoPanelPorW * num(p.potenciaPanel);
  const inversores = num(p.potenciaAC) * c.costoInversorPorW * 1000;
  const costoInterno = paneles + inversores
    + kwp * (c.costoManoObraKwp + c.costoEstructuraKwp + c.costoElectricoKwp)
    + (kwp > 340 ? c.costoProteccionesGrandes : 0)
    + (kwp > 145 ? c.costoEstudioConexion : 0)
    + c.costoRetie + upme + (paneles + inversores) * c.imprevistosPct + extras;
  const capex = costoInterno / (1 - c.ppaMargen);
  const ingreso1 = gen1 * tarifaPPA1;
  const neto1 = ingreso1 * (1 - c.ppaGastosAdmPct) - capex * c.ppaMantenimientoPctCapex;
  // Como el libro: ingreso indexado y sin degradación durante el contrato.
  const flujosInv = [-capex];
  for (let y = 1; y <= c.ppaPlazo; y++) flujosInv.push(neto1 * Math.pow(1 + c.incrementoTarifa, y - 1));

  return {
    modalidad: 'ppa',
    descuento: c.ppaDescuento,
    plazo: c.ppaPlazo,
    indexacion: c.incrementoTarifa,
    tarifaRed1: tarifa,
    tarifaPPA1,
    generacionAnual1: gen1,
    pagoMensual1: anios[0].pagoPPA / 12,
    facturaRedMensual1: anios[0].costoRed / 12,
    ahorroMensual1: anios[0].ahorro / 12,
    ahorroAnual1: anios[0].ahorro,
    acumulado5: acumuladoA(5),
    acumulado10: acumuladoA(10),
    acumulado15: acumuladoA(15),
    acumulado25: acumuladoA(c.horizonte),
    ahorroContrato: acumuladoA(c.ppaPlazo),
    anios,
    interno: {
      costoInterno, upme, capex, ingreso1, neto1,
      tir8: tir(flujosInv.slice(0, 9)),
      tir10: tir(flujosInv.slice(0, 11)),
      tirPlazo: tir(flujosInv),
      vpnPlazo: vpn(c.ppaTasaDescuento, flujosInv),
    },
  };
}

// Entradas de los modelos a partir de un resultado de cálculo o un lead guardado.
function entradasDesde(r, extra = {}) {
  const kwp = num(r.kwp);
  // contribucion puede llegar como texto desde un formulario ("false" no es verdadero).
  const contribucion = r.contribucion === true || ['true', 'si', 'sí', '1'].includes(String(r.contribucion).trim().toLowerCase());
  const tarifaBase = num(r.costoKwhAjustado) || num(r.costoKwh) * (contribucion ? 1.2 : 1);
  const generacionAnual = num(r.generacionMes) * 12
    || kwp * (num(r.radiacionSolar) || 3.8) * 365;
  return {
    kwp,
    potenciaAC: num(r.potenciaAC) || kwp / 1.3,
    npaneles: num(r.npaneles),
    potenciaPanel: num(r.potenciaPanel) || 610,
    generacionAnual,
    tarifa: tarifaBase,
    costoProyecto: num(r.costoProyecto) || num(r.costoProyectoMasIva) / 1.05,
    costoProyectoMasIva: num(r.costoProyectoMasIva),
    ahorroAnual: num(r.ahorroAnual) || num(r.ahorroMensual) * 12,
    mantenimientoAnual: num(r.mantenimientoAnual) || kwp * 45000,
    esEmpresa: String(r.tipoDocumento || '').toUpperCase() === 'NIT',
    ...extra,
  };
}

module.exports = { FIN_DEFAULTS, analizarRecursosPropios, calcularPPA, entradasDesde, tir, vpn, retorno };
