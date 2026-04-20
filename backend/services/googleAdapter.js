'use strict';
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

const NUM_KEYS = [
  'costokWp', 'potenciaPanel', 'capacidadInversor', 'radiacionSolar',
  'margenCobertura', 'longitudRiel', 'cableSolar', 'ivaPct',
  'descuentoRentaPct', 'factorCO2', 'factorArboles', 'factorGalones',
];

// Mapeo: columna del Sheets → propiedad interna del lead
const SHEET_TO_LEAD = {
  // ── Identificación ──
  contacto:        'numeroCotizacion',
  fecha:           'fecha',
  asesor:          'vendedor',
  estado:          'estado',
  // ── Cliente ──
  nombre:          'nombre',
  cedula:          'identificacion',
  email:           'correo',
  telefono:        'telefono',
  ciudad:          'ubicacion',
  ciudad_solar:    'ciudadSolar',
  // ── Proyecto ──
  tipo:            'tipoSolicitud',
  tipo_techo:      'tipoTecho',
  sistema:         'sistemaInteres',
  contacto_pref:   'preferenciaContacto',
  canal_conociste: 'conociste',
  // ── Técnico ──
  consumo_kwh:     'consumoKwh',
  costo_kwh:       'costoKwh',
  factura_mensual: 'valorMensual',
  area_m2:         'areaDisponible',
  radiacion:       'radiacionSolar',
  potencia_kw:     'kwp',
  paneles:         'npaneles',
  inversores:      'ninversores',
  // ── Financiero ──
  inversion_cop:   'costoProyectoMasIva',
  ahorro_mensual:  'ahorroMensual',
  ahorro_anual:    'ahorroAnual',
  roi_meses:       'tiempoRetorno',
  // ── Misc ──
  pdf_url:         'pdfUrl',
  kwh:             'id',
};

// Columnas del Sheets en el orden exacto de la hoja
const SHEETS_COLS = Object.keys(SHEET_TO_LEAD);

// Mapeo inverso: propiedad interna → columna del Sheets
const LEAD_TO_SHEET = Object.fromEntries(
  Object.entries(SHEET_TO_LEAD).map(([col, prop]) => [prop, col])
);

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
async function getConfig() {
  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: 'config!A2:B',
    });
    const rows = res.data.values || [];
    const cfg = { empresa: {} };
    rows.forEach(([key, value]) => {
      if (!key) return;
      if (key.startsWith('empresa.')) {
        cfg.empresa[key.slice(8)] = value ?? '';
      } else {
        cfg[key] = NUM_KEYS.includes(key) ? Number(value) : value;
      }
    });
    return cfg;
  } catch (err) {
    console.error('[googleAdapter] getConfig error:', err.message);
    return {};
  }
}

async function saveConfig(cfg) {
  const auth = await getAuth().getClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const rows = [['clave', 'valor']];
  Object.entries(cfg).forEach(([k, v]) => {
    if (k === 'empresa' && v && typeof v === 'object') {
      Object.entries(v).forEach(([ek, ev]) => rows.push([`empresa.${ek}`, ev ?? '']));
    } else {
      rows.push([k, v ?? '']);
    }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: `config!A1:B${rows.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

// ─── LEADS ────────────────────────────────────────────────────────────────────
async function getAllLeads() {
  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: 'leads!A1:AH',
    });
    const [headers, ...rows] = res.data.values || [[]];
    if (!headers || !headers.length) return [];

    return rows.map(row => {
      // Construir objeto con columnas del Sheets
      const sheetObj = {};
      headers.forEach((h, i) => { sheetObj[h] = row[i] ?? ''; });

      // Traducir columnas Sheets → propiedades internas
      const lead = { opciones: [], identificacion: null };
      Object.entries(SHEET_TO_LEAD).forEach(([col, prop]) => {
        let val = sheetObj[col] ?? '';
        if (prop === 'numeroCotizacion') val = Number(val) || 0;
        if (['consumoKwh', 'kwp', 'costoProyectoMasIva'].includes(prop)) val = Number(val) || 0;
        if (prop === 'tiempoRetorno' && val !== '') val = Number(val) / 12; // meses → años
        lead[prop] = val;
      });

      if (!lead.id) lead.id = String(lead.numeroCotizacion || Math.random());
      return lead;
    });
  } catch (err) {
    console.error('[googleAdapter] getAllLeads error:', err.message);
    return [];
  }
}

async function saveLead(lead) {
  const auth = await getAuth().getClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'leads!A1:1',
  });
  let actualHeaders = headerRes.data.values?.[0] || [];

  // Agregar columnas canónicas faltantes al encabezado
  const missingCols = SHEETS_COLS.filter(c => !actualHeaders.includes(c));
  if (actualHeaders.length === 0 || missingCols.length > 0) {
    const newHeaders = [...actualHeaders, ...missingCols];
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: 'leads!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [newHeaders] },
    });
    actualHeaders = newHeaders;
  }

  const row = actualHeaders.map(col => {
    const prop = SHEET_TO_LEAD[col];
    if (!prop) return '';
    const val = lead[prop];
    if (col === 'roi_meses') return val != null ? Math.round(Number(val) * 12) : '';
    return val ?? '';
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: 'leads!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

async function updateLead(numeroCotizacion, fields) {
  const auth = await getAuth().getClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'leads!A1:AH',
  });
  const [headers, ...rows] = res.data.values || [[]];

  // La columna 'contacto' almacena numeroCotizacion
  const contIdx = headers.indexOf('contacto');
  if (contIdx === -1) throw new Error('Columna contacto no encontrada en Sheets');

  const rowIdx = rows.findIndex(r => Number(r[contIdx]) === Number(numeroCotizacion));
  if (rowIdx === -1) throw new Error('Lead no encontrado');

  const sheetRow = rowIdx + 2;
  const updatedRow = [...rows[rowIdx]];
  while (updatedRow.length < headers.length) updatedRow.push('');

  Object.entries(fields).forEach(([prop, val]) => {
    const col = LEAD_TO_SHEET[prop];
    if (!col) return;
    const colIdx = headers.indexOf(col);
    if (colIdx === -1) return;
    updatedRow[colIdx] = String(val ?? '');
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: `leads!A${sheetRow}:AH${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [updatedRow] },
  });
}

// ─── CONTADOR ─────────────────────────────────────────────────────────────────
async function incrementContador() {
  const auth = await getAuth().getClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'contador!A:B',
  });
  const rows = (res.data.values || []).filter(r => r[0] !== 'fecha');
  let total = rows.length > 0 ? parseInt(rows[rows.length - 1][1] || '0', 10) : 0;
  total += 1;
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: 'contador!A:B',
    valueInputOption: 'RAW',
    requestBody: { values: [[new Date().toISOString(), total]] },
  });
  return total;
}

// ─── CIUDADES / RADIACIÓN ──────────────────────────────────────────────────────
async function getCiudades() {
  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: 'config!D2:G',
    });
    const rows = res.data.values || [];
    return rows
      .filter(r => r[1] && r[3])
      .map(([departamento, ciudad, , radiacionDia]) => ({
        departamento: departamento || '',
        ciudad: ciudad || '',
        radiacionDia: Number(String(radiacionDia).replace(',', '.')) || 0,
      }));
  } catch (err) {
    console.error('[googleAdapter] getCiudades error:', err.message);
    return [];
  }
}

module.exports = { getConfig, saveConfig, getAllLeads, saveLead, updateLead, incrementContador, getCiudades };
