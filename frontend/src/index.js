import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Cliente from './CotizadorSolar'; 
import Resultado from './Resultado'; 
import DashboardAdmon from './dashboardAdmon';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <Router>
    <Routes>
      <Route path="/" element={<DashboardAdmon/>} />
      <Route path="/resultado" element={<Resultado />} />
      <Route path="/cliente" element={< Cliente/>} />
    </Routes>
  </Router>
);
