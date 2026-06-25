// ============================================================
//  COTIZADOR SOLAR — VALIDACIÓN DE VARIABLES
//  Valores de referencia tomados de imagen Excel (24/06/2026)
//  Cliente: ALFREDO MORELOS — Cotización #4215
// ============================================================

// ─────────────────────────────────────────────────────────────
// BLOQUE 1 — DATOS DEL CLIENTE (variables fijas de entrada)
// ─────────────────────────────────────────────────────────────
const fecha               = new Date("2026-06-24");
const numeroCotizacion    = 4215;
const nombreCliente       = "ALFREDO MORELOS";
const tipoIdentificacion  = "NIT";
const numeroIdentificacion = "1152689738";
const contacto            = "3043838770";
const correo              = "juanfelipepradaing@gmail.com";
const celular             = "3043838770";
const comercial           = "Martin Uribe";
const canales             = "whatsapp";
const nombreProyecto      = "Isla Múcura";
const departamento        = "Antioquia";
const municipio           = "Medellín";
const consumoKWhMes       = 1000;
const tipoProyecto        = "Hogar";
const costoKWhCliente     = 900;
const contribucion        = "NO";
const areaDisponible      = 800;
const tipoCubierta        = "Standing Seam";
const nivelTension        = "";          // vacío en imagen
const tipoTransformador   = "MONOUSUARIO";

// ─────────────────────────────────────────────────────────────
// BLOQUE 2 — PARÁMETROS GENERALES (constantes del sistema)
// ─────────────────────────────────────────────────────────────
const tasaImpuestos        = 0.35;        // 35%
const inflacion            = 0.08;        // 8%
const radiacion            = 1387;        // kWh/kWp/año  ← IMAGEN: 1387 (amarillo)
const maxAC100kWp          = 135;         // 100 AC Max
const maxGrande            = 4.5;         // Max >100 AC
const kwpManual            = null;        // vacío → automático
const sobredimension       = 0.30;        // 30%
const potenciaPanel        = 620;         // Wp
const areaPanel            = 2.5;         // m² por panel
const factorArea           = 5.5;         // m²/kWp
const precioKwpBase        = 4500000;     // $/kWp  ← imagen: $4.500.000 (amarillo)
const ivaProyecto          = 0.05;        // 5%
const ivaExtras            = 0.19;        // 19%
const uvt                  = 42412;       // $42.412
const degradacionPaneles   = 0.0055;      // 0.55%
const costoComercializacion = 120;        // $/kWh
const costoGeneracion      = 330;         // $/kWh
const mantenimientoKwp     = 45000;       // $/kWp
const wacc                 = 0.20;        // 20%

// Costos unitarios por componente
const precioPanelW         = 550;         // K4 $/W
const precioInversorW      = 400;         // K5 $/W
const costoManoObraKwp     = 400000;      // K6 $/kWp
const costoEstructuraKwp   = 200000;      // K7 $/kWp
const costoMatElectricoKwp = 200000;      // K8 $/kWp
const costoRetie           = 2000000;     // fijo

// PPA
const margenVentaPPA       = 0.15;        // 15%
const descuentoPPA         = 0.35;        // 35%
const indexadoPPA          = 0.05;        // 5%
const gastosAdmPorc        = 0.08;        // 8%
const mantenimientoPorc    = 0.01;        // 1%
const anosPPA              = 15;
const margenCostos         = 0.30;        // 30%

// Precio Solartech
const precioKwpSolartech   = 3200000;     // T6

// ─────────────────────────────────────────────────────────────
// BLOQUE 3 — CÁLCULOS (replicando fórmulas Excel)
// ─────────────────────────────────────────────────────────────

// G3 — Max >100 AC  =B16*12/E4*52%
const maxGrandeCalc = (consumoKWhMes * 12 / radiacion) * 0.52;

// E6 — kWp Propuesto
const kwpPorConsumo = consumoKWhMes * 12 / radiacion;
const areaRequerida = kwpPorConsumo * factorArea;
const kwpPropuesto  = areaRequerida < areaDisponible
  ? kwpPorConsumo
  : areaDisponible / factorArea;

