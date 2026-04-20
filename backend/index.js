// LOGICA DE CALCULOS
// backend/index.js actualizado
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const jwt = require('jsonwebtoken');
const USE_GOOGLE = !!process.env.GOOGLE_SERVICE_ACCOUNT;
const gAdapter = USE_GOOGLE ? require('./services/googleAdapter') : null;
if (USE_GOOGLE) console.log('[storage] Google Sheets + Drive activado');
const contadorPath = path.join(__dirname, 'contador.json');
const leadsPath = path.join(__dirname, 'leads.json');
const configPath = path.join(__dirname, 'config.json');

const JWT_SECRET = process.env.JWT_SECRET || 'solartech_clave_secreta_2024';

// Usuarios del sistema — agregar o quitar vendedores aquí
const usuarios = [
  { id: 1, nombre: 'Administrador', apellido: '',      cargo: 'Administrador',    usuario: 'admin',     password: 'solartech2026' },
  { id: 2, nombre: 'Vendedor',      apellido: 'Uno',   cargo: 'Asesor Comercial', usuario: 'vendedor1', password: 'vendedor123'   },
  { id: 3, nombre: 'Vendedor',      apellido: 'Dos',   cargo: 'Asesor Comercial', usuario: 'vendedor2', password: 'vendedor456'   },
];

const app = express();
const PORT = 4000;

const montserratPath = path.join(__dirname, "fonts", "Montserrat-Regular.ttf");
// const montserratBoldPath = path.join(__dirname, "fonts", "Montserrat-Bold.ttf");

// ====== Middlewares ======
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/cotizaciones', express.static(path.join(__dirname, 'public', 'cotizaciones')));

// ====== Multer (uploads) ======
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ====== Almacenamiento unificado (local o Google Sheets/Drive) ======
async function getAllLeads() {
  if (USE_GOOGLE) return gAdapter.getAllLeads();
  if (!fs.existsSync(leadsPath)) return [];
  try { const raw = fs.readFileSync(leadsPath, 'utf-8').trim(); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

async function saveLeadStorage(lead) {
  if (USE_GOOGLE) return gAdapter.saveLead(lead);
  const leads = await getAllLeads();
  leads.push(lead);
  fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));
}

async function updateLeadField(numeroCotizacion, fields) {
  if (USE_GOOGLE) return gAdapter.updateLead(numeroCotizacion, fields);
  const leads = await getAllLeads();
  const idx = leads.findIndex(l => l.numeroCotizacion === numeroCotizacion);
  if (idx === -1) throw new Error('Lead no encontrado');
  Object.assign(leads[idx], fields);
  fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));
}

async function getNextContador() {
  if (USE_GOOGLE) return gAdapter.incrementContador();
  if (!fs.existsSync(contadorPath)) fs.writeFileSync(contadorPath, JSON.stringify({ numero: 0 }, null, 2));
  const raw = fs.readFileSync(contadorPath, 'utf-8');
  const json = JSON.parse(raw);
  json.numero += 1;
  fs.writeFileSync(contadorPath, JSON.stringify(json, null, 2));
  return json.numero;
}

async function savePDFStorage(fileName, pdfBytes) {
  const cotizDir = path.join(__dirname, 'public', 'cotizaciones');
  if (!fs.existsSync(cotizDir)) fs.mkdirSync(cotizDir, { recursive: true });
  fs.writeFileSync(path.join(cotizDir, fileName), pdfBytes);
  const base = (process.env.BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  return `${base}/cotizaciones/${fileName}`;
}

// ====== Config ======
const CONFIG_DEFAULT = {
  costokWp: 3500000, potenciaPanel: 585, capacidadInversor: 3000,
  radiacionSolar: 3.8, margenCobertura: 0.8, longitudRiel: 4.7, cableSolar: 10,
  ivaPct: 5, descuentoRentaPct: 50,
  factorCO2: 0.3612, factorArboles: 0.02, factorGalones: 117.6,
  empresa: { nombre: 'Solartech Energy Systems', telefono: '+57 300 000 0000',
    email: 'info@solartech.com.co', web: 'www.solartechenergysystems.com',
    nit: '900.123.456-7', ciudad: 'Medellin, Colombia' },
};

async function leerConfig() {
  if (USE_GOOGLE) {
    try {
      const remote = await gAdapter.getConfig();
      return { ...CONFIG_DEFAULT, ...remote };
    } catch (_) {}
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return { ...CONFIG_DEFAULT, ...JSON.parse(raw) };
  } catch (_) {
    return { ...CONFIG_DEFAULT };
  }
}

async function guardarConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  if (USE_GOOGLE) {
    try {
      await gAdapter.saveConfig(cfg);
    } catch (err) {
      console.error('[config] Error sincronizando con Sheets:', err.message);
    }
  }
}

