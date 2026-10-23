import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { analizarRecursosPropios, calcularPPA, entradasDesde } from "../finanzas";

/* Análisis financiero de la propuesta según la modalidad de negocio.
   Los cálculos salen de finanzas.js (el mismo archivo que usa el PDF del backend),
   así la propuesta web, la del asesor y el PDF muestran las mismas cifras.
   Card y Metric llegan de cada vista para conservar su estilo. */

export const MODALIDADES = [
  { valor: "recursos_propios", texto: "Recursos propios" },
  { valor: "ppa", texto: "PPA (sin inversión)" },
];

export const CONDICIONES_PPA = [
  "Las tarifas presentadas son de referencia y no son vinculantes hasta la firma del contrato de suministro de energía (PPA).",
  "La tarifa PPA se indexa mensualmente con el IPC durante el contrato. Al terminar el plazo, los equipos se ceden al cliente sin costo adicional.",
  "Solartech asume la inversión, la instalación, la operación y el mantenimiento del sistema durante la vigencia del contrato.",
  "Los ahorros proyectados no incluyen la devolución de excedentes a la red y dependen de la radiación solar real.",
  "No incluye líneas de vida, apantallamiento ni análisis estructural de la cubierta; se definen en la visita técnica.",
  "No incluye la adecuación de la frontera comercial; el costo lo define el operador de red durante la legalización.",
  "Si la cubierta tiene más área útil, el proyecto puede crecer y la tarifa PPA se mantiene.",
  "Validez de la oferta: 15 días calendario.",
];

const cop = (v) => (v == null || !Number.isFinite(v) ? "—" : `$ ${Math.round(v).toLocaleString("es-CO")}`);
const millones = (v) => `$${(v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 0 })} M`;
const pct = (v, dec = 1) => (v == null ? "—" : `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: dec })} %`);
const anios = (v) => (v == null ? "Más de 25 años" : `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} años`);

const tooltipStyle = { fontSize: 12, borderRadius: 6, border: "1px solid #e7e5e4" };

// ── Recursos propios ─────────────────────────────────────────────────────────
export function AnalisisRecursosPropios({ r, cfg, Card, Metric }) {
  const rp = useMemo(() => {
    if (!(Number(r?.costoProyectoMasIva) > 0) || !(Number(r?.ahorroAnual || r?.ahorroMensual) > 0)) return null;
    return analizarRecursosPropios(entradasDesde(r), cfg);
  }, [r, cfg]);
  if (!rp) return null;

  const datos = [{ anio: 0, acumulado: rp.flujos[0] }, ...rp.anios.map((a) => ({ anio: a.anio, acumulado: a.acumulado }))];
  const s = rp.supuestos;

  return (
    <Card title="Análisis financiero">
      <div className="pp-metrics-grid">
        <Metric label="Inversión total (con IVA)" value={cop(rp.inversion)} />
        <Metric label="Ahorro mensual (año 1)" value={cop(Number(r.ahorroMensual) || Number(r.ahorroAnual) / 12)} isGreen />
        <Metric label={rp.esEmpresa ? "Retorno después de impuestos" : "Retorno de la inversión"} value={anios(rp.retornoAnios)} />
        <Metric label="Ganancia acumulada a 10 años" value={cop(rp.ganancia10)} isGreen />
        <Metric label="Ganancia acumulada a 25 años" value={cop(rp.ganancia25)} isGreen />
        <Metric label={`Valor presente neto (25 años, tasa ${pct(s.tasaDescuento, 0)})`} value={cop(rp.vpn25)} />
        <Metric label="Tasa interna de retorno (25 años)" value={pct(rp.tir25)} />
        <Metric label="Retorno descontado" value={anios(rp.retornoDescontadoAnios)} />
      </div>

      {rp.beneficiosTributarios && (
        <>
          <div className="pp-divider" />
          <p className="chartTitle">Beneficios tributarios Ley 1715 (incluidos en las cifras)</p>
          <div className="pp-metrics-grid">
            <Metric label="Depreciación acelerada en 3 años" value={cop(rp.beneficiosTributarios.depreciacion)} />
            <Metric label="Deducción especial del 50 % en renta" value={cop(rp.beneficiosTributarios.deduccion)} />
            <Metric label="Menor impuesto de renta (total)" value={cop(rp.beneficiosTributarios.total)} isGreen />
          </div>
          <p className="chartNote" style={{ textAlign: "left" }}>
            Sujeto a la certificación UPME del proyecto y a que la empresa tenga renta líquida suficiente.
          </p>
        </>
      )}

      <div className="pp-divider" />
      <p className="chartTitle">Flujo de caja acumulado (25 años)</p>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f0efee" vertical={false} />
            <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#6f6762" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: "#6f6762" }} tickFormatter={millones} width={70} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => cop(v)} labelFormatter={(a) => `Año ${a}`} contentStyle={tooltipStyle} />
            <ReferenceLine y={0} stroke="#57504c" />
            <Line type="linear" dataKey="acumulado" name="Acumulado" stroke="#a6563b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chartNote" style={{ textAlign: "left" }}>
        Supuestos: alza de la tarifa {pct(s.incrementoTarifa)} anual, pérdida de rendimiento de los paneles{" "}
        {pct(s.degradacion, 2)} anual, mantenimiento anual indexado y reposición de inversores en el año {s.reposicionAnio}.
        {rp.esEmpresa ? ` Incluye el efecto en renta (${pct(s.tasaImpuesto, 0)}).` : ""}
      </p>
    </Card>
  );
}

