import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import DashboardResumen from './DashboardResumen';
import CotizadorSolar from './CotizadorSolar';
import Resultado from './Resultado';
import LeadsCotizaciones from './LeadsCotizaciones';
import Asesores from './Asesores';
import Login from './Login';

function RutaProtegida({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <Router>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RutaProtegida><DashboardLayout /></RutaProtegida>}>
        <Route index element={<DashboardResumen />} />
        <Route path="cliente" element={<CotizadorSolar />} />
        <Route path="resultado" element={<Resultado />} />
        <Route path="leads" element={<LeadsCotizaciones />} />
        <Route path="asesores" element={<Asesores />} />
      </Route>
    </Routes>
  </Router>
);