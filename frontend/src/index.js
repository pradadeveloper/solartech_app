import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CotizadorSolar from './CotizadorSolar';
import Resultado from './Resultado';
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
      <Route path="/" element={<RutaProtegida><CotizadorSolar /></RutaProtegida>} />
      <Route path="/resultado" element={<RutaProtegida><Resultado /></RutaProtegida>} />
    </Routes>
  </Router>
);