// ====== Helpers ======
function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function requireFields(data, fields) {
  const missing = fields.filter((k) => String(data?.[k] ?? "").trim() === "");
  return missing;
}

// ====== Cálculo ======
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
  const consumo = toNumber(consumoKwh);       // kWh/mes
  const costoUnidad = toNumber(costoKwh);     // COP/kWh
  const gastoMensual = toNumber(valorMensual);
  const areaDisp = toNumber(areaDisponible);

  if ([consumo, costoUnidad, gastoMensual].some((n) => Number.isNaN(n))) {
    throw new Error("Valores numéricos inválidos: consumoKwh, costoKwh o valorMensual");
  }

  // Parámetros desde config (con fallback a defaults)
  const potenciaPanel    = cfg.potenciaPanel    || 585;
  const radiacionSolar   = (Number(radiacionData) > 0) ? Number(radiacionData) : (cfg.radiacionSolar || 3.8);
  const margenCobertura  = cfg.margenCobertura  || 0.8;
  const capacidadInversor= cfg.capacidadInversor|| 3000;
  const costokWp         = cfg.costokWp         || 3500000;
  const longitudRiel     = cfg.longitudRiel     || 4.7;
  const cableSolar       = cfg.cableSolar       || 10;
  const ivaPct           = cfg.ivaPct           ?? 5;
  const descuentoRentaPct= cfg.descuentoRentaPct?? 50;
  const factorCO2        = cfg.factorCO2        || 0.3612;
  const factorArboles    = cfg.factorArboles    || 0.02;
  const factorGalones    = cfg.factorGalones    || 117.6;

  // Derivados
  const radiacionSolarCobertura = Number((radiacionSolar * margenCobertura).toFixed(1));

  // Wh/día estimado desde kWh/mes
  const wPromedioDia = Number((((consumo * 1000) * 12) / 365).toFixed(1));

  // kWp
  const kwpNum = (wPromedioDia / radiacionSolarCobertura) / 1000;
  const kwp = Number(kwpNum.toFixed(1));

  // Costos
  const ahorroAnual = Math.round(consumo * 12 * costoUnidad);
  const ahorroMensual = Math.round(consumo * costoUnidad);
  const ahorro10Anos = Math.round(ahorroAnual * 10);

  const costoProyecto = Math.round(kwp * costokWp);
  const ivaProyecto = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva = Math.round(costoProyecto + ivaProyecto);

  const costokwpproyecto = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));
  const tiempoRetorno = ahorroAnual > 0 ? Number((costoProyecto / ahorroAnual).toFixed(1)) : null;
  const valorKwp = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  // Equipos
  const npaneles = Math.ceil(wPromedioDia / (potenciaPanel * radiacionSolarCobertura));
  const ninversores = Math.ceil((potenciaPanel * npaneles) / capacidadInversor);

  const riel47 = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland = Math.ceil((npaneles * 2) - 2);
  const endCland = Math.ceil(npaneles / 2);
  const lFoot = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;

  // Producción mensual estimada (kWh/mes)
  const produccionDeEnergia = Math.round((potenciaPanel * npaneles * radiacionSolarCobertura * 30) / 1000);

  // Área mínima estimada
  const areaMinima = Math.round(kwp * 5.8);

  // Cobertura por área (si aplica)
  let porcentajeCoberturaProyecto = 0;
  if (!Number.isNaN(areaDisp) && areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }

  // Ambiental
  const co2EvitadoToneladas = Number((kwp * factorCO2).toFixed(2));
  const arbolesEquivalentes = Math.round(co2EvitadoToneladas / factorArboles);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * factorGalones);

  const equipos = ["Paneles solares", "Inversor", "Estructuras", "Cableado"];

  return {
    nombre,
    correo,
    telefono,
    ubicacion,
    preferenciaContacto,
    tipoSolicitud,
    tipoTecho,
    recibeFactura,
    sistemaInteres,

    consumoKwh: consumo,
    costoKwh: costoUnidad,
    valorMensual: gastoMensual,
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

// ====== PDF ======
async function generarPDF(data, resultados, asesor = {}, cfg = {}) {
  const empresa = cfg.empresa || {};
  const empNombre  = empresa.nombre   || 'Solartech Energy Systems';
  const empTel     = empresa.telefono || '+57 300 000 0000';
  const empEmail   = empresa.email    || 'info@solartech.com.co';
  const empWeb     = empresa.web      || 'www.solartechenergysystems.com';
  const empNit     = empresa.nit      || '900.123.456-7';
  const empCiudad  = empresa.ciudad   || 'Medellin, Colombia';
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(montserratPath);
  const font = await pdfDoc.embedFont(fontBytes);

  const W = 595, H = 842;
  const margin = 42;
  const cW = W - margin * 2;
  const headerH = 80;
  const footerH = 30;

  const COLOR_ACCENT  = rgb(0.690, 0.227, 0.133);
  const COLOR_TEXT    = rgb(0, 0, 0);
  const COLOR_MUTED   = rgb(0.12, 0.12, 0.12);
  const COLOR_WHITE   = rgb(1, 1, 1);
  const COLOR_BORDER  = rgb(0.6, 0.6, 0.6);
  const COLOR_LIGHT   = rgb(0.92, 0.92, 0.92);
  const COLOR_ACLIGHT = rgb(0.97, 0.90, 0.87);

  let logoImg = null;
  const logoPath = path.join(__dirname, 'public', 'assets', 'logo_solartech.png');
  if (fs.existsSync(logoPath)) {
    try { logoImg = await pdfDoc.embedPng(fs.readFileSync(logoPath)); } catch (_) {}
  }

  let bannerImg = null;
  const bannerPath = path.join(__dirname, 'public', 'assets', 'banner_resultadospdf.jpg');
  if (fs.existsSync(bannerPath)) {
    try { bannerImg = await pdfDoc.embedJpg(fs.readFileSync(bannerPath)); } catch (_) {}
  }

  // Logos de marcas aliadas
  const frontendLogos = path.join(__dirname, '..', 'frontend', 'public', 'logos');
  const brandLogos = {};
  for (const [key, file] of [['longi', 'logo_longi.png'], ['growatt', 'growatt.png']]) {
    const lp = path.join(frontendLogos, file);
    if (fs.existsSync(lp)) {
      try { brandLogos[key] = await pdfDoc.embedPng(fs.readFileSync(lp)); } catch (_) {}
    }
  }

  let page;
  let y;

  function newPage() {
    page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOR_WHITE });

    // Header rojo
    page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: COLOR_ACCENT });

    if (logoImg) {
      const lW = 150;
      const lH = (logoImg.height / logoImg.width) * lW;
      page.drawImage(logoImg, { x: margin, y: H - headerH + (headerH - lH) / 2, width: lW, height: lH });
    } else {
      page.drawText('SOLARTECH ENERGY', { x: margin, y: H - headerH + 32, size: 14, font, color: COLOR_WHITE });
    }

    const cx = W - margin - 190;
    page.drawText(`${empTel}  |  ${empEmail}`, { x: cx, y: H - headerH + 52, size: 7.5, font, color: COLOR_WHITE });
    page.drawText(empWeb, { x: cx, y: H - headerH + 38, size: 7.5, font, color: rgb(1, 0.85, 0.80) });
    page.drawText(`NIT: ${empNit}  |  ${empCiudad}`, { x: cx, y: H - headerH + 24, size: 7, font, color: rgb(1, 0.85, 0.80) });

    // Footer
    page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: COLOR_LIGHT });
    page.drawLine({ start: { x: 0, y: footerH }, end: { x: W, y: footerH }, thickness: 0.5, color: COLOR_BORDER });
    page.drawText(`${empNombre}  -  Propuesta Tecnica y Comercial  -  Documento confidencial`, {
      x: margin, y: 9, size: 7, font, color: COLOR_MUTED,
    });
    page.drawText(`N-${resultados?.numeroCotizacion ?? '-'}`, {
      x: W - margin - 40, y: 9, size: 7.5, font, color: COLOR_MUTED,
    });

    y = H - headerH - 18;
  }

  function checkY(needed) {
    if (y - needed < footerH + 16) newPage();
  }

  const safe = (v) => (v == null || v === '' ? '-' : String(v));
  const cop = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;

  function sectionHeader(title) {
    checkY(46);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 28, width: cW, height: 28, color: COLOR_LIGHT, borderColor: COLOR_BORDER, borderWidth: 0.5 });
    page.drawRectangle({ x: margin, y: y - 28, width: 5, height: 28, color: COLOR_ACCENT });
    page.drawText(title, { x: margin + 14, y: y - 18, size: 11, font, color: COLOR_ACCENT });
    y -= 36;
  }

  function infoRow(label, value, highlight) {
    const rH = 22;
    checkY(rH);
    if (highlight) {
      page.drawRectangle({ x: margin, y: y - rH, width: cW, height: rH, color: COLOR_ACLIGHT, borderColor: COLOR_ACCENT, borderWidth: 0.5 });
    } else {
      page.drawRectangle({ x: margin, y: y - rH, width: cW, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER, borderWidth: 0.3 });
    }
    page.drawText(String(label), { x: margin + 10, y: y - 14, size: 9, font, color: highlight ? COLOR_ACCENT : COLOR_MUTED });
    page.drawText(String(value ?? '-'), { x: margin + cW / 2, y: y - 14, size: 10, font, color: highlight ? COLOR_ACCENT : COLOR_TEXT });
    y -= rH;
  }

  function infoRow2(l1, v1, l2, v2) {
    const rH = 22;
    const half = (cW - 6) / 2;
    checkY(rH);
    page.drawRectangle({ x: margin, y: y - rH, width: half, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER, borderWidth: 0.3 });
    page.drawText(String(l1), { x: margin + 8, y: y - 14, size: 8.5, font, color: COLOR_MUTED });
    page.drawText(String(v1 ?? '-'), { x: margin + 8 + half / 2, y: y - 14, size: 9.5, font, color: COLOR_TEXT });
    const rx = margin + half + 6;
    page.drawRectangle({ x: rx, y: y - rH, width: half, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER, borderWidth: 0.3 });
    page.drawText(String(l2), { x: rx + 8, y: y - 14, size: 8.5, font, color: COLOR_MUTED });
    page.drawText(String(v2 ?? '-'), { x: rx + 8 + half / 2, y: y - 14, size: 9.5, font, color: COLOR_TEXT });
    y -= rH;
  }

  function para(text, indent, size, color) {
    indent = indent || 0;
    size = size || 9.5;
    color = color || COLOR_TEXT;
    const maxW = cW - indent - 8;
    const words = String(text).split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        checkY(size + 4);
        page.drawText(line, { x: margin + indent, y, size, font, color });
        y -= size + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      checkY(size + 4);
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= size + 4;
    }
  }

  function bullet(text, indent) {
    indent = indent || 10;
    checkY(18);
    page.drawRectangle({ x: margin + indent, y: y - 9, width: 5, height: 5, color: COLOR_ACCENT });
    page.drawText(text, { x: margin + indent + 12, y: y - 10, size: 9.5, font, color: COLOR_TEXT });
    y -= 18;
  }

  const gap = (n) => { y -= (n || 10); };

  // ─── INICIO ───
  newPage();

  // Banner imagen — pegado al borde inferior del header rojo
  const bannerH = 155;
  if (bannerImg) {
    page.drawImage(bannerImg, { x: 0, y: H - headerH - bannerH, width: W, height: bannerH });
    y = H - headerH - bannerH - 24; // espacio entre banner y título
  } else {
    y -= 10;
  }

  page.drawText('PROPUESTA TECNICA Y COMERCIAL', { x: margin, y, size: 15, font, color: COLOR_ACCENT });
  y -= 16;
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Cotizacion N-${resultados?.numeroCotizacion ?? '-'}   |   Fecha: ${fecha}`, { x: margin, y, size: 9, font, color: COLOR_MUTED });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 1, color: COLOR_ACCENT });
  y -= 16;

  const asesorNombre = `${asesor.nombre || ''} ${asesor.apellido || ''}`.trim() || 'Asesor Comercial';

  // 1. CLIENTE
  sectionHeader('DATOS DEL CLIENTE');
  infoRow2('Nombre completo', safe(data.nombre), 'Identificacion', safe(data.identificacion));
  infoRow2('Correo electronico', safe(data.correo), 'Telefono', safe(data.telefono));
  infoRow2('Municipio / Ubicacion', safe(data.ubicacion), 'Preferencia contacto', safe(data.preferenciaContacto));
  infoRow2('Tipo de solicitud', safe(data.tipoSolicitud), 'Tipo de techo', safe(data.tipoTecho));
  infoRow2('Recibe factura', safe(data.recibeFactura), 'Sistema de interes', safe(data.sistemaInteres));
  gap(6);

  // 3. SISTEMA SOLAR
  sectionHeader('TU SISTEMA SOLAR');
  infoRow2('Potencia del sistema', `${safe(resultados.kwp)} kWp`, 'Numero de paneles', `${safe(resultados.npaneles)} paneles`);
  infoRow2('Numero de inversores', `${safe(resultados.ninversores)} und`, 'Potencia por panel', `${safe(resultados.potenciaPanel)} W`);
  infoRow2('Produccion estimada', `${safe(resultados.produccionDeEnergia)} kWh/mes`, 'Cobertura del sistema', `${safe(resultados.porcentajeCoberturaProyecto)}%`);
  infoRow2('Consumo del cliente', `${safe(resultados.consumoKwh)} kWh/mes`, 'Area minima requerida', `${safe(resultados.areaMinima)} m2`);
  infoRow2('Area disponible declarada', `${safe(data.areaDisponible)} m2`, 'Radiacion solar local', `${safe(resultados.radiacionSolar)} kWh/m2/dia`);
  gap(6);

  // 4. ANALISIS FINANCIERO
  sectionHeader('ANALISIS FINANCIERO');
  infoRow('Ahorro mensual estimado', cop(resultados.ahorroMensual));
  infoRow('Ahorro anual estimado', cop(resultados.ahorroAnual));
  infoRow('Ahorro proyectado a 10 anos', cop(resultados.ahorro10Anos));
  infoRow('Tiempo de retorno de la inversion', `${safe(resultados.tiempoRetorno)} anos`);
  gap(6);

  // 5. PROPUESTA ECONOMICA
  sectionHeader('PROPUESTA ECONOMICA');
  infoRow('Costo del sistema (sin IVA)', cop(resultados.costoProyecto));
  infoRow('IVA aplicable (5%)', cop(resultados.ivaProyecto));
  infoRow('TOTAL CON IVA - PRECIO FINAL', cop(resultados.costoProyectoMasIva), true);
  infoRow('Descuento declaracion de renta (Ley 1715)', cop(resultados.descuentoDeclaracion));
  infoRow('Costo por kWp instalado', cop(resultados.valorKwp));
  gap(6);

  // 6. RESUMEN INVERSION
  sectionHeader('RESUMEN DE LA INVERSION');
  checkY(20);
  page.drawText('Componentes e items incluidos en el proyecto:', { x: margin + 10, y, size: 9, font, color: COLOR_TEXT });
  y -= 14;
  const componentes = [
    `${resultados.npaneles} paneles solares de ${resultados.potenciaPanel} W (LONGi / JA Solar)`,
    `${resultados.ninversores} inversor(es) de ${(resultados.capacidadInversor / 1000).toFixed(1)} kW (Huawei / Growatt / GoodWe)`,
    `${resultados.riel47} rieles de aluminio 4.7 m para estructura de montaje`,
    `${resultados.midCland} mid clamps y ${resultados.endCland} end clamps de fijacion`,
    `${resultados.lFoot} L-Foot de anclaje a cubierta`,
    `${resultados.cableSolar} m de cable solar 10 mm2`,
    `${resultados.groundingLoop} m grounding loop puesta a tierra`,
    'Cableado de AC/DC, protecciones electricas y fusibles',
    'Instalacion, puesta en marcha y configuracion de monitoreo remoto',
    'Capacitacion al usuario y entrega de manual de operacion',
  ];
  componentes.forEach((c) => bullet(c, 10));
  gap(6);

  // 7. FORMAS DE PAGO
  sectionHeader('FORMAS DE PAGO');
  const formasPago = [
    { t: '1. Pago de contado', d: 'Pago total antes de iniciar la instalacion. Garantiza disponibilidad inmediata de equipos y posible descuento por pronto pago.' },
    { t: '2. Credito bancario', d: 'Financiacion directa con su entidad bancaria. Solartech entrega la documentacion tecnica requerida para la solicitud.' },
    { t: '3. Financiacion interna', d: 'Plan de cuotas mensuales acordado directamente con Solartech Energy Systems. Solicite condiciones personalizadas.' },
    { t: '4. Leasing solar', d: 'Arrendamiento financiero del sistema fotovoltaico con opcion de compra al finalizar el contrato pactado.' },
    { t: '5. Subsidio / Fondo Emprender', d: 'Para proyectos que apliquen, gestionamos el acceso a fondos de cofinanciacion FNCER y subsidios gubernamentales.' },
  ];
  formasPago.forEach(({ t, d }) => {
    checkY(42);
    page.drawText(t, { x: margin + 10, y, size: 9, font, color: COLOR_ACCENT });
    y -= 13;
    para(d, 14, 8.5, COLOR_MUTED);
    gap(3);
  });
  gap(6);

  // 8. IMPACTO AMBIENTAL
  sectionHeader('IMPACTO AMBIENTAL');
  infoRow2('Arboles equivalentes al ano', `${safe(resultados.arbolesEquivalentes)} arboles`, 'CO2 evitado anualmente', `${safe(resultados.co2EvitadoToneladas)} toneladas`);
  infoRow('Galones de gasolina ahorrados al ano', `${safe(resultados.galonesGasolinaEvitados)} galones`);
  gap(4);
  para('Al elegir energia solar contribuye activamente a la reduccion de emisiones de CO2 y a la independencia energetica de Colombia. Su sistema generara energia limpia por mas de 25 anos.', 10, 8.5, COLOR_MUTED);
  gap(6);

  // 9. ETAPAS DEL PROYECTO
  sectionHeader('ETAPAS DEL PROYECTO');
  const etapas = [
    { n: '01', t: 'Visita tecnica', d: 'Inspeccion del sitio, medicion de area disponible y evaluacion estructural de la cubierta.' },
    { n: '02', t: 'Diseno e ingenieria', d: 'Elaboracion de planos, memorias de calculo, diseno electrico y simulacion de produccion solar.' },
    { n: '03', t: 'Aprobacion UPME / RETIE', d: 'Gestion de permisos ante el operador de red local y cumplimiento de normativa RETIE vigente.' },
    { n: '04', t: 'Adquisicion de equipos', d: 'Compra e importacion de paneles, inversores y materiales de instalacion de marcas aliadas.' },
    { n: '05', t: 'Instalacion y montaje', d: 'Ejecucion de obra, montaje de estructura, instalacion de paneles y conexiones electricas certificadas.' },
    { n: '06', t: 'Puesta en marcha y entrega', d: 'Pruebas del sistema, configuracion del monitoreo remoto, capacitacion y entrega de documentacion.' },
  ];
  etapas.forEach(({ n, t, d }) => {
    checkY(34);
    page.drawRectangle({ x: margin + 10, y: y - 24, width: 24, height: 24, color: COLOR_ACCENT });
    page.drawText(n, { x: margin + 14, y: y - 16, size: 8.5, font, color: COLOR_WHITE });
    page.drawText(t, { x: margin + 42, y: y - 9, size: 9, font, color: COLOR_TEXT });
    page.drawText(d, { x: margin + 42, y: y - 21, size: 7.5, font, color: COLOR_MUTED });
    y -= 32;
  });
  gap(6);

  // 10. GARANTIAS
  sectionHeader('GARANTIAS');
  const garantias = [
    ['Paneles solares - rendimiento', 'Garantia de producto 12 anos. Rendimiento mayor al 80% por 25 anos.'],
    ['Inversor', 'Garantia de fabrica 5 anos (extensible a 10 segun fabricante).'],
    ['Estructura de montaje', 'Garantia estructural 10 anos contra corrosion y deformacion.'],
    ['Instalacion electrica', 'Garantia de mano de obra 2 anos segun norma RETIE.'],
    ['Soporte post-instalacion', '12 meses de soporte tecnico y monitoreo remoto incluidos.'],
  ];
  garantias.forEach(([label, desc]) => {
    checkY(26);
    page.drawRectangle({ x: margin + 10, y: y - 5, width: 6, height: 6, color: COLOR_ACCENT });
    page.drawText(`${label}:`, { x: margin + 22, y: y - 5, size: 8.5, font, color: COLOR_ACCENT });
    y -= 14;
    page.drawText(desc, { x: margin + 22, y, size: 8.5, font, color: COLOR_TEXT });
    y -= 15;
  });
  gap(6);

  // 11. MARCAS ALIADAS
  sectionHeader('MARCAS ALIADAS');
  checkY(20);
  page.drawText('Trabajamos con marcas lideres del mercado solar mundial con presencia certificada en Colombia:', {
    x: margin + 10, y, size: 9.5, font, color: COLOR_MUTED,
  });
  y -= 18;
  const marcas = [
    { key: 'longi',   nombre: 'LONGi Solar',   desc: 'Paneles - N1 mundial'          },
    { key: null,      nombre: 'JA Solar',       desc: 'Paneles - Top 3 mundial'       },
    { key: null,      nombre: 'Huawei Solar',   desc: 'Inversores inteligentes'       },
    { key: 'growatt', nombre: 'Growatt',        desc: 'Inversores residencial/com.'   },
    { key: null,      nombre: 'GoodWe',         desc: 'Soluciones hibridas'           },
  ];
  const mCols = 3;
  const mGap = 10;
  const mColW = (cW - mGap * (mCols - 1)) / mCols;
  const mBH = 60;
  const mRows2 = Math.ceil(marcas.length / mCols);
  checkY(mRows2 * (mBH + mGap));
  marcas.forEach((m, i) => {
    const col = i % mCols;
    const row = Math.floor(i / mCols);
    const bx = margin + col * (mColW + mGap);
    const by = y - row * (mBH + mGap);
    page.drawRectangle({ x: bx, y: by - mBH, width: mColW, height: mBH, color: COLOR_WHITE, borderColor: COLOR_BORDER, borderWidth: 0.75 });
    page.drawRectangle({ x: bx, y: by - mBH, width: 5, height: mBH, color: COLOR_ACCENT });
    const img = m.key ? brandLogos[m.key] : null;
    if (img) {
      const iH = mBH - 16;
      const iW = Math.min((img.width / img.height) * iH, mColW - 20);
      const ix = bx + 12 + (mColW - 20 - iW) / 2;
      page.drawImage(img, { x: ix, y: by - mBH + 8, width: iW, height: iH });
    } else {
      page.drawText(m.nombre, { x: bx + 14, y: by - 24, size: 10, font, color: COLOR_TEXT });
      page.drawText(m.desc,   { x: bx + 14, y: by - 38, size: 8.5, font, color: COLOR_MUTED });
    }
  });
  y -= mRows2 * (mBH + mGap) + 4;
  gap(6);

  // 12. CONDICIONES COMERCIALES
  sectionHeader('CONDICIONES COMERCIALES');
  const condiciones = [
    'Esta cotizacion tiene validez de 30 dias calendario desde la fecha de emision.',
    'Los precios incluyen IVA del 5% segun Ley 1715 de 2014 sobre energias renovables.',
    'Valores en COP sujetos a variacion por tasa de cambio USD/COP para equipos importados.',
    'El inicio de obra requiere un anticipo del 50% del valor total del proyecto aprobado.',
    'El plazo estimado de instalacion es de 15 a 30 dias habiles tras aprobacion y anticipo.',
    'No se incluyen adecuaciones electricas previas, obras civiles adicionales ni tramites notariales.',
    'Solartech se reserva el derecho de ajustar la propuesta si la visita tecnica evidencia condiciones distintas a las declaradas.',
  ];
  condiciones.forEach((c, i) => {
    checkY(30);
    page.drawText(`${i + 1}.`, { x: margin + 10, y, size: 8.5, font, color: COLOR_ACCENT });
    para(c, 22, 8.5, COLOR_TEXT);
    gap(2);
  });
  gap(8);

  // 13. DATOS DEL ASESOR COMERCIAL
  sectionHeader('DATOS DEL ASESOR COMERCIAL');
  infoRow2('Nombre del asesor', asesorNombre, 'Cargo', safe(asesor.cargo));
  infoRow2('Usuario sistema', safe(asesor.usuario), 'Empresa', 'Solartech Energy Systems');
  gap(8);

  // 14. CIERRE
  sectionHeader('GRACIAS POR CONFIAR EN SOLARTECH ENERGY SYSTEMS');
  checkY(100);
  page.drawText('Estamos comprometidos a brindarle la mejor solucion de energia solar adaptada a sus necesidades.', {
    x: margin + 10, y, size: 10, font, color: COLOR_TEXT,
  });
  y -= 16;
  page.drawText('Para aceptar esta propuesta o resolver cualquier consulta, comuniquese con su asesor:', {
    x: margin + 10, y, size: 9.5, font, color: COLOR_MUTED,
  });
  y -= 26;

  const sigX = margin + 10;
  page.drawRectangle({ x: sigX, y: y - 66, width: 220, height: 66, color: COLOR_LIGHT, borderColor: COLOR_BORDER, borderWidth: 0.5 });
  page.drawRectangle({ x: sigX, y: y - 66, width: 5, height: 66, color: COLOR_ACCENT });
  page.drawText(asesorNombre, { x: sigX + 14, y: y - 18, size: 11, font, color: COLOR_TEXT });
  page.drawText(safe(asesor.cargo || 'Asesor Comercial'), { x: sigX + 14, y: y - 33, size: 9.5, font, color: COLOR_MUTED });
  page.drawText('Solartech Energy Systems', { x: sigX + 14, y: y - 48, size: 9.5, font, color: COLOR_ACCENT });

  const pdfBytes = await pdfDoc.save();
  const fileName = `propuesta-${uuidv4()}.pdf`;
  return savePDFStorage(fileName, pdfBytes);
}

// LOGIN
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const user = usuarios.find(u => u.usuario === usuario && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { id: user.id, nombre: user.nombre, apellido: user.apellido, cargo: user.cargo, usuario: user.usuario },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, nombre: user.nombre, apellido: user.apellido, cargo: user.cargo });
});

// ====== Endpoint ======
app.post("/api/calcular-proyecto", upload.single("facturaAdjunta"), async (req, res) => {
  try {
    const data = req.body || {};

    // ✅ Validación real alineada con el frontend
    const required = [
      "nombre",
      "correo",
      "telefono",
      "ubicacion",
      "consumoKwh",
      "costoKwh",
      "valorMensual",
      "areaDisponible",
      "preferenciaContacto",
      "tipoSolicitud",
    ];

    const missing = requireFields(data, required);
    if (missing.length) {
      return res.status(400).json({ error: "Faltan datos requeridos", missing });
    }

    // ====== Validar lead duplicado (solo por cédula/NIT) ======
    if (data.identificacion) {
      const todosLeads = await getAllLeads();
      const leadExistente = todosLeads.find(l =>
        l.identificacion && String(l.identificacion).trim() === String(data.identificacion).trim()
      ) || null;
      if (leadExistente) {
        return res.status(409).json({
          error: 'lead_duplicado',
          mensaje: `La Cédula/NIT ${data.identificacion} ya está registrada y la está atendiendo el asesor ${leadExistente.vendedor}.`,
          vendedor: leadExistente.vendedor,
          cotizacion: leadExistente.numeroCotizacion,
          campoClave: 'Cédula/NIT',
        });
      }
    }

    const numeroCotizacion = await getNextContador();

    // Extraer vendedor del token JWT (si viene)
    let vendedor = 'Sin asignar';
    let asesorPDF = {};
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        vendedor = decoded.nombre || decoded.usuario;
        asesorPDF = { nombre: decoded.nombre, apellido: decoded.apellido, cargo: decoded.cargo, usuario: decoded.usuario };
      } catch (_) {}
    }

    const cfg = await leerConfig();
    const resultados = calcularProyecto(data, cfg);
    const pdfUrl = await generarPDF(data, { ...resultados, numeroCotizacion }, asesorPDF, cfg);

    // ====== Guardar lead ======
    await saveLeadStorage({
      id: uuidv4(),
      numeroCotizacion,
      vendedor,
      estado: 'Nuevo',
      fecha: new Date().toISOString(),
      // Cliente
      nombre: data.nombre,
      identificacion: data.identificacion || null,
      correo: data.correo,
      telefono: data.telefono,
      ubicacion: data.ubicacion,
      ciudadSolar: data.ciudadSolar || null,
      // Proyecto
      tipoSolicitud: data.tipoSolicitud,
      tipoTecho: data.tipoTecho || null,
      sistemaInteres: data.sistemaInteres || null,
      preferenciaContacto: data.preferenciaContacto || null,
      conociste: data.conociste || null,
      // Técnico
      consumoKwh: resultados.consumoKwh,
      costoKwh: resultados.costoKwh,
      valorMensual: resultados.valorMensual,
      areaDisponible: resultados.areaDisponible,
      radiacionSolar: resultados.radiacionSolar,
      kwp: resultados.kwp,
      npaneles: resultados.npaneles,
      ninversores: resultados.ninversores,
      // Financiero
      costoProyectoMasIva: resultados.costoProyectoMasIva,
      ahorroMensual: resultados.ahorroMensual,
      ahorroAnual: resultados.ahorroAnual,
      tiempoRetorno: resultados.tiempoRetorno,
      pdfUrl,
      opciones: [],
    });

    res.json({ ...resultados, numeroCotizacion, pdfUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error interno" });
  }
});

// ====== GET /api/ciudades ======
app.get('/api/ciudades', async (req, res) => {
  if (!USE_GOOGLE) return res.json([]);
  try {
    const ciudades = await gAdapter.getCiudades();
    res.json(ciudades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== GET /api/config ======
app.get('/api/config', async (req, res) => {
  res.json(await leerConfig());
});

// ====== PUT /api/config ======
app.put('/api/config', express.json(), async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  const actual = await leerConfig();
  const nueva = { ...actual, ...req.body };
  if (req.body.empresa) nueva.empresa = { ...actual.empresa, ...req.body.empresa };
  await guardarConfig(nueva);
  res.json({ ok: true, config: nueva });
});

// ====== GET /api/leads ======
app.get('/api/leads', async (_req, res) => {
  try { res.json(await getAllLeads()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ====== GET /api/leads/buscar ======
app.get('/api/leads/buscar', async (req, res) => {
  const { identificacion } = req.query;
  if (!identificacion) return res.json({ encontrado: false });
  try {
    const leads = await getAllLeads();
    const lead = leads.find(l =>
      l.identificacion && String(l.identificacion).trim() === String(identificacion).trim()
    );
    if (lead) return res.json({ encontrado: true, vendedor: lead.vendedor, numeroCotizacion: lead.numeroCotizacion, nombre: lead.nombre, campoClave: 'Cédula/NIT' });
    res.json({ encontrado: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ====== GET /api/asesores ======
app.get('/api/asesores', (_req, res) => {
  res.json(usuarios.map(u => ({
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    cargo: u.cargo,
    usuario: u.usuario,
    rol: u.usuario === 'admin' ? 'Admin' : 'Asesor',
  })));
});

// ====== PATCH /api/leads/:numeroCotizacion/estado ======
app.patch('/api/leads/:numeroCotizacion/estado', express.json(), async (req, res) => {
  const num = Number(req.params.numeroCotizacion);
  const { estado } = req.body;
  try {
    await updateLeadField(num, { estado });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === 'Lead no encontrado' ? 404 : 500).json({ error: err.message });
  }
});

// ====== PATCH /api/leads/:numeroCotizacion/opciones ======
app.patch('/api/leads/:numeroCotizacion/opciones', express.json(), async (req, res) => {
  const num = Number(req.params.numeroCotizacion);
  const { opciones } = req.body;
  try {
    await updateLeadField(num, { opciones });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === 'Lead no encontrado' ? 404 : 500).json({ error: err.message });
  }
});

// ====== POST /api/generar-pdf (solo PDF, sin guardar lead) ======
app.post('/api/generar-pdf', express.json(), async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.consumoKwh || !data.costoKwh) {
      return res.status(400).json({ error: 'consumoKwh y costoKwh son requeridos' });
    }
    let asesorPDF = {};
    const authPDF = req.headers['authorization'];
    if (authPDF && authPDF.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authPDF.slice(7), JWT_SECRET);
        asesorPDF = { nombre: decoded.nombre, apellido: decoded.apellido, cargo: decoded.cargo, usuario: decoded.usuario };
      } catch (_) {}
    }
    const cfg = await leerConfig();
    const resultados = calcularProyecto(data, cfg);
    const pdfUrl = await generarPDF(data, { ...resultados, numeroCotizacion: data.numeroCotizacion ?? '-' }, asesorPDF, cfg);
    res.json({ pdfUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});