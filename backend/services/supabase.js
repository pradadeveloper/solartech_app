'use strict';
// Acceso a Supabase (base compartida con la página web de Solartech).
//
// Dos clientes:
//  - admin (service role): lo público (cotizador de la web, propuesta pública,
//    config) y la gestión de usuarios de Auth. Se salta RLS.
//  - por usuario (token del asesor): todo lo del CRM. RLS decide qué leads ve
//    cada uno y la bitácora (lead_events) registra quién hizo cada cambio.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
}

const OPTS = {
  auth: { persistSession: false, autoRefreshToken: false },
  // Node 20 no trae WebSocket nativo y supabase-js lo exige al crear el cliente.
  realtime: { transport: require('ws') },
};
const admin = createClient(SUPABASE_URL, SERVICE_KEY, OPTS);

function clienteDe(token) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    ...OPTS,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Lanza el error de Supabase como Error normal para que lo capturen los endpoints.
function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ─── Asesores ─────────────────────────────────────────────────────────────────
// Forma que usa el frontend desde la época de Google Sheets.
function aAsesor(s) {
  return {
    id: s.user_id,
    nombre: s.name,
    apellido: s.apellido || '',
    cargo: s.cargo || 'Asesor Comercial',
    usuario: s.email,
    correo: s.email,
    celular: s.celular || '',
    rol: s.role === 'admin' ? 'Admin' : 'Asesor',
    activo: s.activo,
  };
}

async function getAsesores() {
  const filas = ok(await admin.from('staff').select('*').eq('activo', true).order('name'));
  return filas.map(aAsesor);
}

// Usuario autenticado a partir del Bearer token de Supabase Auth, o null.
// Incluye `db`: cliente con el token del usuario, sujeto a RLS.
async function autenticar(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: staff } = await admin.from('staff').select('*').eq('user_id', data.user.id).maybeSingle();
  if (!staff || !staff.activo) return null;
  return { ...aAsesor(staff), esAdmin: staff.role === 'admin', db: clienteDe(token) };
}

// ─── Leads: equivalencias con los campos de solartech_app ─────────────────────
const APP_A_ESTADO = {
  'Nuevo': 'nuevo', 'En negociación': 'negociacion', 'Cotizado': 'propuesta',
  'Enviado': 'enviado', 'Cerrado': 'ganado', 'Perdido': 'perdido',
};
const ESTADO_A_APP = {
  nuevo: 'Nuevo', contactado: 'En negociación', visita: 'En negociación',
  negociacion: 'En negociación', propuesta: 'Cotizado', enviado: 'Enviado',
  ganado: 'Cerrado', perdido: 'Perdido',
};
const TIPOS_ACTIVIDAD = ['nota', 'llamada', 'correo', 'reunion', 'whatsapp'];
const FUENTES_WEB = ['cotizador', 'contacto', 'calculadora'];

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const entero = (v) => (num(v) == null ? null : Math.round(Number(v)));
const texto = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

function tipoCliente(tipoSolicitud) {
  const t = String(tipoSolicitud || '').toLowerCase();
  if (!t) return null;
  if (t.includes('hogar')) return 'hogar';
  if (t.includes('agro')) return 'agro';
  return 'empresa';
}

function techoWeb(tipoTecho) {
  const t = String(tipoTecho || '').toLowerCase();
  if (t.includes('barro')) return 'teja_barro';
  if (t.includes('losa')) return 'losa';
  if (t.includes('suelo')) return 'suelo';
  if (t.includes('standing') || t.includes('termoac') || t.includes('lámina') || t.includes('lamina')) return 'lamina';
  return null;
}

