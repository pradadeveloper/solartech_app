import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './assets/logo_solartech.webp';
import './login.css';
import { supabase, guardarPerfil, cerrarSesion } from './supabase';
import VideoFondo from './components/VideoFondo';

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
      const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: usuario.trim(),
        password,
      });
      if (authError) {
        setError('Correo o contraseña incorrectos');
        return;
      }

      // Perfil del asesor (nombre, cargo, rol) desde la tabla staff
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${auth.session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        await cerrarSesion();
        setError('Tu usuario no está habilitado como asesor. Contacta al administrador.');
        return;
      }

      localStorage.setItem('token', auth.session.access_token);
      guardarPerfil(data);
      navigate('/');
    } catch (err) {
      setError('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <VideoFondo />
      <div className="login-card">
        <img src={logo} alt="Logo Solartech" className="login-logo" />
        <h1 className="login-title">Bienvenido</h1>
        <p className="login-subtitle">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-correo">Correo</label>
            <input
              id="login-correo"
              className="login-input"
              type="email"
              placeholder="Ej: asesor@solartech.com.co"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="login-footer">Solartech Energy S.A.S &nbsp;·&nbsp; v1.0</p>
      </div>
    </div>
  );
}
