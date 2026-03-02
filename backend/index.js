// backend/index.js — SOLARTECH
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const app = express();
const PORT = 4000;

const contadorPath = path.join(__dirname, "contador.json");
const montserratPath = path.join(__dirname, "fonts", "Montserrat-Regular.ttf");
// const montserratBoldPath = path.join(__dirname, "fonts", "Montserrat-Bold.ttf");

// ====== Middlewares ======
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ====== Multer (uploads) ======
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ====== Contador ======
function incrementarContador() {
  if (!fs.existsSync(contadorPath)) {
    fs.writeFileSync(contadorPath, JSON.stringify({ numero: 0 }, null, 2));
  }
  const raw = fs.readFileSync(contadorPath, "utf-8");
  const json = JSON.parse(raw);
  json.numero += 1;
  fs.writeFileSync(contadorPath, JSON.stringify(json, null, 2));
  return json.numero;
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
}) {
  const consumo = toNumber(consumoKwh);       // kWh/mes
  const costoUnidad = toNumber(costoKwh);     // COP/kWh
  const gastoMensual = toNumber(valorMensual);
  const areaDisp = toNumber(areaDisponible);

  if ([consumo, costoUnidad, gastoMensual].some((n) => Number.isNaN(n))) {
    throw new Error("Valores numéricos inválidos: consumoKwh, costoKwh o valorMensual");
  }

  // Constantes
  const potenciaPanel = 585;     // W
  const radiacionSolar = 3.8;    // kWh/m2/día (aprox)
  const margenCobertura = 0.8;
  const capacidadInversor = 3000; // W
  const costokWp = 3500000;      // COP por kWp
  const longitudRiel = 4.7;
  const cableSolar = 10;

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
  const ivaProyecto = Math.round(costoProyecto * 0.05);
  const costoProyectoMasIva = Math.round(costoProyecto + ivaProyecto);

  const costokwpproyecto = kwp > 0 ? Math.round(costoProyecto / kwp) : 0;
  const descuentoDeclaracion = Math.round(costoProyecto / 2);
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
  const areaMinima = Math.round(npaneles * 1.13 * 2);

  // Cobertura por área (si aplica)
  let porcentajeCoberturaProyecto = 0;
  if (!Number.isNaN(areaDisp) && areaDisp > 0 && areaMinima > 0) {
    const p = (areaDisp / areaMinima) * 100;
    porcentajeCoberturaProyecto = p >= 100 ? 100 : Number(p.toFixed(1));
  }

  // Ambiental
  const co2EvitadoToneladas = Number((kwp * 1.2 * 0.7 * 0.43).toFixed(2));
  const arbolesEquivalentes = Math.round(co2EvitadoToneladas / 0.02);
  const galonesGasolinaEvitados = Math.round(co2EvitadoToneladas * 117.6);

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

    arbolesEquivalentes,
    galonesGasolinaEvitados,
    co2EvitadoToneladas,
  };
}

