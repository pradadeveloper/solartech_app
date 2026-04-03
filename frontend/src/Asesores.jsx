import { useEffect, useState } from "react";
import "./dashboardAdmon.css";

const ROL_BADGE = {
  Admin:  { bg: "rgba(245,197,24,.15)", color: "#f5c518" },
  Asesor: { bg: "rgba(52,152,219,.15)", color: "#3498db" },
};

export default function Asesores() {
  const [asesores, setAsesores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/asesores`)
      .then((r) => r.json())
      .then((data) => { setAsesores(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>Asesores</h2>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
          {asesores.length} usuarios registrados en el sistema
        </p>
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
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "20px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "var(--accent)", color: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1.1rem", flexShrink: 0,
                }}>
                  {iniciales}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      {a.nombre} {a.apellido}
                    </span>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      border: `1px solid ${badge.color}`,
                      borderRadius: 20, padding: "2px 9px",
                      fontSize: "0.72rem", fontWeight: 700,
                    }}>
                      {a.rol}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                    {a.cargo}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--muted2)" }}>
                    @{a.usuario}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
