import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CotizadorSolar from './CotizadorSolar'; 
import Resultado from './Resultado'; 

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <Router>
    <Routes>
      <Route path="/" element={<CotizadorSolar />} />
      <Route path="/resultado" element={<Resultado />} />
    </Routes>
  </Router>
);
