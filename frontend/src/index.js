import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import DashboardResumen from "./DashboardResumen";
import Cliente from "./CotizadorSolar";
import Resultado from "./Resultado";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <Router>
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<DashboardResumen />} />
        <Route path="cliente" element={<Cliente />} />
        <Route path="resultado" element={<Resultado />} />
      </Route>
    </Routes>
  </Router>
);