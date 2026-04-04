import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import KpiCard from "./components/KpiCard";
import Panel from "./components/Panel";
import PipelineTable from "./components/PipelineTable";

const ACCENT = "#B03A22";
const PIE_COLORS = ["#B03A22", "#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#1abc9c", "#f39c12"];

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

function isSameDay(date, ref) {
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  );
}

function isSameMonth(date, ref) {
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth()
  );
}

// Últimos N días: devuelve array [{ dia: "Lun 31", leads: 0 }, ...]
function buildLeadsPorDia(leads, dias = 14) {
  const hoy = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const ref = new Date(hoy);
    ref.setDate(hoy.getDate() - (dias - 1 - i));
    const count = leads.filter((l) => isSameDay(new Date(l.fecha), ref)).length;
    const label = ref.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
    return { dia: label, leads: count };
  });
}

// Distribución por tipoSolicitud
function buildFuentes(leads) {
  const map = {};
  leads.forEach((l) => {
    const key = l.tipoSolicitud || "Sin especificar";
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const TooltipLeads = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem" }}>
      <p style={{ margin: 0, color: "var(--muted)" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontWeight: 700, color: ACCENT }}>{payload[0].value} lead{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
};

const TooltipFuente = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem" }}>
      <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>{name}</p>
      <p style={{ margin: "2px 0 0", color: ACCENT }}>{value} lead{value !== 1 ? "s" : ""}</p>
    </div>
  );
};

export default function DashboardResumen() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`)
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const ahora = new Date();
    const leadsHoy = leads.filter((l) => isSameDay(new Date(l.fecha), ahora)).length;
    const leadsMes = leads.filter((l) => isSameMonth(new Date(l.fecha), ahora)).length;
    const cotizacionesMes = leads.filter((l) => {
      const d = new Date(l.fecha);
      return isSameMonth(d, ahora) && l.kwp;
    }).length;
    const cerrados = leads.filter((l) => l.estado === "Cerrado").length;
    const tasaCierre = leads.length > 0
      ? Number((cerrados / leads.length * 100).toFixed(1))
      : 0;
    const totalValor = leads.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0);
    const ticketPromedio = leads.length > 0 ? Math.round(totalValor / leads.length) : 0;
    const kwpProyectadosMes = leads
      .filter((l) => isSameMonth(new Date(l.fecha), ahora))
      .reduce((s, l) => s + (l.kwp || 0), 0);

    const valorCotizadoMes = leads
      .filter((l) => isSameMonth(new Date(l.fecha), ahora))
      .reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0);

    return { leadsHoy, leadsMes, cotizacionesMes, tasaCierre, ticketPromedio, kwpProyectadosMes, valorCotizadoMes };
  }, [leads]);

  const leadsPorDia = useMemo(() => buildLeadsPorDia(leads, 14), [leads]);
  const fuentes = useMemo(() => buildFuentes(leads), [leads]);

  // Últimos 5 leads para el resumen del dashboard
  const pipelineRows = useMemo(() =>
    [...leads].reverse().slice(0, 5).map((l) => ({
      id: `N-${l.numeroCotizacion}`,
      cliente: l.nombre,
      ciudad: l.ubicacion,
      kwh: l.consumoKwh,
      sistema: l.kwp ? `${l.kwp} kWp` : "—",
      valorCOP: l.costoProyectoMasIva || 0,
      estado: l.estado || "Nuevo",
      pdfUrl: l.pdfUrl || null,
      _lead: l,
    })),
  [leads]);

  return (
    <>
      <div className="grid kpiGrid">
        <KpiCard title="Leads hoy" value={loading ? "—" : kpis.leadsHoy} hint="Últimas 24h" />
        <KpiCard title="Leads del mes" value={loading ? "—" : kpis.leadsMes} hint="Mes actual" />
        <KpiCard title="Cotizaciones" value={loading ? "—" : kpis.cotizacionesMes} hint="Mes actual" />
        <KpiCard title="Tasa de cierre" value={loading ? "—" : `${kpis.tasaCierre}%`} hint="Sobre total leads" />
        <KpiCard title="Ticket promedio" value={loading ? "—" : formatCOP(kpis.ticketPromedio)} hint="COP" />
        <KpiCard title="kWp proyectados" value={loading ? "—" : Number(kpis.kwpProyectadosMes.toFixed(1))} hint="Mes actual" />
        <KpiCard
          title="Valor cotizado mes"
          value={loading ? "—" : formatCOP(kpis.valorCotizadoMes)}
          hint="Suma proyectos del mes"
          highlight
        />
      </div>

      <div className="grid chartsGrid">
        {/* Gráfico 1: Leads por día (últimos 14 días) */}
        <Panel title="Leads por día — últimos 14 días">
          {loading ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Cargando…</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TooltipLeads />} cursor={{ fill: "rgba(245,197,24,.08)" }} />
                <Bar dataKey="leads" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Gráfico 2: Distribución por tipo de solicitud */}
        <Panel title="Tipos de solicitud">
          {loading ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Cargando…</p>
          ) : fuentes.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Sin datos aún.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={fuentes}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {fuentes.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipFuente />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <PipelineTable
        title="Últimos leads — Pipeline"
        rows={pipelineRows}
        onView={(row) => navigate("/resultado", { state: { resultado: row._lead } })}
        onVerTodos={() => navigate("/leads")}
      />
    </>
  );
}