// Propiedad de solartech_app → [columna, conversión]. Solo se escriben las que vienen.
const CAMPOS = {
  nombre:              ['nombre', texto],
  identificacion:      ['nit', texto],
  correo:              ['email', texto],
  telefono:            ['celular', texto],
  departamentoSolar:   ['departamento', texto],
  tipoSolicitud:       ['tipo_solicitud', texto],
  tipoTecho:           ['tipo_techo', texto],
  sistemaInteres:      ['sistema_interes', texto],
  preferenciaContacto: ['preferencia_contacto', texto],
  conociste:           ['canal_conociste', texto],
  consumoKwh:          ['consumo_kwh', num],
  costoKwh:            ['tarifa_kwh', num],
  valorMensual:        ['factura_cop', num],
  areaDisponible:      ['area_m2', num],
  radiacionSolar:      ['radiacion_solar', num],
  kwp:                 ['kwp', num],
  npaneles:            ['npaneles', entero],
  ninversores:         ['ninversores', entero],
  costoProyectoMasIva: ['valor_proyecto_cop', num],
  ahorroMensual:       ['ahorro_mensual_cop', num],
  ahorroAnual:         ['ahorro_anual_cop', num],
  pdfUrl:              ['propuesta_url', texto],
  codigoPublico:       ['codigo_publico', texto],
  opciones:            ['opciones', (v) => (Array.isArray(v) ? v : [])],
  modalidad:           ['modalidad', (v) => (v === 'ppa' ? 'ppa' : 'recursos_propios')],
  tipoDocumento:       ['tipo_documento', (v) => (['CC', 'NIT', 'CE', 'PH'].includes(String(v || '').toUpperCase()) ? String(v).toUpperCase() : null)],
  contribucion:        ['contribucion', (v) => v === true || ['true', 'si', 'sí', '1'].includes(String(v).trim().toLowerCase())],
};

function aFila(lead) {
  const fila = {};
  for (const [prop, [col, conv]] of Object.entries(CAMPOS)) {
    if (lead[prop] !== undefined) fila[col] = conv(lead[prop]);
  }
  // El cotizador manda la ciudad en ciudadSolar y/o ubicacion.
  if (lead.ciudadSolar !== undefined || lead.ubicacion !== undefined) {
    fila.ciudad = texto(lead.ciudadSolar) || texto(lead.ubicacion);
  }
  if (lead.tipoSolicitud !== undefined) fila.tipo_cliente = tipoCliente(lead.tipoSolicitud);
  if (lead.tipoTecho !== undefined) fila.techo = techoWeb(lead.tipoTecho);
  if (lead.tiempoRetorno !== undefined) {
    const anios = num(lead.tiempoRetorno);
    fila.payback_meses = anios == null ? null : Math.round(anios * 12 * 10) / 10;
  }
  if (lead.estado !== undefined) fila.estado = APP_A_ESTADO[lead.estado] || 'nuevo';
  return fila;
}

function numeroDe(r) {
  if (r.numero_cotizacion == null) return r.id; // leads del formulario de contacto
  return r.version_num ? `${r.numero_cotizacion}_${r.version_num}` : r.numero_cotizacion;
}

const SELECT_LEAD = `*,
  asesor:staff!leads_asesor_id_fkey(name),
  eventos:lead_events!lead_events_lead_id_fkey(id, type, data, created_at, actor:staff!lead_events_actor_id_fkey(name))`;

