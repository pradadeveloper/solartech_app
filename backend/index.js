// LOGICA DE CALCULOS
// backend/index.js actualizado
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const contadorPath = path.join(__dirname, 'contador.json');

const app = express();
const PORT = 4000;
const montserratPath = path.join(__dirname, 'fonts', 'Montserrat-Regular.ttf');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configurar multer para archivo adjunto
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

function incrementarContador() {
  const data = fs.readFileSync(contadorPath, 'utf-8');
  const json = JSON.parse(data);
  json.numero += 1;
  fs.writeFileSync(contadorPath, JSON.stringify(json));
  return json.numero;
}

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
  costoKwh
}) {
  // Convertir strings a números reales
  const consumo = parseFloat(consumoKwh);
  const costoUnidad = parseFloat(costoKwh);
  const gastoMensual = parseFloat(valorMensual);

  // Validación básica para evitar cálculos con NaN
  if (isNaN(consumo) || isNaN(costoUnidad) || isNaN(gastoMensual)) {
    throw new Error('Valores numéricos inválidos: consumoKwh, costoKwh o valorMensual');
  }

  // Cálculos
  const potenciaPanel = 585;
  const radiacionSolar = 3.8;
  const margenCobertura = 0.8
  const capacidadInversor = 3000;
  const vBateriaGel = 12;
  const vBateriaLitio = 48;
  const porcentajeDescargaBatGel = 0.6;
  const porcentajeDescargaBatLitio = 0.8;
  const costokWp = 3500000
  const longitudRiel = 4.7
  const cableSolar = 10

  const radiacionSolarCobertura = (radiacionSolar*margenCobertura).toFixed(1)
  const wPromedioDia = ((consumo * 1000 * 12) / 365).toFixed(1);
  const ahorroAnual = Math.round(consumo * 12 * costoUnidad);
  const ahorroMensual = Math.round(consumo * costoUnidad);
  const ahorro10Anos = Math.round(ahorroAnual*10);
  const kwp = ((wPromedioDia / radiacionSolarCobertura) / 1000).toFixed(1);
  const costoProyecto = Math.round(kwp * costokWp);
  const ivaProyecto = Math.round(costoProyecto* 0.05);
  const costoProyectoMasIva = Math.round(costoProyecto+ivaProyecto)
  const costokwpproyecto = Math.round(costoProyecto/kwp);
  const descuentoDeclaracion = Math.round(costoProyecto/2)
  const tiempoRetorno = (costoProyecto/ahorroAnual).toFixed(1)
  const valorKwp = Math.round(costoProyecto/kwp)

  // MEDIO AMBIENTALES
  const co2EvitadoToneladas = (kwp * 1.2 * 0.7 * 0.43).toFixed(2);
  const arbolesEquivalentes = (co2EvitadoToneladas / 0.02).toFixed(0);
  const galonesGasolinaEvitados = (co2EvitadoToneladas * 117.6).toFixed(0);

  // CALCULO DE EQUIPOS
  const npaneles = Math.ceil( wPromedioDia/(potenciaPanel * radiacionSolarCobertura));
  const ninversores = Math.ceil((potenciaPanel * npaneles) / capacidadInversor);

  const nbateriasGel = Math.ceil(((wPromedioDia * 0.6) / porcentajeDescargaBatGel) / vBateriaGel);
  const nbateriaslitio = Math.ceil(((wPromedioDia * 0.6) / porcentajeDescargaBatLitio) / vBateriaLitio);

  const nbateriasGel100 = Math.ceil(nbateriasGel / 100);
  const nbateriasGel150 = Math.ceil(nbateriasGel / 150);
  const nbateriasGel200 = Math.ceil(nbateriasGel / 200);
  const nbateriasLitio100 = Math.ceil(nbateriaslitio / 100);
  const nbateriasLitio150 = Math.ceil(nbateriaslitio / 150);
  const nbateriasLitio200 = Math.ceil(nbateriaslitio / 200);

  const riel47 = Math.ceil(((npaneles * 1.15) / longitudRiel) * 2);
  const midCland = Math.ceil((npaneles * 2) - 2);
  const endCland = Math.ceil(npaneles / 2);
  const lFoot = Math.ceil(riel47 * 3);
  const groundingLoop = Math.round(riel47 / 2) * 2;

  const produccionDeEnergia = npaneles * potenciaPanel;
  const areaMinima = Math.round(npaneles * 1.13 * 2); // o usa .toFixed(1) si necesitas un decimal

  const equipos = ["Paneles solares", "Inversor", "Estructuras", "Cableado"];

  // COBERTURA DEL PROYECTO ESPACIO
  let porcentajeCoberturaProyecto = 0;
  if (!isNaN(areaDisponible) && areaDisponible > 0) {
  const porcentajeReal = (areaDisponible / areaMinima) * 100;
  porcentajeCoberturaProyecto = porcentajeReal >= 100 ? 100 : porcentajeReal.toFixed(1);
  }
  
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
    wPromedioDia,
    potenciaPanel,
    capacidadInversor,
    kwp,
    costoProyecto,
    ivaProyecto,
    costoProyectoMasIva,
    costoKwh,
    valorKwp,
    equipos,
    ahorroAnual,
    ahorroMensual,
    ahorro10Anos,
    consumoKwh,
    npaneles,
    tiempoRetorno,
    areaDisponible,
    areaMinima,
    porcentajeCoberturaProyecto,
    margenCobertura,
    radiacionSolar,
    radiacionSolarCobertura,
    ninversores,
    nbateriasGel,
    nbateriaslitio,
    nbateriasGel100,
    nbateriasGel150,
    nbateriasGel200,
    nbateriasLitio100,
    nbateriasLitio150,
    nbateriasLitio200,
    descuentoDeclaracion,
    riel47,
    midCland,
    endCland,
    lFoot,
    groundingLoop,
    cableSolar,
    produccionDeEnergia,
    costokwpproyecto,
    arbolesEquivalentes,
    galonesGasolinaEvitados,
    co2EvitadoToneladas
  };
}

