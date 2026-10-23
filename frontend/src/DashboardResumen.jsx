import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Pregunta de la pantalla: ¿cuánto hay en juego en el embudo y qué hay que mover hoy?
// El cobre (--accent) marca solo el dato principal: los leads por día y lo cerrado.

const ETAPAS = ["Nuevo", "En negociación", "Cotizado", "Enviado", "Cerrado"];
const ABIERTOS = ["Nuevo", "En negociación", "Cotizado", "Enviado"];
const CLASE_ESTADO = {
  "Nuevo": "estado",
  "En negociación": "estado estado--progreso",
  "Cotizado": "estado estado--progreso",
  "Enviado": "estado estado--progreso",
  "Cerrado": "estado estado--positivo",
  "Perdido": "estado estado--negativo",
};

const cop = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
const millones = (v) => {
  if (!v) return "$0";
  return v >= 1e9
    ? `$${(v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 2 })} mil M`
    : `$${(v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
};
const kwp = (v) => (v ? `${Number(v).toLocaleString("es-CO", { maximumFractionDigits: 1 })} kWp` : "—");
const plural = (n, uno, varios) => `${n.toLocaleString("es-CO")} ${n === 1 ? uno : varios}`;

const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function leadsPorDia(leads, dias = 14) {
  const hoy = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const ref = new Date(hoy);
    ref.setDate(hoy.getDate() - (dias - 1 - i));
    return {
      dia: ref.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", ""),
      leads: leads.filter((l) => mismoDia(new Date(l.fecha), ref)).length,
    };
  });
}

const TooltipDia = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="grafica-tip">
      {label}: <strong>{plural(payload[0].value, "lead", "leads")}</strong>
    </div>
  );
};

export default function DashboardResumen() {
  const [leads, setLeads] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error
  const navigate = useNavigate();

  const cargar = () => {
    setEstado("cargando");
    const token = localStorage.getItem("token");
    fetch(`${process.env.REACT_APP_API_URL}/api/leads`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (r.status === 401) { navigate("/login", { replace: true }); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => { if (data) { setLeads(Array.isArray(data) ? data : []); setEstado("listo"); } })
      .catch(() => setEstado("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, []);

  // Las versiones (83_2) son copias de una cotización: no cuentan como leads nuevos.
  const base = useMemo(() => leads.filter((l) => !String(l.numeroCotizacion).includes("_")), [leads]);

  const datos = useMemo(() => {
    const ahora = new Date();
    const hace30 = new Date(ahora); hace30.setDate(ahora.getDate() - 30);
    const mes = base.filter((l) => new Date(l.fecha) >= hace30);
    const cerrados = base.filter((l) => l.estado === "Cerrado");
    const conValor = base.filter((l) => l.costoProyectoMasIva > 0);
    const valorMes = mes.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0);
    const sinAsesor = base.filter((l) => (l.estado || "Nuevo") === "Nuevo" && (!l.vendedor || l.vendedor === "Sin asignar"));

    const etapas = ETAPAS.map((e) => {
      const items = base.filter((l) => (l.estado || "Nuevo") === e);
      return { estado: e, cuenta: items.length, valor: items.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0) };
    });
    const perdidos = base.filter((l) => l.estado === "Perdido");
    const maxEtapa = Math.max(1, ...etapas.map((e) => e.cuenta), perdidos.length);

    const canales = Object.entries(
      base.reduce((m, l) => { const k = l.conociste || "Sin dato"; m[k] = (m[k] || 0) + 1; return m; }, {})
    ).map(([nombre, cuenta]) => ({ nombre, cuenta })).sort((a, b) => b.cuenta - a.cuenta).slice(0, 5);

    const abiertos = base
      .filter((l) => ABIERTOS.includes(l.estado || "Nuevo"))
      .sort((a, b) => (b.costoProyectoMasIva || 0) - (a.costoProyectoMasIva || 0));

    return {
      valorMes,
      cotizadosMes: mes.filter((l) => l.kwp).length,
      leadsMes: mes.length,
      leadsHoy: base.filter((l) => mismoDia(new Date(l.fecha), ahora)).length,
      cerrados: cerrados.length,
      tasaCierre: base.length ? (cerrados.length / base.length) * 100 : 0,
      ticket: conValor.length ? conValor.reduce((s, l) => s + l.costoProyectoMasIva, 0) / conValor.length : 0,
      sinAsesor: sinAsesor.length,
      etapas,
      perdidos: { cuenta: perdidos.length, valor: perdidos.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0) },
      maxEtapa,
      canales,
      abiertos: abiertos.slice(0, 5),
      totalAbiertos: abiertos.length,
      valorAbierto: abiertos.reduce((s, l) => s + (l.costoProyectoMasIva || 0), 0),
    };
  }, [base]);

  const porDia = useMemo(() => leadsPorDia(base, 14), [base]);
  const maxCanal = datos.canales[0]?.cuenta || 1;
  const cargando = estado === "cargando";
  const v = (x) => (cargando ? <span className="esqueleto" /> : x);

  if (estado === "error") {
    return (
      <div className="panel">
        <div className="panel__body bloque-error">
          No se pudieron cargar los leads.
          <button className="boton boton--texto" onClick={cargar}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {datos.sinAsesor > 0 && !cargando && (
        <div className="hallazgo">
          <span>
            <strong>{plural(datos.sinAsesor, "lead nuevo", "leads nuevos")} sin asesor.</strong>{" "}
            Llegaron por la web o sin asignar y nadie los está atendiendo.
          </span>
          <button className="boton boton--chico" onClick={() => navigate("/leads", { state: { asesor: "Sin asignar" } })}>
            Ver y asignar
          </button>
        </div>
      )}

      <section className="kpis" aria-label="Indicadores de los últimos 30 días">
        <div className="kpi kpi--lider">
          <div className="kpi__label">Valor cotizado · 30 días</div>
          <div className="kpi__valor">{v(cop(datos.valorMes))}</div>
          <div className="kpi__nota">{v(plural(datos.cotizadosMes, "cotización", "cotizaciones"))}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Leads · 30 días</div>
          <div className="kpi__valor">{v(datos.leadsMes.toLocaleString("es-CO"))}</div>
          <div className="kpi__nota">{v(`${datos.leadsHoy.toLocaleString("es-CO")} hoy`)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Tasa de cierre</div>
          <div className="kpi__valor">{v(<>{datos.tasaCierre.toLocaleString("es-CO", { maximumFractionDigits: 1 })}<span className="kpi__unidad">%</span></>)}</div>
          <div className="kpi__nota">{v(`${datos.cerrados} cerrados de ${base.length}`)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Ticket promedio</div>
          <div className="kpi__valor" title={cop(datos.ticket)}>{v(millones(datos.ticket))}</div>
          <div className="kpi__nota">Por proyecto cotizado</div>
        </div>
      </section>

      <section className="panel" aria-labelledby="t-embudo">
        <div className="panel__head">
          <h2 id="t-embudo">Embudo</h2>
          <span className="panel__meta">
            {cargando ? "" : `${plural(datos.totalAbiertos, "oportunidad abierta", "oportunidades abiertas")} · ${millones(datos.valorAbierto)}`}
          </span>
        </div>
        <div className="panel__body">
          <div className="embudo">
            {datos.etapas.map((e) => (
              <div key={e.estado} className={`etapa${e.estado === "Cerrado" ? " etapa--cerrado" : ""}`}>
                <div className="etapa__nombre">{e.estado}</div>
                <div className="etapa__cuenta">{v(e.cuenta)}</div>
                <div className="etapa__valor">{cargando ? "" : e.valor ? millones(e.valor) : "—"}</div>
                <div className="etapa__barra"><span style={{ width: `${(e.cuenta / datos.maxEtapa) * 100}%` }} /></div>
              </div>
            ))}
            <div className="embudo__corte" aria-hidden="true" />
            <div className="etapa etapa--perdido">
              <div className="etapa__nombre">Perdido</div>
              <div className="etapa__cuenta">{v(datos.perdidos.cuenta)}</div>
              <div className="etapa__valor">{cargando ? "" : datos.perdidos.valor ? millones(datos.perdidos.valor) : "—"}</div>
              <div className="etapa__barra"><span style={{ width: `${(datos.perdidos.cuenta / datos.maxEtapa) * 100}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="fila-2-1">
        <section className="panel" aria-labelledby="t-dias">
          <div className="panel__head">
            <h2 id="t-dias">Leads por día</h2>
            <span className="panel__meta">Últimos 14 días</span>
          </div>
          <div className="panel__body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porDia} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "var(--faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--faint)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<TooltipDia />} cursor={{ fill: "var(--raised)" }} />
                <Bar dataKey="leads" fill="var(--accent)" maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel" aria-labelledby="t-canal">
          <div className="panel__head">
            <h2 id="t-canal">Por dónde llegan</h2>
            <span className="panel__meta">Todos los leads</span>
          </div>
          <div className="panel__body">
            {!cargando && datos.canales.length === 0 ? (
              <p className="vacio">Todavía no hay leads con canal registrado.</p>
            ) : (
              <ul className="barras">
                {datos.canales.map((c) => (
                  <li key={c.nombre} className="barras__fila">
                    <div className="barras__texto">
                      <span>{c.nombre}</span>
                      <span className="barras__valor">{plural(c.cuenta, "lead", "leads")}</span>
                    </div>
                    <div className="barras__pista"><span style={{ width: `${(c.cuenta / maxCanal) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="panel" aria-labelledby="t-abiertas">
        <div className="panel__head">
          <h2 id="t-abiertas">Oportunidades abiertas de mayor valor</h2>
          <button className="boton boton--chico" onClick={() => navigate("/leads")}>
            Ver todos los leads
          </button>
        </div>
        <div className="panel__body">
          {!cargando && datos.abiertos.length === 0 ? (
            <p className="vacio">No hay oportunidades abiertas. Los leads nuevos aparecerán aquí.</p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="col-hide-mobile">Ciudad</th>
                    <th className="num col-hide-mobile">Sistema</th>
                    <th className="num">Valor</th>
                    <th className="col-hide-mobile">Estado</th>
                    <th className="col-hide-mobile">Asesor</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.abiertos.map((l) => (
                    <tr key={l.id} onClick={() => navigate("/resultado", { state: { resultado: l } })} style={{ cursor: "pointer" }}>
                      <td className="identidad">
                        <button className="enlace-fila" onClick={(e) => { e.stopPropagation(); navigate("/resultado", { state: { resultado: l } }); }}>
                          {l.nombre}
                        </button>
                        <span className="sub-movil">{l.estado || "Nuevo"} · {l.ubicacion || "—"}</span>
                      </td>
                      <td className="tenue col-hide-mobile">{l.ubicacion || "—"}</td>
                      <td className="num col-hide-mobile">{kwp(l.kwp)}</td>
                      <td className="num">{cop(l.costoProyectoMasIva)}</td>
                      <td className="col-hide-mobile"><span className={CLASE_ESTADO[l.estado || "Nuevo"]}>{l.estado || "Nuevo"}</span></td>
                      <td className="tenue col-hide-mobile">{l.vendedor || "Sin asignar"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