// F7 — kWp limitado regulatorio
let kwpLimitado;
if (kwpPropuesto < maxAC100kWp)       kwpLimitado = kwpPropuesto;
else if (kwpPropuesto < maxGrandeCalc) kwpLimitado = kwpPropuesto;
else if (maxGrandeCalc < maxAC100kWp)  kwpLimitado = maxAC100kWp;
else                                   kwpLimitado = maxGrandeCalc;

// E7 — kWp Final (redondeo a panel entero)
const kwpPorPanel = potenciaPanel / 1000;
const kwpFinal    = Math.floor(kwpLimitado / kwpPorPanel) * kwpPorPanel;

// E8 — Potencia AC
const potenciaAC = kwpFinal / (1 + sobredimension);

// E10 — Generación mensual
const generacionMensual = kwpFinal * radiacion / 12;

// E11 — Gen/Consumo
const relacionGenConsumo = generacionMensual / consumoKWhMes;

// E12 — % Excedentes
let porcentajeExcedentes;
if (relacionGenConsumo <= 0.33) {
  porcentajeExcedentes = 0;
} else if (relacionGenConsumo <= 1) {
  porcentajeExcedentes = (5/7) * relacionGenConsumo - (15/67);
} else {
  porcentajeExcedentes = (0.5 * consumoKWhMes + generacionMensual - consumoKWhMes) / generacionMensual;
}

// E21 — Número de inversores
const cantidadInversores = potenciaAC <= 50 ? 1 : Math.ceil(potenciaAC / 50);

// E24 — Número de paneles
const cantidadPaneles = kwpFinal / kwpPorPanel;

// E30 — Área necesaria
const areaNecesaria = factorArea * kwpFinal;

// E25 — $ kWh Ahorro
const valorKwhAhorro = contribucion === "SI" ? costoKWhCliente * 1.2 : costoKWhCliente;

// E26 — $ kWh Venta
const valorKwhVenta = kwpFinal > maxAC100kWp
  ? costoGeneracion
  : valorKwhAhorro - costoComercializacion;

// ── COSTOS DIRECTOS ─────────────────────────────────────────

const costoPaneles         = cantidadPaneles * precioPanelW * potenciaPanel;
const costoInversores      = potenciaAC * precioInversorW * 1000;
const costoManoObra        = kwpFinal * costoManoObraKwp;
const costoEstructura      = kwpFinal * costoEstructuraKwp;
const costoMaterialElect   = kwpFinal * costoMatElectricoKwp;
const costoProtecciones    = kwpFinal > 340 ? 50000000 : 0;
const costoEstudioConexion = kwpFinal > 145 ? 10000000 : 0;
const costoImprevistos     = (costoPaneles + costoInversores) * 0.05;
const costoExtras          = 0;

// UPME
const costoProyectoBaseUPME = kwpFinal * precioKwpBase + costoExtras;
let costoUPME;
if (costoProyectoBaseUPME < uvt * 3305) {
  costoUPME = 13.4 * uvt;
} else {
  const upmeCalc = 13.4 * uvt + ((costoProyectoBaseUPME - 3305 * uvt) * 0.405) * 0.005;
  costoUPME = Math.min(upmeCalc, 275 * uvt);
}

const costoTotalProyecto = costoPaneles + costoInversores + costoManoObra +
  costoEstructura + costoMaterialElect + costoProtecciones +
  costoEstudioConexion + costoRetie + costoUPME + costoImprevistos + costoExtras;

const margenProyecto       = costoTotalProyecto / (1 - margenCostos);
const valorVentaKwp        = margenProyecto / kwpFinal;
const costoKwp             = costoTotalProyecto / kwpFinal;

// ── PRECIO DE VENTA ─────────────────────────────────────────

