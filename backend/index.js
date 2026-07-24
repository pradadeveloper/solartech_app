require('dotenv').config();
const { calcularProyecto, toNumber } = require('./formulas');
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
const saPath = path.join(__dirname, 'service-account.json');
const USE_GOOGLE = !!process.env.GOOGLE_SERVICE_ACCOUNT || fs.existsSync(saPath);
const gAdapter = USE_GOOGLE ? require('./services/googleAdapter') : null;
if (USE_GOOGLE) console.log('[storage] Google Sheets + Drive activado');
const contadorPath = path.join(__dirname, 'contador.json');
const leadsPath = path.join(__dirname, 'leads.json');
const configPath = path.join(__dirname, 'config.json');
const usuariosPath = path.join(__dirname, 'usuarios.json');

const JWT_SECRET = process.env.JWT_SECRET || 'solartech_clave_secreta_2024';

const USUARIOS_DEFAULT = [
  { id: 1, nombre: 'Administrador', apellido: '',      cargo: 'Administrador',    usuario: 'admin',     password: 'solartech2026', rol: 'Admin',  celular: '', correo: '' },
  { id: 2, nombre: 'Vendedor',      apellido: 'Uno',   cargo: 'Asesor Comercial', usuario: 'vendedor1', password: 'vendedor123',   rol: 'Asesor', celular: '', correo: '' },
  { id: 3, nombre: 'Vendedor',      apellido: 'Dos',   cargo: 'Asesor Comercial', usuario: 'vendedor2', password: 'vendedor456',   rol: 'Asesor', celular: '', correo: '' },
];

function cargarUsuarios() {
  try {
    if (fs.existsSync(usuariosPath)) return JSON.parse(fs.readFileSync(usuariosPath, 'utf-8'));
  } catch (_) {}
  return [...USUARIOS_DEFAULT];
}

function guardarUsuarios(lista) {
  fs.writeFileSync(usuariosPath, JSON.stringify(lista, null, 2));
  if (USE_GOOGLE) {
    gAdapter.saveAllAsesores(lista).catch(err =>
      console.error('[asesores] Error sincronizando con Sheets:', err.message)
    );
  }
}

async function inicializarUsuarios() {
  if (USE_GOOGLE) {
    try {
      const remoto = await gAdapter.getAsesores();
      if (remoto.length > 0) {
        usuarios = remoto;
        fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
        console.log(`[asesores] ${usuarios.length} asesores cargados desde Google Sheets`);
        return;
      }
    } catch (err) {
      console.error('[asesores] Error cargando desde Sheets:', err.message);
    }
  }
  usuarios = cargarUsuarios();
}

let usuarios = cargarUsuarios();
inicializarUsuarios();

const app = express();
const PORT = 4000;

const montserratPath     = path.join(__dirname, "fonts", "Montserrat-Regular.ttf");
const montserratBoldPath = path.join(__dirname, "fonts", "Montserrat-Bold.ttf");

// Cache de buffers de imágenes de proyectos (leídos una sola vez al arrancar)
const ASSETS_PATH = path.join(__dirname, 'public', 'assets');
const PROYECTOS_BUFS = {};
for (const [key, file] of [
  ['caribeMotor',     'PROYECTO CARIBE MOTOR PDF.jpg'],
  ['absorbentes',     'PROYECTO ABSORBENTES DE COLOMBIA PDF.jpg'],
  ['saferAgro',       'PROYECTO SAFER AGROBIOLÓGICOS PDF.jpg'],
  ['agricolasUnidas', 'PROYECTO AGRICOLAS UNIDAS PDF.jpg'],
  ['naturalHarvest',  'PROYECTO NATURAL HARVEST PDF.jpg'],
]) {
  const ip = path.join(ASSETS_PATH, file);
  if (fs.existsSync(ip)) {
    try { PROYECTOS_BUFS[key] = fs.readFileSync(ip); } catch (_) {}
  }
}

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

function generarCodigoPublico(leadsExistentes = []) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0,1,I,O,L para evitar confusión
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (leadsExistentes.some(l => l.codigoPublico === code));
  return code;
}

// ====== Propuestas guardadas (una por opción elegida por el asesor) ======
const propuestasPath = path.join(__dirname, 'propuestas.json');

