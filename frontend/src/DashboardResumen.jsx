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

const PIPELINE_STAGES = [
  { key: "Nuevo",          color: "#3498db", icon: "✦" },
  { key: "En negociación", color: "#f39c12", icon: "◈" },
  { key: "Cotizado",       color: "#9b59b6", icon: "◉" },
  { key: "Enviado",        color: "#1abc9c", icon: "▶" },
  { key: "Cerrado",        color: "#2ecc71", icon: "✔" },
  { key: "Perdido",        color: "#e74c3c", icon: "✖" },
];

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
    const token = localStorage.getItem('token');
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const ahora = new Date();
    const hace30 = new Date(ahora); hace30.setDate(ahora.getDate() - 30);
    const isUltimos30 = (fecha) => { const d = new Date(fecha); return d >= hace30 && d <= ahora; };

    const leadsHoy = leads.filter((l) => isSameDay(new Date(l.fecha), ahora)).length;
    const leadsMes = leads.filter((l) => isUltimos30(l.fecha)).length;
    const cotizacionesMes = leads.filter((l) => isUltimos30(l.fecha) && l.kwp).length;
    const cerrados = leads.filter((l) => l.estado === "Cerrado").length;
    const tasaCierre = leads.length > 0
      ? Number((cerrados / leads.length * 100).toFixed(1))
      : 0;
    const totalValor = leads.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0);
    const ticketPromedio = leads.length > 0 ? Math.round(totalValor / leads.length) : 0;
    const kwpProyectadosMes = leads
      .filter((l) => isUltimos30(l.fecha))
      .reduce((s, l) => s + (l.kwp || 0), 0);

    const valorCotizadoMes = leads
      .filter((l) => isUltimos30(l.fecha))
      .reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0);

    // Principal fuente de leads (campo conociste)
    const fuenteMap = {};
    leads.forEach(l => {
      const f = l.conociste || "";
      if (f) fuenteMap[f] = (fuenteMap[f] || 0) + 1;
    });
    const topFuenteEntry = Object.entries(fuenteMap).sort((a, b) => b[1] - a[1])[0];
    const topFuente      = topFuenteEntry ? topFuenteEntry[0] : "—";
    const topFuenteCount = topFuenteEntry ? topFuenteEntry[1] : 0;

    return { leadsHoy, leadsMes, cotizacionesMes, tasaCierre, ticketPromedio, kwpProyectadosMes, valorCotizadoMes, topFuente, topFuenteCount };
  }, [leads]);

  const leadsPorDia = useMemo(() => buildLeadsPorDia(leads, 14), [leads]);
  const fuentes = useMemo(() => buildFuentes(leads), [leads]);

  const pipelineData = useMemo(() =>
    PIPELINE_STAGES.map(({ key, color, icon }) => {
      const items = leads.filter(l => (l.estado || "Nuevo") === key);
      return {
        estado: key, color, icon,
        count: items.length,
        valor: items.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0),
      };
    }),
  [leads]);

  const pipelineRows = useMemo(() =>
    [...leads]
      .sort((a, b) => (b.costoProyectoMasIva || 0) - (a.costoProyectoMasIva || 0))
      .slice(0, 5)
      .map((l) => ({
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
      {/* ── PIPELINE FULL WIDTH — primero ── */}
      <Panel title="Pipeline de Leads">
        {loading ? (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Cargando…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "stretch", gap: 0, minWidth: 520 }}>
              {/* Etapas principales (sin Perdido) */}
              {pipelineData.slice(0, 5).map((stage, i) => {
                const total = leads.length - (pipelineData[5]?.count || 0);
                const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
                return (
                  <React.Fragment key={stage.estado}>
                    <div style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "14px 8px 12px",
                      borderTop: `3px solid ${stage.color}`,
                      background: `linear-gradient(180deg, ${stage.color}14 0%, transparent 100%)`,
                      borderRadius: i === 0 ? "10px 0 0 10px" : i === 4 ? "0 10px 10px 0" : 0,
                      borderRight: i < 4 ? "1px solid var(--border)" : "none",
                      position: "relative",
                      minWidth: 80,
                    }}>
                      {i < 4 && (
                        <div style={{
                          position: "absolute",
                          right: -13,
                          top: "50%",
                          transform: "translateY(-50%)",
                          zIndex: 2,
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--panel)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "var(--muted)",
                          fontWeight: 700,
                        }}>›</div>
                      )}
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: stage.color, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>
                        {stage.estado}
                      </span>
                      <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
                        {stage.count}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2, marginBottom: 8 }}>
                        lead{stage.count !== 1 ? "s" : ""}
                      </span>
                      <div style={{ width: "80%", height: 4, borderRadius: 4, background: "var(--border)", marginBottom: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: stage.color, borderRadius: 4, transition: "width .5s" }} />
                      </div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", opacity: 0.8, textAlign: "center" }}>
                        {stage.valor > 0 ? formatCOP(stage.valor) : "—"}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Separador + Perdido */}
              <div style={{ display: "flex", alignItems: "stretch", marginLeft: 10 }}>
                <div style={{ width: 2, background: "var(--border)", borderRadius: 2, margin: "8px 0" }} />
                {(() => {
                  const stage = pipelineData[5];
                  if (!stage) return null;
                  return (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "14px 14px 12px",
                      borderTop: `3px solid ${stage.color}`,
                      background: `linear-gradient(180deg, ${stage.color}14 0%, transparent 100%)`,
                      borderRadius: "0 10px 10px 0",
                      minWidth: 90,
                      marginLeft: 10,
                    }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: stage.color, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                        {stage.estado}
                      </span>
                      <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
                        {stage.count}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2, marginBottom: 8 }}>
                        lead{stage.count !== 1 ? "s" : ""}
                      </span>
                      <div style={{ width: "80%", height: 4, borderRadius: 4, background: "var(--border)", marginBottom: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: leads.length > 0 ? `${Math.round((stage.count / leads.length) * 100)}%` : "0%", background: stage.color, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", opacity: 0.8 }}>
                        {stage.valor > 0 ? formatCOP(stage.valor) : "—"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid kpiGrid">
        <KpiCard
          title="Valor cotizado mes"
          value={loading ? "—" : formatCOP(kpis.valorCotizadoMes)}
          hint="Últimos 30 días"
          highlight
          hero
        />
        <KpiCard title="Leads hoy" value={loading ? "—" : kpis.leadsHoy} hint="Últimas 24h" />
        <KpiCard title="Leads" value={loading ? "—" : kpis.leadsMes} hint="Últimos 30 días" />
        <KpiCard title="Cotizaciones" value={loading ? "—" : kpis.cotizacionesMes} hint="Últimos 30 días" />
        <KpiCard title="Tasa de cierre" value={loading ? "—" : `${kpis.tasaCierre}%`} hint="Sobre total leads" />
        <KpiCard title="Ticket promedio" value={loading ? "—" : formatCOP(kpis.ticketPromedio)} hint="COP" />
        <KpiCard title="kWp proyectados" value={loading ? "—" : Number(kpis.kwpProyectadosMes.toFixed(1))} hint="Últimos 30 días" />
        <KpiCard title="Principal fuente" value={loading ? "—" : kpis.topFuente} hint={loading ? "" : `${kpis.topFuenteCount} lead${kpis.topFuenteCount !== 1 ? "s" : ""}`} />
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