const costoProyecto        = kwpFinal * precioKwpBase;
const costoProyectoMasExtras = costoExtras + costoProyecto;
const valorIVA             = costoProyecto * ivaProyecto + costoExtras * ivaExtras;
const costoProyectoTotal   = costoProyectoMasExtras + valorIVA;
const anticipo50           = costoProyectoTotal * 0.50;
const anticipo40           = costoProyectoTotal * 0.40;
const reserva10            = costoProyectoTotal * 0.10;

const costoProyectoPPA     = costoTotalProyecto / (1 - margenVentaPPA);
const valorKwpPPA          = costoProyectoPPA / kwpFinal;

// Solartech / Inversiones
const kwpProyecto               = kwpFinal;
const costoProyectoDistribuido  = kwpProyecto * precioKwpSolartech;
const inversionInversionista    = costoProyectoDistribuido / 2;
const inversionSolartech        = costoProyectoPPA - inversionInversionista;

// ── PPA ─────────────────────────────────────────────────────

const tarifaPPA            = valorKwhAhorro * (1 - descuentoPPA);
const ingresosPPA          = kwpFinal * radiacion * tarifaPPA;
const rentabilidadAnual    = ingresosPPA / costoProyectoPPA;
const gastosAdministrativos = ingresosPPA * gastosAdmPorc;
const costoMantenimiento   = costoProyectoPPA * mantenimientoPorc;
const ingresoNeto          = ingresosPPA - gastosAdministrativos - costoMantenimiento;
const rentabilidadNeta     = ingresoNeto / costoProyectoPPA;

const ingresoSolartech      = ingresoNeto / 2;
const ingresoInversionista  = ingresoNeto / 2;
const rentabilidadSolartech    = ingresoSolartech / inversionSolartech;
const rentabilidadInversionista = ingresoInversionista / inversionInversionista;

// ── FLUJOS DE CAJA ──────────────────────────────────────────

const inversionInicial = -costoProyectoPPA;
const flujos = [inversionInicial];
let flujoBase = ingresoNeto;
for (let i = 1; i <= anosPPA; i++) {
  flujos.push(flujoBase);
  flujoBase *= (1 + indexadoPPA);
}
const [,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15] = flujos;

// ── TIR (Newton-Raphson) ────────────────────────────────────

function calcularTIR(fl, guess = 0.1) {
  let tasa = guess;
  for (let i = 0; i < 1000; i++) {
    let vpn = 0, dvpn = 0;
    for (let t = 0; t < fl.length; t++) {
      vpn  += fl[t] / Math.pow(1 + tasa, t);
      dvpn -= t * fl[t] / Math.pow(1 + tasa, t + 1);
    }
    const nueva = tasa - vpn / dvpn;
    if (Math.abs(nueva - tasa) < 1e-7) return nueva;
    tasa = nueva;
  }
  return tasa;
}

function calcularVPN(tasa, fl) {
  let vna = fl[0];
  for (let t = 1; t < fl.length; t++) vna += fl[t] / Math.pow(1 + tasa, t);
  return vna;
}

const tir15Anos = calcularTIR(flujos.slice(0, 16));
const tir10Anos = calcularTIR(flujos.slice(0, 11));
const tir8Anos  = calcularTIR(flujos.slice(0, 9));
const vpn15Anos = calcularVPN(wacc, flujos.slice(0, 16));
const vpn10Anos = calcularVPN(wacc, flujos.slice(0, 11));
const vpn8Anos  = calcularVPN(wacc, flujos.slice(0, 9));

// ── REGULATORIO ─────────────────────────────────────────────

const requiereContrato  = potenciaAC > 110 ? 1 : 0;
const contratoRespaldoEPM = requiereContrato ? "SI" : "NO";
const vrAnualContrato   = requiereContrato
  ? (kwpFinal / 1.3) * 40000 * 12 * 0.20 : 0;

// ── AUXILIARES ──────────────────────────────────────────────

const ahorroMensual         = generacionMensual * costoKWhCliente;
const ahorroAnual           = ahorroMensual * 12;
const retornoInversion      = costoProyectoPPA / ingresoNeto;
const porcentajeAutoconsumo = 1 - porcentajeExcedentes;
const porcentajeVentaRed    = porcentajeExcedentes;
const porcentajeCobertura   = relacionGenConsumo;

