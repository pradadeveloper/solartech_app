'use strict';
// Migración única: Google Sheets (o los JSON locales) → Supabase.
//
//   node scripts/importar-sheets.js           # solo muestra qué haría
//   node scripts/importar-sheets.js --aplicar # escribe en Supabase
//   añadir --json para leer backend/leads.json, usuarios.json y config.json en vez de Sheets
//
// Se puede correr varias veces: lo ya importado (legacy_id) no se duplica.
// Si un lead de la web ya tiene ese número de cotización, se completa ese mismo registro.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sb = require('../services/supabase');

const APLICAR = process.argv.includes('--aplicar');
const DESDE_JSON = process.argv.includes('--json');
const { admin } = sb;

const leerJSON = (f, def) => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')); } catch { return def; }
};

async function origen() {
  if (DESDE_JSON) {
    return {
      asesores: leerJSON('usuarios.json', []),
      leads: leerJSON('leads.json', []),
      propuestas: leerJSON('propuestas.json', []),
      config: leerJSON('config.json', {}),
    };
  }
  const g = require('../services/googleAdapter');
  const [asesores, leads, propuestas, config] = await Promise.all([
    g.getAsesores(), g.getAllLeads(), g.getAllPropuestas(), g.getConfig(),
  ]);
  if (!leads.length) throw new Error('Sheets no devolvió leads: revisa GOOGLE_SERVICE_ACCOUNT y SHEET_ID');
  return { asesores, leads, propuestas, config };
}

// ─── Asesores ─────────────────────────────────────────────────────────────────
async function importarAsesores(asesores) {
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const porCorreo = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const sinCorreo = [];
  const sinClave = [];

  for (const a of asesores) {
    const correo = String(a.correo || (String(a.usuario).includes('@') ? a.usuario : '')).trim().toLowerCase();
    if (!correo) { sinCorreo.push(`${a.nombre} ${a.apellido || ''} (@${a.usuario})`.trim()); continue; }
    if (!APLICAR) { console.log(`  asesor ${correo} (${a.rol || 'Asesor'})`); continue; }

    let userId = porCorreo.get(correo);
    if (!userId) {
      // Se conserva su contraseña si cumple el mínimo de Supabase; si no, una aleatoria
      // y el admin le asigna una nueva desde la pantalla de Asesores.
      const usable = String(a.password || '').length >= 6;
      if (!usable) sinClave.push(correo);
      const { data, error } = await admin.auth.admin.createUser({
        email: correo,
        password: usable ? String(a.password) : crypto.randomBytes(18).toString('base64url'),
        email_confirm: true,
      });
      if (error) { console.error(`  ✗ ${correo}: ${error.message}`); continue; }
      userId = data.user.id;
    }
    const { error } = await admin.from('staff').upsert({
      user_id: userId,
      email: correo,
      name: a.nombre,
      apellido: a.apellido || null,
      cargo: a.cargo || 'Asesor Comercial',
      celular: a.celular || null,
      role: String(a.rol).toLowerCase() === 'admin' ? 'admin' : 'asesor',
      activo: true,
    });
    if (error) console.error(`  ✗ staff ${correo}: ${error.message}`);
    else console.log(`  ✓ asesor ${correo}`);
  }
  if (sinCorreo.length) console.log(`  ⚠ Sin correo, no se importaron (créalos en Asesores): ${sinCorreo.join(', ')}`);
  if (sinClave.length) console.log(`  ⚠ Contraseña muy corta, asígnales una nueva en Asesores: ${sinClave.join(', ')}`);
}

// ─── Leads ────────────────────────────────────────────────────────────────────
function partirNumero(n) {
  const m = String(n ?? '').match(/^(\d+)(?:_(\d+))?$/);
  return m ? { numero: Number(m[1]), version: m[2] ? Number(m[2]) : null } : null;
}

