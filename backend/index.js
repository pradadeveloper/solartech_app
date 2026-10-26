require('dotenv').config();
const { calcularProyecto, toNumber } = require('./formulas');
const { analizarRecursosPropios, calcularPPA, entradasDesde } = require('./finanzas');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
// Leads, asesores, propuestas y config viven en Supabase (base compartida con la web).
const sb = require('./services/supabase');

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
// En memoria: la factura adjunta se sube al bucket "facturas" de Supabase.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ====== Sesión ======
// El login lo hace el frontend contra Supabase Auth; el backend valida el token
// y trabaja con un cliente del propio usuario, así RLS decide qué leads ve.
async function requiereUsuario(req, res, next) {
  try {
    const usuario = await sb.autenticar(req);
    if (!usuario) return res.status(401).json({ error: 'No autorizado' });
    req.usuario = usuario;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function requiereAdmin(req, res, next) {
  if (!req.usuario?.esAdmin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}

// Datos del asesor que van en la firma del PDF.
function firmaDe(a) {
  if (!a) return {};
  return { nombre: a.nombre, apellido: a.apellido, cargo: a.cargo, usuario: a.usuario, celular: a.celular, correo: a.correo };
}

// Sin token, el PDF se firma con el asesor que venga en data.vendedor (si existe).
async function firmaPorVendedor(vendedor) {
  if (!vendedor) return {};
  const asesores = await sb.getAsesores();
  const a = asesores.find(u =>
    `${u.nombre} ${u.apellido}`.trim() === vendedor || u.nombre === vendedor || u.usuario === vendedor
  );
  return firmaDe(a);
}

// Un asesor que trabaja un lead sin asignar queda como su dueño:
// RLS no le deja guardar cambios en un lead que no es suyo.
function tomarSiLibre(usuario, lead) {
  return !usuario.esAdmin && !lead.asesorId ? { asesor_id: usuario.id } : {};
}

async function savePDFStorage(fileName, pdfBytes) {
  // Solo desarrollo: PDF_LOCAL_DIR guarda el PDF en disco en vez de subirlo al bucket.
  if (process.env.PDF_LOCAL_DIR) {
    const destino = path.join(process.env.PDF_LOCAL_DIR, fileName);
    fs.writeFileSync(destino, pdfBytes);
    return destino;
  }
  return sb.subirPDF(fileName, pdfBytes);
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
  try {
    const remoto = await sb.getConfig();
    return { ...CONFIG_DEFAULT, ...remoto, empresa: { ...CONFIG_DEFAULT.empresa, ...(remoto.empresa || {}) } };
  } catch (err) {
    console.error('[config] Error leyendo de Supabase:', err.message);
    return { ...CONFIG_DEFAULT };
  }
}

function requireFields(data, fields) {
  const missing = fields.filter((k) => String(data?.[k] ?? "").trim() === "");
  return missing;
}

// Texto libre que llega del endpoint público: recortado y null si viene vacío.
function textoWeb(value, max) {
  const s = String(value ?? "").trim().slice(0, max);
  return s || null;
}

// ====== PDF ======
async function generarPDF(data, resultados, asesor = {}, cfg = {}) {
  // Modalidad de negocio: el PPA no muestra precio, IVA ni formas de pago.
  const esPPA = data.modalidad === 'ppa';
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

  // Salto automático sin banner: la foto de 155 px en una página que solo
  // continúa una sección la dejaba casi vacía.
  function checkY(needed) {
    if (y - needed < footerH + 16) newPage(false);
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

  page.drawText(esPPA ? 'PROPUESTA DE ENERGIA SOLAR - MODALIDAD PPA' : 'PROPUESTA TECNICA Y COMERCIAL', { x: margin, y, size: 15, font: fontBold, color: COLOR_ACCENT });
  y -= 16;
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Cotizacion N-${resultados?.numeroCotizacion ?? '-'}   |   Fecha: ${fecha}`, { x: margin, y, size: 9, font, color: COLOR_MUTED });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 1, color: COLOR_ACCENT });
  y -= 16;

  const asesorNombre = `${asesor.nombre || ''} ${asesor.apellido || ''}`.trim() || 'Asesor Comercial';

  // 1. CLIENTE
  sectionHeader('DATOS DEL CLIENTE');
  // Identificación con su tipo ("NIT 900123456"); el municipio sin el departamento pegado.
  const tipoDoc = { CC: 'C.C.', NIT: 'NIT', CE: 'C.E.', PH: 'P.H.' }[String(data.tipoDocumento || '').toUpperCase()] || '';
  const identificacion = [tipoDoc, data.identificacion].filter(Boolean).join(' ');
  const municipio = data.ciudadSolar || String(data.ubicacion || '').split(',')[0];
  infoRow2('Nombre completo', safe(data.nombre), 'Identificacion', safe(identificacion));
  infoRow2('Correo electronico', safe(data.correo), 'Telefono', safe(data.telefono));
  infoRow2('Municipio', safe(municipio), 'Departamento', safe(data.departamentoSolar));
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

  // 4-7. Análisis financiero y propuesta económica: dependen de la modalidad
  // (recursos propios o PPA). Modelos en finanzas.js, los mismos de la propuesta web.
  const entradasFin = entradasDesde({ ...resultados, tipoDocumento: data.tipoDocumento });
  const anios = (v) => (v == null ? '-' : `${Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })} años`);
  const pct = (v) => (v == null ? '-' : `${(v * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`);

  if (esPPA) {
    const ppa = calcularPPA(entradasFin, cfg);
    newPage();
    gap(4);
    sectionHeader('MODALIDAD PPA - ENERGIA SIN INVERSION');
    para('Solartech instala, opera y mantiene el sistema solar en sus instalaciones sin que usted invierta. Usted paga solo la energia que el sistema genera, a una tarifa menor que la del operador de red.', 10, 9, COLOR_MUTED);
    gap(6);
    infoRow('Inversion del cliente', '$0', true);
    infoRow('Tarifa actual del operador de red', `${cop(Math.round(ppa.tarifaRed1))} / kWh`);
    infoRow(`Tarifa PPA Solartech (${pct(ppa.descuento)} de descuento)`, `${cop(Math.round(ppa.tarifaPPA1))} / kWh`, true);
    infoRow('Plazo del contrato', `${ppa.plazo} años`);
    infoRow('Indexacion de la tarifa', `IPC (supuesto ${pct(ppa.indexacion)} anual)`);
    infoRow('Al terminar el contrato', 'Los equipos pasan a ser suyos');
    gap(6);

    sectionHeader('AHORRO PROYECTADO');
    infoRow('Factura evitada al operador (mes 1)', cop(Math.round(ppa.facturaRedMensual1)));
    infoRow('Pago estimado a Solartech (mes 1)', cop(Math.round(ppa.pagoMensual1)));
    infoRow('Ahorro del primer mes', cop(Math.round(ppa.ahorroMensual1)), true);
    infoRow('Ahorro acumulado a 5 años', cop(Math.round(ppa.acumulado5)));
    infoRow('Ahorro acumulado a 10 años', cop(Math.round(ppa.acumulado10)));
    infoRow(`Ahorro acumulado durante el contrato (${ppa.plazo} años)`, cop(Math.round(ppa.ahorroContrato)), true);
    infoRow('Ahorro acumulado a 25 años (con equipos propios)', cop(Math.round(ppa.acumulado25)));
    gap(6);

    // Tabla año a año (años representativos)
    checkY(18 * 10 + 60);   // título y tabla en la misma página
    sectionHeader('PROYECCIÓN DEL AHORRO');
    const cols = [
      { t: 'Año', w: 0.08 }, { t: 'Tarifa red $/kWh', w: 0.18 }, { t: 'Tarifa PPA $/kWh', w: 0.18 },
      { t: 'Generacion kWh', w: 0.18 }, { t: 'Ahorro del año', w: 0.19 }, { t: 'Acumulado', w: 0.19 },
    ];
    const filas = ppa.anios.filter((a) => [1, 2, 3, 5, 10, ppa.plazo, ppa.plazo + 1, 20, 25].includes(a.anio));
    const rH = 18;
    checkY(rH * (filas.length + 1) + 6);
    let cx = margin;
    page.drawRectangle({ x: margin, y: y - rH, width: cW, height: rH, color: COLOR_LIGHT });
    cols.forEach((c) => {
      page.drawText(c.t, { x: cx + 4, y: y - 12, size: 7.5, font: fontBold, color: COLOR_MUTED });
      cx += c.w * cW;
    });
    y -= rH;
    filas.forEach((a) => {
      const vals = [
        String(a.anio),
        Math.round(a.tarifaRed).toLocaleString('es-CO'),
        a.tarifaPPA ? Math.round(a.tarifaPPA).toLocaleString('es-CO') : 'Equipos suyos',
        Math.round(a.kwh).toLocaleString('es-CO'),
        cop(Math.round(a.ahorro)),
        cop(Math.round(a.acumulado)),
      ];
      cx = margin;
      page.drawLine({ start: { x: margin, y: y - rH }, end: { x: margin + cW, y: y - rH }, thickness: 0.5, color: COLOR_BORDER_INNER });
      vals.forEach((v, i) => {
        page.drawText(v, { x: cx + 4, y: y - 12, size: 8, font, color: COLOR_TEXT });
        cx += cols[i].w * cW;
      });
      y -= rH;
    });
    gap(14);
    para('Ahorro calculado con toda la generacion valorada a la tarifa del operador de red, indexacion anual igual para ambas tarifas y una perdida de rendimiento de los paneles de 0,55% por año.', 10, 7.5, COLOR_MUTED);
    gap(6);

    checkY(46 + 4 * 18 + 10);   // la lista completa en una sola página
    sectionHeader('EL SISTEMA QUE INSTALAMOS');
    [
      `${resultados.npaneles} paneles solares de ${resultados.potenciaPanel} W (LONGi Solar)`,
      `Inversor(es) de ${num2(resultados.potenciaAC)} kW AC (Huawei / Growatt / GoodWe)`,
      'Estructura de montaje, cableado, protecciones y monitoreo remoto',
      'Operacion y mantenimiento a cargo de Solartech durante el contrato',
    ].forEach((c) => bullet(c, 10));
    gap(6);
  } else {
    const rp = analizarRecursosPropios(entradasFin, cfg);
    newPage();
    gap(4);
    sectionHeader('ANALISIS FINANCIERO');
    infoRow('Ahorro mensual estimado (año 1)', cop(resultados.ahorroMensual));
    infoRow('Ahorro anual estimado (año 1)', cop(resultados.ahorroAnual));
    infoRow(rp.esEmpresa ? 'Retorno de la inversion (despues de impuestos)' : 'Retorno de la inversion', anios(rp.retornoAnios), true);
    infoRow('Ganancia neta acumulada a 10 años', cop(Math.round(rp.ganancia10)));
    infoRow('Ganancia neta acumulada a 25 años', cop(Math.round(rp.ganancia25)));
    infoRow(`Valor presente neto a 25 años (tasa ${pct(rp.supuestos.tasaDescuento)})`, cop(Math.round(rp.vpn25)));
    infoRow('Tasa interna de retorno a 25 años', pct(rp.tir25));
    gap(14);
    para(`Supuestos: alza de la tarifa ${pct(rp.supuestos.incrementoTarifa)} anual, perdida de rendimiento de los paneles ${(rp.supuestos.degradacion * 100).toLocaleString('es-CO', { maximumFractionDigits: 2 })}% anual, mantenimiento anual indexado y reposicion de inversores en el año ${rp.supuestos.reposicionAnio}.${rp.esEmpresa ? ` Incluye el efecto en renta (${pct(rp.supuestos.tasaImpuesto)}).` : ''}`, 10, 7.5, COLOR_MUTED);
    gap(6);

    if (rp.beneficiosTributarios) {
      sectionHeader('BENEFICIOS TRIBUTARIOS LEY 1715');
      infoRow('Depreciacion acelerada (3 años)', cop(Math.round(rp.beneficiosTributarios.depreciacion)));
      infoRow('Deduccion especial del 50% en renta', cop(Math.round(rp.beneficiosTributarios.deduccion)));
      infoRow('Menor impuesto de renta (total)', cop(Math.round(rp.beneficiosTributarios.total)), true);
      gap(14);
      para('Sujeto a la certificacion UPME del proyecto y a que la empresa tenga renta liquida suficiente para aplicar los beneficios. Ya estan incluidos en el retorno, el VPN y la TIR.', 10, 7.5, COLOR_MUTED);
      gap(6);
    }

    // 5. PROPUESTA ECONOMICA
    sectionHeader('PROPUESTA ECONOMICA');
    infoRow('Costo del sistema (sin IVA)', cop(resultados.costoProyecto));
    infoRow('IVA aplicable (5%)', cop(resultados.ivaProyecto));
    infoRow('TOTAL CON IVA - PRECIO FINAL', cop(resultados.costoProyectoMasIva), true);
    infoRow('Costo por kWp instalado', cop(resultados.valorKwp));
    gap(6);

    // 6. RESUMEN INVERSION
    sectionHeader('RESUMEN DE LA INVERSION');
    checkY(20);
    page.drawText('Componentes e items incluidos en el proyecto:', { x: margin + 10, y, size: 9, font: fontBold, color: COLOR_TITLE });
    y -= 14;
    [
      `${resultados.npaneles} paneles solares de ${resultados.potenciaPanel} W (LONGi Solar)`,
      `1 inversor capacidad aprox. ${num2(resultados.kwp)} kW (Huawei / Growatt / GoodWe)`,
      'Estructura de montaje (rieles, clamps, L-Foot y puesta a tierra)',
      'Cableado solar AC/DC, protecciones electricas y fusibles',
      'Instalacion, puesta en marcha y configuracion de monitoreo remoto',
      'Capacitacion al usuario y entrega de manual de operacion',
    ].forEach((c) => bullet(c, 10));
    gap(6);

    // 7. FORMAS DE PAGO
    newPage();
    gap(4);
    sectionHeader('FORMAS DE PAGO');
    [
      { t: '1. Pago de contado', d: 'Pago total antes de iniciar la instalacion. Garantiza disponibilidad inmediata de equipos y posible descuento por pronto pago.' },
      { t: '2. Credito bancario', d: 'Financiacion directa con su entidad bancaria. Solartech entrega la documentacion tecnica requerida para la solicitud.' },
    ].forEach(({ t, d }) => {
      checkY(42);
      page.drawText(t, { x: margin + 10, y, size: 9, font: fontBold, color: COLOR_ACCENT });
      y -= 13;
      para(d, 14, 8.5, COLOR_MUTED);
      gap(3);
    });
    gap(6);
  }
  // 8. IMPACTO AMBIENTAL
  gap(6);
  // Título, tarjetas y texto en la misma página: el texto solo en una página nueva la dejaba vacía.
  checkY(46 + 64 + 44);
  sectionHeader('IMPACTO AMBIENTAL');

  // Tarjetas visuales para los 3 indicadores ambientales
  const statCards = [
    { icon: '🌳', label: 'Arboles equivalentes', value: `${safe(resultados.arbolesEquivalentes)}`, unit: 'arboles/año' },
    { icon: '💨', label: 'CO2 evitado',           value: `${safe(resultados.co2EvitadoToneladas)}`, unit: 'ton/año'   },
    { icon: '⛽', label: 'Gasolina evitada',       value: `${safe(resultados.galonesGasolinaEvitados)}`, unit: 'galones/año' },
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
  para('Al elegir energia solar contribuye activamente a la reduccion de emisiones de CO2 y a la independencia energetica de Colombia. Su sistema generara energia limpia por mas de 25 años.', 10, 8.5, COLOR_MUTED);
  gap(8);

  // // Banner hogar después de impacto ambiental
  // if (bannerImgs.hogar) {
  //   checkY(118);
  //   const bH = 105;
  //   page.drawImage(bannerImgs.hogar, { x: 0, y: y - bH, width: W, height: bH });
  //   y -= bH + 12;
  // }

  // 9. ETAPAS DEL PROYECTO — 2 columnas de 3 + Garantías al final. Página nueva solo si no cabe:
  // forzarla dejaba la página anterior medio vacía.
  checkY(320);
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
  checkY(46 + 150);   // título y garantías juntos
  sectionHeader('GARANTIAS');
  {
    const col1Items = [
      ['Paneles solares - rendimiento', 'Garantia de producto 12 años. Rendimiento mayor al 80% por 25 años.'],
      ['Inversor', 'Garantia de fabrica 5 años (extensible a 10 segun fabricante).'],
      ['Estructura de montaje', 'Garantia estructural 10 años contra corrosion y deformacion.'],
    ];
    const col2Items = [
      ['Instalacion electrica', 'Garantia de mano de obra 2 años segun norma RETIE.'],
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

  // PROYECTOS INSTALADOS — dos filas de tarjetas; página nueva solo si no caben.
  checkY(2 * (115 + 78 + 8) + 60);
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

  // 11. CASOS DE EXITO + MARCAS ALIADAS — página nueva solo si la imagen de casos no cabe.
  checkY(46 + 280 + 16);
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
  // la numeración y es justo lo que se veía antes. Los saltos automáticos ya van sin
  // banner, así que basta con que el título y las primeras condiciones quepan.
  bannerSuprimido = true;
  gap(4);
  // Condiciones del PPA: hoja PPA del Cotizador WEB (B68:B73) más las de operación del contrato.
  const condicionesPPA = [
    'Las tarifas presentadas son de referencia y no son vinculantes hasta la firma del contrato de suministro de energia (PPA).',
    `La tarifa PPA se indexa mensualmente con el IPC durante los ${calcularPPA(entradasDesde(resultados), cfg).plazo} años del contrato. Al terminar el plazo, los equipos se ceden al cliente sin costo adicional.`,
    'Solartech asume la inversion, la instalacion, la operacion y el mantenimiento del sistema durante la vigencia del contrato.',
    'Los ahorros proyectados no incluyen la devolucion de excedentes a la red y dependen de la radiacion solar real, que varia segun las condiciones climaticas.',
    'El proyecto no incluye lineas de vida, apantallamiento ni analisis estructural de la cubierta; estos se definen en la visita tecnica.',
    'El proyecto no incluye la adecuacion de la frontera comercial. Este costo sera definido por el operador de red durante la legalizacion.',
    'Si la cubierta tiene mas area util, el proyecto puede crecer y la tarifa PPA se mantiene.',
    'Validez de la oferta: quince (15) dias calendario a partir de su emision.',
  ];
  const condiciones = esPPA ? condicionesPPA : [
    'La cantidad de paneles solares e inversores podra ajustarse de acuerdo con la potencia finalmente disponible y las condiciones tecnicas definitivas del proyecto.',
    'Con la aceptacion de la presente cotizacion, el cliente declara conocer y aceptar las politicas de servicio posventa y condiciones de garantia establecidas por la empresa.',
    'La cotizacion incluye los costos asociados a viaticos de instalacion y desplazamiento del personal tecnico hasta el sitio del proyecto.',
    'El plazo estimado de entrega es de ciento veinte (120) dias calendario, contados a partir de la fecha de recepcion del primer pago, y estara sujeto a la obtencion del certificado RETIE.',
    'Los equipos que sean objeto de reparacion o reemplazo durante el periodo de garantia conservaran exclusivamente el tiempo restante de la garantia original.',
    'La presente propuesta podra generar costos adicionales derivados de condiciones que se identifiquen durante la visita tecnica en sitio.',
    'El sistema fotovoltaico no esta disenado para operar en ausencia del suministro de la red electrica (sistema on-grid), por lo cual su funcionamiento depende de la presencia activa de dicha red.',
    'Las cubiertas tipo losa de concreto deberan soportar una carga minima de 50 kg/m2, mientras que las cubiertas en teja deberan soportar una carga minima de 17 kg/m2.',
    'La presente cotizacion contempla la instalacion del cableado en tuberia expuesta. Cualquier requerimiento de canalizacion oculta o soluciones esteticas adicionales podra generar costos adicionales.',
    'Condiciones de garantia del sistema: Paneles solares: 15 años. Inversores: 5 años. Instalacion: 5 años. La validez de las garantias estara sujeta a la ejecucion de mantenimientos preventivos anuales con Solartech.',
    'En caso de que el comprador sea monousuario (con transformador propio) y desee realizar la legalizacion del sistema con entrega de excedentes al operador de red, debera cumplir con la Resolucion CREG 174 de 2021 (Cap. 4, Art. 19), la CREG 038 de 2014, la CREG 015 de 2018 y las normas del operador de red RA8-028 / RA8-030.',
    'Los valores de ahorro proyectados son estimativos y dependen de variables externas como la radiacion solar, el costo del kWh y la remuneracion definida por el operador de red para los excedentes de energia.',
    'El valor del contrato de respaldo es referencial y se ha calculado bajo el supuesto de un respaldo del 20% de la capacidad instalada. El cliente podra elegir respaldar desde 1 kW hasta el 100% de la capacidad instalada.',
    'El proyecto no incluye la adecuacion de la frontera comercial. Este costo sera definido posteriormente por el operador de red durante el proceso de visita y legalizacion.',
    'El proyecto no incluye el suministro del medidor bidireccional. Este podra ser adquirido directamente por el cliente con el operador de red o, si la normativa lo permite, podra ser suministrado por la empresa como un item adicional.',
    'Validez de la oferta: quince (15) dias calendario a partir de su emision.',
  ];
  // Todas juntas si caben en una página; si no, al menos el título con las primeras.
  const altoCondiciones = condiciones.reduce((h, c) => h + wrapWords(c, cW - 30, 8.5).length * 12.5 + 8, 46);
  checkY(Math.min(altoCondiciones, H - headerH - footerH - 60));
  sectionHeader(esPPA ? 'CONDICIONES DEL CONTRATO PPA' : 'CONDICIONES COMERCIALES');
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

  // 13. DATOS DEL ASESOR COMERCIAL — sigue a las condiciones si cabe (asesor + cierre ≈ 340 px)
  checkY(340);
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

// ====== GET /api/me — perfil del asesor con sesión de Supabase ======
app.get('/api/me', requiereUsuario, (req, res) => {
  const { db, ...perfil } = req.usuario;
  res.json(perfil);
});

// ====== POST /api/calcular-proyecto ======
// Lo usan el asesor (con token) y la página web (servidor a servidor, sin token).
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

    const usuario = await sb.autenticar(req);
    // La web guarda primero el lead en Supabase y manda su id: aquí se completa ese
    // mismo registro en vez de crear otro. Solo se acepta con la llave compartida.
    const esWeb = !!process.env.WEB_SYNC_KEY && req.headers['x-solartech-web-key'] === process.env.WEB_SYNC_KEY;
    const leadIdWeb = esWeb && data.leadIdWeb ? String(data.leadIdWeb) : null;

    // ====== Validar lead duplicado (solo por cédula/NIT) ======
    if (data.identificacion) {
      const existente = await sb.buscarPorIdentificacion(data.identificacion, leadIdWeb);
      if (existente) {
        return res.status(409).json({
          error: 'lead_duplicado',
          mensaje: `La Cédula/NIT ${data.identificacion} ya está registrada y la está atendiendo el asesor ${existente.vendedor}.`,
          vendedor: existente.vendedor,
          cotizacion: existente.numeroCotizacion,
          campoClave: 'Cédula/NIT',
        });
      }
    }

    const numeroCotizacion = await sb.siguienteNumero();
    const codigoPublico    = await sb.codigoPublicoLibre();
    const asesorPDF = usuario ? firmaDe(usuario) : await firmaPorVendedor(data.vendedor);

    const cfg = await leerConfig();
    const resultados = calcularProyecto(data, cfg);
    const pdfUrl = await generarPDF(data, { ...resultados, numeroCotizacion }, asesorPDF, cfg);

    const lead = {
      codigoPublico,
      estado: 'Nuevo',
      // Cliente
      nombre: data.nombre,
      identificacion: data.identificacion,
      correo: data.correo,
      telefono: data.telefono,
      ubicacion: data.ubicacion,
      ciudadSolar: data.ciudadSolar,
      departamentoSolar: data.departamentoSolar,
      // Proyecto
      tipoSolicitud: data.tipoSolicitud,
      tipoTecho: data.tipoTecho,
      sistemaInteres: data.sistemaInteres,
      preferenciaContacto: data.preferenciaContacto,
      conociste: data.conociste,
      modalidad: data.modalidad,
      tipoDocumento: data.tipoDocumento,
      contribucion: resultados.contribucion,
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
    };

    let leadId;
    if (leadIdWeb) {
      await sb.completarLeadWeb(leadIdWeb, lead, { numero_cotizacion: numeroCotizacion });
      leadId = leadIdWeb;
    } else if (usuario) {
      leadId = await sb.crearLead(usuario.db, lead, {
        source: 'solartech_app', numero_cotizacion: numeroCotizacion, asesor_id: usuario.id,
      });
    } else {
      leadId = await sb.crearLead(sb.admin, lead, { source: 'solartech_app', numero_cotizacion: numeroCotizacion });
    }

    // La web ya subió la factura por su lado.
    if (req.file && !leadIdWeb) {
      try { await sb.subirFactura(leadId, req.file); }
      catch (err) { console.error('[factura] No se pudo subir:', err.message); }
    }

    res.json({
      ...resultados, numeroCotizacion, codigoPublico, pdfUrl, leadId,
      modalidad: data.modalidad === 'ppa' ? 'ppa' : 'recursos_propios',
      tipoDocumento: data.tipoDocumento || null,
      // Datos del cliente que calcularProyecto no devuelve y el PDF de la propuesta necesita
      identificacion: data.identificacion || null,
      conociste: data.conociste || null,
      ciudadSolar: data.ciudadSolar, departamentoSolar: data.departamentoSolar,
      areaDisponible: data.areaDisponible,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error interno" });
  }
});

// ====== GET /api/ciudades ======
// La radiación por municipio sale de frontend/src/data/colombiaMunicipios.js.
app.get('/api/ciudades', (_req, res) => res.json([]));

// ====== GET /api/config ======
app.get('/api/config', async (req, res) => {
  res.json(await leerConfig());
});

// ====== PUT /api/config (solo admin) ======
app.put('/api/config', express.json(), requiereUsuario, requiereAdmin, async (req, res) => {
  try {
    const actual = await leerConfig();
    const nueva = { ...actual, ...req.body };
    if (req.body.empresa) nueva.empresa = { ...actual.empresa, ...req.body.empresa };
    await sb.guardarConfig(req.usuario, nueva);
    res.json({ ok: true, config: nueva });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Datos del asesor que ve el cliente en la propuesta pública.
async function asesorInfoDe(asesorId) {
  if (!asesorId) return null;
  const a = (await sb.getAsesores()).find(x => x.id === asesorId);
  if (!a) return null;
  return { nombre: a.nombre, apellido: a.apellido, cargo: a.cargo, celular: a.celular, correo: a.correo };
}

// ====== GET /api/propuesta/:num (público — sin auth, para compartir con cliente) ======
app.get('/api/propuesta/:num', async (req, res) => {
  try {
    const param = String(req.params.num);
    let lead = await sb.getLeadPorCodigo(param);
    // Fallback: links antiguos por número, solo para leads que nunca tuvieron código.
    if (!lead && /^\d+(_\d+)?$/.test(param)) {
      const viejo = await sb.getLead(sb.admin, param);
      if (viejo && !viejo.codigoPublico) lead = viejo;
    }
    if (!lead) return res.status(404).json({ error: 'Propuesta no encontrada' });
    // Fuera lo interno del CRM: notas del asesor, historial, ids.
    const { id, estado, asesorId, actividades, historialEstados, fuente, mensaje, ...pub } = lead;
    const asesorInfo = await asesorInfoDe(asesorId);
    if (asesorInfo) pub.asesorInfo = asesorInfo;
    res.json(pub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== POST /api/propuestas/guardar — guarda la opción elegida por el asesor ======
// Este es el único punto donde se genera un ID de propuesta y su PDF. La vista
// /resultado ya NO genera PDF ni link antes de este paso.
app.post('/api/propuestas/guardar', express.json(), requiereUsuario, async (req, res) => {
  try {
    const usuario = req.usuario;
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

    const cfgForCalc = Number(datosOpcion.costokWp) > 0 ? { ...cfg, costokWp: Number(datosOpcion.costokWp) } : cfg;
    const dataWithFix = { ...datosCliente, consumoKwh, costoKwh };
    const resultados = calcularProyecto(dataWithFix, cfgForCalc);

    const propuestaId = await sb.propuestaIdLibre();
    const pdfUrl = await generarPDF(dataWithFix, { ...resultados, numeroCotizacion: propuestaId }, firmaDe(usuario), cfg);

    // leadId llega como número de cotización ("83" o "83_2").
    const lead = leadId != null && leadId !== '' ? await sb.getLead(usuario.db, leadId) : null;

    await sb.crearPropuesta(usuario.db, {
      id: propuestaId,
      lead_id: lead?.id ?? null,
      created_by: usuario.id,
      opcion: opcionSeleccionada != null ? String(opcionSeleccionada) : null,
      kwp: resultados.kwp,
      paneles: Math.round(Number(resultados.npaneles) || 0),
      inversion_cop: resultados.costoProyectoMasIva,
      ahorro_mensual_cop: resultados.ahorroMensual,
      roi_anios: resultados.tiempoRetorno,
      nombre_cliente: datosCliente.nombre || null,
      ciudad: datosCliente.ubicacion || datosCliente.ciudadSolar || null,
      consumo_kwh: resultados.consumoKwh,
      sistema: datosCliente.sistemaInteres || datosCliente.tipoSolicitud || null,
      techo: datosCliente.tipoTecho || null,
      pdf_url: pdfUrl,
      estado: 'Enviada',
      modalidad: datosCliente.modalidad === 'ppa' ? 'ppa' : 'recursos_propios',
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
    const propuesta = await sb.getPropuesta(String(req.params.id).trim());
    if (!propuesta) return res.status(404).json({ error: 'Propuesta no encontrada' });

    // Enriquecer con datos de contacto y asesor del lead original, si existe
    let leadInfo = {};
    let asesorInfo = null;
    const lead = propuesta.lead_id ? await sb.getLeadPorId(propuesta.lead_id) : null;
    if (lead) {
      leadInfo = {
        correo: lead.correo,
        telefono: lead.telefono,
        preferenciaContacto: lead.preferenciaContacto,
        radiacionSolar: lead.radiacionSolar,
        areaDisponible: lead.areaDisponible,
        vendedor: lead.vendedor,
      };
      asesorInfo = await asesorInfoDe(lead.asesorId);
    }

    res.json({
      numeroCotizacion: propuesta.id,
      codigoPublico: propuesta.id,
      leadId: lead?.numeroCotizacion ?? '',
      opcion: propuesta.opcion,
      nombre: propuesta.nombre_cliente,
      ubicacion: propuesta.ciudad,
      kwp: Number(propuesta.kwp) || 0,
      npaneles: Number(propuesta.paneles) || 0,
      costoProyectoMasIva: Number(propuesta.inversion_cop) || 0,
      ahorroMensual: Number(propuesta.ahorro_mensual_cop) || 0,
      tiempoRetorno: propuesta.roi_anios != null ? Number(propuesta.roi_anios) : null,
      consumoKwh: Number(propuesta.consumo_kwh) || 0,
      tipoSolicitud: propuesta.sistema,
      sistemaInteres: propuesta.sistema,
      tipoTecho: propuesta.techo,
      fecha: propuesta.created_at,
      pdfUrl: propuesta.pdf_url,
      estado: propuesta.estado,
      modalidad: propuesta.modalidad || lead?.modalidad || 'recursos_propios',
      tipoDocumento: lead?.tipoDocumento || null,
      contribucion: lead?.contribucion || false,
      costoKwh: lead?.costoKwh,
      radiacionSolar: lead?.radiacionSolar,
      ...leadInfo,
      asesorInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== GET /api/leads/:num/versiones — lista versiones de una cotización ======
app.get('/api/leads/:numeroCotizacion/versiones', requiereUsuario, async (req, res) => {
  try {
    const versiones = await sb.listarVersiones(req.usuario.db, String(req.params.numeroCotizacion));
    res.json(versiones.map(({ id, ...pub }) => pub));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== POST /api/leads/:num/version — guarda una opción como nueva versión ======
app.post('/api/leads/:numeroCotizacion/version', express.json(), requiereUsuario, async (req, res) => {
  try {
    const usuario = req.usuario;
    const base = String(req.params.numeroCotizacion);
    const baseLead = await sb.getLead(usuario.db, base);
    if (!baseLead) return res.status(404).json({ error: 'Propuesta base no encontrada' });

    const newLead = { ...baseLead, ...req.body };

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

    const versionId = await sb.crearVersion(usuario, base, {
      ...req.body, kwp: newLead.kwp, consumoKwh: newLead.consumoKwh, pdfUrl: '',
    });
    res.json({ ok: true, versionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== GET /api/leads ======
// RLS filtra: el admin ve todo; el asesor, sus leads y los que están sin asignar.
app.get('/api/leads', requiereUsuario, async (req, res) => {
  try {
    res.json(await sb.listarLeads(req.usuario.db));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ====== GET /api/leads/buscar ======
app.get('/api/leads/buscar', async (req, res) => {
  const { identificacion } = req.query;
  if (!identificacion) return res.json({ encontrado: false });
  try {
    const lead = await sb.buscarPorIdentificacion(identificacion);
    if (lead) return res.json({ encontrado: true, vendedor: lead.vendedor, numeroCotizacion: lead.numeroCotizacion, nombre: lead.nombre, campoClave: 'Cédula/NIT' });
    res.json({ encontrado: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ====== GET /api/leads/check-cedula/:cedula ======
app.get('/api/leads/check-cedula/:cedula', async (req, res) => {
  const { cedula } = req.params;
  if (!cedula) return res.json({ exists: false });
  try {
    const lead = await sb.buscarPorIdentificacion(cedula);
    if (lead) return res.json({ exists: true, asesor: lead.vendedor, cotNum: lead.numeroCotizacion });
    res.json({ exists: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ====== Asesores (usuarios de Supabase Auth + tabla staff) ======
app.get('/api/asesores', requiereUsuario, async (_req, res) => {
  try {
    res.json(await sb.getAsesores());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const filaStaff = ({ nombre, apellido, cargo, rol, celular }) => ({
  ...(nombre && { name: nombre }),
  ...(apellido !== undefined && { apellido }),
  ...(cargo && { cargo }),
  ...(rol && { role: String(rol).toLowerCase() === 'admin' ? 'admin' : 'asesor' }),
  ...(celular !== undefined && { celular }),
});

// ====== POST /api/asesores (solo admin) ======
// El correo es el usuario de acceso.
app.post('/api/asesores', express.json(), requiereUsuario, requiereAdmin, async (req, res) => {
  const { nombre, password } = req.body;
  const correo = String(req.body.correo || req.body.usuario || '').trim().toLowerCase();
  if (!nombre || !correo || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
  if (!correo.includes('@')) return res.status(400).json({ error: 'El usuario de acceso debe ser un correo' });

  const { data, error } = await sb.admin.auth.admin.createUser({ email: correo, password, email_confirm: true });
  if (error) {
    const yaExiste = /already|registered|exists/i.test(error.message);
    return res.status(yaExiste ? 409 : 400).json({ error: yaExiste ? 'Ya existe un usuario con ese correo' : error.message });
  }
  const { error: errStaff } = await sb.admin.from('staff').insert({
    user_id: data.user.id, email: correo, cargo: 'Asesor Comercial', role: 'asesor', ...filaStaff(req.body),
  });
  if (errStaff) {
    await sb.admin.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({ error: errStaff.message });
  }
  res.status(201).json({ ok: true, id: data.user.id });
});

// ====== PUT /api/asesores/:id (solo admin) ======
app.put('/api/asesores/:id', express.json(), requiereUsuario, requiereAdmin, async (req, res) => {
  const id = String(req.params.id);
  const correo = req.body.correo ? String(req.body.correo).trim().toLowerCase() : null;
  const cambiosAuth = {
    ...(correo && { email: correo, email_confirm: true }),
    ...(req.body.password && { password: req.body.password }),
  };
  if (Object.keys(cambiosAuth).length) {
    const { error } = await sb.admin.auth.admin.updateUserById(id, cambiosAuth);
    if (error) return res.status(400).json({ error: error.message });
  }
  const { data, error } = await sb.admin.from('staff')
    .update({ ...filaStaff(req.body), ...(correo && { email: correo }) })
    .eq('user_id', id).select('user_id');
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: 'Asesor no encontrado' });
  res.json({ ok: true });
});

// ====== DELETE /api/asesores/:id (solo admin) ======
// Se desactiva en vez de borrar: sus leads e historial siguen apuntando a él.
app.delete('/api/asesores/:id', requiereUsuario, requiereAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (id === req.usuario.id) return res.status(403).json({ error: 'No puedes desactivar tu propio usuario' });
  const { data, error } = await sb.admin.from('staff').update({ activo: false }).eq('user_id', id).select('user_id');
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: 'Asesor no encontrado' });
  res.json({ ok: true });
});

// ====== PATCH /api/leads/:numeroCotizacion/estado ======
// La bitácora (historial de estados) y la fecha de cierre las llevan los triggers de Supabase.
app.patch('/api/leads/:numeroCotizacion/estado', express.json(), requiereUsuario, async (req, res) => {
  const num = String(req.params.numeroCotizacion);
  const { estado } = req.body;
  if (!sb.APP_A_ESTADO[estado]) return res.status(400).json({ error: 'Estado no válido' });
  try {
    const usuario = req.usuario;
    const lead = await sb.getLead(usuario.db, num);
    if (!lead) throw new Error('Lead no encontrado');
    await sb.actualizarLead(usuario.db, num, { estado }, tomarSiLibre(usuario, lead));
    const actualizado = await sb.getLead(usuario.db, num);
    res.json({ ok: true, historialEstados: actualizado?.historialEstados || [] });
  } catch (err) {
    res.status(err.message === 'Lead no encontrado' ? 404 : 500).json({ error: err.message });
  }
});

// ====== POST /api/leads/:numeroCotizacion/actividad — nota/gestión del asesor ======
const TIPOS_ACTIVIDAD = ['nota', 'llamada', 'correo', 'reunion', 'whatsapp'];
app.post('/api/leads/:numeroCotizacion/actividad', express.json(), requiereUsuario, async (req, res) => {
  const num = String(req.params.numeroCotizacion);
  const { tipo, texto } = req.body || {};
  if (!texto || !String(texto).trim()) return res.status(400).json({ error: 'La nota no puede estar vacía.' });
  try {
    const usuario = req.usuario;
    const lead = await sb.getLead(usuario.db, num);
    if (!lead) throw new Error('Lead no encontrado');
    const tomar = tomarSiLibre(usuario, lead);
    if (tomar.asesor_id) await sb.actualizarLead(usuario.db, num, {}, tomar);
    const actividad = await sb.registrarActividad(
      usuario, lead.id, TIPOS_ACTIVIDAD.includes(tipo) ? tipo : 'nota', String(texto).trim()
    );
    res.json({ ok: true, actividad });
  } catch (err) {
    res.status(err.message === 'Lead no encontrado' ? 404 : 500).json({ error: err.message });
  }
});

// ====== PATCH /api/leads/:numeroCotizacion/opciones ======
app.patch('/api/leads/:numeroCotizacion/opciones', express.json(), requiereUsuario, async (req, res) => {
  const num = String(req.params.numeroCotizacion);
  const { opciones } = req.body;
  try {
    const usuario = req.usuario;
    const lead = await sb.getLead(usuario.db, num);
    if (!lead) throw new Error('Lead no encontrado');
    await sb.actualizarLead(usuario.db, num, { opciones }, tomarSiLibre(usuario, lead));
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === 'Lead no encontrado' ? 404 : 500).json({ error: err.message });
  }
});

// ====== POST /api/generar-pdf (solo PDF, sin guardar lead) ======
// También lo usa la propuesta pública (sin token).
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

    const usuario = await sb.autenticar(req);
    const asesorPDF = usuario ? firmaDe(usuario) : await firmaPorVendedor(data.vendedor);

    // For versioned proposals, respect the version's costokWp
    const cfgForCalc = Number(data.costokWp) > 0
      ? { ...cfg, costokWp: Number(data.costokWp) }
      : cfg;

    const dataWithFix = { ...data, consumoKwh, costoKwh };
    const resultados = calcularProyecto(dataWithFix, cfgForCalc);
    const pdfUrl = await generarPDF(dataWithFix, { ...resultados, numeroCotizacion: data.numeroCotizacion ?? '-' }, asesorPDF, cfgForCalc);

    // Persistir pdfUrl en el lead: solo un asesor con sesión, nunca desde la vista pública.
    if (usuario && data.numeroCotizacion) {
      try {
        await sb.actualizarLead(usuario.db, String(data.numeroCotizacion), { pdfUrl });
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
  crearHandlerAgenteIA({ autenticar: sb.autenticar, listarLeads: sb.listarLeads })
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