// ─────────────────────────────────────────────────────────────
// BLOQUE 4 — CONSOLE.LOG DE VALIDACIÓN
// Referencia imagen Excel vs resultado calculado
// ─────────────────────────────────────────────────────────────

const $ = v => Math.round(v).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const P = v => (v * 100).toFixed(2) + "%";
const N = (v, d=2) => parseFloat(v.toFixed(d));

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║         VALIDACIÓN COTIZADOR SOLAR — 24/06/2026                ║");
console.log("║         Cliente: ALFREDO MORELOS | Cotización #4215            ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");

console.log("\n── DATOS CLIENTE ────────────────────────────────────────  ESPERADO");
console.log(`  fecha              : ${fecha.toLocaleDateString("es-CO")}              | 24/06/2026`);
console.log(`  numeroCotizacion   : ${numeroCotizacion}                            | 4215`);
console.log(`  nombreCliente      : ${nombreCliente}              | ALFREDO MORELOS`);
console.log(`  tipoIdentificacion : ${tipoIdentificacion}                             | NIT`);
console.log(`  numeroIdentificacion: ${numeroIdentificacion}                    | 1152689738`);
console.log(`  contacto           : ${contacto}                    | 3043838770`);
console.log(`  correo             : ${correo}  | juanfelipepradaing@gmail.com`);
console.log(`  celular            : ${celular}                    | 3043838770`);
console.log(`  comercial          : ${comercial}                    | Martin Uribe`);
console.log(`  departamento       : ${departamento}                       | Antioquia`);
console.log(`  municipio          : ${municipio}                        | Medellín`);
console.log(`  consumoKWhMes      : ${consumoKWhMes}                          | 1.000`);
console.log(`  tipoProyecto       : ${tipoProyecto}                          | Hogar`);
console.log(`  costoKWhCliente    : ${costoKWhCliente}                           | 900`);
console.log(`  contribucion       : ${contribucion}                            | NO`);
console.log(`  areaDisponible     : ${areaDisponible}                           | 800`);
console.log(`  tipoCubierta       : ${tipoCubierta}                  | Standing Seam`);

console.log("\n── PARÁMETROS GENERALES ─────────────────────────────────  ESPERADO");
console.log(`  tasaImpuestos      : ${P(tasaImpuestos)}                         | 35%`);
console.log(`  inflacion          : ${P(inflacion)}                          | 8%`);
console.log(`  radiacion          : ${radiacion}                          | 1387`);
console.log(`  maxAC100kWp        : ${maxAC100kWp}                           | 135`);
console.log(`  sobredimension     : ${P(sobredimension)}                         | 30%`);
console.log(`  potenciaPanel      : ${potenciaPanel}                           | 620`);
console.log(`  factorArea         : ${factorArea}                           | 5,5`);
console.log(`  precioKwpBase      : ${$(precioKwpBase)}               | $4.500.000`);
console.log(`  uvt                : ${$(uvt)}                    | $42.412`);
console.log(`  degradacionPaneles : ${P(degradacionPaneles)}                      | 0,55%`);
console.log(`  wacc               : ${P(wacc)}                         | 20%`);