function aLead(r) {
  const eventos = (r.eventos || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  // Los eventos importados de Sheets traen el nombre en data.usuario.
  const quien = (e) => e.actor?.name || e.data?.usuario || 'Sistema';
  return {
    id: r.id,
    numeroCotizacion: numeroDe(r),
    codigoPublico: r.codigo_publico,
    vendedor: r.asesor?.name || 'Sin asignar',
    asesorId: r.asesor_id,
    estado: ESTADO_A_APP[r.estado] || 'Nuevo',
    fecha: r.created_at,
    fuente: r.source,
    // Cliente
    nombre: r.nombre,
    empresa: r.empresa,
    identificacion: r.nit,
    correo: r.email,
    telefono: r.celular,
    ubicacion: r.ciudad,
    ciudadSolar: r.ciudad,
    departamentoSolar: r.departamento,
    mensaje: r.mensaje,
    // Proyecto
    tipoSolicitud: r.tipo_solicitud || (r.tipo_cliente ? r.tipo_cliente[0].toUpperCase() + r.tipo_cliente.slice(1) : null),
    tipoTecho: r.tipo_techo || r.techo,
    sistemaInteres: r.sistema_interes,
    preferenciaContacto: r.preferencia_contacto,
    conociste: r.canal_conociste || (FUENTES_WEB.includes(r.source) ? 'Página web' : null),
    // Técnico
    consumoKwh: Number(r.consumo_kwh) || 0,
    costoKwh: num(r.tarifa_kwh),
    valorMensual: num(r.factura_cop),
    areaDisponible: num(r.area_m2),
    radiacionSolar: num(r.radiacion_solar),
    kwp: Number(r.kwp) || 0,
    npaneles: r.npaneles,
    ninversores: r.ninversores,
    // Financiero
    costoProyectoMasIva: Number(r.valor_proyecto_cop) || 0,
    ahorroMensual: num(r.ahorro_mensual_cop),
    ahorroAnual: num(r.ahorro_anual_cop),
    tiempoRetorno: r.payback_meses == null ? null : Math.round((Number(r.payback_meses) / 12) * 10) / 10,
    pdfUrl: r.propuesta_url,
    opciones: r.opciones || [],
    modalidad: r.modalidad || 'recursos_propios',
    tipoDocumento: r.tipo_documento || null,
    contribucion: !!r.contribucion,
    // CRM
    fechaCierre: r.estado === 'ganado' ? r.cerrado_at : null,
    historialEstados: eventos.filter((e) => e.type === 'estado').map((e) => ({
      de: ESTADO_A_APP[e.data?.de] || e.data?.de,
      a: ESTADO_A_APP[e.data?.a] || e.data?.a,
      fecha: e.created_at,
      usuario: quien(e),
    })),
    actividades: eventos.filter((e) => TIPOS_ACTIVIDAD.includes(e.type)).map((e) => ({
      id: `act_${e.id}`,
      tipo: e.type,
      texto: e.data?.texto || '',
      fecha: e.created_at,
      usuario: quien(e),
    })),
  };
}

// "83" → cotización 83; "83_2" → su versión 2; un uuid → lead sin número (contacto).
function filtroPorNumero(query, numero) {
  const m = String(numero).match(/^(\d+)(?:_(\d+))?$/);
  if (!m) return query.eq('id', String(numero));
  query = query.eq('numero_cotizacion', Number(m[1]));
  return m[2] ? query.eq('version_num', Number(m[2])) : query.is('version_num', null);
}

async function listarLeads(db) {
  const filas = ok(await db.from('leads').select(SELECT_LEAD).order('created_at', { ascending: false }));
  return filas.map(aLead);
}

async function getLead(db, numero) {
  const fila = ok(await filtroPorNumero(db.from('leads').select(SELECT_LEAD), numero).maybeSingle());
  return fila ? aLead(fila) : null;
}

async function getLeadPorCodigo(codigo) {
  const fila = ok(await admin.from('leads').select(SELECT_LEAD).eq('codigo_publico', codigo).maybeSingle());
  return fila ? aLead(fila) : null;
}

// `excluirId`: el lead que la web acaba de guardar con esa misma cédula/NIT.
async function buscarPorIdentificacion(identificacion, excluirId = null) {
  let q = admin.from('leads')
    .select('numero_cotizacion, version_num, nombre, id, asesor:staff!leads_asesor_id_fkey(name)')
    .eq('nit', String(identificacion).trim())
    .is('version_num', null);
  if (excluirId) q = q.neq('id', excluirId);
  const fila = ok(await q.order('created_at').limit(1).maybeSingle());
  if (!fila) return null;
  return { numeroCotizacion: numeroDe(fila), nombre: fila.nombre, vendedor: fila.asesor?.name || 'Sin asignar' };
}

async function siguienteNumero() {
  return ok(await admin.rpc('siguiente_numero_cotizacion'));
}

async function codigoPublicoLibre() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0, 1, I, O, L para evitar confusión
  for (;;) {
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const { count } = await admin.from('leads').select('id', { count: 'exact', head: true }).eq('codigo_publico', code);
    if (!count) return code;
  }
}

// `extra` son columnas directas (source, asesor_id, numero_cotizacion…).
async function crearLead(db, lead, extra = {}) {
  const fila = ok(await db.from('leads').insert({ ...aFila(lead), ...extra }).select('id').single());
  return fila.id;
}

async function actualizarLead(db, numero, campos, extra = {}) {
  const filas = ok(await filtroPorNumero(db.from('leads').update({ ...aFila(campos), ...extra }), numero).select('id'));
  if (!filas.length) throw new Error('Lead no encontrado');
}

async function actualizarLeadPorId(db, id, campos, extra = {}) {
  const filas = ok(await db.from('leads').update({ ...aFila(campos), ...extra }).eq('id', id).select('id'));
  if (!filas.length) throw new Error('Lead no encontrado');
}

// La web guarda el lead (contacto, consentimiento, UTM) y solartech_app lo completa
// con el número de cotización, el dimensionamiento y el PDF. Solo una vez por lead.
async function completarLeadWeb(id, campos, extra = {}) {
  const filas = ok(await admin.from('leads')
    .update({ ...aFila(campos), ...extra, synced_solartech_app_at: new Date().toISOString() })
    .eq('id', id)
    .in('source', FUENTES_WEB)
    .is('numero_cotizacion', null)
    .select('id'));
  if (!filas.length) throw new Error('Lead web no encontrado o ya registrado');
}

