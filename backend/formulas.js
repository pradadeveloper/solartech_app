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
  potenciaPanel:     610,       // Wp por panel
  radiacionSolar:    3.8,       // HSP promedio (horas sol pico)
  margenCobertura:   0.9,       // Factor de eficiencia del sistema (PR)
  capacidadInversor: 3000,      // W por inversor
  costokWp:          3500000,   // COP por kWp instalado
  longitudRiel:      4.7,       // metros por riel
  cableSolar:        10,        // metros de cable solar incluidos
  ivaPct:               5,    // % IVA sobre el proyecto
  descuentoRentaPct:    50,   // % de descuento en renta (beneficio tributario)
  costoGeneracion:      330,  // COP/kWh — tarifa de generación (CREG)
  costoComercializacion: 115, // COP/kWh — cargo de comercialización (CREG)
  factorAreaM2PorKwp:   5.8,  // m² de techo requeridos por kWp instalado
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
  const potenciaPanel     = cfg.potenciaPanel     || DEFAULTS.potenciaPanel;
  const radiacionSolar    = Number(radiacionData) > 0 ? Number(radiacionData) : (cfg.radiacionSolar || DEFAULTS.radiacionSolar);
  const margenCobertura   = cfg.margenCobertura   || DEFAULTS.margenCobertura;
  const capacidadInversor = cfg.capacidadInversor || DEFAULTS.capacidadInversor;
  const costokWp          = cfg.costokWp          || DEFAULTS.costokWp;
  const longitudRiel      = cfg.longitudRiel      || DEFAULTS.longitudRiel;
  const cableSolar        = cfg.cableSolar        || DEFAULTS.cableSolar;
  const ivaPct            = cfg.ivaPct            ?? DEFAULTS.ivaPct;
  const descuentoRentaPct = cfg.descuentoRentaPct ?? DEFAULTS.descuentoRentaPct;
  const factorCO2              = cfg.factorCO2              || DEFAULTS.factorCO2;
  const factorAreaM2PorKwp     = cfg.factorAreaM2PorKwp     || DEFAULTS.factorAreaM2PorKwp;
  const factorArboles     = cfg.factorArboles     || DEFAULTS.factorArboles;
  const factorGalones     = cfg.factorGalones     || DEFAULTS.factorGalones;

  // ── 1. Radiación efectiva ────────────────────────────────
  // HSP ajustada por el Performance Ratio (margenCobertura)
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));

  // ── 3. Tamaño del sistema (kWp) ──────────────────────────
  // kWp necesario para cubrir el consumo anual del cliente
  const kWpPorConsumo = (consumo * 12) / radiacionSolar;
  // kWp máximo que permite el área disponible del techo (sin restricción si no se informó área)
  const kWpMaximoPorArea = (!Number.isNaN(areaDisp) && areaDisp > 0) ? areaDisp / factorAreaM2PorKwp : Infinity;
  // Se usa el menor: el área limita el sistema si el techo es pequeño
  const kwp1 = Math.min(kWpMaximoPorArea, kWpPorConsumo);
  // Redondear al número entero de paneles hacia arriba → kWp real instalado
  const kWpPorPanel = potenciaPanel / 1000;
  const kwp = Math.ceil(kwp1 / kWpPorPanel) * kWpPorPanel;

  // ── 2. Wh/día del sistema instalado (derivado del kWp real, no del consumo) ──
  const wPromedioDia = Math.round(kwp * radiacionSolarCobertura * 1000);

  // ── 4. Financiero ────────────────────────────────────────
  // Factura mensual = consumo × tarifa (lo que el cliente paga actualmente)
  const facturaPromedio      = Math.round(consumo * costoUnidad);

  // kWh generados por mes = kWp instalado × radiación anual / 12
  const generacionMes = (kwp * radiacionSolar) / 12;

  // Si el cliente tiene contribución de solidaridad, su tarifa efectiva es 20% mayor
  const costoKwhAjustado = contribucion ? costoUnidad * 1.2 : costoUnidad;

  // Ratio generación / consumo (E11 en la hoja de cálculo)
  const ratioGenConsumo = consumo > 0 ? generacionMes / consumo : 0;

  // Excedentes: fracción de la generación que se exporta a la red
  let excedentes;
  if (ratioGenConsumo <= 0.3) {
    excedentes = 0;                                                         // genera menos del 30% → no hay excedentes
  } else if (ratioGenConsumo <= 1) {
    excedentes = (5 / 7) * ratioGenConsumo - 15 / 68;                      // escala proporcional entre 30% y 100%
  } else {
    excedentes = (0.5 * consumo + generacionMes - consumo) / generacionMes; // genera más del consumo → excedente real
  }

  // Tarifas reguladas (CREG) — configurables desde el panel de administración
  const costoGeneracion       = cfg.costoGeneracion       || DEFAULTS.costoGeneracion;
  const costoComercializacion = cfg.costoComercializacion || DEFAULTS.costoComercializacion;

  // Precio de venta de excedentes:
  //   > 136 kWp (gran autogenerador): tarifa fija de generación
  //   ≤ 136 kWp (pequeño autogenerador): tarifa neta ajustada
  const costoExcedentes = kwp > 136
    ? costoGeneracion
    : costoKwhAjustado - costoComercializacion;

  // Ahorro mensual = autoconsumo ahorrado + excedentes exportados
  const ahorroMensual  = Math.round(
    generacionMes * costoKwhAjustado * (1 - excedentes) +
    generacionMes * costoExcedentes  * excedentes
  );
  const ahorroAnual    = Math.round(ahorroMensual * 12);   // COP/año
  const ahorro10Anos   = Math.round(ahorroAnual * 10);     // COP en 10 años

  const costoProyecto        = Math.round(kwp * costokWp);             // COP sin IVA
  const ivaProyecto          = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva  = Math.round(costoProyecto + ivaProyecto);
  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));

  // Tiempo de retorno = Costo total (con IVA) / Ahorro mensual real / 12 meses → años
  const tiempoRetorno = ahorroMensual > 0
    ? Number((costoProyectoMasIva / ahorroMensual / 12).toFixed(1))
    : null;
  const valorKwp = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  // ── 5. Equipos ───────────────────────────────────────────
  // Número de paneles derivado directamente del kWp calculado (consistente con kwp)
  const npaneles   = Math.ceil(kwp1 / kWpPorPanel);
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
  const areaMinima = Math.round(kwp * factorAreaM2PorKwp);

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
    costoKwhAjustado,
    contribucion: !!contribucion,
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
