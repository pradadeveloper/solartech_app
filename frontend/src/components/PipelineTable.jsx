import React, { useMemo, useState } from "react";

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const statusBadgeClass = (status) => {
  switch (status) {
    case "Nuevo":          return "badge badge--new";
    case "Cotizado":       return "badge badge--quoted";
    case "En negociación": return "badge badge--negotiation";
    case "Cerrado":        return "badge badge--closed";
    case "Perdido":        return "badge badge--lost";
    default:               return "badge";
  }
};

export default function PipelineTable({
  title = "Pipeline (CRM) — Clientes cotizados y estado",
  rows = [],
  onView,
  onVerTodos,
}) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [ciudad, setCiudad] = useState("Todas");
  const [kwhMin, setKwhMin] = useState("");
  const [kwhMax, setKwhMax] = useState("");
  const [sortBy, setSortBy] = useState("reciente");

  const estadosDisponibles = useMemo(() => {
    const s = new Set(rows.map((r) => r.estado).filter(Boolean));
    return ["Todos", ...Array.from(s)];
  }, [rows]);

  const ciudadesDisponibles = useMemo(() => {
    const s = new Set(rows.map((r) => r.ciudad).filter(Boolean));
    return ["Todas", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const min = kwhMin === "" ? null : Number(kwhMin);
    const max = kwhMax === "" ? null : Number(kwhMax);

    let list = rows.filter((r) => {
      const matchQ =
        !term ||
        String(r.cliente ?? "").toLowerCase().includes(term) ||
        String(r.ciudad ?? "").toLowerCase().includes(term) ||
        String(r.id ?? "").toLowerCase().includes(term);
      const matchEstado = estado === "Todos" || r.estado === estado;
      const matchCiudad = ciudad === "Todas" || r.ciudad === ciudad;
      const kwh = Number(r.kwh ?? 0);
      const matchMin = min == null || kwh >= min;
      const matchMax = max == null || kwh <= max;
      return matchQ && matchEstado && matchCiudad && matchMin && matchMax;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "valor")   return Number(b.valorCOP ?? 0) - Number(a.valorCOP ?? 0);
      if (sortBy === "kwh")     return Number(b.kwh ?? 0) - Number(a.kwh ?? 0);
      if (sortBy === "cliente") return String(a.cliente ?? "").localeCompare(String(b.cliente ?? ""));
      return String(b.id ?? "").localeCompare(String(a.id ?? "")); // reciente desc
    });

    return list;
  }, [rows, q, estado, ciudad, kwhMin, kwhMax, sortBy]);

  const onReset = () => {
    setQ("");
    setEstado("Todos");
    setCiudad("Todas");
    setKwhMin("");
    setKwhMax("");
    setSortBy("reciente");
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>{title}</h2>
        <div className="panelActions" style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--ghost" type="button" onClick={onReset}>
            Limpiar filtros
          </button>
          {onVerTodos && (
            <button
              className="btn btn--primary"
              type="button"
              onClick={onVerTodos}
            >
              Ver todos →
            </button>
          )}
        </div>
      </div>

      <div className="panel__body">
        {/* Filtros */}
        <div className="filters pipelineFilters">
          <div className="field">
            <label>Buscar</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cliente, ciudad o ID…"
            />
          </div>

          <div className="field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {estadosDisponibles.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ciudad</label>
            <select value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
              {ciudadesDisponibles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>kWh mín</label>
            <input
              type="number"
              value={kwhMin}
              onChange={(e) => setKwhMin(e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>

          <div className="field">
            <label>kWh máx</label>
            <input
              type="number"
              value={kwhMax}
              onChange={(e) => setKwhMax(e.target.value)}
              placeholder="2000"
              min="0"
            />
          </div>

          <div className="field">
            <label>Ordenar por</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="reciente">Más reciente</option>
              <option value="valor">Mayor valor</option>
              <option value="kwh">Mayor kWh</option>
              <option value="cliente">Cliente A–Z</option>
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ciudad</th>
                <th>kWh</th>
                <th>Sistema</th>
                <th>Valor</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyCell">
                    No hay resultados con esos filtros.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.cliente}</td>
                    <td>{r.ciudad}</td>
                    <td className="num">{r.kwh}</td>
                    <td className="num">{r.sistema}</td>
                    <td className="num">{formatCOP(r.valorCOP)}</td>
                    <td>
                      <span className={statusBadgeClass(r.estado)}>{r.estado}</span>
                    </td>
                    <td className="actions">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn--tiny"
                          type="button"
                          onClick={() => onView?.(r)}
                        >
                          Ver
                        </button>
                        {r.pdfUrl && (
                          <a
                            href={`${process.env.REACT_APP_API_URL}${r.pdfUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn--tiny btn--primary"
                            style={{ textDecoration: "none", fontWeight: 700 }}
                          >
                            ↓ PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12, color: "var(--muted)" }}>
          Mostrando {filteredRows.length} de {rows.length}
        </div>
      </div>
    </div>
  );
}
