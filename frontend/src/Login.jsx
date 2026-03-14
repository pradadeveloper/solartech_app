import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './assets/logo_solartech.webp';
import './App.css';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('nombreUsuario', data.nombre);
      navigate('/');
    } catch (err) {
      setError('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg">
      <div className="overlay">
        <div className="form-container">
          <img
            src={logo}
            alt="Logo Solartech"
            style={{ width: '200px', display: 'block', margin: '80px auto 1.5rem' }}
          />
          <h1 className="title">Iniciar Sesión</h1>

          <form onSubmit={handleSubmit}>
            <input
              className="input"
              placeholder="Usuario"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              required
              autoComplete="username"
            />
            <input
              className="input"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <p style={{ color: '#e74c3c', textAlign: 'center', margin: '0.5rem 0' }}>
                {error}
              </p>
            )}

            <div className="form-actions">
              <button type="submit" className="button" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