// ====== PDF ======
async function generarPDF(data, resultados) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(montserratPath);
  // const fontBoldBytes = fs.readFileSync(montserratBoldPath);
  const font = await pdfDoc.embedFont(fontBytes);
  // const fontBold = await pdfDoc.embedFont(fontBoldBytes);

  const COLOR_BG = rgb(0.06, 0.09, 0.12);
  const COLOR_PANEL = rgb(0.10, 0.14, 0.20);
  const COLOR_BORDER = rgb(0.20, 0.25, 0.33);
  const COLOR_TEXT = rgb(0.95, 0.96, 0.98);
  const COLOR_MUTED = rgb(0.70, 0.74, 0.80);
  const COLOR_ACCENT = rgb(0.96, 0.78, 0.10);

  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 42;
  let y = height - margin;

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: COLOR_BG });

  // Banner (opcional)
  const bannerPath = path.join(__dirname, "public", "assets", "banner_resultadospdF.jpg");
  if (fs.existsSync(bannerPath)) {
    const bytes = fs.readFileSync(bannerPath);
    const img = await pdfDoc.embedJpg(bytes);

    const bannerH = 130;
    page.drawImage(img, { x: 0, y: height - bannerH, width, height: bannerH });

    page.drawRectangle({
      x: 0, y: height - bannerH, width, height: bannerH,
      color: rgb(0, 0, 0), opacity: 0.35,
    });

    y = height - bannerH - 18;
  }

  // Header
  page.drawText("Solartech Energy S.A.S", { x: margin, y, size: 18, color: COLOR_ACCENT });
  y -= 18;
  page.drawText("📞 +57 300 000 0000   ✉️ contacto@solartech.com.co", { x: margin, y, size: 10, font, color: COLOR_MUTED });
  y -= 14;

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: COLOR_BORDER });
  y -= 18;

  page.drawText("Propuesta Técnica y Comercial", { x: margin, y, size: 16, color: COLOR_TEXT });
  y -= 18;

  const fecha = new Date().toLocaleDateString("es-CO");
  page.drawText(`Cotización: N-${resultados?.numeroCotizacion ?? "—"}   ·   Fecha: ${fecha}`, {
    x: margin, y, size: 10, font, color: COLOR_MUTED,
  });
  y -= 22;

  // Card helper (sin borderRadius)
  const card = ({ title, bodyLines, x, yTop, w, h }) => {
    page.drawRectangle({
      x, y: yTop - h, width: w, height: h,
      color: COLOR_PANEL,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
      opacity: 0.96,
    });

    page.drawText(title, { x: x + 14, y: yTop - 18, size: 12, color: COLOR_TEXT });

    let yy = yTop - 44;
    bodyLines.forEach((line) => {
      page.drawText(line, { x: x + 14, y: yy, size: 10, font, color: COLOR_MUTED });
      yy -= 14;
    });
  };

  const safe = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

  // Datos cliente (solo algunos campos clave)
  const clienteLines = [
    `Nombre: ${safe(data.nombre)}`,
    `Correo: ${safe(data.correo)}`,
    `Teléfono: ${safe(data.telefono)}`,
    `Ubicación: ${safe(data.ubicacion)}`,
    `Contacto: ${safe(data.preferenciaContacto)}`,
    `Tipo: ${safe(data.tipoSolicitud)}`,
  ];

  const cardW = width - margin * 2;
  card({ title: "Datos del cliente", bodyLines: clienteLines, x: margin, yTop: y, w: cardW, h: 130 });
  y -= 130 + 16;

  // Resultados
  const colGap = 12;
  const colW = (cardW - colGap) / 2;

  card({
    title: "Resumen técnico",
    bodyLines: [
      `kWp estimado: ${safe(resultados.kwp)}`,
      `Producción (kWh/mes): ${safe(resultados.produccionDeEnergia)}`,
      `Cobertura: ${safe(resultados.porcentajeCoberturaProyecto)}%`,
      `Área mínima: ${safe(resultados.areaMinima)} m²`,
    ],
    x: margin,
    yTop: y,
    w: colW,
    h: 140,
  });

  card({
    title: "Resumen financiero",
    bodyLines: [
      `Total (con IVA): $${safe(resultados.costoProyectoMasIva)}`,
      `Ahorro mensual: $${safe(resultados.ahorroMensual)}`,
      `Ahorro anual: $${safe(resultados.ahorroAnual)}`,
      `Retorno: ${safe(resultados.tiempoRetorno)} años`,
    ],
    x: margin + colW + colGap,
    yTop: y,
    w: colW,
    h: 140,
  });

  // Footer
  page.drawText("Gracias por confiar en Solartech Energy.", { x: margin, y: 28, size: 9, font, color: COLOR_MUTED });

  const pdfBytes = await pdfDoc.save();
  const fileName = `propuesta-${uuidv4()}.pdf`;
  const filePath = path.join(__dirname, "public", fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return "/" + fileName;
}

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

    const numeroCotizacion = incrementarContador();

    const resultados = calcularProyecto(data);
    const pdfUrl = await generarPDF(data, { ...resultados, numeroCotizacion });

    res.json({ ...resultados, numeroCotizacion, pdfUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error interno" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});