// ── PPA ──────────────────────────────────────────────────────────────────────
export function PropuestaPPA({ r, cfg, Card, Metric, mostrarInterno = false }) {
  const ppa = useMemo(() => {
    if (!(Number(r?.kwp) > 0) || !(Number(r?.costoKwh) > 0)) return null;
    return calcularPPA(entradasDesde(r), cfg);
  }, [r, cfg]);
  if (!ppa) return null;

  const filas = ppa.anios.filter((a) => [1, 2, 3, 5, 10, ppa.plazo, ppa.plazo + 1, 20, 25].includes(a.anio));
  const barras = ppa.anios.map((a) => ({
    anio: a.anio,
    "Pago a Solartech": Math.round(a.pagoPPA),
    "Ahorro": Math.round(a.ahorro),
  }));

  return (
    <>
      <Card title="Modalidad PPA — energía solar sin inversión">
        <p className="pp-welcome-body" style={{ marginTop: 0 }}>
          Solartech instala, opera y mantiene el sistema sin que inviertas. Pagas solo la energía que genera,
          a una tarifa menor que la del operador de red. Al terminar el contrato, los equipos pasan a ser tuyos.
        </p>
        <div className="pp-metrics-grid">
          <Metric label="Tu inversión" value="$ 0" isGreen />
          <Metric label="Tarifa actual del operador" value={`${cop(ppa.tarifaRed1)} / kWh`} />
          <Metric label={`Tarifa PPA Solartech (${pct(ppa.descuento, 0)} menos)`} value={`${cop(ppa.tarifaPPA1)} / kWh`} isGreen />
          <Metric label="Plazo del contrato" value={`${ppa.plazo} años`} />
          <Metric label="Indexación de la tarifa" value={`IPC (supuesto ${pct(ppa.indexacion, 0)} anual)`} />
          <Metric label="Al terminar el contrato" value="Los equipos son tuyos" />
        </div>
      </Card>

      <Card title="Tu ahorro con el PPA">
        <div className="pp-metrics-grid">
          <Metric label="Factura evitada al operador (mes 1)" value={cop(ppa.facturaRedMensual1)} />
          <Metric label="Pago estimado a Solartech (mes 1)" value={cop(ppa.pagoMensual1)} />
          <Metric label="Ahorro del primer mes" value={cop(ppa.ahorroMensual1)} isGreen />
          <Metric label="Ahorro acumulado a 5 años" value={cop(ppa.acumulado5)} isGreen />
          <Metric label="Ahorro acumulado a 10 años" value={cop(ppa.acumulado10)} isGreen />
          <Metric label={`Ahorro durante el contrato (${ppa.plazo} años)`} value={cop(ppa.ahorroContrato)} isGreen />
          <Metric label="Ahorro acumulado a 25 años" value={cop(ppa.acumulado25)} isGreen />
        </div>

        <div className="pp-divider" />
        <p className="chartTitle">Lo que pagas a Solartech y lo que ahorras, año a año</p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={barras} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f0efee" vertical={false} />
              <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#6f6762" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: "#6f6762" }} tickFormatter={millones} width={70} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => cop(v)} labelFormatter={(a) => `Año ${a}`} contentStyle={tooltipStyle} />
              <Bar dataKey="Pago a Solartech" stackId="a" fill="#d6d3d1" isAnimationActive={false} />
              <Bar dataKey="Ahorro" stackId="a" fill="#a6563b" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="chartNote" style={{ textAlign: "left" }}>
          La barra completa es lo que pagarías al operador de red. Desde el año {ppa.plazo + 1} los equipos son tuyos y todo es ahorro.
        </p>

        <div className="pp-divider" />
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Año</th>
                <th className="num">Tarifa red $/kWh</th>
                <th className="num">Tarifa PPA $/kWh</th>
                <th className="num">Ahorro del año</th>
                <th className="num">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.anio}>
                  <td>{a.anio}</td>
                  <td className="num">{Math.round(a.tarifaRed).toLocaleString("es-CO")}</td>
                  <td className="num">{a.tarifaPPA ? Math.round(a.tarifaPPA).toLocaleString("es-CO") : "Equipos tuyos"}</td>
                  <td className="num">{cop(a.ahorro)}</td>
                  <td className="num">{cop(a.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chartNote" style={{ textAlign: "left" }}>
          Toda la generación se valora a la tarifa del operador de red; ambas tarifas suben {pct(ppa.indexacion, 0)} al año
          y los paneles pierden 0,55 % de rendimiento por año.
        </p>
      </Card>

      {mostrarInterno && (
        <Card title="Rentabilidad para Solartech (uso interno)">
          <p className="pp-welcome-body" style={{ marginTop: 0 }}>
            No aparece en la propuesta del cliente ni en el PDF. Sirve para validar el descuento ofrecido.
          </p>
          <div className="pp-metrics-grid">
            <Metric label="Costo interno del proyecto" value={cop(ppa.interno.costoInterno)} />
            <Metric label="Inversión con margen (capex)" value={cop(ppa.interno.capex)} />
            <Metric label="Ingreso neto año 1" value={cop(ppa.interno.neto1)} />
            <Metric label="TIR a 10 años" value={pct(ppa.interno.tir10)} />
            <Metric label={`TIR a ${ppa.plazo} años`} value={pct(ppa.interno.tirPlazo)} />
          </div>
        </Card>
      )}

      <Card title="Condiciones del contrato PPA">
        <ol className="condicionesComerciales">
          {CONDICIONES_PPA.map((c) => <li key={c}>{c}</li>)}
        </ol>
      </Card>
    </>
  );
}
