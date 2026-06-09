// ============================================================
//  FÓRMULAS Y CÁLCULOS — Solartech Energy Systems
//  Modificar este archivo para ajustar cualquier cálculo del
//  sistema sin tocar la lógica del servidor (index.js).
// ============================================================

// ── Utilidad numérica ────────────────────────────────────────
function toNumber(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// ── Valores por defecto de configuración ────────────────────
// Estos son los fallback cuando no hay config guardada en BD.
// Los valores reales se administran desde el panel de Configuración.
const DEFAULTS = {
  potenciaPanel:     585,       // Wp por panel
  radiacionSolar:    3.8,       // HSP promedio (horas sol pico)
  margenCobertura:   0.8,       // Factor de eficiencia del sistema (PR)
  capacidadInversor: 3000,      // W por inversor
  costokWp:          3500000,   // COP por kWp instalado
  longitudRiel:      4.7,       // metros por riel
  cableSolar:        10,        // metros de cable solar incluidos
  ivaPct:            5,         // % IVA sobre el proyecto
  descuentoRentaPct: 50,        // % de descuento en renta (beneficio tributario)
  factorCO2:         0.3612,    // tonCO2/kWp·año (factor de emisión red eléctrica CO)
  factorArboles:     0.02,      // tonCO2 absorbidas por árbol/año
  factorGalones:     117.6,     // galones de gasolina equivalentes por tonCO2
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
  radiacionSolar: radiacionData,
  ciudadSolar,
}, cfg = {}) {

  const consumo     = toNumber(consumoKwh);   // kWh/mes del cliente
  const costoUnidad = toNumber(costoKwh);     // COP/kWh (tarifa del cliente)
  const areaDisp    = toNumber(areaDisponible);

  if ([consumo, costoUnidad].some((n) => Number.isNaN(n))) {
    throw new Error('Valores numéricos inválidos: consumoKwh o costoKwh');
  }

  // Parámetros de configuración (config de BD con fallback a DEFAULTS)
  const potenciaPanel     = cfg.potenciaPanel     || DEFAULTS.potenciaPanel;
  const radiacionSolar    = Number(radiacionData) > 0 ? Number(radiacionData) : (cfg.radiacionSolar || DEFAULTS.radiacionSolar);
  const margenCobertura   = cfg.margenCobertura   || DEFAULTS.margenCobertura;
  const capacidadInversor = cfg.capacidadInversor || DEFAULTS.capacidadInversor;
  const costokWp          = cfg.costokWp          || DEFAULTS.costokWp;
  const longitudRiel      = cfg.longitudRiel      || DEFAULTS.longitudRiel;
  const cableSolar        = cfg.cableSolar        || DEFAULTS.cableSolar;
  const ivaPct            = cfg.ivaPct            ?? DEFAULTS.ivaPct;
  const descuentoRentaPct = cfg.descuentoRentaPct ?? DEFAULTS.descuentoRentaPct;
  const factorCO2         = cfg.factorCO2         || DEFAULTS.factorCO2;
  const factorArboles     = cfg.factorArboles     || DEFAULTS.factorArboles;
  const factorGalones     = cfg.factorGalones     || DEFAULTS.factorGalones;

  // ── 1. Radiación efectiva ────────────────────────────────
  // HSP ajustada por el Performance Ratio (margenCobertura)
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));

  // ── 2. Consumo diario ────────────────────────────────────
  // Convertir kWh/mes a Wh/día usando promedio anual de 365 días
  const wPromedioDia = Number((((consumo * 1000) * 12) / 365).toFixed(1));

  // ── 3. Tamaño del sistema (kWp) ──────────────────────────
  // kWp = Wh/día requeridos / (HSP efectivo × 1000)
  const kwpNum = (wPromedioDia / radiacionSolarCobertura) / 1000;
  const kwp    = Number(kwpNum.toFixed(1));

  // ── 4. Financiero ────────────────────────────────────────
  // Factura mensual = consumo × tarifa (lo que el cliente paga actualmente)
  const facturaPromedio      = Math.round(consumo * costoUnidad);
  const ahorroMensual        = facturaPromedio;                         // COP/mes ahorrado
  const ahorroAnual          = Math.round(facturaPromedio * 12);        // COP/año
  const ahorro10Anos         = Math.round(ahorroAnual * 10);            // COP en 10 años

  const costoProyecto        = Math.round(kwp * costokWp);             // COP sin IVA
  const ivaProyecto          = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));

  // Tiempo de retorno = Costo total (con IVA) / Ahorro mensual / 12 meses → años
  const tiempoRetorno = facturaPromedio > 0
    ? Number((costoProyectoMasIva / facturaPromedio / 12).toFixed(1))
    : null;
  const valorKwp = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  // ── 5. Equipos ───────────────────────────────────────────
  // Número de paneles = Wh/día / (Wp_panel × HSP_efectivo)
  const npaneles   = Math.ceil(wPromedioDia / (potenciaPanel * radiacionSolarCobertura));
  const ninversores = 1;

  // Materiales de estructura y cableado
  const riel47       = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2); // rieles necesarios
  const midCland     = Math.ceil((npaneles * 2) - 2);                     // mid clamps
  const endCland     = Math.ceil(npaneles / 2);                           // end clamps
  const lFoot        = Math.ceil(riel47 * 3);                             // L-feet (3 por riel)
  const groundingLoop = Math.round(riel47 / 2) * 2;                       // puntos de tierra

  // ── 6. Producción estimada ───────────────────────────────
  // kWh/mes = (Wp_panel × N_paneles × HSP_efectivo × 30 días) / 1000
  const produccionDeEnergia = Math.round(
    (potenciaPanel * npaneles * radiacionSolarCobertura * 30) / 1000
  );

  // ── 7. Área ──────────────────────────────────────────────
  // ~5.8 m² por kWp instalado (panel 585W ≈ 2.8m², densidad de montaje)
  const areaMinima = Math.round(kwp * 5.8);

  // Porcentaje del área disponible que cubre el proyecto
  let porcentajeCoberturaProyecto = 0;
  if (!Number.isNaN(areaDisp) && areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }

  // ── 8. Impacto ambiental ─────────────────────────────────
  // CO2 evitado = kWp × factor de emisión de la red (tonCO2/kWp·año)
  const co2EvitadoToneladas     = Number((kwp * factorCO2).toFixed(2));
  // Árboles equivalentes = CO2 evitado / CO2 que absorbe un árbol/año
  const arbolesEquivalentes     = Math.round(co2EvitadoToneladas / factorArboles);
  // Galones de gasolina = CO2 evitado × factor de equivalencia energética
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * factorGalones);

  const equipos = ['Paneles solares', 'Inversor', 'Estructuras', 'Cableado'];

  return {
    nombre, correo, telefono, ubicacion, preferenciaContacto,
    tipoSolicitud, tipoTecho, recibeFactura, sistemaInteres,

    consumoKwh: consumo,
    costoKwh: costoUnidad,
    valorMensual: facturaPromedio,
    areaDisponible: Number.isNaN(areaDisp) ? null : areaDisp,

    wPromedioDia,
    potenciaPanel,
    capacidadInversor,
    kwp,

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

    ahorroAnual,
    ahorroMensual,
    ahorro10Anos,

    equipos,
    areaMinima,

    arbolesEquivalentes,
    galonesGasolinaEvitados,
    co2EvitadoToneladas,
  };
}

module.exports = { calcularProyecto, toNumber, DEFAULTS };