async function importarLeads(leads) {
  const { data: staff } = await admin.from('staff').select('user_id, name, apellido, email');
  const asesorDe = (vendedor) => {
    const v = String(vendedor || '').trim();
    const s = staff.find((x) => x.name === v || `${x.name} ${x.apellido || ''}`.trim() === v || x.email === v);
    return s?.user_id ?? null;
  };
  const sinAsesor = new Set();
  const omitidos = [];
  const idPorNumero = new Map();

  // Bases primero: las versiones apuntan a su lead base.
  const ordenados = leads
    .map((l) => ({ l, n: partirNumero(l.numeroCotizacion) }))
    .sort((a, b) => (a.n?.version ? 1 : 0) - (b.n?.version ? 1 : 0));

  for (const { l, n } of ordenados) {
    const legacyId = `sheets:${l.numeroCotizacion}`;
    if (!l.correo && !l.telefono) { omitidos.push(`${l.numeroCotizacion} (sin correo ni teléfono)`); continue; }
    const asesorId = asesorDe(l.vendedor);
    if (l.vendedor && l.vendedor !== 'Sin asignar' && !asesorId) sinAsesor.add(l.vendedor);

    if (!APLICAR) continue;

    const campos = { ...l };
    delete campos.historialEstados; delete campos.actividades;
    const extra = {
      legacy_id: legacyId,
      asesor_id: asesorId,
      numero_cotizacion: n?.numero ?? null,
      version_num: n?.version ?? null,
      version_de: n?.version ? idPorNumero.get(n.numero) ?? null : null,
      ...(l.fecha && !Number.isNaN(Date.parse(l.fecha)) && { created_at: new Date(l.fecha).toISOString() }),
      ...(l.fechaCierre && { cerrado_at: l.fechaCierre }),
    };

    // ¿Ya está? (importado antes, o es el mismo lead que guardó la web con ese número)
    let q = admin.from('leads').select('id, legacy_id, source');
    q = n ? q.eq('numero_cotizacion', n.numero) : q.eq('legacy_id', legacyId);
    if (n) q = n.version ? q.eq('version_num', n.version) : q.is('version_num', null);
    const { data: existente } = await q.maybeSingle();

    let id;
    try {
      if (existente) {
        // No se pisa el origen ni el consentimiento que registró la web.
        await sb.actualizarLeadPorId(admin, existente.id, campos, extra);
        id = existente.id;
      } else {
        id = await sb.crearLead(admin, campos, { source: 'importado', ...extra });
      }
    } catch (err) {
      omitidos.push(`${l.numeroCotizacion} (${err.message})`);
      continue;
    }
    if (n && !n.version) idPorNumero.set(n.numero, id);

    // Historial y notas (solo existen en los JSON locales: Sheets no los guardaba).
    if (!existente) {
      const eventos = [
        ...(l.historialEstados || []).map((h) => ({
          lead_id: id, type: 'estado', created_at: h.fecha,
          data: { de: sb.APP_A_ESTADO[h.de] || h.de, a: sb.APP_A_ESTADO[h.a] || h.a, usuario: h.usuario },
        })),
        ...(l.actividades || []).map((a) => ({
          lead_id: id, type: a.tipo || 'nota', created_at: a.fecha, data: { texto: a.texto, usuario: a.usuario },
        })),
      ];
      if (eventos.length) {
        const { error } = await admin.from('lead_events').insert(eventos);
        if (error) console.error(`  ✗ historial ${l.numeroCotizacion}: ${error.message}`);
      }
    }
  }

  console.log(`  ${APLICAR ? 'Importados' : 'Se importarían'}: ${leads.length - omitidos.length} de ${leads.length}`);
  if (sinAsesor.size) console.log(`  ⚠ Vendedores sin asesor en Supabase (quedan "Sin asignar"): ${[...sinAsesor].join(', ')}`);
  if (omitidos.length) console.log(`  ⚠ Omitidos: ${omitidos.join('; ')}`);
}

// ─── Propuestas ───────────────────────────────────────────────────────────────
async function importarPropuestas(propuestas) {
  let n = 0;
  for (const p of propuestas) {
    if (!p.id) continue;
    n++;
    if (!APLICAR) continue;
    const num = partirNumero(p.leadId);
    let leadId = null;
    if (num) {
      let q = admin.from('leads').select('id').eq('numero_cotizacion', num.numero);
      q = num.version ? q.eq('version_num', num.version) : q.is('version_num', null);
      leadId = (await q.maybeSingle()).data?.id ?? null;
    }
    const numero = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
    const { error } = await admin.from('propuestas').upsert({
      id: String(p.id).trim(),
      lead_id: leadId,
      ...(p.fecha && !Number.isNaN(Date.parse(p.fecha)) && { created_at: new Date(p.fecha).toISOString() }),
      opcion: p.opcion || null,
      kwp: numero(p.kWp),
      paneles: numero(p.paneles) == null ? null : Math.round(numero(p.paneles)),
      inversion_cop: numero(p.inversion_cop),
      ahorro_mensual_cop: numero(p.ahorro_mensual),
      roi_anios: numero(p.roi_anios),
      nombre_cliente: p.nombre_cliente || null,
      ciudad: p.ciudad || null,
      consumo_kwh: numero(p.consumo_kwh),
      sistema: p.sistema || null,
      techo: p.techo || null,
      pdf_url: p.pdf_url || null,
      estado: p.estado || 'Enviada',
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) console.error(`  ✗ propuesta ${p.id}: ${error.message}`);
  }
  console.log(`  ${APLICAR ? 'Importadas' : 'Se importarían'}: ${n}`);
}

(async () => {
  console.log(APLICAR ? '== Importando a Supabase ==' : '== Simulación (agrega --aplicar para escribir) ==');
  const datos = await origen();
  console.log(`Origen ${DESDE_JSON ? 'JSON local' : 'Google Sheets'}: ${datos.asesores.length} asesores, ${datos.leads.length} leads, ${datos.propuestas.length} propuestas`);

  console.log('\n1. Asesores'); await importarAsesores(datos.asesores);
  console.log('\n2. Leads');    await importarLeads(datos.leads);
  console.log('\n3. Propuestas'); await importarPropuestas(datos.propuestas);

  console.log('\n4. Configuración');
  if (APLICAR && Object.keys(datos.config).length) {
    const { error } = await admin.from('app_config').upsert({ clave: 'cotizador', valor: datos.config });
    console.log(error ? `  ✗ ${error.message}` : '  ✓ guardada');
  } else console.log(`  ${Object.keys(datos.config).length} claves`);

  if (APLICAR) {
    const { data, error } = await admin.rpc('sincronizar_numero_cotizacion');
    console.log(error ? `\n✗ Consecutivo: ${error.message}` : `\nConsecutivo de cotizaciones listo (último: ${data}).`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