async function getAllPropuestas() {
  if (USE_GOOGLE) return gAdapter.getAllPropuestas();
  if (!fs.existsSync(propuestasPath)) return [];
  try { const raw = fs.readFileSync(propuestasPath, 'utf-8').trim(); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

async function savePropuestaStorage(propuesta) {
  if (USE_GOOGLE) return gAdapter.savePropuesta(propuesta);
  const propuestas = await getAllPropuestas();
  propuestas.push(propuesta);
  fs.writeFileSync(propuestasPath, JSON.stringify(propuestas, null, 2));
}

function generarPropuestaId(existentes = []) {
  let id;
  do {
    id = `ST-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  } while (existentes.some(p => p.id === id));
  return id;
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
  ivaPct: 5, descuentoRentaPct: 50, costoGeneracion: 330, costoComercializacion: 115, factorAreaM2PorKwp: 5.8,
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
function requireFields(data, fields) {
  const missing = fields.filter((k) => String(data?.[k] ?? "").trim() === "");
  return missing;
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

  const fontBytes     = fs.readFileSync(montserratPath);
  const fontBoldBytes = fs.readFileSync(montserratBoldPath);
  await pdfDoc.embedFont(fontBytes); // cargado pero no usado — todo el PDF usa Bold
  const fontBold = await pdfDoc.embedFont(fontBoldBytes);
  const font     = fontBold; // usar Bold como fuente base para mayor legibilidad

  const W = 595, H = 842;
  const margin = 42;
  const cW = W - margin * 2;
  const headerH = 80;
  const footerH = 30;

  const COLOR_ACCENT       = rgb(0.690, 0.227, 0.133);
  const COLOR_TITLE        = rgb(0.102, 0.102, 0.102); // #1a1a1a
  const COLOR_TEXT         = rgb(0.067, 0.067, 0.067); // #111111
  const COLOR_MUTED        = rgb(0.176, 0.176, 0.176); // #2d2d2d
  const COLOR_NUM          = rgb(0, 0, 0);              // #000000
  const COLOR_WHITE        = rgb(1, 1, 1);
  const COLOR_BORDER       = rgb(0.753, 0.753, 0.753); // #c0c0c0 (outer)
  const COLOR_BORDER_INNER = rgb(0.835, 0.835, 0.835); // #d5d5d5 (inner)
  const COLOR_LIGHT        = rgb(0.92, 0.92, 0.92);
  const COLOR_ACLIGHT      = rgb(0.97, 0.90, 0.87);

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
  const assetsPath = path.join(__dirname, 'public', 'assets');
  const brandLogos = {};
  for (const [key, file, type, altDir] of [
    ['longi',   'logo_longi.png',    'png'],
    ['growatt', 'growatt.png',       'png'],
    ['huawei',  'huawei.jpeg',       'jpg'],
    ['goodwe',  'goodwe.jpeg',       'jpg'],
  ]) {
    const lp = path.join(altDir || frontendLogos, file);
    if (fs.existsSync(lp)) {
      try {
        brandLogos[key] = type === 'png'
          ? await pdfDoc.embedPng(fs.readFileSync(lp))
          : await pdfDoc.embedJpg(fs.readFileSync(lp));
      } catch (e) {
        console.error(`[PDF] Error embebiendo logo ${key}:`, e.message);
      }
    }
  }

  // Imagen casos de éxito
  let casosExitoImg = null;
  const casosPath = path.join(frontendLogos, 'casos_exito.jpg');
  if (fs.existsSync(casosPath)) {
    try { casosExitoImg = await pdfDoc.embedJpg(fs.readFileSync(casosPath)); } catch (_) {}
  }

  // Banners de proyecto
  const bannerImgs = {};
  for (const [key, file] of [
    ['hogar',      'banner_panel_solar_hogar.jpg'],
    ['industria',  'banner_panel_solar_industria.jpg'],
    ['industria2', 'banner_panel_solar_industria_2.jpg'],
    ['industria3', 'banner_panel_solar_industria_3.jpg'],
    ['pdf1',       'BANNER_PDF_1.jpeg'],
    ['pdf2',       'BANNER_PDF_2.jpeg'],
  ]) {
    const bp = path.join(assetsPath, file);
    if (fs.existsSync(bp)) {
      try { bannerImgs[key] = await pdfDoc.embedJpg(fs.readFileSync(bp)); } catch (_) {}
    }
  }

  // Imagenes de proyectos instalados (detecta jpg vs png por magic bytes)
  const proyectosImgs = {};
  for (const [key, file] of [
    ['caribeMotor',     'PROYECTO CARIBE MOTOR PDF.jpg'],
    ['absorbentes',     'PROYECTO ABSORBENTES DE COLOMBIA PDF.jpg'],
    ['saferAgro',       'PROYECTO SAFER AGROBIOLÓGICOS PDF.jpg'],
    ['agricolasUnidas', 'PROYECTO AGRICOLAS UNIDAS PDF.jpg'],
    ['naturalHarvest',  'PROYECTO NATURAL HARVEST PDF.jpg'],
  ]) {
    const ip = path.join(assetsPath, file);
    if (!fs.existsSync(ip)) continue;
    try {
      const buf = fs.readFileSync(ip);
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      proyectosImgs[key] = isPng ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
    } catch (_) {}
  }

  let page;
  let y;
  let pageCount = 0;
  let bannerSuprimido = false;   // ver newPage(): corta el banner en saltos automáticos

  function newPage(withBanner = true) {
    pageCount++;
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
    const hdrLine1 = [asesor.celular, asesor.correo].filter(Boolean).join('  |  ') || `${empTel}  |  ${empEmail}`;
    page.drawText(hdrLine1, { x: cx, y: H - headerH + 52, size: 7.5, font, color: COLOR_WHITE });
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

    // Banner full-size solo si withBanner=true (páginas que lo solicitan explícitamente).
    // bannerSuprimido lo activan las secciones que no toleran una imagen intercalada
    // (p.ej. el listado de condiciones), donde el salto lo dispara checkY/para y no
    // habria forma de pasarles withBanner=false.
    if (pageCount >= 2 && withBanner && !bannerSuprimido) {
      const pageBanner =
        pageCount === 2 ? (bannerImgs.pdf1     || bannerImgs.hogar    || bannerImgs.industria2) :
        pageCount === 3 ? (bannerImgs.industria || bannerImgs.industria2) :
        pageCount === 7 ? (bannerImgs.pdf2     || bannerImgs.industria2 || bannerImgs.industria3) :
                          (bannerImgs.industria2 || bannerImgs.industria3 || bannerImgs.industria);
      if (pageBanner) {
        const bH = 155;
        page.drawImage(pageBanner, { x: 0, y: H - headerH - bH, width: W, height: bH });
        y = H - headerH - bH - 14;
      }
    }
  }

  function checkY(needed) {
    if (y - needed < footerH + 16) newPage();
  }

  const safe = (v) => (v == null || v === '' ? '-' : String(v));
  const cop = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;
  const num2 = (v) => Number(v || 0).toFixed(2); // redondeo a 2 decimales (kWp / kW)

  function sectionHeader(title) {
    checkY(46);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 28, width: cW, height: 28, color: COLOR_LIGHT, borderColor: COLOR_BORDER, borderWidth: 1.5 });
    page.drawRectangle({ x: margin, y: y - 28, width: 5, height: 28, color: COLOR_ACCENT });
    page.drawText(title.toUpperCase(), { x: margin + 14, y: y - 18, size: 11, font: fontBold, color: COLOR_TITLE });
    y -= 44; // +8px breathing room between header bar and content
  }

  function infoRow(label, value, highlight) {
    const rH = 22;
    checkY(rH);
    if (highlight) {
      page.drawRectangle({ x: margin, y: y - rH, width: cW, height: rH, color: COLOR_ACLIGHT, borderColor: COLOR_ACCENT, borderWidth: 1.5 });
    } else {
      page.drawRectangle({ x: margin, y: y - rH, width: cW, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER_INNER, borderWidth: 1 });
    }
    page.drawText(String(label), { x: margin + 10, y: y - 14, size: 9, font: fontBold, color: highlight ? COLOR_ACCENT : COLOR_MUTED });
    page.drawText(String(value ?? '-'), { x: margin + cW / 2, y: y - 14, size: 9.5, font, color: highlight ? COLOR_ACCENT : COLOR_TEXT });
    y -= rH;
  }

  function infoRow2(l1, v1, l2, v2) {
    const rH = 34; // más alto para apilar label + valor
    const half = (cW - 6) / 2;
    const maxValW = half - 16;
    const fitSize = (text, maxW) => {
      let sz = 9.5;
      while (sz >= 6.5 && font.widthOfTextAtSize(String(text ?? '-'), sz) > maxW) sz -= 0.5;
      return sz;
    };
    checkY(rH);
    // Columna izquierda
    page.drawRectangle({ x: margin, y: y - rH, width: half, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER_INNER, borderWidth: 1 });
    page.drawText(String(l1), { x: margin + 8, y: y - 12, size: 7.5, font: fontBold, color: COLOR_MUTED });
    page.drawText(String(v1 ?? '-'), { x: margin + 8, y: y - 26, size: fitSize(v1, maxValW), font, color: COLOR_TEXT });
    // Columna derecha
    const rx = margin + half + 6;
    page.drawRectangle({ x: rx, y: y - rH, width: half, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER_INNER, borderWidth: 1 });
    page.drawText(String(l2), { x: rx + 8, y: y - 12, size: 7.5, font: fontBold, color: COLOR_MUTED });
    page.drawText(String(v2 ?? '-'), { x: rx + 8, y: y - 26, size: fitSize(v2, maxValW), font, color: COLOR_TEXT });
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

  // Shared word-wrap helper used by Etapas and Garantías
  const wrapWords = (text, maxW, sz) => {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, sz) > maxW) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

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

  page.drawText('PROPUESTA TECNICA Y COMERCIAL', { x: margin, y, size: 15, font: fontBold, color: COLOR_ACCENT });
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
  infoRow2('Municipio / Ubicacion', safe(data.ubicacion), 'Ciudad solar', safe(data.ciudadSolar));
  infoRow2('Tipo de solicitud', safe(data.tipoSolicitud), 'Tipo de techo', safe(data.tipoTecho));
  infoRow2('Como nos conocio', safe(data.conociste), 'Sistema de interes', safe(data.sistemaInteres));
  gap(6);

  // 3. SISTEMA SOLAR
  sectionHeader('TU SISTEMA SOLAR');
  infoRow2('Potencia del sistema', `${num2(resultados.kwp)} kWp`, 'Numero de paneles', `${safe(resultados.npaneles)} paneles`);
  infoRow2('Numero de inversores', `${safe(resultados.ninversores)} und`, 'Potencia AC inversor', `${num2(resultados.potenciaAC)} kW`);
  infoRow2('Generacion mensual', `${safe(resultados.generacionMes ?? resultados.produccionDeEnergia)} kWh/mes`, 'Cobertura del sistema', `${safe(resultados.porcentajeCoberturaProyecto)}%`);
  infoRow2('Consumo del cliente', `${safe(resultados.consumoKwh)} kWh/mes`, 'Area minima requerida', `${safe(resultados.areaMinima)} m2`);
  infoRow2('Area disponible declarada', `${safe(data.areaDisponible)} m2`, 'Radiacion solar local', `${safe(resultados.radiacionSolar)} kWh/m2/dia`);
  gap(6);

  // 4. ANALISIS FINANCIERO
  newPage();
  gap(4);
  sectionHeader('ANALISIS FINANCIERO');
  infoRow('Ahorro mensual estimado', cop(resultados.ahorroMensual));
  infoRow('Ahorro anual estimado', cop(resultados.ahorroAnual));
  infoRow('Ahorro proyectado a 10 anos', cop(resultados.ahorro10Anos));
  infoRow('Tiempo de retorno de la inversion', `${safe(resultados.tiempoRetorno)} años`);
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
  page.drawText('Componentes e items incluidos en el proyecto:', { x: margin + 10, y, size: 9, font: fontBold, color: COLOR_TITLE });
  y -= 14;
  const componentes = [
    `${resultados.npaneles} paneles solares de ${resultados.potenciaPanel} W (LONGi Solar)`,
    `1 inversor capacidad aprox. ${num2(resultados.kwp)} kW (Huawei / Growatt / GoodWe)`,
    'Estructura de montaje (rieles, clamps, L-Foot y puesta a tierra)',
    'Cableado solar AC/DC, protecciones electricas y fusibles',
    'Instalacion, puesta en marcha y configuracion de monitoreo remoto',
    'Capacitacion al usuario y entrega de manual de operacion',
  ];
  componentes.forEach((c) => bullet(c, 10));
  gap(6);

  // 7. FORMAS DE PAGO
  newPage();
  gap(4);
  sectionHeader('FORMAS DE PAGO');
  const formasPago = [
    { t: '1. Pago de contado', d: 'Pago total antes de iniciar la instalacion. Garantiza disponibilidad inmediata de equipos y posible descuento por pronto pago.' },
    { t: '2. Credito bancario', d: 'Financiacion directa con su entidad bancaria. Solartech entrega la documentacion tecnica requerida para la solicitud.' },
  ];
  formasPago.forEach(({ t, d }) => {
    checkY(42);
    page.drawText(t, { x: margin + 10, y, size: 9, font: fontBold, color: COLOR_ACCENT });
    y -= 13;
    para(d, 14, 8.5, COLOR_MUTED);
    gap(3);
  });
  gap(6);

  // 8. IMPACTO AMBIENTAL
  gap(6);
  sectionHeader('IMPACTO AMBIENTAL');

  // Tarjetas visuales para los 3 indicadores ambientales
  const statCards = [
    { icon: '🌳', label: 'Arboles equivalentes', value: `${safe(resultados.arbolesEquivalentes)}`, unit: 'arboles/ano' },
    { icon: '💨', label: 'CO2 evitado',           value: `${safe(resultados.co2EvitadoToneladas)}`, unit: 'ton/ano'   },
    { icon: '⛽', label: 'Gasolina evitada',       value: `${safe(resultados.galonesGasolinaEvitados)}`, unit: 'galones/ano' },
  ];
  const cardW = (cW - 12) / 3;
  const cardH = 56;
  checkY(cardH + 8);
  statCards.forEach((card, i) => {
    const cx2 = margin + i * (cardW + 6);
    page.drawRectangle({ x: cx2, y: y - cardH, width: cardW, height: cardH, color: COLOR_ACLIGHT, borderColor: COLOR_ACCENT, borderWidth: 0.75 });
    page.drawRectangle({ x: cx2, y: y - cardH, width: cardW, height: 4, color: COLOR_ACCENT });
    page.drawText(card.label, { x: cx2 + 8, y: y - 14, size: 8, font: fontBold, color: COLOR_MUTED });
    page.drawText(card.value, { x: cx2 + 8, y: y - 30, size: 18, font: fontBold, color: COLOR_ACCENT });
    page.drawText(card.unit,  { x: cx2 + 8, y: y - 44, size: 7.5, font, color: COLOR_MUTED });
  });
  y -= cardH + 8;

  gap(4);
  para('Al elegir energia solar contribuye activamente a la reduccion de emisiones de CO2 y a la independencia energetica de Colombia. Su sistema generara energia limpia por mas de 25 anos.', 10, 8.5, COLOR_MUTED);
  gap(8);

  // // Banner hogar después de impacto ambiental
  // if (bannerImgs.hogar) {
  //   checkY(118);
  //   const bH = 105;
  //   page.drawImage(bannerImgs.hogar, { x: 0, y: y - bH, width: W, height: bH });
  //   y -= bH + 12;
  // }

  // 9. ETAPAS DEL PROYECTO — página 4 (forzada), 2 columnas de 3 + Garantías al final
  newPage(false);
  gap(4);
  sectionHeader('ETAPAS DEL PROYECTO');
  const etapas = [
    { n: '01', t: 'Visita tecnica',           d: 'Inspeccion del sitio, medicion de area disponible y evaluacion estructural de la cubierta.' },
    { n: '02', t: 'Diseno e ingenieria',       d: 'Elaboracion de planos, memorias de calculo, diseno electrico y simulacion de produccion solar.' },
    { n: '03', t: 'Aprobacion UPME / RETIE',  d: 'Gestion de permisos ante el operador de red local y cumplimiento de normativa RETIE vigente.' },
    { n: '04', t: 'Adquisicion de equipos',   d: 'Compra e importacion de paneles, inversores y materiales de instalacion de marcas aliadas.' },
    { n: '05', t: 'Instalacion y montaje',    d: 'Ejecucion de obra, montaje de estructura, instalacion de paneles y conexiones electricas certificadas.' },
    { n: '06', t: 'Puesta en marcha y entrega', d: 'Pruebas del sistema, configuracion del monitoreo remoto, capacitacion y entrega de documentacion.' },
  ];
  {
    const eColW   = (cW - 14) / 2;
    const eBadgeS = 24;
    const eTxtOff = eBadgeS + 16;
    const eTxtMaxW = eColW - eTxtOff - 8;
    const eTitleSz = 8.5;
    const eDescSz  = 7.5;
    const eLineH   = 11;

    const eItemH = (item) => {
      const dLines = wrapWords(item.d, eTxtMaxW, eDescSz);
      return 10 + 14 + dLines.length * eLineH + 8; // top-pad + title + desc-lines + bottom-pad
    };

    const colLeft  = etapas.slice(0, 3);
    const colRight = etapas.slice(3, 6);
    const rowH = [0, 1, 2].map(i => Math.max(eItemH(colLeft[i]), eItemH(colRight[i])));
    const totalEH = rowH.reduce((s, h) => s + h + 6, 0);
    checkY(totalEH + 8);
    const eStartY = y;

    [colLeft, colRight].forEach((col, ci) => {
      const cx = margin + ci * (eColW + 14);
      let cy = eStartY;
      col.forEach((item, ri) => {
        const rH = rowH[ri];
        page.drawRectangle({ x: cx, y: cy - rH, width: eColW, height: rH, color: rgb(0.97, 0.97, 0.97), borderColor: COLOR_BORDER_INNER, borderWidth: 0.75 });
        // badge centrado verticalmente
        const badgeY = cy - rH + (rH - eBadgeS) / 2;
        page.drawRectangle({ x: cx + 7, y: badgeY, width: eBadgeS, height: eBadgeS, color: COLOR_ACCENT });
        page.drawText(item.n, { x: cx + 12, y: badgeY + 14, size: 8.5, font: fontBold, color: COLOR_WHITE });
        // título
        page.drawText(item.t, { x: cx + eTxtOff, y: cy - 16, size: eTitleSz, font: fontBold, color: COLOR_TEXT });
        // descripción con wrap
        const dLines = wrapWords(item.d, eTxtMaxW, eDescSz);
        let ly = cy - 16 - eLineH;
        dLines.forEach(ln => {
          page.drawText(ln, { x: cx + eTxtOff, y: ly, size: eDescSz, font, color: COLOR_MUTED });
          ly -= eLineH;
        });
        cy -= rH + 6;
      });
    });
    y -= totalEH + 6;
    gap(6);
  }

  // 10. GARANTIAS — misma página que Etapas
  gap(8);
  sectionHeader('GARANTIAS');
  {
    const col1Items = [
      ['Paneles solares - rendimiento', 'Garantia de producto 12 anos. Rendimiento mayor al 80% por 25 anos.'],
      ['Inversor', 'Garantia de fabrica 5 anos (extensible a 10 segun fabricante).'],
      ['Estructura de montaje', 'Garantia estructural 10 anos contra corrosion y deformacion.'],
    ];
    const col2Items = [
      ['Instalacion electrica', 'Garantia de mano de obra 2 anos segun norma RETIE.'],
      ['Soporte post-instalacion', '12 meses de soporte tecnico y monitoreo remoto incluidos.'],
    ];

    const colW = (cW - 12) / 2;
    const colX1 = margin;
    const colX2 = margin + colW + 12;
    const itemLineH = 14;
    const descLineH = 13;
    const itemGap   = 10;
    const dotOff    = 8;
    const textOff   = 20;
    const descMaxW  = colW - textOff - 4;
    const fontSize  = 8.5;

    // measure total height of one column
    const colHeight = (items) => items.reduce((h, [, desc]) => {
      const lines = wrapWords(desc, descMaxW, fontSize);
      return h + itemLineH + lines.length * descLineH + itemGap;
    }, 0);

    const totalH = Math.max(colHeight(col1Items), colHeight(col2Items));
    checkY(totalH + 8);
    const startY = y;

    // draw one column
    const drawCol = (items, cx) => {
      let cy = startY;
      items.forEach(([label, desc]) => {
        page.drawRectangle({ x: cx + dotOff, y: cy - 6, width: 6, height: 6, color: COLOR_ACCENT });
        page.drawText(`${label}:`, { x: cx + textOff, y: cy - 5, size: fontSize, font: fontBold, color: COLOR_ACCENT });
        cy -= itemLineH;
        const lines = wrapWords(desc, descMaxW, fontSize);
        lines.forEach(ln => {
          page.drawText(ln, { x: cx + textOff, y: cy, size: fontSize, font, color: COLOR_TEXT });
          cy -= descLineH;
        });
        cy -= itemGap;
      });
    };

    drawCol(col1Items, colX1);
    drawCol(col2Items, colX2);
    y -= totalH;
    gap(10);
  }

  // PROYECTOS INSTALADOS — página 5 (forzada)
  newPage(false);
  gap(4);
  sectionHeader('PROYECTOS INSTALADOS');
  {
    const proyectos = [
      {
        img: proyectosImgs.caribeMotor,
        nombre: 'PROYECTO CARIBE MOTOR',
        ciudad: 'Medellín, Antioquia',
        kwp: '135 kWp',
        ahorro: '$9.500.000/mes',
        retorno: '3.6 años',
      },
      {
        img: proyectosImgs.absorbentes,
        nombre: 'ABSORBENTES DE COLOMBIA',
        ciudad: 'Cartagena, Bolívar',
        kwp: '540 kWp',
        ahorro: '$55.000.000/mes',
        retorno: '3.4 años',
      },
      {
        img: proyectosImgs.saferAgro,
        nombre: 'SAFER AGROBIOLÓGICOS',
        ciudad: 'San Pedro, Antioquia',
        kwp: '130 kWp',
        ahorro: '$13.000.000/mes',
        retorno: '3.3 años',
      },
      {
        img: proyectosImgs.agricolasUnidas,
        nombre: 'AGRÍCOLAS UNIDAS',
        ciudad: 'Támesis, Antioquia',
        kwp: '136 kWp',
        ahorro: '$9.500.000/mes',
        retorno: '3.2 años',
      },
      {
        img: proyectosImgs.naturalHarvest,
        nombre: 'NATURAL HARVEST',
        ciudad: 'Pereira, Risaralda',
        kwp: '130 kWp',
        ahorro: '$11.500.000/mes',
        retorno: '3.8 años',
      },
    ];

    const pGap     = 8;
    const pImgH    = 115;
    const pCardH   = pImgH + 78;
    const COLOR_GREEN = rgb(0.055, 0.502, 0.165);
    // Fila 0: 3 columnas iguales; Fila 1: 2 columnas más anchas (llenan todo el ancho)
    const pColW3   = (cW - pGap * 2) / 3;
    const pColW2   = (cW - pGap) / 2;
    checkY(2 * (pCardH + 8));

    proyectos.forEach((p, i) => {
      const row  = i < 3 ? 0 : 1;
      const col  = i < 3 ? i : i - 3;
      const colW = row === 0 ? pColW3 : pColW2;
      const px   = margin + col * (colW + pGap);
      const py   = y - row * (pCardH + 8);

      page.drawRectangle({ x: px, y: py - pCardH, width: colW, height: pCardH, color: COLOR_WHITE, borderColor: COLOR_BORDER, borderWidth: 0.75 });

      if (p.img) {
        page.drawImage(p.img, { x: px, y: py - pImgH, width: colW, height: pImgH });
      } else {
        page.drawRectangle({ x: px, y: py - pImgH, width: colW, height: pImgH, color: COLOR_ACLIGHT });
      }

      let ty = py - pImgH - 12;
      const nameLines = wrapWords(p.nombre, colW - 16, 8);
      nameLines.slice(0, 2).forEach(ln => {
        page.drawText(ln, { x: px + 10, y: ty, size: 8, font: fontBold, color: COLOR_TEXT });
        ty -= 10;
      });
      page.drawText(p.ciudad, { x: px + 10, y: ty, size: 7, font, color: COLOR_MUTED });
      ty -= 15;
      page.drawText(p.ahorro, { x: px + 10, y: ty, size: 13, font: fontBold, color: COLOR_GREEN });
      ty -= 14;
      page.drawText('Ahorro mensual estimado', { x: px + 10, y: ty, size: 7, font, color: COLOR_MUTED });
      ty -= 12;
      page.drawText(`${p.kwp}  ·  Retorno: ${p.retorno}`, { x: px + 10, y: ty, size: 7.5, font, color: COLOR_ACCENT });
    });
    y -= 2 * (pCardH + 8);
  }
  gap(6);

  // 11. CASOS DE EXITO + MARCAS ALIADAS + CONDICIONES — página sin banner
  newPage(false);
  gap(4);

  if (casosExitoImg) {
    const aspectRatio = casosExitoImg.height / casosExitoImg.width;
    const bH = Math.min(280, Math.round(aspectRatio * cW));
    sectionHeader('CASOS DE EXITO');
    page.drawImage(casosExitoImg, { x: margin, y: y - bH, width: cW, height: bH });
    y -= bH + 16;
  }

  sectionHeader('MARCAS ALIADAS');
  checkY(20);
  page.drawText('Trabajamos con marcas lideres del mercado solar mundial con presencia certificada en Colombia:', {
    x: margin + 10, y, size: 9.5, font, color: COLOR_MUTED,
  });
  y -= 18;
  const marcas = [
    { key: 'longi',   nombre: 'LONGi Solar',   desc: 'Paneles - N1 mundial'          },
    { key: 'huawei',  nombre: 'Huawei Solar',   desc: 'Inversores inteligentes'       },
    { key: 'growatt', nombre: 'Growatt',        desc: 'Inversores residencial/com.'   },
    { key: 'goodwe',  nombre: 'GoodWe',         desc: 'Soluciones hibridas'           },
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


  // 12. CONDICIONES COMERCIALES — arranca en página propia y, si el listado se
  // desborda, las páginas siguientes van sin banner: una foto a media lista parte
  // la numeración y es justo lo que se veía antes.
  newPage(false);
  bannerSuprimido = true;
  gap(4);
  sectionHeader('CONDICIONES COMERCIALES');
  const condiciones = [
    'La cantidad de paneles solares e inversores podra ajustarse de acuerdo con la potencia finalmente disponible y las condiciones tecnicas definitivas del proyecto.',
    'Con la aceptacion de la presente cotizacion, el cliente declara conocer y aceptar las politicas de servicio posventa y condiciones de garantia establecidas por la empresa.',
    'La cotizacion incluye los costos asociados a viaticos de instalacion y desplazamiento del personal tecnico hasta el sitio del proyecto.',
    'El plazo estimado de entrega es de ciento veinte (120) dias calendario, contados a partir de la fecha de recepcion del primer pago, y estara sujeto a la obtencion del certificado RETIE.',
    'Los equipos que sean objeto de reparacion o reemplazo durante el periodo de garantia conservaran exclusivamente el tiempo restante de la garantia original.',
    'La presente propuesta podra generar costos adicionales derivados de condiciones que se identifiquen durante la visita tecnica en sitio.',
    'El sistema fotovoltaico no esta disenado para operar en ausencia del suministro de la red electrica (sistema on-grid), por lo cual su funcionamiento depende de la presencia activa de dicha red.',
    'Las cubiertas tipo losa de concreto deberan soportar una carga minima de 50 kg/m2, mientras que las cubiertas en teja deberan soportar una carga minima de 17 kg/m2.',
    'La presente cotizacion contempla la instalacion del cableado en tuberia expuesta. Cualquier requerimiento de canalizacion oculta o soluciones esteticas adicionales podra generar costos adicionales.',
    'Condiciones de garantia del sistema: Paneles solares: 15 anos. Inversores: 5 anos. Instalacion: 5 anos. La validez de las garantias estara sujeta a la ejecucion de mantenimientos preventivos anuales con Solartech.',
    'En caso de que el comprador sea monousuario (con transformador propio) y desee realizar la legalizacion del sistema con entrega de excedentes al operador de red, debera cumplir con la Resolucion CREG 174 de 2021 (Cap. 4, Art. 19), la CREG 038 de 2014, la CREG 015 de 2018 y las normas del operador de red RA8-028 / RA8-030.',
    'Los valores de ahorro proyectados son estimativos y dependen de variables externas como la radiacion solar, el costo del kWh y la remuneracion definida por el operador de red para los excedentes de energia.',
    'El valor del contrato de respaldo es referencial y se ha calculado bajo el supuesto de un respaldo del 20% de la capacidad instalada. El cliente podra elegir respaldar desde 1 kW hasta el 100% de la capacidad instalada.',
    'El proyecto no incluye la adecuacion de la frontera comercial. Este costo sera definido posteriormente por el operador de red durante el proceso de visita y legalizacion.',
    'El proyecto no incluye el suministro del medidor bidireccional. Este podra ser adquirido directamente por el cliente con el operador de red o, si la normativa lo permite, podra ser suministrado por la empresa como un item adicional.',
    'Validez de la oferta: quince (15) dias calendario a partir de su emision.',
  ];
  condiciones.forEach((c, i) => {
    // Reservamos el alto real del item (numero + todas sus lineas) antes de
    // dibujarlo. Con un checkY fijo, un item de 3 lineas podia partirse y dejar
    // el numero solo al final de la pagina.
    const lineas = wrapWords(c, cW - 22 - 8, 8.5).length;
    checkY(lineas * 12.5 + 6);
    page.drawText(`${i + 1}.`, { x: margin + 10, y, size: 8.5, font, color: COLOR_ACCENT });
    para(c, 22, 8.5, COLOR_TEXT);
    gap(2);
  });
  bannerSuprimido = false;   // el resto del documento vuelve a llevar banner
  gap(8);

  // 13. DATOS DEL ASESOR COMERCIAL — última página
  newPage();
  gap(4);
  sectionHeader('DATOS DEL ASESOR COMERCIAL');
  infoRow2('Nombre del asesor', asesorNombre, 'Cargo', safe(asesor.cargo));
  infoRow2('Celular', safe(asesor.celular || '-'), 'Correo', safe(asesor.correo || '-'));
  infoRow2('Usuario sistema', safe(asesor.usuario), 'Empresa', 'Solartech Energy Systems');
  gap(8);

  // 14. CIERRE
  sectionHeader('GRACIAS POR CONFIAR EN SOLARTECH ENERGY SYSTEMS');
  checkY(110);
  page.drawText('Estamos comprometidos a brindarle la mejor solucion de energia solar adaptada a sus necesidades.', {
    x: margin + 10, y, size: 10, font, color: COLOR_TEXT,
  });
  y -= 16;
  page.drawText('Para aceptar esta propuesta o resolver cualquier consulta, comuniquese con su asesor:', {
    x: margin + 10, y, size: 9.5, font, color: COLOR_MUTED,
  });
  y -= 26;

  const sigX = margin + 10;
  const sigLines = [asesor.cargo, asesor.celular, asesor.correo].filter(Boolean).length;
  const sigH = 38 + sigLines * 16 + 18; // nombre(18) + líneas(16c/u) + empresa(18) + padding
  page.drawRectangle({ x: sigX, y: y - sigH, width: 280, height: sigH, color: COLOR_LIGHT, borderColor: COLOR_BORDER, borderWidth: 1.5 });
  page.drawRectangle({ x: sigX, y: y - sigH, width: 5, height: sigH, color: COLOR_ACCENT });
  let sy = y - 16;
  page.drawText(asesorNombre, { x: sigX + 14, y: sy, size: 11, font: fontBold, color: COLOR_TITLE });
  sy -= 16;
  if (asesor.cargo) { page.drawText(safe(asesor.cargo), { x: sigX + 14, y: sy, size: 9, font, color: COLOR_MUTED }); sy -= 15; }
  if (asesor.celular) { page.drawText(`Tel: ${asesor.celular}`, { x: sigX + 14, y: sy, size: 9, font, color: COLOR_MUTED }); sy -= 15; }
  if (asesor.correo)  { page.drawText(asesor.correo, { x: sigX + 14, y: sy, size: 9, font, color: COLOR_MUTED }); sy -= 15; }
  page.drawText('Solartech Energy Systems', { x: sigX + 14, y: y - sigH + 10, size: 9, font, color: COLOR_ACCENT });

  const pdfBytes = await pdfDoc.save();
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const fnCot     = resultados.numeroCotizacion || uuidv4().slice(0, 8);
  const fnCliente = slug(data.nombre) || 'Cliente';
  const fnEmpresa = slug(cfg?.empresa?.nombre || 'Solartech');
  const fileName  = `Propuesta_N-${fnCot}_${fnCliente}_${fnEmpresa}.pdf`;
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
    { id: user.id, nombre: user.nombre, apellido: user.apellido, cargo: user.cargo, usuario: user.usuario, celular: user.celular || '', correo: user.correo || '', rol: user.rol || 'Asesor' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, nombre: user.nombre, apellido: user.apellido, cargo: user.cargo, celular: user.celular || '', correo: user.correo || '', rol: user.rol || 'Asesor' });
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
    const todosLeads       = await getAllLeads();
    const codigoPublico    = generarCodigoPublico(todosLeads);

    // Extraer vendedor del token JWT (si viene)
    let vendedor = 'Sin asignar';
    let asesorPDF = {};
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        vendedor = decoded.nombre || decoded.usuario;
        // Buscar asesor actualizado en memoria para tener celular/correo frescos
        const asesorVivo = usuarios.find(u => u.usuario === decoded.usuario) || {};
        asesorPDF = {
          nombre:   asesorVivo.nombre   || decoded.nombre,
          apellido: asesorVivo.apellido || decoded.apellido,
          cargo:    asesorVivo.cargo    || decoded.cargo,
          usuario:  decoded.usuario,
          celular:  asesorVivo.celular  || decoded.celular || '',
          correo:   asesorVivo.correo   || decoded.correo  || '',
        };
      } catch (_) {}
    }
    // Fallback: si el token no dio nombre, buscar por vendedor en usuarios
    if (!asesorPDF.nombre && data.vendedor) {
      const av = usuarios.find(u =>
        `${u.nombre} ${u.apellido}`.trim() === data.vendedor ||
        u.usuario === data.vendedor
      ) || {};
      if (av.nombre) asesorPDF = { nombre: av.nombre, apellido: av.apellido || '', cargo: av.cargo || '', usuario: av.usuario || '', celular: av.celular || '', correo: av.correo || '' };
    }

    const cfg = await leerConfig();
    const resultados = calcularProyecto(data, cfg);
    const pdfUrl = await generarPDF(data, { ...resultados, numeroCotizacion }, asesorPDF, cfg);

    // ====== Guardar lead ======
    await saveLeadStorage({
      id: uuidv4(),
      numeroCotizacion,
      codigoPublico,
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

    res.json({ ...resultados, numeroCotizacion, codigoPublico, pdfUrl });
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

// ====== GET /api/propuesta/:num (público — sin auth, para compartir con cliente) ======
app.get('/api/propuesta/:num', async (req, res) => {
  try {
    const [leads, asesores] = await Promise.all([getAllLeads(), gAdapter.getAsesores()]);
    const param = String(req.params.num);
    const lead  = leads.find(l => l.codigoPublico === param)
               || leads.find(l => String(l.numeroCotizacion) === param); // fallback propuestas antiguas
    if (!lead) return res.status(404).json({ error: 'Propuesta no encontrada' });
    const { id, estado, ...pub } = lead;
    const asesor = asesores.find(a =>
      a.nombre === pub.vendedor ||
      `${a.nombre} ${a.apellido}`.trim() === pub.vendedor ||
      a.usuario === pub.vendedor
    );
    if (asesor) {
      pub.asesorInfo = {
        nombre:   asesor.nombre,
        apellido: asesor.apellido || '',
        cargo:    asesor.cargo   || 'Asesor Comercial',
        celular:  asesor.celular || '',
        correo:   asesor.correo  || '',
      };
    }
    res.json(pub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== POST /api/propuestas/guardar — guarda la opción elegida por el asesor ======
// Este es el único punto donde se genera un ID de propuesta y su PDF. La vista
// /resultado ya NO genera PDF ni link antes de este paso.
app.post('/api/propuestas/guardar', express.json(), async (req, res) => {
  try {
    const { leadId, opcionSeleccionada, datosOpcion = {}, datosCliente = {} } = req.body || {};

    // Redondeamos a 2 decimales antes de persistir: evita guardar valores como
    // 3,7199999999999998 kWp que luego ensucian la propuesta y el PDF.
    const kwp = Math.round((Number(datosOpcion.kwp ?? datosOpcion.kWp) || 0) * 100) / 100;
    let consumoKwh = Number(datosOpcion.consumoKwh) || 0;
    let costoKwh = Number(datosOpcion.costoKwh) || Number(datosCliente.costoKwh) || 0;

    const cfg = await leerConfig();

    // Fallback defensivo: si no viene consumoKwh/costoKwh explícito, derivarlo del kWp
    // (mismo truco que /api/generar-pdf para reproducir el mismo kWp al recalcular).
    if (!consumoKwh && kwp > 0) {
      const radiacion = Number(datosOpcion.radiacionSolar) || Number(datosCliente.radiacionSolar) || cfg.radiacionSolar || 3.8;
      const margen = cfg.margenCobertura || 0.8;
      const wPromedioDia = kwp * radiacion * margen * 1000;
      consumoKwh = Number(((wPromedioDia * 365) / (1000 * 12)).toFixed(1));
    }
    if (!costoKwh && Number(datosOpcion.ahorroMensual) > 0 && consumoKwh > 0) {
      costoKwh = Math.round(Number(datosOpcion.ahorroMensual) / consumoKwh);
    }

    if (!kwp || !consumoKwh || !costoKwh) {
      return res.status(400).json({ error: 'Datos insuficientes para guardar la propuesta (falta kWp, consumo o costo por kWh).' });
    }

    // Asesor desde el token JWT (si viene)
    let asesorPDF = {};
    let vendedor = datosCliente.vendedor || '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        vendedor = decoded.nombre || decoded.usuario || vendedor;
        const asesorVivo = usuarios.find(u => u.usuario === decoded.usuario) || {};
        asesorPDF = {
          nombre:   asesorVivo.nombre   || decoded.nombre,
          apellido: asesorVivo.apellido || decoded.apellido,
          cargo:    asesorVivo.cargo    || decoded.cargo,
          usuario:  decoded.usuario,
          celular:  asesorVivo.celular  || decoded.celular || '',
          correo:   asesorVivo.correo   || decoded.correo  || '',
        };
      } catch (_) {}
    }

    const cfgForCalc = Number(datosOpcion.costokWp) > 0 ? { ...cfg, costokWp: Number(datosOpcion.costokWp) } : cfg;
    const dataWithFix = { ...datosCliente, consumoKwh, costoKwh };
    const resultados = calcularProyecto(dataWithFix, cfgForCalc);

    const propuestasExistentes = await getAllPropuestas();
    const propuestaId = generarPropuestaId(propuestasExistentes);

    const pdfUrl = await generarPDF(dataWithFix, { ...resultados, numeroCotizacion: propuestaId }, asesorPDF, cfg);

    await savePropuestaStorage({
      id: propuestaId,
      leadId: leadId ?? '',
      opcion: opcionSeleccionada ?? '',
      kWp: resultados.kwp,
      paneles: resultados.npaneles,
      inversion_cop: resultados.costoProyectoMasIva,
      ahorro_mensual: resultados.ahorroMensual,
      roi_anios: resultados.tiempoRetorno,
      nombre_cliente: datosCliente.nombre || '',
      ciudad: datosCliente.ubicacion || datosCliente.ciudadSolar || '',
      consumo_kwh: resultados.consumoKwh,
      sistema: datosCliente.sistemaInteres || datosCliente.tipoSolicitud || '',
      techo: datosCliente.tipoTecho || '',
      fecha: new Date().toISOString(),
      pdf_url: pdfUrl,
      estado: 'Enviada',
    });

    const base = (process.env.FRONTEND_URL || 'https://solartech-app.vercel.app').replace(/\/$/, '');
    const shareUrl = `${base}/propuesta/${propuestaId}`;

    res.json({ propuestaId, pdfUrl, shareUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// ====== GET /api/propuestas/:id (público — sin auth, para compartir con cliente) ======
app.get('/api/propuestas/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const propuestas = await getAllPropuestas();
    const propuesta = propuestas.find(p => String(p.id).trim() === id);
    if (!propuesta) return res.status(404).json({ error: 'Propuesta no encontrada' });

    // Enriquecer con datos de contacto y asesor del lead original, si existe
    let leadInfo = {};
    let asesorInfo = null;
    if (propuesta.leadId) {
      const leads = await getAllLeads();
      const lead = leads.find(l => String(l.numeroCotizacion) === String(propuesta.leadId));
      if (lead) {
        leadInfo = {
          correo: lead.correo,
          telefono: lead.telefono,
          preferenciaContacto: lead.preferenciaContacto,
          radiacionSolar: lead.radiacionSolar,
          areaDisponible: lead.areaDisponible,
          vendedor: lead.vendedor,
        };
        const asesor = usuarios.find(u =>
          u.nombre === lead.vendedor ||
          `${u.nombre} ${u.apellido}`.trim() === lead.vendedor ||
          u.usuario === lead.vendedor
        );
        if (asesor) {
          asesorInfo = {
            nombre:   asesor.nombre,
            apellido: asesor.apellido || '',
            cargo:    asesor.cargo   || 'Asesor Comercial',
            celular:  asesor.celular || '',
            correo:   asesor.correo  || '',
          };
        }
      }
    }

    res.json({
      numeroCotizacion: propuesta.id,
      codigoPublico: propuesta.id,
      leadId: propuesta.leadId,
      opcion: propuesta.opcion,
      nombre: propuesta.nombre_cliente,
      ubicacion: propuesta.ciudad,
      kwp: Number(propuesta.kWp) || 0,
      npaneles: Number(propuesta.paneles) || 0,
      costoProyectoMasIva: Number(propuesta.inversion_cop) || 0,
      ahorroMensual: Number(propuesta.ahorro_mensual) || 0,
      tiempoRetorno: propuesta.roi_anios !== '' ? Number(propuesta.roi_anios) : null,
      consumoKwh: Number(propuesta.consumo_kwh) || 0,
      tipoSolicitud: propuesta.sistema,
      sistemaInteres: propuesta.sistema,
      tipoTecho: propuesta.techo,
      fecha: propuesta.fecha,
      pdfUrl: propuesta.pdf_url,
      estado: propuesta.estado,
      ...leadInfo,
      asesorInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== GET /api/leads/:num/versiones — lista versiones de una cotización ======
app.get('/api/leads/:numeroCotizacion/versiones', async (req, res) => {
  try {
    const base = String(req.params.numeroCotizacion);
    const leads = await getAllLeads();
    const regex = new RegExp(`^${base}_\\d+$`);
    const versiones = leads
      .filter(l => regex.test(String(l.numeroCotizacion)))
      .map(({ id, ...pub }) => pub);
    res.json(versiones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== POST /api/leads/:num/version — guarda una opción como nueva versión ======
app.post('/api/leads/:numeroCotizacion/version', express.json(), async (req, res) => {
  try {
    const base = String(req.params.numeroCotizacion);
    const leads = await getAllLeads();
    const baseLead = leads.find(l => String(l.numeroCotizacion) === base);
    if (!baseLead) return res.status(404).json({ error: 'Propuesta base no encontrada' });

    const regex = new RegExp(`^${base}_\\d+$`);
    const nextNum = leads.filter(l => regex.test(String(l.numeroCotizacion))).length + 1;
    const versionId = `${base}_${nextNum}`;

    const newLead = {
      ...baseLead,
      ...req.body,
      numeroCotizacion: versionId,
      id: require('crypto').randomUUID(),
      pdfUrl: '',
      opciones: [],
    };

    // Garantizar que consumoKwh y kwp estén siempre poblados en la versión.
    const cfg = await leerConfig();
    let vKwp = Number(newLead.kwp) || 0;
    let vConsumo = Number(newLead.consumoKwh) || 0;

    // Caso 1: ambos en 0 pero hay npaneles → derivar kwp desde npaneles
    if (!vKwp && !vConsumo && Number(newLead.npaneles) > 0) {
      const potPanel = cfg.potenciaPanel || 585;
      vKwp = Number(((Number(newLead.npaneles) * potPanel) / 1000).toFixed(1));
      newLead.kwp = vKwp;
    }
    // Caso 2: kwp presente, falta consumoKwh
    if (!vConsumo && vKwp > 0) {
      const rad = (Number(newLead.radiacionSolar) > 0 ? Number(newLead.radiacionSolar) : cfg.radiacionSolar) || 3.8;
      const margen = cfg.margenCobertura || 0.8;
      const wProm = vKwp * rad * margen * 1000;
      newLead.consumoKwh = Number(((wProm * 365) / (1000 * 12)).toFixed(1));
    }
    // Caso 3: consumoKwh presente, falta kwp
    if (!vKwp && vConsumo > 0) {
      const rad = (Number(newLead.radiacionSolar) > 0 ? Number(newLead.radiacionSolar) : cfg.radiacionSolar) || 3.8;
      const margen = cfg.margenCobertura || 0.8;
      const wProm = (vConsumo * 1000 * 12) / 365;
      newLead.kwp = Number((wProm / (rad * margen * 1000)).toFixed(1));
    }

    await saveLeadStorage(newLead);
    res.json({ ok: true, versionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== GET /api/leads ======
app.get('/api/leads', async (req, res) => {
  try {
    let leads = await getAllLeads();
    // Filtrar por vendedor para usuarios no-admin
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        const esAdmin = (decoded.rol || '').toLowerCase() === 'admin';
        if (!esAdmin) {
          const nombre = decoded.nombre || decoded.usuario;
          leads = leads.filter(l => l.vendedor === nombre);
        }
      } catch (_) { /* token inválido → devolver todo (fallback seguro) */ }
    }
    res.json(leads);
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// ====== GET /api/leads/check-cedula/:cedula ======
app.get('/api/leads/check-cedula/:cedula', async (req, res) => {
  const { cedula } = req.params;
  if (!cedula) return res.json({ exists: false });
  try {
    const leads = await getAllLeads();
    const lead = leads.find(l =>
      l.identificacion && String(l.identificacion).trim() === String(cedula).trim()
    );
    if (lead) return res.json({ exists: true, asesor: lead.vendedor, cotNum: lead.numeroCotizacion });
    res.json({ exists: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ====== GET /api/asesores ======
app.get('/api/asesores', (_req, res) => {
  res.json(usuarios.map(u => ({
    id: u.id, nombre: u.nombre, apellido: u.apellido, cargo: u.cargo,
    usuario: u.usuario, rol: u.rol || (u.usuario === 'admin' ? 'Admin' : 'Asesor'),
    celular: u.celular || '', correo: u.correo || '',
  })));
});

// ====== POST /api/asesores (solo admin) ======
app.post('/api/asesores', express.json(), (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    if (decoded.usuario !== 'admin' && (decoded.rol || '').toLowerCase() !== 'admin')
      return res.status(403).json({ error: 'Solo administradores pueden agregar asesores' });
  } catch (_) { return res.status(401).json({ error: 'Token inválido' }); }

  const { nombre, apellido, cargo, usuario, password, rol, celular, correo } = req.body;
  if (!nombre || !usuario || !password) return res.status(400).json({ error: 'nombre, usuario y password son requeridos' });
  if (usuarios.find(u => u.usuario === usuario)) return res.status(409).json({ error: 'El usuario ya existe' });

  const newUser = { id: Date.now(), nombre, apellido: apellido || '', cargo: cargo || 'Asesor Comercial', usuario, password, rol: rol || 'Asesor', celular: celular || '', correo: correo || '' };
  usuarios.push(newUser);
  guardarUsuarios(usuarios);
  res.status(201).json({ ok: true, id: newUser.id });
});

// ====== PUT /api/asesores/:id (solo admin) ======
app.put('/api/asesores/:id', express.json(), (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    if (decoded.usuario !== 'admin' && (decoded.rol || '').toLowerCase() !== 'admin')
      return res.status(403).json({ error: 'Solo administradores' });
  } catch (_) { return res.status(401).json({ error: 'Token inválido' }); }

  const id = Number(req.params.id);
  const idx = usuarios.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Asesor no encontrado' });

  const { nombre, apellido, cargo, usuario, password, rol, celular, correo } = req.body;
  if (usuario && usuario !== usuarios[idx].usuario && usuarios.find(u => u.usuario === usuario))
    return res.status(409).json({ error: 'El usuario ya existe' });

  usuarios[idx] = { ...usuarios[idx], ...(nombre && { nombre }), ...(apellido !== undefined && { apellido }), ...(cargo && { cargo }), ...(usuario && { usuario }), ...(password && { password }), ...(rol && { rol }), ...(celular !== undefined && { celular }), ...(correo !== undefined && { correo }) };
  guardarUsuarios(usuarios);
  res.json({ ok: true });
});

// ====== DELETE /api/asesores/:id (solo admin) ======
app.delete('/api/asesores/:id', (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    if (decoded.usuario !== 'admin' && (decoded.rol || '').toLowerCase() !== 'admin')
      return res.status(403).json({ error: 'Solo administradores' });
  } catch (_) { return res.status(401).json({ error: 'Token inválido' }); }

  const id = Number(req.params.id);
  if (id === 1) return res.status(403).json({ error: 'No se puede eliminar el administrador principal' });
  const antes = usuarios.length;
  usuarios = usuarios.filter(u => u.id !== id);
  if (usuarios.length === antes) return res.status(404).json({ error: 'Asesor no encontrado' });
  guardarUsuarios(usuarios);
  res.json({ ok: true });
});

// ====== PATCH /api/leads/:numeroCotizacion/estado ======
app.patch('/api/leads/:numeroCotizacion/estado', express.json(), async (req, res) => {
  const num = String(req.params.numeroCotizacion);
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
  const num = String(req.params.numeroCotizacion);
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
    const cfg = await leerConfig();

    let consumoKwh = Number(data.consumoKwh) || 0;
    let costoKwh = Number(data.costoKwh) || 0;

    // Derive consumoKwh from kwp when missing (versioned proposals store kwp explicitly)
    if (!consumoKwh && Number(data.kwp) > 0) {
      const kwp = Number(data.kwp);
      const radiacion = Number(data.radiacionSolar) || cfg.radiacionSolar || 3.8;
      const margen = cfg.margenCobertura || 0.8;
      const radCobertura = radiacion * margen;
      const wPromedioDia = kwp * radCobertura * 1000;
      consumoKwh = Number(((wPromedioDia * 365) / (1000 * 12)).toFixed(1));
    }

    // Derive costoKwh from ahorroMensual / consumoKwh when missing
    if (!costoKwh && Number(data.ahorroMensual) > 0 && consumoKwh > 0) {
      costoKwh = Math.round(Number(data.ahorroMensual) / consumoKwh);
    }

    if (!consumoKwh || !costoKwh) {
      return res.status(400).json({ error: 'No se pudieron determinar consumoKwh y costoKwh. Verifica los datos de la propuesta.' });
    }

    let asesorPDF = {};
    const authPDF = req.headers['authorization'];
    if (authPDF && authPDF.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authPDF.slice(7), JWT_SECRET);
        const asesorVivo = usuarios.find(u => u.usuario === decoded.usuario) || {};
        asesorPDF = {
          nombre:   asesorVivo.nombre   || decoded.nombre,
          apellido: asesorVivo.apellido || decoded.apellido,
          cargo:    asesorVivo.cargo    || decoded.cargo,
          usuario:  decoded.usuario,
          celular:  asesorVivo.celular  || decoded.celular || '',
          correo:   asesorVivo.correo   || decoded.correo  || '',
        };
      } catch (_) {}
    }
    // Fallback: si el token no dio nombre, buscar por vendedor en usuarios
    if (!asesorPDF.nombre && data.vendedor) {
      const av = usuarios.find(u =>
        `${u.nombre} ${u.apellido}`.trim() === data.vendedor ||
        u.usuario === data.vendedor
      ) || {};
      if (av.nombre) asesorPDF = { nombre: av.nombre, apellido: av.apellido || '', cargo: av.cargo || '', usuario: av.usuario || '', celular: av.celular || '', correo: av.correo || '' };
    }

    // For versioned proposals, respect the version's costokWp
    const cfgForCalc = Number(data.costokWp) > 0
      ? { ...cfg, costokWp: Number(data.costokWp) }
      : cfg;

    const dataWithFix = { ...data, consumoKwh, costoKwh };
    const resultados = calcularProyecto(dataWithFix, cfgForCalc);
    const pdfUrl = await generarPDF(dataWithFix, { ...resultados, numeroCotizacion: data.numeroCotizacion ?? '-' }, asesorPDF, cfgForCalc);

    // Persistir pdfUrl en el registro del lead (si se conoce la cotización)
    if (data.numeroCotizacion) {
      try {
        await updateLeadField(String(data.numeroCotizacion), { pdfUrl });
      } catch (_) { /* no crítico: el PDF igual se devuelve */ }
    }

    res.json({ pdfUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// ====== POST /api/agente-ia ======
// Chat del Agente IA. Responde en streaming (SSE) sobre las cotizaciones
// visibles para el usuario autenticado. Ver backend/agenteIA.js.
const { crearHandler: crearHandlerAgenteIA } = require('./agenteIA');
app.post(
  '/api/agente-ia',
  express.json(),
  crearHandlerAgenteIA({ getAllLeads, jwt, JWT_SECRET })
);

// Indica al frontend si el módulo está configurado (para ocultarlo si no).
app.get('/api/agente-ia/estado', (_req, res) => {
  res.json({ disponible: !!process.env.ANTHROPIC_API_KEY });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠  Agente IA deshabilitado: falta ANTHROPIC_API_KEY en backend/.env');
  }
});