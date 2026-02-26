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
          <img src={logo} alt="Logo Solartech" style={{ width: '200px', display: 'block', margin: '80px auto 1rem' }} />
          
          <h1 className="title">Escribe los datos de tu cliente:</h1>
          <div className="step-indicator">
            <div className={`step ${step === 1 ? 'active' : ''}`}>1. Datos</div>
            <div className={`step ${step === 2 ? 'active' : ''}`}>2. Cotización</div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <h2>PASO 1 DE 2:</h2>
                <input name="nombre" placeholder="Nombre completo" className="input" onChange={handleChange} required />
                <input name="correo" type="email" placeholder="Correo electrónico" className="input" onChange={handleChange} required />
                <input name="telefono" type="tel" placeholder="Número de contacto" className="input" onChange={handleChange} required />
                <input name="ubicacion" placeholder="Ubicación del proyecto" className="input" onChange={handleChange} required />

                <input name="consumoKwh" placeholder="Consumo kWh/mes" className="input" onChange={handleChange} required />
                <input name="costoKwh" placeholder="Costo kWh/mes" className="input" onChange={handleChange} required />
                <input name="valorMensual" type="number" placeholder="Valor promedio de factura de energía" className="input" onChange={handleChange} required />
                <input name="areaDisponible" type="number" placeholder="Area disponible para páneles" className="input" onChange={handleChange} required />

                <select name="preferenciaContacto" className="input" onChange={handleChange} required>
                  <option value="">Preferencias de contacto del cliente</option>
                  <option value="Llamada">Llamada</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>

                <select name="tipoSolicitud" className="input" onChange={handleChange} required>
                  <option value="">Tipo de proyecto:</option>
                  <option value="Hogar">Hogar</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Empresa">Empresa</option>
                  <option value="Gran Escala">Granja Solar</option>
                </select>
              </>
            )}

            {step === 2 && (
              <>
                <h2>PASO 2 DE 2:</h2>

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
                
                <label className="label">Sistema de Interés:</label>
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

                <label className="label">Adjunta una foto de la factura:</label>
                <input type="file" name="facturaAdjunta" className="input" onChange={handleChange} />

                <textarea name="notasAdicionales" placeholder="Notas del proyecto" className="input" onChange={handleChange} />
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
