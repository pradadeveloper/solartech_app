import React, { useMemo, useState } from "react";

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const statusBadgeClass = (status) => {
  switch (status) {
    case "Nuevo":
      return "badge badge--new";
    case "Cotizado":
      return "badge badge--quoted";
    case "En negociación":
      return "badge badge--negotiation";
    case "Cerrado":
      return "badge badge--closed";
    case "Perdido":
      return "badge badge--lost";
    default:
      return "badge";
  }
};

export default function PipelineTable({
  title = "Pipeline (CRM) — Clientes cotizados y estado",
  rows = [],
  onView,
}) {
  // ✅ filtros
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [ciudad, setCiudad] = useState("Todas");
  const [kwhMin, setKwhMin] = useState("");
  const [kwhMax, setKwhMax] = useState("");
  const [sortBy, setSortBy] = useState("reciente"); // mock
  const [sortDir, setSortDir] = useState("desc");

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

      const matchEstado = estado === "Todos" ? true : r.estado === estado;
      const matchCiudad = ciudad === "Todas" ? true : r.ciudad === ciudad;

      const kwh = Number(r.kwh ?? 0);
      const matchMin = min == null ? true : kwh >= min;
      const matchMax = max == null ? true : kwh <= max;

      return matchQ && matchEstado && matchCiudad && matchMin && matchMax;
    });

    // ✅ orden
    const dir = sortDir === "asc" ? 1 : -1;

    list = [...list].sort((a, b) => {
      if (sortBy === "valor") return (Number(a.valorCOP ?? 0) - Number(b.valorCOP ?? 0)) * dir;
      if (sortBy === "kwh") return (Number(a.kwh ?? 0) - Number(b.kwh ?? 0)) * dir;
      if (sortBy === "cliente") return String(a.cliente ?? "").localeCompare(String(b.cliente ?? "")) * dir;
      // "reciente" sin fecha real: usa id como fallback
      return String(a.id ?? "").localeCompare(String(b.id ?? "")) * dir;
    });

    return list;
  }, [rows, q, estado, ciudad, kwhMin, kwhMax, sortBy, sortDir]);

  const onReset = () => {
    setQ("");
    setEstado("Todos");
    setCiudad("Todas");
    setKwhMin("");
    setKwhMax("");
    setSortBy("reciente");
    setSortDir("desc");
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>{title}</h2>

        <div className="panelActions">
          <button className="btn btn--ghost" type="button" onClick={onReset}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="panel__body">
        {/* ✅ Filtros */}
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
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ciudad</label>
            <select value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
              {ciudadesDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
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
            <label>Ordenar</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="reciente">Reciente</option>
              <option value="valor">Valor</option>
              <option value="kwh">kWh</option>
              <option value="cliente">Cliente</option>
            </select>
          </div>

          <div className="field">
            <label>Dirección</label>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        {/* ✅ Tabla */}
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
                      <button
                        className="btn btn--tiny"
                        type="button"
                        onClick={() => onView?.(r)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
          Mostrando {filteredRows.length} de {rows.length}
        </div>
      </div>
    </div>
  );
}