console.log("\n── DIMENSIONAMIENTO TÉCNICO ─────────────────────────────  ESPERADO");
console.log(`  kwpPropuesto       : ${N(kwpPropuesto)}                         | 8,7`);
console.log(`  kwpFinal           : ${N(kwpFinal)}                         | 8,06`);
console.log(`  kwpLimitado (F7)   : ${N(kwpLimitado)}                         | 8,65`);
console.log(`  potenciaAC         : ${N(potenciaAC)}                         | 6,20`);
console.log(`  sobredimension     : ${P(sobredimension)}                         | 30%`);
console.log(`  generacionMensual  : ${N(generacionMensual)}                          | 932`);
console.log(`  relacionGenConsumo : ${P(relacionGenConsumo)}                        | 93,2%`);
console.log(`  porcentajeExcedentes: ${P(porcentajeExcedentes)}                       | 44,1%`);
console.log(`  cantidadInversores : ${cantidadInversores}                             | 1`);
console.log(`  potenciaPanel      : ${potenciaPanel}                           | 620`);
console.log(`  areaPanel          : ${areaPanel}                           | 2,5`);
console.log(`  cantidadPaneles    : ${N(cantidadPaneles)}                            | 13`);
console.log(`  valorKwhAhorro     : ${valorKwhAhorro}                           | 900`);
console.log(`  valorKwhVenta      : ${valorKwhVenta}                           | 780`);
console.log(`  costoComercializacion: ${costoComercializacion}                          | 120`);
console.log(`  costoGeneracion    : ${costoGeneracion}                           | 330`);
console.log(`  factorArea         : ${factorArea}                           | 5,5`);
console.log(`  areaNecesaria      : ${N(areaNecesaria)}                         | 44,33`);
console.log(`  contratoRespaldoEPM: ${contratoRespaldoEPM}                            | NO`);
console.log(`  vrAnualContrato    : ${$(vrAnualContrato)}                         | $0`);
console.log(`  uvt                : ${uvt}                         | 42.412`);
console.log(`  degradacionPaneles : ${P(degradacionPaneles)}                      | 0,55%`);

console.log("\n── COSTOS DIRECTOS ──────────────────────────────────────  ESPERADO");
console.log(`  costoPaneles       : ${$(costoPaneles)}               | $4.433.000`);
console.log(`  costoInversores    : ${$(costoInversores)}               | $2.480.000`);
console.log(`  costoManoObra      : ${$(costoManoObra)}               | $3.224.000`);
console.log(`  costoEstructura    : ${$(costoEstructura)}               | $1.612.000`);
console.log(`  costoMaterialElect : ${$(costoMaterialElect)}               | $1.612.000`);
console.log(`  costoProtecciones  : ${$(costoProtecciones)}                      | $0`);
console.log(`  costoEstudioConexion: ${$(costoEstudioConexion)}                     | $0`);
console.log(`  costoRetie         : ${$(costoRetie)}               | $2.000.000`);
console.log(`  costoUPME          : ${$(costoUPME)}                  | $568.321`);
console.log(`  costoImprevistos   : ${$(costoImprevistos)}                  | $345.650`);
console.log(`  costoExtras        : ${$(costoExtras)}                      | $0`);
console.log(`  costoTotalProyecto : ${$(costoTotalProyecto)}              | $16.274.971`);
console.log(`  margenProyecto     : ${$(margenProyecto)}              | $23.249.958`);
console.log(`  valorVentaKwp      : ${$(valorVentaKwp)}               | $2.884.610`);
console.log(`  costoKwp           : ${$(costoKwp)}               | $2.019.227`);

console.log("\n── PRECIO DE VENTA ──────────────────────────────────────  ESPERADO");
console.log(`  costoProyecto      : ${$(costoProyecto)}              | $36.270.000`);
console.log(`  costoProyectoMasExtras: ${$(costoProyectoMasExtras)}             | $36.270.000`);
console.log(`  valorIVA           : ${$(valorIVA)}               | $1.813.500`);
console.log(`  costoProyectoTotal : ${$(costoProyectoTotal)}              | $38.083.500`);
console.log(`  anticipo50         : ${$(anticipo50)}              | $19.041.750`);
console.log(`  anticipo40         : ${$(anticipo40)}              | $15.233.400`);
console.log(`  reserva10          : ${$(reserva10)}               | $3.808.350`);

