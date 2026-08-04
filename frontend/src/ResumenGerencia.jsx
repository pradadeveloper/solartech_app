import { useEffect, useState, useMemo } from "react";
import "./dashboardAdmon.css";
import "./gerencia.css";

/* Resumen gerencial de la gestión de los asesores. Solo Admin. Imprimible. */

const CERRADO = "Cerrado";
const PERDIDO = "Perdido";
const ABIERTOS = ["Nuevo", "En negociación", "Cotizado", "Enviado"]; // pipeline vivo

const money = (v) => `$${Math.round(Number(v) || 0).toLocaleString("es-CO")}`;
const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

export default function ResumenGerencia() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setLeads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const { filas, totales } = useMemo(() => {
    const porAsesor = {};
    for (const l of leads) {
      const asesor = l.vendedor || "Sin asignar";
      if (!porAsesor[asesor]) {
        porAsesor[asesor] = {
          asesor, total: 0, abiertos: 0, cerrados: 0, perdidos: 0,
          valorPipeline: 0, valorCerrado: 0, ultimaGestion: null,
        };
      }
      const a = porAsesor[asesor];
      const estado = l.estado || "Nuevo";
      const valor = Number(l.costoProyectoMasIva) || 0;
      a.total += 1;
      if (estado === CERRADO) { a.cerrados += 1; a.valorCerrado += valor; }
      else if (estado === PERDIDO) { a.perdidos += 1; }
      else { a.abiertos += 1; a.valorPipeline += valor; }

      // Última gestión: máxima fecha entre actividades e historial de estados.
      const fechas = [
        ...(Array.isArray(l.actividades) ? l.actividades.map((x) => x.fecha) : []),
        ...(Array.isArray(l.historialEstados) ? l.historialEstados.map((x) => x.fecha) : []),
      ].filter(Boolean);
      for (const f of fechas) {
        if (!a.ultimaGestion || new Date(f) > new Date(a.ultimaGestion)) a.ultimaGestion = f;
      }
    }
    const filas = Object.values(porAsesor).sort((a, b) => b.valorCerrado - a.valorCerrado);
    const totales = filas.reduce(
      (t, a) => ({
        total: t.total + a.total, abiertos: t.abiertos + a.abiertos,
        cerrados: t.cerrados + a.cerrados, perdidos: t.perdidos + a.perdidos,
        valorPipeline: t.valorPipeline + a.valorPipeline, valorCerrado: t.valorCerrado + a.valorCerrado,
      }),
      { total: 0, abiertos: 0, cerrados: 0, perdidos: 0, valorPipeline: 0, valorCerrado: 0 }
    );
    return { filas, totales };
  }, [leads]);

  const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const diasSin = (f) => {
    if (!f) return null;
    return Math.floor((Date.now() - new Date(f).getTime()) / 86400000);
  };

  if (loading) return <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 60 }}>Cargando resumen…</p>;

  return (
    <div className="ger">
      {/* Encabezado — visible en pantalla y en impresión */}
      <div className="ger-head">
        <div>
          <h2 className="ger-title">Resumen Gerencia</h2>
          <p className="ger-sub">Gestión comercial del equipo de energía solar · {hoy}</p>
        </div>
        <button className="btn btn--primary ger-print" onClick={() => window.print()}>🖨 Imprimir</button>
      </div>

      {/* KPIs globales */}
      <div className="ger-kpis">
        <Kpi label="Leads totales" value={totales.total} />
        <Kpi label="En pipeline" value={totales.abiertos} sub={money(totales.valorPipeline)} />
        <Kpi label="Cerrados" value={totales.cerrados} sub={money(totales.valorCerrado)} good />
        <Kpi label="Perdidos" value={totales.perdidos} bad />
        <Kpi label="Conversión" value={pct(totales.cerrados, totales.total)} />
      </div>

      {/* Tabla por asesor */}
      <div className="ger-tablewrap">
        <table className="ger-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Asesor</th>
              <th>Leads</th>
              <th>Pipeline</th>
              <th>Cerrados</th>
              <th>Perdidos</th>
              <th>Conversión</th>
              <th>Valor pipeline</th>
              <th>Valor cerrado</th>
              <th>Última gestión</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => {
              const d = diasSin(a.ultimaGestion);
              return (
                <tr key={a.asesor}>
                  <td style={{ textAlign: "left", fontWeight: 700 }}>{a.asesor}</td>
                  <td>{a.total}</td>
                  <td>{a.abiertos}</td>
                  <td className="ger-good">{a.cerrados}</td>
                  <td className="ger-bad">{a.perdidos}</td>
                  <td><b>{pct(a.cerrados, a.total)}</b></td>
                  <td>{money(a.valorPipeline)}</td>
                  <td className="ger-good">{money(a.valorCerrado)}</td>
                  <td className={d != null && d > 14 ? "ger-bad" : ""}>
                    {a.ultimaGestion ? `hace ${d} día${d === 1 ? "" : "s"}` : "sin gestión"}
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)" }}>Sin datos.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ textAlign: "left" }}>TOTAL</td>
              <td>{totales.total}</td>
              <td>{totales.abiertos}</td>
              <td>{totales.cerrados}</td>
              <td>{totales.perdidos}</td>
              <td>{pct(totales.cerrados, totales.total)}</td>
              <td>{money(totales.valorPipeline)}</td>
              <td>{money(totales.valorCerrado)}</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="ger-foot">
        Pipeline = leads en {ABIERTOS.join(", ")}. Conversión = cerrados / leads totales.
        Reporte generado el {hoy} desde el CRM de Solartech Energy.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, good, bad }) {
  return (
    <div className={`ger-kpi${good ? " ger-kpi--good" : ""}${bad ? " ger-kpi--bad" : ""}`}>
      <div className="ger-kpi__value">{value}</div>
      <div className="ger-kpi__label">{label}</div>
      {sub && <div className="ger-kpi__sub">{sub}</div>}
    </div>
  );
}
