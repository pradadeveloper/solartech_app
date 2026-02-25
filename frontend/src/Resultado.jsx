import { useLocation, useNavigate } from 'react-router-dom';
import logo from './assets/logo_solartech.webp';
import { useState } from 'react';

// Fecha
const fechaPropuesta = new Date().toLocaleDateString('es-CO');

export default function Resultado() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { resultado } = location.state || {};
  const styles = {
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    },
    modalContent: {
      backgroundColor: '#fff',
      padding: '2rem',
      borderRadius: '8px',
      maxWidth: '500px',
      width: '90%',
      boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
    }
  };


  if (!resultado) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>No se encontraron datos</h2>
        <button onClick={() => navigate('/')}>Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <div className="overlay">
        <div className="form-container">
          {/* LOGO MARCA */}
          <img src={logo} alt="Logo WattsPower" style={{ width: '200px', display: 'block', margin: '80px auto 1rem' }} />

          <div>
            <h2 className='title'>Cotización N-{resultado.numeroCotizacion}</h2>
          </div>
          <p className="fecha">Fecha de la propuesta: {fechaPropuesta}</p>

          <h3 className="title">Hola {resultado.nombre}! Aquí tienes el resultado de tu cotización:</h3>
          <p>
            En Solartech tenemos la mejor solución para ayudarte a ahorrar en tu factura de energía. Aquí te la presentamos.Los valores proporcionados son estimaciones basadas en los datos seleccionados y no de
            ben ser considerados como una cotización formal. <b>¡Ten en cuenta!</b> * Si requieres más información ponte en contacto con un asesor.
          </p>
          
          {/* DATOS INICIALES CLIENTE */}
          <container className="datoscliente">
            <h3 className="title">INFORMACIÓN INICIAL:</h3>
            <div className='datosUsuario'>
              <img src="/iconos/user-interface.png" alt="Ícono UI" className='icono'/>
              
              <table>
                <tbody>
                  <tr>
                    <td>Nombre:</td>
                    <td>{resultado.nombre}</td>
                  </tr>
                  <tr>
                    <td>Correo:</td>
                    <td>{resultado.correo}</td>
                  </tr>
                  <tr>
                    <td>Teléfono:</td>
                    <td>{resultado.telefono}</td>
                  </tr>
                  <tr>
                    <td>Ubicación del proyecto:</td>
                    <td>{resultado.ubicacion}</td>
                  </tr>
                  <tr>
                    <td>Preferencia de contacto:</td>
                    <td>{resultado.preferenciaContacto}</td>
                  </tr>
                  <tr>
                    <td>Tipo de solicitud:</td>
                    <td>{resultado.tipoSolicitud}</td>
                  </tr>
                  <tr>
                    <td>Tipo de techo:</td>
                    <td>{resultado.tipoTecho}</td>
                  </tr>
                  <tr>
                    <td>¿Recibe factura de energía?:</td>
                    <td>{resultado.recibeFactura}</td>
                  </tr>
                  <tr>
                    <td>Sistema de interés:</td>
                    <td>{resultado.sistemaInteres}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </container>

          {/* DATOS GENERALES DEL PROYECTO $$$ */}
          <container className='calculosIniciales'>
            <h3 className="title">TU SISTEMA SOLAR:</h3>
            <div className='sistemaSolarContainer'>
              <img src="/iconos/panel-solar.png" alt="Ícono UI" className='icono'/>

              <div className='generales'>
                <div>
                  <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.kwp} kWp</b> Potencia del sistema.
                        </p>
                  </div>
                  <div className='containerPgenerales' style={{ display: 'flex', gap: '2rem' }}>
                    
                    {/* Columna izquierda */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.consumoKwh.toLocaleString('es-CO')}kWh/mes</b> Consumo actual en el mes.
                        </p>
                      </div>

                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.produccionDeEnergia.toLocaleString('es-CO')} kWh/mes</b> producción de energía al mes del sistema.
                        </p>
                      </div>
                      
                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.radiacionSolar} radiación </b>promedio día de la zona.
                        </p>
                      </div>

                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.areaDisponible.toLocaleString('es-CO')} m²</b> de área disponible.
                        </p>
                      </div>
                    </div>

                    {/* Columna derecha */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.wPromedioDia.toLocaleString('es-CO')} W/día</b> Consumo promedio en un día.
                        </p>
                      </div>

                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.porcentajeCoberturaProyecto}%</b> Porcentaje de cobertura de tu consumo.
                        </p>
                      </div>
                      

                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.radiacionSolarCobertura} radiación</b> promedio con margen de cobertura del {resultado?.margenCobertura}%.
                        </p>
                      </div>
                      
                      <div className='pgenerales'>
                        <p className='pgeneralesDetalle'> 
                          <b className='resultado'>{resultado?.areaMinima} m²</b> área mínima requerida
                        </p>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
            </div>
          </container>


          {/* ANALISIS FINANCIERO $$$ */}
          <container className="analisisFinanciero">
          <h3 className="title">ANÁLISIS FINANCIERO:</h3>
          <div className="sistemaSolarContainer">
            <img src="/iconos/negocios-y-finanzas.png" alt="Ícono finanzas" className="icono" />

            <div className="generalesBloque">
              <div className="pgenerales">
                <p className="pgeneralesDetalle">
                  <b className="resultado">${resultado?.costoProyectoMasIva?.toLocaleString('es-CO')}</b> Inversión estimada del proyecto.
                </p>
              </div>

              <div className="containerPgenerales" style={{ display: 'flex', gap: '2rem' }}>
                
                {/* Columna izquierda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">${resultado?.ahorroAnual?.toLocaleString('es-CO')}</b> Ahorro anual estimado.
                    </p>
                  </div>

                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">${resultado?.ahorroMensual?.toLocaleString('es-CO')}</b> Ahorro mensual estimado.
                    </p>
                  </div>

                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">{resultado?.tiempoRetorno} años</b> estimados para retorno de tu inversión.
                    </p>
                  </div>

                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">25 años</b> vida útil estimada del proyecto.
                    </p>
                  </div>
                </div>

                {/* Columna derecha */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">${resultado?.descuentoDeclaracion?.toLocaleString('es-CO')}</b> descuento en declaración de renta.
                    </p>
                  </div>

                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">$ {resultado?.valorKwp?.toLocaleString('es-CO')}</b> valor promedio por kWp.
                    </p>
                  </div>

                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">${resultado?.ahorro10Anos?.toLocaleString('es-CO')}</b> dinero ahorrado con proyección a 10 años.
                    </p>
                  </div>

                  <div className="pgenerales">
                    <p className="pgeneralesDetalle">
                      <b className="resultado">4-10% valorización</b> aproximada de la propiedad.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </container>


          {/* PROPUESTA ECONOMICA */}
          <container className="propuestaEconomicaContainer">
            <h3 className="title">PROPUESTA ECONOMICA:</h3>
            <div className='propuestaEconomica'>
              {/* <img src="/iconos/money-management.png" alt="Ícono UI" className='icono'/> */}
              <table>
                <tbody>
                  <tr><td>Paneles {resultado.potenciaPanel}W:</td><td>{resultado.npaneles}</td></tr>
                  <tr><td>Inversores {resultado.capacidadInversor}W:</td><td>{resultado.ninversores}</td></tr>
                  <tr><td>Riel 4.7 metros:</td><td>{resultado.riel47}</td></tr>
                  <tr><td>Trámites ante el operador de red:</td><td>1</td></tr>
                  <tr><td>Sistema de monitoreo:</td><td>1</td></tr>
                  <tr><td>Pólizas:</td><td>1</td></tr>
                  <tr><td>Servicio de instalación:</td><td>1</td></tr>
                  <tr><td>Beneficios tributarios:</td><td>1</td></tr>
                  <tr><td>Extras:</td><td>1</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className='buttonDetalleEquipos'>
              <button onClick={() => setMostrarModal(true)} className="DetalleEquiposBotón">
                Detalle de los equipos
              </button>
            </div>

            {mostrarModal && (
              <div style={styles.modalOverlay}>
                <div style={styles.modalContent}>
                  <h4 className='title'>Detalle de Equipos</h4>
                  <table>
                    <tbody>
                      <tr><td>Paneles {resultado.potenciaPanel}W:</td><td>{resultado.npaneles}</td></tr>
                      <tr><td>Inversores {resultado.capacidadInversor}W:</td><td>{resultado.ninversores}</td></tr>
                      <tr><td>Riel 47:</td><td>{resultado.riel47}</td></tr>
                      <tr><td>Baterías Gel 100Ah:</td><td>{resultado.nbateriasGel100}</td></tr>
                      <tr><td>Baterías Gel 150Ah:</td><td>{resultado.nbateriasGel150}</td></tr>
                      <tr><td>Baterías Gel 200Ah:</td><td>{resultado.nbateriasGel200}</td></tr>
                      <tr><td>Baterías Litio 100Ah:</td><td>{resultado.nbateriasLitio100}</td></tr>
                      <tr><td>Baterías Litio 150Ah:</td><td>{resultado.nbateriasLitio150}</td></tr>
                      <tr><td>Baterías Litio 200Ah:</td><td>{resultado.nbateriasLitio200}</td></tr>
                      <tr><td>Mid Clamp:</td><td>{resultado.midCland}</td></tr>
                      <tr><td>End Clamp:</td><td>{resultado.endCland}</td></tr>
                      <tr><td>L-Foot:</td><td>{resultado.lFoot}</td></tr>
                      <tr><td>Grounding Loop:</td><td>{resultado.groundingLoop}</td></tr>
                      <tr><td>Cable solar:</td><td>{resultado.cableSolar}</td></tr>
                    </tbody>
                  </table>
                  <button onClick={() => setMostrarModal(false)} className="button-secondary" style={{ marginTop: '1rem' }}>
                    Cerrar
                  </button>
                </div>
              </div>
              )
            }

            <div className='resumenPropuestaEconomica'>
              <table>
                <tr><td className='resumenValorProyecto'><b>INVERSIÓN DE TU PROYECTO SOLAR</b></td><td>$ {resultado.costoProyecto.toLocaleString('es-CO')}</td></tr>
                <tr><td className='resumenValorProyecto'><b>IVA</b></td><td>$ {resultado.ivaProyecto.toLocaleString('es-CO')}</td></tr>
                <tr><td className='resumenValorProyecto'><b>TOTAL INVERSIÓN EN TU PROYECTO</b></td><td><b>$ {resultado.costoProyectoMasIva.toLocaleString('es-CO')}</b></td></tr>
                <tr><td className='resumenValorProyecto'><b>$/kWp</b></td><td><b>$ {resultado.costokwpproyecto.toLocaleString('es-CO')}</b></td></tr>
              </table>
            </div>
          </container>

          {/* FORMAS DE PAGO Y MANTENIMIENTO ANUAL$$$ */}
          <container className="formasDePago">
            <h3 className="title">FORMAS DE PAGO:</h3>
            <table>
              <tbody>
                <tr>
                  <td className='resumenValorProyecto'><b>ANTICIPO</b></td>
                  <td >50%</td>
                </tr>
                <tr>
                  <td className='resumenValorProyecto'><b>ENTREGA DE MATERIALES</b></td>
                  <td >40%</td>
                </tr>
                <tr>
                  <td className='resumenValorProyecto'><b>RETIE</b></td>
                  <td >10%</td>
                </tr>
              </tbody>
            </table>
          </container>

          {/* AMBIENTAL $$$ */}
          <container className="impactoAmbiental">
          <h3 className="title">IMPACTO AMBIENTAL DE TU PROYECTO:</h3>
            <div className='generales'>
            <img src="/iconos/ambientalismo.png" alt="Ícono UI" className='icono'/>
            
            <div className='containerPgenerales' style={{ display: 'flex', gap: '2rem' }}>
              
              {/* Columna izquierda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className='pgenerales'>
                  <p className='pgeneralesDetalle'>
                    <b className="resultadoGreen">{resultado?.arbolesEquivalentes?.toLocaleString('es-CO')} toneladas de CO₂</b> evitadas al año.
                  </p>
                </div>
                <div className='pgenerales'>
                  <p className='pgeneralesDetalle'>
                    Equivalente en árboles sembrados: <b className="resultadoGreen">{resultado?.galonesGasolinaEvitados?.toLocaleString('es-CO')} arboles</b>.
                  </p>
                </div>
                <div className='pgenerales'>
                  <p className='pgeneralesDetalle'>
                    <b className="resultadoGreen">{resultado?.co2EvitadoToneladas} Galones de gasolina</b> no consumidos.
                  </p>
                </div>
              </div>
            </div>
            </div>
          </container>
          
          {/* ETAPAS DEL PROYECTO $$$ */}
          <container className="etapasProyectoContainer">
            <h3 className="title">ETAPAS DEL PROYECTO:</h3>
            <div className='etapasProyecto'>
              <div>
                <img src="/iconos/el-pensamiento-de-diseno.png" alt="Ícono UI" className='icono'/>
                <h4 className='title'>ETAPA 1. Planeación, diseño e importación</h4>
                <p>1.Diagnóstico.</p>
                <p>2.Diseño de la solución.</p>
                <p>3.Gestión de trámites.</p>
                <p id='etapasProyectoTiempo'><b>30 días hábiles</b></p>
              </div>
              <div>
                <img src="/iconos/trabajadores.png" alt="Ícono UI" className='icono'/>
                <h4 className='title'> ETAPA 2. Construcción y puesta en marcha</h4>
                <p>4.Instalación.</p>
                <p>5.Puesta en marcha.</p>
                <p id='etapasProyectoTiempo'><b>90 días hábiles</b></p>
              </div>
              <div>
                <img src="/iconos/energia-solar.png" alt="Ícono UI" className='icono'/>
                <h4 className='title'>ETAPA 3. Operación</h4>
                <p>6.Trámites y conexión a la red.</p>
                <p>7.Monitoreo y mantenimiento.</p>
                <p id='etapasProyectoTiempo'><b>30 días hábiles</b></p>
              </div>
            </div>
          </container>

          {/* GARANTÍAS $$$ */}
          <h3 className="title">GARANTÍAS:</h3>
          <div className='garantiasContainer'>
            <div>
              <img src="/iconos/paneles-solares.png" alt="Ícono UI" className='icono'/>
              <h4 className='title'>Paneles Solares</h4>
              <p id='etapasProyectoTiempo'><b>15 años de producto</b></p>
              <p id='etapasProyectoTiempo'><b>30 años de generación</b></p>
            </div>
            <div>
              <img src="/iconos/inversor-solar.png" alt="Ícono UI" className='icono'/>
              <h4 className='title'>Inversores</h4>
              <p id='etapasProyectoTiempo'><b>10 años de producto</b></p>
            </div>
            <div>
              <img src="/iconos/paneles-solares (1).png" alt="Ícono UI" className='icono'/>
              <h4 className='title'>Estructuras</h4>
              <p id='etapasProyectoTiempo'><b>10 años de producto</b></p>
            </div>
          </div>
          
          {/* MARCAS ALIADAS $$$ */}
          <container className="marcasAliadasContainer">
            <h3 className="title">MARCAS ALIADAS:</h3>
            <div className='marcasAliadas'>
              <img src="/huawei.jpeg" alt="Marcas Aliadas" className='Banner_Casos_Desktop'style={{ width: '150px' }}/>
              <img src="/longi.png" alt="Marcas Aliadas"  />
              <img src="/growatt.png" alt="Marcas Aliadas" />
              <img src="/goodwe.jpeg" alt="Marcas Aliadas" />
            </div>
           </container>


          {/* CONDICIONES COMERCIALES $$$ */}
          <container className="condicionesComercialesContainer">
            <h3 className="title">CONDICIONES COMERCIALES:</h3>
            <ol class="condicionesComerciales">
            <li>La cantidad de paneles e inversores podrá variar dependiendo de la potencia que se tenga a disposición de los mismos.</li>
            <li>Con la aceptación de esta cotización se aceptan las políticas de servicio post y garantías.</li>
            <li>La cotización incluye viáticos de instalación y desplazamiento técnico hasta el lugar de la instalación.</li>
            <li>El Tiempo de entrega del proyecto es de 120 días a Retie, contados a partir de la fecha de recibir el primer pago.</li>
            <li>El producto que se reemplace o se repare dentro del periodo de garantía solo estará garantizado por la parte restante no utilizada en la garantía vigente.</li>
            <li>Esta propuesta puede tener costos adicionales que se encuentren en la visita técnica.</li>
            <li>Este sistema no está diseñado para operar cuando existan interrupciones de energía en la red. El sistema funcionará cuando la señal de la red esté presente.</li>
            <li>Los techos de loza de concreto deben tener la capacidad de soportar un peso equivalente a 50kg/m² y los de teja de 15kg/m².</li>
            <li>Garantía del sistema y sus equipos:
              <ul>
                <li>Paneles: 12 años</li>
                <li>Inversores: 5 años</li>
                <li>Instalación: 5 años</li>
              </ul>
              *(Sujeto a realización de mantenimientos anuales con Solartech)*
            </li>
            <li>Si el comprador es monousuario (tiene transformador propio) y quiere legalizar el proyecto con entrega de excedentes a las empresas públicas de energía, la frontera (medidor principal) debe cumplir lo establecido por la CREG 174 de 2021 en el capítulo 4, artículo 19 sobre sistema de medición. Además, queda sujeto a las resoluciones CREG 174 del 2021, 038 del 2014, 015 del 2018 y normas OR RA8-028 / RA8-030.</li>
            <li>Los valores de ahorro son estimados y están sujetos a la radiación, el precio del kWh y el precio que reconozca el OR sobre los excedentes.</li>
            <li>El proyecto no incluye la adecuación de la frontera comercial. Este valor se sabrá cuando el OR realice la visita de legalización.</li>
            <li>Validez de la oferta: 15 días calendario.</li>
          </ol>
        </container>

          {/* CASOS DE ÉXITO MARCAS $$$ */}
        <container className="casosExitoColombia">
          <h3 className="title">CASOS DE ÉXITO EN COLOMBIA:</h3>
          <div className='container_casos_exito_2'>
            <div className='container_casos_exito'>
              <img src="/casos_exito_marcas.jpg" alt="Casos de éxito marcas" className='Banner_Casos_Desktop'/>
              <img src="/caso1.svg" alt="Casos de éxito marcas" className='Banner_Casos_mobile'/>
              <img src="/caso3.webp" alt="Casos de éxito marcas" className='Banner_Casos_mobile'/>
              <img src="/caso2.png" alt="Casos de éxito marcas" className='Banner_Casos_mobile'/>
            </div>
            <div className='container_casos_exito'>
              <img src="/caso4.png" alt="Casos de éxito marcas" className='Banner_Casos_mobile'/>
              <img src="/caso5.png" alt="Casos de éxito marcas" className='Banner_Casos_mobile'/>
              <img src="/caso6.jpeg" alt="Casos de éxito marcas" className='Banner_Casos_mobile'/>
            </div>
          </div>
          </container>

          {/* AGRADECIMIENTOS Y CONTACTO $$$ */}
          <h3 className="title">¡MUCHAS GRACIAS!</h3>
          <p>Estamos para atender sus dudas e inquietudes, no dude en contactarnos.</p>
          <p>Martin Uribe</p>
          <p>Director de Proyectos</p>

          {/* DESCARGAR PDF*/}
          <a
            href={`${process.env.REACT_APP_API_URL}${resultado.pdfUrl}`}
            download
            className="download-link"
          >
            Descargar propuesta en PDF
          </a>
          <br /><br />
          
          
          <button onClick={() => navigate('/')}>Volver al formulario</button>
        </div>
      </div>
    </div>
  );
}