async function subirFactura(leadId, file) {
  const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
  const ruta = `${new Date().toISOString().slice(0, 7).replace('-', '/')}/${leadId}.${ext}`;
  ok(await admin.storage.from('facturas').upload(ruta, file.buffer, { contentType: file.mimetype, upsert: true }));
  ok(await admin.from('leads').update({ factura_path: ruta }).eq('id', leadId));
}

async function registrarActividad(usuario, leadId, tipo, textoNota) {
  const fila = ok(await usuario.db.from('lead_events')
    .insert({ lead_id: leadId, actor_id: usuario.id, type: tipo, data: { texto: textoNota } })
    .select('id, created_at').single());
  await usuario.db.from('leads').update({ ultimo_contacto_at: fila.created_at }).eq('id', leadId);
  return { id: `act_${fila.id}`, tipo, texto: textoNota, fecha: fila.created_at, usuario: usuario.nombre };
}

async function listarVersiones(db, numeroBase) {
  const filas = ok(await db.from('leads').select(SELECT_LEAD)
    .eq('numero_cotizacion', Number(numeroBase)).not('version_num', 'is', null).order('version_num'));
  return filas.map(aLead);
}

// Crea la versión N+1 de una cotización copiando el lead base.
async function crearVersion(usuario, numeroBase, cambios) {
  const base = ok(await usuario.db.from('leads').select('*')
    .eq('numero_cotizacion', Number(numeroBase)).is('version_num', null).maybeSingle());
  if (!base) return null;
  // La mayor versión se busca con admin: RLS podría ocultar versiones de otro asesor.
  const ultima = ok(await admin.from('leads').select('version_num')
    .eq('numero_cotizacion', Number(numeroBase)).not('version_num', 'is', null)
    .order('version_num', { ascending: false }).limit(1).maybeSingle());
  const versionNum = (ultima?.version_num || 0) + 1;
  const {
    id, created_at, updated_at, codigo_publico, estado_at, cerrado_at, legacy_id,
    synced_solartech_app_at, propuesta_url, ...copia
  } = base;
  ok(await usuario.db.from('leads').insert({
    ...copia,
    ...aFila(cambios),
    version_de: base.id,
    version_num: versionNum,
    opciones: [],
    asesor_id: usuario.esAdmin ? base.asesor_id : usuario.id,
  }));
  return `${numeroBase}_${versionNum}`;
}

// ─── Propuestas ───────────────────────────────────────────────────────────────
async function propuestaIdLibre() {
  for (;;) {
    const id = `ST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const { count } = await admin.from('propuestas').select('id', { count: 'exact', head: true }).eq('id', id);
    if (!count) return id;
  }
}

async function crearPropuesta(db, p) {
  ok(await db.from('propuestas').insert(p));
}

async function getPropuesta(id) {
  return ok(await admin.from('propuestas').select('*').eq('id', id).maybeSingle());
}

async function getLeadPorId(id) {
  const fila = ok(await admin.from('leads').select(SELECT_LEAD).eq('id', id).maybeSingle());
  return fila ? aLead(fila) : null;
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function getConfig() {
  const fila = ok(await admin.from('app_config').select('valor').eq('clave', 'cotizador').maybeSingle());
  return fila?.valor || {};
}

async function guardarConfig(usuario, cfg) {
  ok(await usuario.db.from('app_config').upsert({
    clave: 'cotizador', valor: cfg, updated_at: new Date().toISOString(), updated_by: usuario.id,
  }));
}

// ─── PDFs ─────────────────────────────────────────────────────────────────────
async function subirPDF(fileName, bytes) {
  const ruta = `${new Date().toISOString().slice(0, 7)}/${fileName}`;
  ok(await admin.storage.from('propuestas').upload(ruta, Buffer.from(bytes), {
    contentType: 'application/pdf', upsert: true,
  }));
  return admin.storage.from('propuestas').getPublicUrl(ruta).data.publicUrl;
}

module.exports = {
  admin, autenticar, aAsesor, getAsesores,
  listarLeads, getLead, getLeadPorId, getLeadPorCodigo, buscarPorIdentificacion,
  siguienteNumero, codigoPublicoLibre, crearLead, actualizarLead, actualizarLeadPorId,
  completarLeadWeb, subirFactura, registrarActividad, listarVersiones, crearVersion,
  propuestaIdLibre, crearPropuesta, getPropuesta,
  getConfig, guardarConfig, subirPDF,
  APP_A_ESTADO,
};
