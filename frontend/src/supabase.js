import { createClient } from '@supabase/supabase-js';

// Solo para la sesión (Supabase Auth). Los datos se leen y escriben a través del backend.
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const PERFIL = ['nombreUsuario', 'apellidoUsuario', 'cargoUsuario', 'celularUsuario', 'correoUsuario', 'rolUsuario'];

// Las pantallas leen el token de localStorage('token'). Se mantiene al día con
// cada renovación automática de Supabase (el token dura 1 hora).
export function sincronizarToken() {
  supabase.auth.onAuthStateChange((_evento, session) => {
    if (session) localStorage.setItem('token', session.access_token);
    else limpiarSesionLocal();
  });
}

export function limpiarSesionLocal() {
  localStorage.removeItem('token');
  PERFIL.forEach((k) => localStorage.removeItem(k));
}

export function guardarPerfil(p) {
  localStorage.setItem('nombreUsuario', p.nombre || '');
  localStorage.setItem('apellidoUsuario', p.apellido || '');
  localStorage.setItem('cargoUsuario', p.cargo || '');
  localStorage.setItem('celularUsuario', p.celular || '');
  localStorage.setItem('correoUsuario', p.correo || '');
  localStorage.setItem('rolUsuario', p.rol || 'Asesor');
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
  limpiarSesionLocal();
}
