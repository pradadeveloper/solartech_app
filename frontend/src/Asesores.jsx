import { useEffect, useState } from "react";
import "./dashboardAdmon.css";

const ROL_BADGE = {
  Admin:  { bg: "rgba(245,197,24,.15)", color: "#f5c518" },
  Asesor: { bg: "rgba(52,152,219,.15)", color: "#3498db" },
};

const EMPTY_FORM = { nombre: "", apellido: "", cargo: "", usuario: "", password: "", rol: "Asesor" };

export default function Asesores() {
  const [asesores, setAsesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', data }
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const isAdmin = (() => {
    try { return JSON.parse(atob(token.split(".")[1])).usuario === "admin"; } catch { return false; }
  })();

  const cargar = () => {
    setLoading(true);
    fetch(`${process.env.REACT_APP_API_URL}/api/asesores`)
      .then((r) => r.json())
      .then((data) => { setAsesores(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(cargar, []);

  const abrirAgregar = () => {
    setForm(EMPTY_FORM);
    setError("");
    setModal({ mode: "add" });
  };

  const abrirEditar = (a) => {
    setForm({ nombre: a.nombre, apellido: a.apellido || "", cargo: a.cargo || "", usuario: a.usuario, password: "", rol: a.rol || "Asesor" });
    setError("");
    setModal({ mode: "edit", id: a.id });
  };

  const cerrar = () => { setModal(null); setError(""); };

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const guardar = async () => {
    if (!form.nombre || !form.usuario) { setError("Nombre y usuario son requeridos"); return; }
    if (modal.mode === "add" && !form.password) { setError("La contraseña es requerida"); return; }
    setSaving(true);
    setError("");
    try {
      const url = modal.mode === "add"
        ? `${process.env.REACT_APP_API_URL}/api/asesores`
        : `${process.env.REACT_APP_API_URL}/api/asesores/${modal.id}`;
      const method = modal.mode === "add" ? "POST" : "PUT";
      const body = { ...form };
      if (modal.mode === "edit" && !body.password) delete body.password;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al guardar"); return; }
      cerrar();
      cargar();
    } catch { setError("Error de red"); }
    finally { setSaving(false); }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`¿Eliminar al asesor ${a.nombre} ${a.apellido}?`)) return;
    await fetch(`${process.env.REACT_APP_API_URL}/api/asesores/${a.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    cargar();
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>Asesores</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            {asesores.length} usuarios registrados en el sistema
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={abrirAgregar}
            style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontWeight: 700, fontSize: "0.85rem",
            }}
          >
            + Agregar asesor
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 60 }}>Cargando asesores…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {asesores.map((a) => {
            const badge = ROL_BADGE[a.rol] ?? ROL_BADGE["Asesor"];
            const iniciales = `${a.nombre?.[0] ?? ""}${a.apellido?.[0] ?? ""}`.toUpperCase() || "?";
            return (
              <div
                key={a.id}
                style={{
                  background: "var(--panel)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "20px 18px",
                  display: "flex", alignItems: "center", gap: 16,
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "var(--accent)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1.1rem", flexShrink: 0,
                }}>
                  {iniciales}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{a.nombre} {a.apellido}</span>
                    <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}`, borderRadius: 20, padding: "2px 9px", fontSize: "0.72rem", fontWeight: 700 }}>
                      {a.rol}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>{a.cargo}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--muted2)" }}>@{a.usuario}</p>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => abrirEditar(a)} style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text)" }}>Editar</button>
                      {a.id !== 1 && (
                        <button onClick={() => eliminar(a)} style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 6, border: "1px solid #e74c3c", background: "transparent", cursor: "pointer", color: "#e74c3c" }}>Eliminar</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }} onClick={cerrar}>
          <div style={{ background: "var(--panel)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", color: "var(--text)" }}>{modal.mode === "add" ? "Agregar asesor" : "Editar asesor"}</h3>

            {[
              { label: "Nombre *", name: "nombre", type: "text" },
              { label: "Apellido", name: "apellido", type: "text" },
              { label: "Cargo", name: "cargo", type: "text", placeholder: "Ej: Asesor Comercial" },
              { label: "Usuario *", name: "usuario", type: "text" },
              { label: modal.mode === "edit" ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *", name: "password", type: "password" },
            ].map(({ label, name, type, placeholder }) => (
              <div key={name} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: 4 }}>{label}</label>
                <input
                  type={type} name={name} value={form[name]} onChange={handleChange} placeholder={placeholder}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem" }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: 4 }}>Rol *</label>
              <select name="rol" value={form.rol} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem" }}>
                <option value="Asesor">Asesor</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {error && <p style={{ color: "#e74c3c", fontSize: "0.82rem", margin: "0 0 12px" }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={cerrar} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text)" }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Guardando…" : modal.mode === "add" ? "Agregar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
