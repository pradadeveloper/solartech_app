import { useState } from 'react';
import './App.css';
import logo from './assets/logo_solartech.webp';
import { useNavigate } from 'react-router-dom';

export default function CotizadorSolar() {
  const [formData, setFormData] = useState({
  nombre: 'Juan Pérez',
  correo: 'juan@example.com',
  telefono: '3001234567',
  ubicacion: 'Medellín',
  preferenciaContacto: 'WhatsApp',
  tipoSolicitud: 'Hogar',
  tipoTecho: 'Teja de barro',
  recibeFactura: 'Sí',
  sistemaInteres: 'Interconectado',
  valorMensual: '1000000',
  consumoKwh: '1000',
  costoKwh: '800',
  conociste: 'Instagram',
  facturaAdjunta: null,
  notasAdicionales: 'Solo pruebas técnicas',
  areaDisponible: '100'
});

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files, type } = e.target;
    if (type === "file") {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleNext = () => {
    if (step === 1) setStep(2);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
  };

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formToSend.append(key, value);
    });

    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/calcular-proyecto`, {
      method: 'POST',
      body: formToSend
    });

    const data = await response.json();
    setLoading(false);

    // 🔁 Aquí rediriges y pasas los resultados a la nueva página
    navigate('/resultado', { state: { resultado: data } });
  };

  return (
    <div className="page-bg">
      <div className="overlay">
        <div className="form-container">
          <img src={logo} alt="Logo WattsPower" style={{ width: '200px', display: 'block', margin: '80px auto 1rem' }} />
          
          <h1 className="title">Cotiza tu Proyecto Solar:</h1>
          <div className="step-indicator">
            <div className={`step ${step === 1 ? 'active' : ''}`}>1. Datos</div>
            <div className={`step ${step === 2 ? 'active' : ''}`}>2. Cotización</div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <h2>¡Háblanos de ti! Queremos conocerte</h2>
                <input name="nombre" placeholder="Nombre completo" className="input" onChange={handleChange} required />
                <input name="correo" type="email" placeholder="Correo electrónico" className="input" onChange={handleChange} required />
                <input name="telefono" type="tel" placeholder="Número de contacto" className="input" onChange={handleChange} required />
                <input name="ubicacion" placeholder="En dónde tienes pensado el proyecto" className="input" onChange={handleChange} required />

                <input name="consumoKwh" placeholder="¿Conoces cuanto es tu consumo kWh/mes?" className="input" onChange={handleChange} required />
                <input name="costoKwh" placeholder="¿Conoces cual es el costo kWh/mes?" className="input" onChange={handleChange} required />
                <input name="valorMensual" type="number" placeholder="¿Cuánto pagas de energía promedio al mes?" className="input" onChange={handleChange} required />
                <input name="areaDisponible" type="number" placeholder="Area disponible para colocar los paneles" className="input" onChange={handleChange} required />

                <select name="preferenciaContacto" className="input" onChange={handleChange} required>
                  <option value="">¿Cómo prefieres ser contactado?</option>
                  <option value="Llamada">Llamada</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>

                <select name="tipoSolicitud" className="input" onChange={handleChange} required>
                  <option value="">¿Tu solicitud es para?</option>
                  <option value="Hogar">Hogar</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Empresa">Empresa</option>
                  <option value="Gran Escala">Gran Escala (Más de 5 MW)</option>
                </select>
              </>
            )}

            {step === 2 && (
              <>
                <h2>¡Diligencia los detalles de tu cotización!</h2>

                <select name="tipoTecho" className="input" onChange={handleChange} required>
                  <option value="">Tipo de techo</option>
                  <option>Standing Seam</option>
                  <option>Termoacústica</option>
                  <option>Teja de barro</option>
                  <option>Manto Asfáltico</option>
                  <option>Teja Eternit</option>
                  <option>Madera</option>
                  <option>Zinc</option>
                </select>

                <label className="label">¿Recibe factura de energía?</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="recibeFactura"
                      value="Sí"
                      checked={formData.recibeFactura === "Sí"}
                      onChange={handleChange}
                    />
                    Sí
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="recibeFactura"
                      value="No"
                      checked={formData.recibeFactura === "No"}
                      onChange={handleChange}
                    />
                    No
                  </label>
                </div>

                <select name="sistemaInteres" className="input" onChange={handleChange}>
                  <option value="">Sistema de interés</option>
                  <option>Interconectado</option>
                  <option>Aislado</option>
                  <option>Híbrido</option>
                </select>

                <select name="conociste" className="input" onChange={handleChange}>
                  <option value="">¿Cómo nos conociste?</option>
                  <option>Periódicos</option>
                  <option>Radio</option>
                  <option>Televisión</option>
                  <option>Referido</option>
                  <option>Email</option>
                  <option>Facebook</option>
                  <option>Instagram</option>
                  <option>LinkedIn</option>
                  <option>Búsqueda de Google</option>
                  <option>Ferias/Eventos</option>
                  <option>WhatsApp</option>
                </select>

                <label className="label">Adjunta una foto de tu factura:</label>
                <input type="file" name="facturaAdjunta" className="input" onChange={handleChange} />

                <textarea name="notasAdicionales" placeholder="¿Debemos saber algo más de tu proyecto solar?" className="input" onChange={handleChange} />
              </>
            )}

            <div className="form-actions">
              {step === 2 && (
                <button type="button" className="button-secondary" onClick={handleBack}>
                  Atrás
                </button>
              )}
              {step === 1 ? (
                <button type="button" className="button" onClick={handleNext}>
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="button" disabled={loading}>
                  {loading ? 'Calculando...' : 'Calcular'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
