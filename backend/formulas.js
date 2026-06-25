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

// ── Valores por defecto de configuración ────────────────────
// Estos son los fallback cuando no hay config guardada en BD.
// Los valores reales se administran desde el panel de Configuración.
const DEFAULTS = {
  potenciaPanel:       610,       // Wp por panel
  radiacionSolar:      3.8,       // HSP promedio (horas sol pico diario)
  margenCobertura:     0.9,       // Factor de eficiencia del sistema (PR)
  capacidadInversor:   3000,      // W por inversor
  costokWp:            3500000,   // COP por kWp instalado
  longitudRiel:        4.7,       // metros por riel
  cableSolar:          10,        // metros de cable solar incluidos
  ivaPct:              5,         // % IVA sobre el proyecto (Ley 1715)
  descuentoRentaPct:   50,        // % de descuento en renta (beneficio tributario)
  costoGeneracion:     330,       // COP/kWh — tarifa de generación CREG
  costoComercializacion: 120,     // COP/kWh — cargo de comercialización CREG (Excel: 120)
  factorAreaM2PorKwp:  5.5,       // m²/kWp de techo requerido (Excel: 5.5)
  factorCO2:           0.3612,    // tonCO2/kWp·año (factor de emisión red eléctrica CO)
  factorArboles:       0.02,      // tonCO2 absorbidas por árbol/año
  factorGalones:       117.6,     // galones de gasolina equivalentes por tonCO2
  sobredimension:      0.30,      // factor de sobredimensionamiento DC/AC (Excel: 30%)
  maxAC100kWp:         135,       // kWp DC umbral pequeño/gran autogenerador (<100 kW AC)
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

  const consumo     = toNumber(consumoKwh);   // kWh/mes del cliente
  const costoUnidad = toNumber(costoKwh);     // COP/kWh (tarifa del cliente)
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
  const sobredimension     = cfg.sobredimension     ?? DEFAULTS.sobredimension;   // E8
  const maxAC100kWp        = cfg.maxAC100kWp        || DEFAULTS.maxAC100kWp;      // F7

  // ── 1. Radiación ────────────────────────────────────────
  // radiacionSolar = HSP diario de la ciudad (horas sol pico)
  // radiacion_anual = HSP * 365 kWh/kWp/año — igual que el Excel (ej: 3.8*365 = 1387)
  // margenCobertura se conserva para display (radiacionSolarCobertura) pero NO se aplica
  // a las fórmulas de generación/dimensionamiento, igual que el Excel (formulasJuan.js).
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(2)); // solo display

  // ── 2. Tamaño del sistema (kWp) ──────────────────────────
  // E6 — kWp para cubrir el consumo anual: consumo*12 / (HSP*365)
  // (equivalente a Excel: consumo*12 / radiacion_anual)
  const kWpPorConsumo = (consumo * 12) / (radiacionSolar * 365);

  // kWp máximo permitido por el área del techo disponible
  const kWpMaximoPorArea = (!Number.isNaN(areaDisp) && areaDisp > 0)
    ? areaDisp / factorAreaM2PorKwp
    : Infinity;

  // kwp1 = menor entre lo que permite el consumo y lo que permite el área
  const kwp1 = Math.min(kWpMaximoPorArea, kWpPorConsumo);

  // G3 — límite máximo para gran autogenerador (>100 kW AC) según CREG
  const maxGrandeCalc = kWpPorConsumo * 0.52;

  // F7 — kWp limitado por regulación (Excel: F7)
  const kWpPorPanel = potenciaPanel / 1000;
  let kwpLimitado;
  if      (kwp1 < maxAC100kWp)        kwpLimitado = kwp1;           // pequeño autogenerador: sin límite
  else if (kwp1 < maxGrandeCalc)       kwpLimitado = kwp1;           // área restringe antes del límite
  else if (maxGrandeCalc < maxAC100kWp) kwpLimitado = maxAC100kWp;  // gran sistema: límite 100AC
  else                                 kwpLimitado = maxGrandeCalc;  // muy grande: límite CREG

  // E7 — kWp final redondeado a panel entero hacia abajo (Excel: FLOOR, no CEIL)
  const kwp = Math.floor(kwpLimitado / kWpPorPanel) * kWpPorPanel;

  // E8 — Potencia AC del inversor (kWp DC / factor de sobredimensionamiento)
  const potenciaAC = Number((kwp / (1 + sobredimension)).toFixed(2));

  // ── 3. Wh/día del sistema instalado ─────────────────────
  // Sin PR, igual que Excel: kWp × HSP_diario × 1000
  const wPromedioDia = Math.round(kwp * radiacionSolar * 1000);

  // ── 4. Financiero ────────────────────────────────────────
  // Factura mensual actual = consumo × tarifa del cliente
  const facturaPromedio = Math.round(consumo * costoUnidad);

  // E10 — Generación mensual: kWp × radiacion_anual / 12 (sin PR, igual que Excel)
  const generacionMes = Math.round(kwp * radiacionSolar * 365 / 12);

  // Si el cliente paga contribución de solidaridad, la tarifa efectiva sube 20%
  const costoKwhAjustado = contribucion ? costoUnidad * 1.2 : costoUnidad;

  // E11 — Relación generación / consumo
  const ratioGenConsumo = consumo > 0 ? generacionMes / consumo : 0;

  // E12 — % excedentes exportados a la red (fórmula Excel)
  let excedentes;
  if (ratioGenConsumo <= 0.33) {
    excedentes = 0;
  } else if (ratioGenConsumo <= 1) {
    excedentes = (5 / 7) * ratioGenConsumo - (15 / 67);  // Excel: (5/7)*r - 15/67
  } else {
    excedentes = (0.5 * consumo + generacionMes - consumo) / generacionMes;
  }

  // Tarifas reguladas CREG — configurables desde el panel de administración
  const costoGeneracion       = cfg.costoGeneracion       || DEFAULTS.costoGeneracion;
  const costoComercializacion = cfg.costoComercializacion || DEFAULTS.costoComercializacion;

  // E26 — Precio de venta de excedentes:
  //   > maxAC100kWp (gran autogenerador): tarifa fija de generación CREG
  //   ≤ maxAC100kWp (pequeño autogenerador): tarifa cliente menos comercialización
  const costoExcedentes = kwp > maxAC100kWp
    ? costoGeneracion
    : costoKwhAjustado - costoComercializacion;

  // Ahorro mensual = autoconsumo ahorrado + excedentes vendidos
  const ahorroMensual = Math.round(
    generacionMes * costoKwhAjustado * (1 - excedentes) +
    generacionMes * costoExcedentes  * excedentes
  );
  const ahorroAnual  = Math.round(ahorroMensual * 12);
  const ahorro10Anos = Math.round(ahorroAnual * 10);

  const costoProyecto        = Math.round(kwp * costokWp);
  const ivaProyecto          = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));

  const tiempoRetorno = ahorroMensual > 0
    ? Number((costoProyectoMasIva / ahorroMensual / 12).toFixed(1))
    : null;
  const valorKwp = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  // ── 5. Equipos ───────────────────────────────────────────
  // E24 — Número de paneles (kwp es múltiplo exacto de kWpPorPanel → división exacta)
  const npaneles = Math.round(kwp / kWpPorPanel);

  // E21 — Número de inversores según potencia AC (Excel: 1 si ≤50 kW, sino ceil(AC/50))
  const ninversores = potenciaAC <= 50 ? 1 : Math.ceil(potenciaAC / 50);

  // Materiales de estructura y cableado
  const riel47       = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland     = Math.ceil((npaneles * 2) - 2);
  const endCland     = Math.ceil(npaneles / 2);
  const lFoot        = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;

  // ── 6. Producción estimada ───────────────────────────────
  // Sin PR, igual que Excel: Wp × npaneles × radiacion_anual/12 / 1000
  const produccionDeEnergia = Math.round(
    (potenciaPanel * npaneles * radiacionSolar * 365 / 12) / 1000
  );

  // ── 7. Área ──────────────────────────────────────────────
  // E30 — Área necesaria para el sistema
  const areaMinima = Math.round(kwp * factorAreaM2PorKwp);

  // Cobertura de factura = % del consumo cubierto por la generación
  const porcentajeCoberturaProyecto = consumo > 0
    ? Math.min(100, Number(((generacionMes / consumo) * 100).toFixed(1)))
    : 0;

  // ── 8. Impacto ambiental ─────────────────────────────────
  const co2EvitadoToneladas     = Number((kwp * factorCO2).toFixed(2));
  const arbolesEquivalentes     = Math.round(co2EvitadoToneladas / factorArboles);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * factorGalones);

  const equipos = ['Paneles solares', 'Inversor', 'Estructuras', 'Cableado'];

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

    generacionMes,
    excedentes,
    ratioGenConsumo,
    costoExcedentes,
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
