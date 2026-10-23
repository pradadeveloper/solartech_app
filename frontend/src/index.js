import ReactDOM from 'react-dom/client';
import './tokens.css';
import Avisos from './components/Avisos';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import DashboardResumen from './DashboardResumen';
import CotizadorSolar from './CotizadorSolar';
import Resultado from './Resultado';
import LeadsCotizaciones from './LeadsCotizaciones';
import ResumenGerencia from './ResumenGerencia';
import ForecastEquipos from './ForecastEquipos';
import Asesores from './Asesores';
import Configuracion from './Configuracion';
import AgenteIA from './AgenteIA';
import Login from './Login';
import PropuestaPublica from './PropuestaPublica';
import { supabase, sincronizarToken, limpiarSesionLocal } from './supabase';

function RutaProtegida({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));

const render = () => root.render(
  <Router>
    <Routes>
      {/* Ruta pública — sin login */}
      <Route path="/propuesta/:num" element={<PropuestaPublica />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RutaProtegida><DashboardLayout /></RutaProtegida>}>
        <Route index element={<DashboardResumen />} />
        <Route path="cliente" element={<CotizadorSolar />} />
        <Route path="resultado" element={<Resultado />} />
        <Route path="leads" element={<LeadsCotizaciones />} />
        <Route path="gerencia" element={<ResumenGerencia />} />
        <Route path="forecast" element={<ForecastEquipos />} />
        <Route path="agente" element={<AgenteIA />} />
        <Route path="asesores" element={<Asesores />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
    <Avisos />
  </Router>
);

// Antes de pintar el CRM: getSession renueva el token si venció mientras la app
// estaba cerrada, así ninguna pantalla arranca con un token viejo. La propuesta
// pública no usa sesión: se pinta de una vez para el cliente.
const esPublica = window.location.pathname.startsWith('/propuesta/');
if (esPublica) render();
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) localStorage.setItem('token', session.access_token);
  else limpiarSesionLocal();
  sincronizarToken();
  if (!esPublica) render();
});