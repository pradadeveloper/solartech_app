import React, { useEffect, useState } from "react";
import KpiCard from "./components/KpiCard";
import Panel from "./components/Panel";
import PipelineTable from "./components/PipelineTable";

const mockKPIs = {
  leadsHoy: 12,
  leadsMes: 328,
  cotizacionesMes: 96,
  tasaCierre: 18.4,
  ticketPromedio: 14500000,
  kwpProyectadosMes: 214.6,
};

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const mockPipeline = [
  { id: "LD-1001", cliente: "María Gómez", ciudad: "Medellín", kwh: 450, sistema: "3.3 kWp", valorCOP: 14500000, estado: "Nuevo" },
  { id: "LD-1002", cliente: "Carlos Pérez", ciudad: "Bogotá", kwh: 820, sistema: "6.0 kWp", valorCOP: 26500000, estado: "En negociación" },
  { id: "LD-1003", cliente: "Laura Sánchez", ciudad: "Cali", kwh: 610, sistema: "4.5 kWp", valorCOP: 19800000, estado: "Cotizado" },
  { id: "LD-1004", cliente: "Andrés Rojas", ciudad: "Barranquilla", kwh: 1200, sistema: "8.5 kWp", valorCOP: 36500000, estado: "Cerrado" },
];

export default function DashboardResumen() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setKpis(mockKPIs);
      setLoading(false);
    }, 200);
  }, []);

  return (
    <>
      <div className="grid kpiGrid">
        <KpiCard title="Leads hoy" value={loading || !kpis ? "—" : kpis.leadsHoy} hint="Últimas 24h" />
        <KpiCard title="Leads del mes" value={loading || !kpis ? "—" : kpis.leadsMes} hint="Mes actual" />
        <KpiCard title="Cotizaciones" value={loading || !kpis ? "—" : kpis.cotizacionesMes} hint="Mes actual" />
        <KpiCard title="Tasa de cierre" value={loading || !kpis ? "—" : `${kpis.tasaCierre}%`} hint="Promedio" />
        <KpiCard title="Ticket promedio" value={loading || !kpis ? "—" : formatCOP(kpis.ticketPromedio)} hint="COP" />
        <KpiCard title="kWp proyectados" value={loading || !kpis ? "—" : kpis.kwpProyectadosMes} hint="Mes actual" />
      </div>

      <div className="grid chartsGrid">
        <Panel title="Leads por día (placeholder)">
          <div className="placeholderChart" />
        </Panel>
        <Panel title="Fuentes de lead (placeholder)">
          <div className="placeholderChart" />
        </Panel>
      </div>
      <PipelineTable rows={mockPipeline} onView={(row) => console.log("Ver lead:", row)}/>
    </>
  );
}