async function generarPDF(data, resultados) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  pdfDoc.registerFontkit(fontkit);
  const fontBytes = fs.readFileSync(montserratPath);
  const montserratFont = await pdfDoc.embedFont(fontBytes);

  // Header
  page.drawText('Solartech Energy S.A.S', {
    x: margin,
    y,
    size: 20,
    color: rgb(0.9, 0.7, 0),
    font: montserratFont,
  });
  y -= 25;
  page.drawText('📞 +57 300 000 0000   ✉️ contacto@wattspower.com.co', {
    x: margin,
    y,
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
    font: montserratFont,
  });
  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 30;

  // Título
  page.drawText('Propuesta Técnica y Comercial', {
    x: margin,
    y,
    size: 16,
    color: rgb(0, 0, 0),
    font: montserratFont,
  });
  y -= 25;

  // Datos del formulario
  const label = (text) => text.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'string') {
      page.drawText(`${label(key)}: ${value}`, {
        x: margin,
        y,
        size: 11,
        font: montserratFont,
        color: rgb(0.1, 0.1, 0.1)
      });
      y -= 15;
    }
  });

  // Resultados
  y -= 10;
  page.drawText(`kWp estimado: ${resultados.kwp}`, { x: margin, y, size: 12, font: montserratFont });
  y -= 15;
  page.drawText(`Costo estimado: $${resultados.costoProyecto}`, { x: margin, y, size: 12, font: montserratFont });
  y -= 15;
  page.drawText('Equipos incluidos:', { x: margin, y, size: 12, font: montserratFont });
  resultados.equipos.forEach((equipo, index) => {
    page.drawText(`- ${equipo}`, {
      x: margin + 15,
      y: y - 15 * (index + 1),
      size: 11,
      font: montserratFont
    });
  });
  y -= 15 * resultados.equipos.length + 10;

  // Condiciones comerciales
  page.drawText('Condiciones Comerciales', {
    x: margin,
    y,
    size: 14,
    font: montserratFont,
    color: rgb(0.1, 0.1, 0.1)
  });
  const condiciones = [
    '• Financiación disponible a través de aliados.',
    '• Garantía de 25 años en paneles solares.',
    '• Instalación estimada en 10 días hábiles.'
  ];
  condiciones.forEach((linea, index) => {
    page.drawText(linea, {
      x: margin + 10,
      y: y - 20 - index * 15,
      size: 11,
      font: montserratFont
    });
  });

  page.drawText('Gracias por confiar en Wattspower, líderes en energía solar.', {
    x: margin,
    y: 50,
    size: 10,
    font: montserratFont,
    color: rgb(0.4, 0.4, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `propuesta-${uuidv4()}.pdf`;
  const filePath = path.join(__dirname, 'public', fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return '/' + fileName;
}

app.post('/api/calcular-proyecto', upload.single('facturaAdjunta'), async (req, res) => {
  const data = req.body;

  if (!data.nombre || !data.ubicacion || !data.valorMensual) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const numeroCotizacion = incrementarContador();

  const resultados = calcularProyecto({
  ...data,
  valorMensual: parseFloat(data.valorMensual),
  consumoKwh: parseFloat(data.consumoKwh),
  costoKwh: parseFloat(data.costoKwh)
});

  const pdfUrl = await generarPDF(data,{ ...resultados, numeroCotizacion });
  res.json({ ...resultados,numeroCotizacion, pdfUrl });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
