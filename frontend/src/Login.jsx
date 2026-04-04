import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './assets/logo_solartech.webp';
import './login.css';

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
      localStorage.setItem('apellidoUsuario', data.apellido || '');
      localStorage.setItem('cargoUsuario', data.cargo || '');
      navigate('/');
    } catch (err) {
      setError('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
    } finally {
      setLoading(false);
    }
  };

  const bgStyle = {
    backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${process.env.PUBLIC_URL}/logos/casos_exito.jpg)`,
  };

  return (
    <div className="login-bg" style={bgStyle}>
      <div className="login-card">
        <img src={logo} alt="Logo Solartech" className="login-logo" />
        <h1 className="login-title">Bienvenido</h1>
        <p className="login-subtitle">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Usuario</label>
            <input
              className="login-input"
              placeholder="Ej: admin"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label">Contraseña</label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="login-footer">Solartech Energy S.A.S &nbsp;·&nbsp; v1.0</p>
      </div>
    </div>
  );
}
