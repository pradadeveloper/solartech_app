'use strict';
const { google } = require('googleapis');
const { Readable } = require('stream');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

const NUM_KEYS = [
  'costokWp', 'potenciaPanel', 'capacidadInversor', 'radiacionSolar',
  'margenCobertura', 'longitudRiel', 'cableSolar', 'ivaPct',
  'descuentoRentaPct', 'factorCO2', 'factorArboles', 'factorGalones',
];

const LEAD_HEADERS = [
  'id', 'numeroCotizacion', 'vendedor', 'estado', 'fecha',
  'nombre', 'correo', 'telefono', 'identificacion', 'ubicacion',
  'tipoSolicitud', 'consumoKwh', 'kwp', 'costoProyectoMasIva', 'pdfUrl', 'opciones',
];

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
      range: 'leads!A1:P',
    });
    const [headers, ...rows] = res.data.values || [[]];
    if (!headers || !headers.length) return [];
    return rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i] ?? '';
        if (h === 'numeroCotizacion') val = Number(val) || 0;
        if (['consumoKwh', 'kwp', 'costoProyectoMasIva'].includes(h)) val = Number(val) || 0;
        if (h === 'opciones') { try { val = val ? JSON.parse(val) : []; } catch { val = []; } }
        obj[h] = val;
      });
      return obj;
    });
  } catch (err) {
    console.error('[googleAdapter] getAllLeads error:', err.message);
    return [];
  }
}

async function saveLead(lead) {
  const auth = await getAuth().getClient();
  const sheets = google.sheets({ version: 'v4', auth });
  // Ensure header row exists
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'leads!A1:P1',
  });
  if (!headerRes.data.values?.[0]?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: 'leads!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [LEAD_HEADERS] },
    });
  }
  const row = LEAD_HEADERS.map(h => {
    const v = lead[h];
    if (h === 'opciones') return JSON.stringify(v ?? []);
    return v ?? '';
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
    range: 'leads!A1:P',
  });
  const [headers, ...rows] = res.data.values || [[]];
  const numIdx = headers.indexOf('numeroCotizacion');
  const rowIdx = rows.findIndex(r => Number(r[numIdx]) === Number(numeroCotizacion));
  if (rowIdx === -1) throw new Error('Lead no encontrado');
  const sheetRow = rowIdx + 2;
  const updatedRow = [...rows[rowIdx]];
  while (updatedRow.length < headers.length) updatedRow.push('');
  Object.entries(fields).forEach(([key, val]) => {
    const idx = headers.indexOf(key);
    if (idx !== -1) updatedRow[idx] = key === 'opciones' ? JSON.stringify(val) : String(val ?? '');
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: `leads!A${sheetRow}:P${sheetRow}`,
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

// ─── DRIVE PDF ────────────────────────────────────────────────────────────────
async function uploadPDF(fileName, fileBuffer) {
  const auth = await getAuth().getClient();
  const drive = google.drive({ version: 'v3', auth });
  const stream = Readable.from(Buffer.from(fileBuffer));
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [process.env.DRIVE_COTIZACIONES_FOLDER_ID],
      mimeType: 'application/pdf',
    },
    media: { mimeType: 'application/pdf', body: stream },
    fields: 'id',
  });
  await drive.permissions.create({
    supportsAllDrives: true,
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return `https://drive.google.com/file/d/${res.data.id}/view`;
}

module.exports = { getConfig, saveConfig, getAllLeads, saveLead, updateLead, incrementContador, uploadPDF };