console.log("\n── MODELO PPA ───────────────────────────────────────────  ESPERADO");
console.log(`  margenVentaPPA     : ${P(margenVentaPPA)}                         | 15%`);
console.log(`  costoProyectoPPA   : ${$(costoProyectoPPA)}              | $19.147.024`);
console.log(`  valorKwpPPA        : ${$(valorKwpPPA)}               | $2.375.561`);
console.log(`  rentabilidadAnual  : ${P(rentabilidadAnual)}                        | 34%`);
console.log(`  ingresosPPA        : ${$(ingresosPPA)}               | $6.539.844`);
console.log(`  tarifaPPA          : ${tarifaPPA}                           | 585`);
console.log(`  descuentoPPA       : ${P(descuentoPPA)}                         | 35%`);
console.log(`  gastosAdministrativos: ${$(gastosAdministrativos)}                  | $523.187`);
console.log(`  costoMantenimiento : ${$(costoMantenimiento)}                  | $191.470`);
console.log(`  ingresoNeto        : ${$(ingresoNeto)}               | $5.825.186`);
console.log(`  rentabilidadNeta   : ${P(rentabilidadNeta)}                         | 30%`);
console.log(`  indexadoPPA        : ${P(indexadoPPA)}                          | 5%`);
console.log(`  anosPPA            : ${anosPPA}                            | 15`);

console.log("\n── DISTRIBUCIÓN DE INVERSIÓN ────────────────────────────  ESPERADO");
console.log(`  kwpProyecto        : ${N(kwpProyecto)}                         | 8,06`);
console.log(`  costoProyectoDistribuido: ${$(costoProyectoDistribuido)}             | $25.792.000`);
console.log(`  valorProyectoKwp   : ${$(precioKwpSolartech)}               | $3.200.000`);
console.log(`  inversionSolartech : ${$(inversionSolartech)}               | $6.251.024`);
console.log(`  inversionInversionista: ${$(inversionInversionista)}             | $12.896.000`);
console.log(`  ingresoSolartech   : ${$(ingresoSolartech)}               | $2.912.593`);
console.log(`  ingresoInversionista: ${$(ingresoInversionista)}              | $2.912.593`);
console.log(`  rentabilidadSolartech: ${P(rentabilidadSolartech)}                       | 47%`);
console.log(`  rentabilidadInversionista: ${P(rentabilidadInversionista)}                  | 23%`);

console.log("\n── FLUJO FINANCIERO ─────────────────────────────────────  ESPERADO");
console.log(`  inversionInicial   : ${$(inversionInicial)}             | -$19.147.024`);
console.log(`  flujoAno1          : ${$(f1)}               | $5.825.186`);
console.log(`  flujoAno2          : ${$(f2)}`);
console.log(`  flujoAno3          : ${$(f3)}`);
console.log(`  flujoAno5          : ${$(f5)}`);
console.log(`  flujoAno10         : ${$(f10)}`);
console.log(`  flujoAno15         : ${$(f15)}`);

console.log("\n── INDICADORES FINANCIEROS ──────────────────────────────  ESPERADO");
console.log(`  tir15Anos          : ${P(tir15Anos)}                         | (imagen sin valor visible)`);
console.log(`  tir10Anos          : ${P(tir10Anos)}`);
console.log(`  tir8Anos           : ${P(tir8Anos)}`);
console.log(`  vpn15Anos          : ${$(vpn15Anos)}             | (imagen sin valor visible)`);
console.log(`  vpn10Anos          : ${$(vpn10Anos)}`);
console.log(`  vpn8Anos           : ${$(vpn8Anos)}`);

console.log("\n── AUXILIARES ───────────────────────────────────────────  ESPERADO");
console.log(`  ahorroMensual      : ${$(ahorroMensual)}                  | ~$838.800`);
console.log(`  ahorroAnual        : ${$(ahorroAnual)}              | ~$10.065.600`);
console.log(`  retornoInversion   : ${N(retornoInversion, 1)} años                    | ~3,3 años`);
console.log(`  porcentajeCobertura: ${P(porcentajeCobertura)}                        | 93,2%`);
console.log(`  porcentajeAutoconsumo: ${P(porcentajeAutoconsumo)}                      | ~55,9%`);
console.log(`  porcentajeVentaRed : ${P(porcentajeVentaRed)}                       | 44,1%`);

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║                    FIN VALIDACIÓN                              ║");
console.log("╚══════════════════════════════════════════════════════════════════╝\n");