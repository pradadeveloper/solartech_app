import { useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo_solartech.webp";
import { useMemo, useState } from "react";
import "./cotizadorSolar.css"; // usa tu misma hoja

export default function Resultado() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { resultado } = location.state || {};

  const fechaPropuesta = useMemo(() => new Date().toLocaleDateString("es-CO"), []);

  const styles = {
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
      padding: "16px",
    },
    modalContent: {
      backgroundColor: "#fff",
      padding: "18px",
      borderRadius: "14px",
      maxWidth: "860px",
      width: "100%",
      boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
      maxHeight: "80vh",
      overflow: "auto",
    },
  };

  if (!resultado) {
    return (
      <div className="cotizador">
        <div className="cotizadorShell">
          <div className="cotCard">
            <div className="cotCardBody" style={{ textAlign: "center" }}>
              <h2 className="cotTitle" style={{ margin: 0 }}>No se encontraron datos</h2>
              <p style={{ opacity: 0.9 }}>Vuelve al formulario y genera una nueva cotización.</p>
              <button className="cotBtn cotBtnPrimary" onClick={() => navigate("/")}>
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const money = (v) =>
    typeof v === "number" ? v.toLocaleString("es-CO") : (v ?? "—");

  return (
    <div className="cotizador">
      <div className="cotizadorShell">
        {/* Header */}
        <header className="cotHeader">
          <img src={logo} alt="Logo Solartech" className="cotLogo" />

          <div className="cotHeaderText">
            <h1 className="cotTitle">Cotización N-{resultado.numeroCotizacion}</h1>
            <p className="cotSubtitle">Fecha de la propuesta: {fechaPropuesta}</p>
          </div>

          <div className="cotSteps">
            <span className="cotStep isActive">✓</span>
            <span className="cotStepLine" />
            <span className="cotStep isActive">✓</span>
          </div>
        </header>

        {/* Intro */}
        <div className="cotGrid">
          <section className="cotMain">
            <div className="cotCard">
              <div className="cotCardHead">
                <h2>Resumen</h2>
              </div>
              <div className="cotCardBody">
                <h3 className="title" style={{ marginTop: 0 }}>
                  Hola {resultado.nombre}! Aquí tienes el resultado de tu cotización:
                </h3>

                <p style={{ marginTop: 10, lineHeight: 1.6 }}>
                  En Solartech tenemos la mejor solución para ayudarte a ahorrar en tu factura de energía.
                  Los valores proporcionados son estimaciones basadas en los datos seleccionados y no deben
                  ser considerados como una cotización formal. <b>¡Ten en cuenta!</b> Si requieres más información,
                  ponte en contacto con un asesor.
                </p>

                <div className="cotActions" style={{ marginTop: 14 }}>
                  <a
                    href={`${process.env.REACT_APP_API_URL}${resultado.pdfUrl}`}
                    download
                    className="cotBtn cotBtnPrimary"
                    style={{ textDecoration: "none", display: "inline-flex", justifyContent: "center" }}
                  >
                    Descargar propuesta en PDF
                  </a>

                  <button className="cotBtn cotBtnGhost" onClick={() => navigate("/")}>
                    Volver al formulario
                  </button>
                </div>
              </div>
            </div>

            {/* INFO INICIAL */}
            <Card title="Información inicial">
              <div className="cotTwoCol">
                <SummaryRow label="Nombre" value={resultado.nombre} />
                <SummaryRow label="Correo" value={resultado.correo} />
                <SummaryRow label="Teléfono" value={resultado.telefono} />
                <SummaryRow label="Ubicación" value={resultado.ubicacion} />
                <SummaryRow label="Preferencia de contacto" value={resultado.preferenciaContacto} />
                <SummaryRow label="Tipo de solicitud" value={resultado.tipoSolicitud} />
                <SummaryRow label="Tipo de techo" value={resultado.tipoTecho} />
                <SummaryRow label="Recibe factura" value={resultado.recibeFactura} />
                <SummaryRow label="Sistema de interés" value={resultado.sistemaInteres} />
              </div>
            </Card>

            {/* TU SISTEMA SOLAR */}
            <Card title="Tu sistema solar">
              <div className="cotTwoCol">
                <Metric label="Potencia del sistema" value={`${resultado?.kwp ?? "—"} kWp`} />
                <Metric label="Consumo mensual" value={`${money(resultado?.consumoKwh)} kWh/mes`} />
                <Metric label="Producción mensual" value={`${money(resultado?.produccionDeEnergia)} kWh/mes`} />
                <Metric label="Consumo promedio día" value={`${money(resultado?.wPromedioDia)} W/día`} />
                <Metric label="Radiación promedio" value={`${resultado?.radiacionSolar ?? "—"}`} />
                <Metric label="Área disponible" value={`${money(resultado?.areaDisponible)} m²`} />
                <Metric label="Cobertura estimada" value={`${resultado?.porcentajeCoberturaProyecto ?? "—"}%`} />
                {/* <Metric
                  label={`Radiación con margen (${resultado?.margenCobertura ?? "—"}%)`}
                  value={`${resultado?.radiacionSolarCobertura ?? "—"}`}
                /> */}
                <Metric label="Área mínima requerida" value={`${resultado?.areaMinima ?? "—"} m²`} />
              </div>
            </Card>

            {/* FINANCIERO */}
            <Card title="Análisis financiero">
              <div className="cotTwoCol">
                <Metric label="Inversión estimada (con IVA)" value={`$ ${money(resultado?.costoProyectoMasIva)}`} />
                <Metric label="Ahorro anual estimado" value={`$ ${money(resultado?.ahorroAnual)}`} />
                <Metric label="Ahorro mensual estimado" value={`$ ${money(resultado?.ahorroMensual)}`} />
                <Metric label="Retorno de inversión" value={`${resultado?.tiempoRetorno ?? "—"} años`} />
                <Metric label="Vida útil estimada" value={`25 años`} />
                <Metric label="Descuento declaración de renta" value={`$ ${money(resultado?.descuentoDeclaracion)}`} />
                {/* <Metric label="Valor promedio por kWp" value={`$ ${money(resultado?.valorKwp)}`} /> */}
                <Metric label="Ahorro proyectado a 10 años" value={`$ ${money(resultado?.ahorro10Anos)}`} />
                <Metric label="Valorización aproximada" value={`4–10%`} />
              </div>
            </Card>

            {/* PROPUESTA ECONÓMICA */}
            <Card
              title="Propuesta económica"
              right={
                <button
                  type="button"
                  className="cotBtn cotBtnGhost"
                  onClick={() => setMostrarModal(true)}
                >
                  Detalle de los equipos
                </button>
              }
            >
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Paneles {resultado.potenciaPanel}W</td><td className="num">{resultado.npaneles}</td></tr>
                    <tr><td>Inversor {resultado.capacidadInversor}W</td><td className="num">{resultado.ninversores}</td></tr>
                    <tr><td>Trámites ante operador de red</td><td className="num">1</td></tr>
                    <tr><td>Sistema de monitoreo</td><td className="num">1</td></tr>
                    <tr><td>Pólizas</td><td className="num">1</td></tr>
                    <tr><td>Servicio de instalación</td><td className="num">1</td></tr>
                    <tr><td>Beneficios tributarios</td><td className="num">1</td></tr>
                    <tr><td>Extras</td><td className="num">1</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="cotDivider" />

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Resumen inversión</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Inversión del proyecto solar</td><td className="num">$ {money(resultado.costoProyecto)}</td></tr>
                    <tr><td>IVA</td><td className="num">$ {money(resultado.ivaProyecto)}</td></tr>
                    <tr><td><b>Total inversión</b></td><td className="num"><b>$ {money(resultado.costoProyectoMasIva)}</b></td></tr>
                    <tr><td>$/kWp</td><td className="num"><b>$ {money(resultado.costokwpproyecto)}</b></td></tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* FORMAS DE PAGO */}
            <Card title="Formas de pago">
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hito</th>
                      <th className="num">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Anticipo</td><td className="num">50%</td></tr>
                    <tr><td>Entrega de materiales</td><td className="num">40%</td></tr>
                    <tr><td>RETIE</td><td className="num">10%</td></tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* IMPACTO AMBIENTAL */}
            <Card title="Impacto ambiental">
              <div className="cotTwoCol">
                <Metric label="CO₂ evitado al año" value={`${money(resultado?.arbolesEquivalentes)} toneladas`} isGreen />
                <Metric label="Equivalente en árboles sembrados" value={`${money(resultado?.galonesGasolinaEvitados)} árboles`} isGreen />
                <Metric label="Gasolina no consumida" value={`${resultado?.co2EvitadoToneladas ?? "—"} galones`} isGreen />
              </div>
            </Card>

            {/* ETAPAS */}
            <Card title="Etapas del proyecto">
              <div className="cotTwoCol">
                <MiniBlock
                  title="Etapa 1 — Planeación, diseño e importación"
                  lines={["1. Diagnóstico", "2. Diseño de la solución", "3. Gestión de trámites"]}
                  foot="30 días hábiles"
                />
                <MiniBlock
                  title="Etapa 2 — Construcción y puesta en marcha"
                  lines={["4. Instalación", "5. Puesta en marcha"]}
                  foot="90 días hábiles"
                />
                <MiniBlock
                  title="Etapa 3 — Operación"
                  lines={["6. Trámites y conexión a la red", "7. Monitoreo y mantenimiento"]}
                  foot="30 días hábiles"
                />
              </div>
            </Card>

            {/* GARANTÍAS */}
            <Card title="Garantías">
              <div className="cotTwoCol">
                <MiniBlock title="Paneles solares" lines={["15 años de producto", "30 años de generación"]} />
                <MiniBlock title="Inversores" lines={["10 años de producto"]} />
                <MiniBlock title="Estructuras" lines={["10 años de producto"]} />
              </div>
            </Card>

            {/* MARCAS */}
            <Card title="Marcas aliadas">
              <div className="marcasAliadas" style={{ marginTop: 10 }}>
                <img src="/logos/huawei.jpeg" alt="Huawei" style={{ width: 120, height: "auto" }} />
                <img src="/logos/logo_longi.png" alt="Longi" style={{ width: 120, height: "auto" }} />
                <img src="/logos/growatt.png" alt="Growatt" style={{ width: 120, height: "auto" }} />
                <img src="/logos/goodwe.jpeg" alt="Goodwe" style={{ width: 120, height: "auto" }} />
              </div>
            </Card>

            {/* CONDICIONES */}
            <Card title="Condiciones comerciales">
              <ol className="condicionesComerciales">
                <li>La cantidad de paneles e inversores podrá variar dependiendo de la potencia disponible.</li>
                <li>Con la aceptación se aceptan políticas de servicio post y garantías.</li>
                <li>Incluye viáticos y desplazamiento técnico hasta el lugar de instalación.</li>
                <li>Tiempo de entrega: 120 días a RETIE desde el primer pago.</li>
                <li>Repuestos/reparaciones solo por el tiempo restante de garantía vigente.</li>
                <li>Puede haber costos adicionales tras visita técnica.</li>
                <li>El sistema no opera durante interrupciones de la red (si aplica al tipo de sistema).</li>
                <li>Capacidad de techo: loza 50kg/m² y teja 15kg/m².</li>
                <li>
                  Garantías:
                  <ul>
                    <li>Paneles: 12 años</li>
                    <li>Inversores: 5 años</li>
                    <li>Instalación: 5 años</li>
                  </ul>
                  *(Sujeto a mantenimientos anuales con Solartech)*
                </li>
                <li>Legalización sujeta a CREG 174 de 2021 y resoluciones aplicables (cuando aplique).</li>
                <li>Los ahorros dependen de radiación, precio kWh y excedentes reconocidos por el OR.</li>
                <li>No incluye adecuación de frontera comercial; se define tras visita del OR.</li>
                <li>Validez de la oferta: 15 días calendario.</li>
              </ol>
            </Card>

            {/* CIERRE */}
            <Card title="Cierre">
              <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                ¡Muchas gracias! Estamos para atender tus dudas e inquietudes.
              </p>
              <p style={{ margin: 0 }}><b>Martin Uribe</b></p>
              <p style={{ margin: "6px 0 0", opacity: 0.9 }}>Director de Proyectos</p>

              <div className="cotActions" style={{ marginTop: 14 }}>
                <a
                  href={`${process.env.REACT_APP_API_URL}${resultado.pdfUrl}`}
                  download
                  className="cotBtn cotBtnPrimary"
                  style={{ textDecoration: "none", display: "inline-flex", justifyContent: "center" }}
                >
                  Descargar propuesta en PDF
                </a>
                <button className="cotBtn cotBtnGhost" onClick={() => navigate("/")}>
                  Volver al formulario
                </button>
              </div>
            </Card>
          </section>

          {/* Right: Side summary */}
          <aside className="cotSide">
            <Card title="Resumen rápido">
              <SummaryRow label="Cotización" value={`N-${resultado.numeroCotizacion}`} />
              <SummaryRow label="Cliente" value={resultado.nombre} />
              <SummaryRow label="Ciudad" value={resultado.ubicacion} />
              <div className="cotDivider" />
              <SummaryRow label="Potencia" value={`${resultado?.kwp ?? "—"} kWp`} />
              <SummaryRow label="Producción" value={`${money(resultado?.produccionDeEnergia)} kWh/mes`} />
              <SummaryRow label="Cobertura" value={`${resultado?.porcentajeCoberturaProyecto ?? "—"}%`} />
              <div className="cotDivider" />
              <SummaryRow label="Total inversión" value={`$ ${money(resultado?.costoProyectoMasIva)}`} />
              <SummaryRow label="Retorno" value={`${resultado?.tiempoRetorno ?? "—"} años`} />
              <SummaryRow label="Ahorro anual" value={`$ ${money(resultado?.ahorroAnual)}`} />
            </Card>

            <Card title="Acciones">
              <div className="cotActions" style={{ marginTop: 0 }}>
                <a
                  href={`${process.env.REACT_APP_API_URL}${resultado.pdfUrl}`}
                  download
                  className="cotBtn cotBtnPrimary"
                  style={{ textDecoration: "none", display: "inline-flex", justifyContent: "center", width: "100%" }}
                >
                  Descargar PDF
                </a>
                <button className="cotBtn cotBtnGhost" onClick={() => navigate("/")}>
                  Nueva cotización
                </button>
              </div>
            </Card>
          </aside>
        </div>

        {/* MODAL DETALLE EQUIPOS */}
        {mostrarModal && (
          <div style={styles.modalOverlay} onClick={() => setMostrarModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 className="title" style={{ marginTop: 0 }}>Detalle de equipos</h3>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Equipo</th>
                      <th className="num">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Paneles {resultado.potenciaPanel}W</td><td className="num">{resultado.npaneles}</td></tr>
                    <tr><td>Inversores {resultado.capacidadInversor}W</td><td className="num">{resultado.ninversores}</td></tr>
                    <tr><td>Riel 47</td><td className="num">{resultado.riel47}</td></tr>

                    <tr><td>Baterías Gel 100Ah</td><td className="num">{resultado.nbateriasGel100}</td></tr>
                    <tr><td>Baterías Gel 150Ah</td><td className="num">{resultado.nbateriasGel150}</td></tr>
                    <tr><td>Baterías Gel 200Ah</td><td className="num">{resultado.nbateriasGel200}</td></tr>

                    <tr><td>Baterías Litio 100Ah</td><td className="num">{resultado.nbateriasLitio100}</td></tr>
                    <tr><td>Baterías Litio 150Ah</td><td className="num">{resultado.nbateriasLitio150}</td></tr>
                    <tr><td>Baterías Litio 200Ah</td><td className="num">{resultado.nbateriasLitio200}</td></tr>

                    <tr><td>Mid Clamp</td><td className="num">{resultado.midCland}</td></tr>
                    <tr><td>End Clamp</td><td className="num">{resultado.endCland}</td></tr>
                    <tr><td>L-Foot</td><td className="num">{resultado.lFoot}</td></tr>
                    <tr><td>Grounding Loop</td><td className="num">{resultado.groundingLoop}</td></tr>
                    <tr><td>Cable solar</td><td className="num">{resultado.cableSolar}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="cotActions" style={{ marginTop: 14 }}>
                <button className="cotBtn cotBtnPrimary" onClick={() => setMostrarModal(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- mini componentes UI (mismo estilo del cotizador) ---------- */

function Card({ title, right, children }) {
  return (
    <div className="cotCard">
      <div className="cotCardHead">
        <h2>{title}</h2>
        {right}
      </div>
      <div className="cotCardBody">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="cotSummaryRow">
      <span className="cotSummaryLabel">{label}</span>
      <span className="cotSummaryValue">{String(value ?? "—")}</span>
    </div>
  );
}

function Metric({ label, value, isGreen }) {
  return (
    <div className="pgenerales" style={{ margin: 0 }}>
      <p className="pgeneralesDetalle" style={{ margin: 0 }}>
        <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>{label}</span>
        <b className={isGreen ? "resultadoGreen" : "resultado"} style={{ fontSize: 18 }}>
          {value}
        </b>
      </p>
    </div>
  );
}

function MiniBlock({ title, lines = [], foot }) {
  return (
    <div className="pgenerales" style={{ margin: 0, textAlign: "left" }}>
      <p className="pgeneralesDetalle" style={{ margin: 0, textAlign: "left" }}>
        <b className="resultado" style={{ display: "block", marginBottom: 6 }}>
          {title}
        </b>
        {lines.map((l, idx) => (
          <span key={idx} style={{ display: "block", opacity: 0.9 }}>{l}</span>
        ))}
        {foot ? <span style={{ display: "block", marginTop: 8 }}><b>{foot}</b></span> : null}
      </p>
    </div>
  );
}