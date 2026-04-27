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
  const areaDisp = toNumber(areaDisponible);

  if ([consumo, costoUnidad].some((n) => Number.isNaN(n))) {
    throw new Error("Valores numéricos inválidos: consumoKwh o costoKwh");
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
  // facturaPromedio = lo que el cliente paga mensualmente (consumo × tarifa)
  const facturaPromedio = Math.round(consumo * costoUnidad);
  const ahorroMensual   = facturaPromedio; // alias semántico para el PDF/UI
  const ahorroAnual     = Math.round(facturaPromedio * 12);
  const ahorro10Anos    = Math.round(ahorroAnual * 10);

  const costoProyecto       = Math.round(kwp * costokWp);
  const ivaProyecto         = Math.round(costoProyecto * (ivaPct / 100));
  const costoProyectoMasIva = Math.round(costoProyecto + ivaProyecto);

  const costokwpproyecto     = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto * (descuentoRentaPct / 100));
  // Tiempo de retorno = Costo total (con IVA) / Factura promedio mensual → resultado en MESES
  const tiempoRetorno = facturaPromedio > 0 ? Math.round(costoProyectoMasIva / facturaPromedio) : null;
  const valorKwp = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;

  // Equipos
  const npaneles = Math.ceil(wPromedioDia / (potenciaPanel * radiacionSolarCobertura));
  const ninversores = 1;

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

  const fontBytes     = fs.readFileSync(montserratPath);
  const fontBoldBytes = fs.readFileSync(montserratBoldPath);
  const font     = await pdfDoc.embedFont(fontBytes);
  const fontBold = await pdfDoc.embedFont(fontBoldBytes);

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
  const brandLogos = {};
  for (const [key, file, type, altDir] of [
    ['longi',   'logo_longi.png',    'png'],
    ['growatt', 'growatt.png',       'png'],
    ['huawei',  'huawei.jpeg',       'jpg'],
    ['goodwe',  'goodwe.jpeg',       'jpg'],
    // ja_solar: usar el PNG de assets (colormap, sin canal alpha) — el de frontend es RGBA y falla en pdf-lib
    ['jasolar', 'ja_solar.png',      'png', assetsPath],
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
  const assetsPath = path.join(__dirname, 'public', 'assets');
  const bannerImgs = {};
  for (const [key, file] of [
    ['hogar',      'banner_panel_solar_hogar.jpg'],
    ['industria',  'banner_panel_solar_industria.jpg'],
    ['industria2', 'banner_panel_solar_industria_2.jpg'],
    ['industria3', 'banner_panel_solar_industria_3.jpg'],
  ]) {
    const bp = path.join(assetsPath, file);
    if (fs.existsSync(bp)) {
      try { bannerImgs[key] = await pdfDoc.embedJpg(fs.readFileSync(bp)); } catch (_) {}
    }
  }

  let page;
  let y;
  let pageCount = 0;

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

    // Banner full-size solo si withBanner=true (páginas que lo solicitan explícitamente)
    if (pageCount >= 2 && withBanner) {
      const pageBanner =
        pageCount === 2 ? (bannerImgs.hogar    || bannerImgs.industria2) :
        pageCount === 3 ? (bannerImgs.industria || bannerImgs.industria2) :
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

  function sectionHeader(title) {
    checkY(46);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 28, width: cW, height: 28, color: COLOR_LIGHT, borderColor: COLOR_BORDER, borderWidth: 1.5 });
    page.drawRectangle({ x: margin, y: y - 28, width: 5, height: 28, color: COLOR_ACCENT });
    page.drawText(title.toUpperCase(), { x: margin + 14, y: y - 18, size: 11, font: fontBold, color: COLOR_TITLE });
    y -= 36;
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
    const rH = 24;
    const half = (cW - 6) / 2;
    const labelW = 100; // ancho fijo para la etiqueta
    const valX1 = margin + 8 + labelW;
    const valMaxW = half - labelW - 16; // espacio real disponible para el valor
    const valX2 = margin + half + 6 + 8 + labelW;
    const fitSize = (text, maxW) => {
      let sz = 9.5;
      while (sz >= 6.5 && font.widthOfTextAtSize(String(text ?? '-'), sz) > maxW) sz -= 0.5;
      return sz;
    };
    checkY(rH);
    page.drawRectangle({ x: margin, y: y - rH, width: half, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER_INNER, borderWidth: 1 });
    page.drawText(String(l1), { x: margin + 8, y: y - 15, size: 8.5, font: fontBold, color: COLOR_MUTED });
    page.drawText(String(v1 ?? '-'), { x: valX1, y: y - 15, size: fitSize(v1, valMaxW), font, color: COLOR_TEXT });
    const rx = margin + half + 6;
    page.drawRectangle({ x: rx, y: y - rH, width: half, height: rH, color: rgb(0.96, 0.96, 0.96), borderColor: COLOR_BORDER_INNER, borderWidth: 1 });
    page.drawText(String(l2), { x: rx + 8, y: y - 15, size: 8.5, font: fontBold, color: COLOR_MUTED });
    page.drawText(String(v2 ?? '-'), { x: valX2, y: y - 15, size: fitSize(v2, valMaxW), font, color: COLOR_TEXT });
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
  infoRow('Tiempo de retorno de la inversion', `${safe(resultados.tiempoRetorno)} meses`);
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
    `${resultados.npaneles} paneles solares de ${resultados.potenciaPanel} W (LONGi / JA Solar)`,
    `1 inversor de ${resultados.kwp} kW (Huawei / Growatt / GoodWe)`,
    'Estructura de montaje (rieles, clamps, L-Foot y puesta a tierra)',
    'Cableado solar AC/DC, protecciones electricas y fusibles',
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
    page.drawText(t, { x: margin + 10, y, size: 9, font: fontBold, color: COLOR_ACCENT });
    y -= 13;
    para(d, 14, 8.5, COLOR_MUTED);
    gap(3);
  });
  gap(6);

  // 8. IMPACTO AMBIENTAL — siempre inicia página nueva
  newPage();
  gap(4);
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
    page.drawText(n, { x: margin + 14, y: y - 16, size: 8.5, font: fontBold, color: COLOR_WHITE });
    page.drawText(t, { x: margin + 42, y: y - 9, size: 9, font: fontBold, color: COLOR_TEXT });
    page.drawText(d, { x: margin + 42, y: y - 21, size: 7.5, font, color: COLOR_MUTED });
    y -= 32;
  });
  gap(6);


  // 10. GARANTIAS — página 3, 2 columnas
  newPage();
  gap(4);
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

    // word-wrap: split desc into lines that fit descMaxW
    const wrapText = (text, maxW, sz) => {
      const words = text.split(' ');
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

    // measure total height of one column
    const colHeight = (items) => items.reduce((h, [, desc]) => {
      const lines = wrapText(desc, descMaxW, fontSize);
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
        const lines = wrapText(desc, descMaxW, fontSize);
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
    gap(6);
  }

  // Casos de éxito
  if (casosExitoImg) {
    const aspectRatio = casosExitoImg.height / casosExitoImg.width;
    const bH = Math.min(160, Math.round(aspectRatio * cW));
    checkY(bH + 20);
    page.drawText('CASOS DE EXITO', { x: margin + 10, y, size: 9.5, font, color: COLOR_ACCENT });
    y -= 12;
    page.drawImage(casosExitoImg, { x: margin, y: y - bH, width: cW, height: bH });
    y -= bH + 12;
  }

  // 11. MARCAS ALIADAS — página propia, sin banner (sección visual limpia)
  newPage(false);
  gap(4);
  sectionHeader('MARCAS ALIADAS');
  checkY(20);
  page.drawText('Trabajamos con marcas lideres del mercado solar mundial con presencia certificada en Colombia:', {
    x: margin + 10, y, size: 9.5, font, color: COLOR_MUTED,
  });
  y -= 18;
  const marcas = [
    { key: 'longi',   nombre: 'LONGi Solar',   desc: 'Paneles - N1 mundial'          },
    { key: 'jasolar', nombre: 'JA Solar',       desc: 'Paneles - Top 3 mundial'       },
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


  // 12. CONDICIONES COMERCIALES — siempre inicia página nueva
  newPage();
  gap(4);
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
    { id: user.id, nombre: user.nombre, apellido: user.apellido, cargo: user.cargo, usuario: user.usuario, celular: user.celular || '', correo: user.correo || '', rol: user.rol || 'Asesor' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, nombre: user.nombre, apellido: user.apellido, cargo: user.cargo, celular: user.celular || '', correo: user.correo || '' });
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