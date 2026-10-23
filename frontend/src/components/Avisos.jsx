import { useEffect, useState } from "react";

// Avisos breves en la esquina, en lugar de alert(). Uso: avisar("Texto", "error").
// Se anuncian a lectores de pantalla y se cierran solos a los 5 s.
let suscriptor = null;
let siguienteId = 1;

export function avisar(texto, tipo = "info") {
  if (suscriptor) suscriptor({ id: siguienteId++, texto, tipo });
}

export default function Avisos() {
  const [lista, setLista] = useState([]);

  useEffect(() => {
    suscriptor = (aviso) => {
      setLista((l) => [...l.slice(-2), aviso]);
      setTimeout(() => setLista((l) => l.filter((a) => a.id !== aviso.id)), 5000);
    };
    return () => { suscriptor = null; };
  }, []);

  return (
    <div className="avisos" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`aviso${a.tipo === "error" ? " aviso--error" : ""}`}>
          <span className="aviso__texto">{a.texto}</span>
          <button
            type="button"
            className="aviso__cerrar"
            aria-label="Cerrar aviso"
            onClick={() => setLista((l) => l.filter((x) => x.id !== a.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
