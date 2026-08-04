import { useEffect, useState, useMemo } from "react";
import "./dashboardAdmon.css";
import "./gerencia.css";

/* Forecast de equipos: proyectos Cerrados → equipos a comprar por mes de entrega.
   Mes = fecha de cierre + lead time (por defecto 120 días, editable). Solo Admin. */

// Líneas de producto a proyectar. `campo` se busca 1º en la opción seleccionada, 2º en el lead.
const LINEAS = [
  { key: "paneles",   label: "Paneles",        campos: ["cantidadPaneles", "npaneles"],   unidad: "und" },
  { key: "inversores",label: "Inversores",     campos: ["cantidadInversores", "ninversores"], unidad: "und" },
  { key: "riel47",    label: "Riel 4.7 m",     campos: ["riel47"],       unidad: "und" },
  { key: "midCland",  label: "Mid Clamp",      campos: ["midCland"],     unidad: "und" },
  { key: "endCland",  label: "End Clamp",      campos: ["endCland"],     unidad: "und" },
  { key: "lFoot",     label: "L-Foot",         campos: ["lFoot"],        unidad: "und" },
  { key: "groundingLoop", label: "Grounding Loop", campos: ["groundingLoop"], unidad: "und" },
  { key: "cableSolar",label: "Cable solar",    campos: ["cableSolar"],   unidad: "m" },
];

const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const num = (v) => Number(v) || 0;

export default function ForecastEquipos() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadTime, setLeadTime] = useState(120); // días entre cierre y entrega

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setLeads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const cerrados = useMemo(() => leads.filter((l) => (l.estado || "") === "Cerrado"), [leads]);

  // Cantidad de una línea: primero en la opción seleccionada, luego en el lead.
  const cantidad = (lead, campos) => {
    const op = lead.opciones?.find((o) => o.seleccionada) || lead.opciones?.[0] || null;
    for (const c of campos) {
      if (op && op[c] != null) return num(op[c]);
      if (lead[c] != null) return num(lead[c]);
    }
    return 0;
  };

  const { meses, total, proyectosSinCantidades } = useMemo(() => {
    const buckets = {};   // 'YYYY-MM' -> { key, label, proyectos, lineas{} }
    const total = {};
    let proyectosSinCantidades = 0;

    for (const lead of cerrados) {
      const base = lead.fechaCierre || lead.fecha;
      const fEntrega = new Date(base);
      if (isNaN(fEntrega.getTime())) continue;
      fEntrega.setDate(fEntrega.getDate() + Number(leadTime || 0));

      const y = fEntrega.getFullYear();
      const m = fEntrega.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (!buckets[key]) buckets[key] = { key, label: `${MESES_ES[m]} ${y}`, proyectos: 0, lineas: {} };
      buckets[key].proyectos += 1;

      let tieneCantidades = false;
      for (const linea of LINEAS) {
        const q = cantidad(lead, linea.campos);
        if (q > 0) tieneCantidades = true;
        buckets[key].lineas[linea.key] = (buckets[key].lineas[linea.key] || 0) + q;
        total[linea.key] = (total[linea.key] || 0) + q;
      }
      if (!tieneCantidades) proyectosSinCantidades += 1;
    }

    const meses = Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
    return { meses, total, proyectosSinCantidades };
  }, [cerrados, leadTime]);

  const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  // Exporta el forecast a CSV (Excel lo abre con doble click).
  const exportarCSV = () => {
    const encabezados = ["Mes de entrega", "Proyectos", ...LINEAS.map((l) => `${l.label} (${l.unidad})`)];
    const filas = meses.map((mes) => [
      `"${mes.label}"`,
      mes.proyectos,
      ...LINEAS.map((l) => mes.lineas[l.key] || 0),
    ]);
    const filaTotal = ["TOTAL", cerrados.length, ...LINEAS.map((l) => total[l.key] || 0)];
    const csv = [encabezados, ...filas, filaTotal].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast_equipos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 60 }}>Cargando forecast…</p>;

  return (
    <div className="ger">
      <div className="ger-head">
        <div>
          <h2 className="ger-title">Forecast de Equipos</h2>
          <p className="ger-sub">
            Equipos a adquirir según proyectos cerrados · {cerrados.length} proyecto{cerrados.length === 1 ? "" : "s"} · {hoy}
          </p>
        </div>
        <div className="ger-head__actions">
          <button className="btn btn--ghost ger-print" onClick={exportarCSV} disabled={cerrados.length === 0}>
            ↓ Exportar a Excel
          </button>
          <button className="btn btn--primary ger-print" onClick={() => window.print()}>🖨 Imprimir</button>
        </div>
      </div>

      {/* Control de lead time */}
      <div className="fc-control">
        <label>Tiempo de entrega desde el cierre:</label>
        <input
          type="number" min="0" step="15" value={leadTime}
          onChange={(e) => setLeadTime(e.target.value)}
        />
        <span>días (~{(num(leadTime) / 30).toFixed(1)} meses) · define en qué mes cae cada compra</span>
      </div>

      {cerrados.length === 0 ? (
        <div className="ger-tablewrap" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Aún no hay proyectos en estado <b>Cerrado</b>. El forecast se llena a medida que se cierran ventas.
        </div>
      ) : (
        <>
          <div className="ger-tablewrap">
            <table className="ger-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Mes de entrega</th>
                  <th>Proyectos</th>
                  {LINEAS.map((l) => <th key={l.key}>{l.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {meses.map((mes) => (
                  <tr key={mes.key}>
                    <td className="fc-month" style={{ textAlign: "left" }}>{mes.label}</td>
                    <td>{mes.proyectos}</td>
                    {LINEAS.map((l) => (
                      <td key={l.key}>{(mes.lineas[l.key] || 0).toLocaleString("es-CO")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ textAlign: "left" }}>TOTAL</td>
                  <td>{cerrados.length}</td>
                  {LINEAS.map((l) => (
                    <td key={l.key}>{(total[l.key] || 0).toLocaleString("es-CO")}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="ger-foot">
            El mes de entrega = fecha de cierre + {leadTime} días. Las cantidades de estructura (rieles, clamps,
            L-Foot, grounding) se toman de la opción seleccionada de cada proyecto.
            {proyectosSinCantidades > 0 && (
              <> <b>{proyectosSinCantidades}</b> proyecto{proyectosSinCantidades === 1 ? "" : "s"} cerrado
              {proyectosSinCantidades === 1 ? "" : "s"} sin cantidades de equipos guardadas (no suman al total).</>
            )}
          </p>
        </>
      )}
    </div>
  );
}
