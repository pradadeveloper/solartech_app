import { useEffect, useRef } from "react";

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo accesible: cierra con Escape o clic en el fondo, mantiene el foco
// dentro mientras está abierto y lo devuelve al elemento que lo abrió.
// `lateral` lo muestra como panel a la derecha (ficha del lead).
export default function Dialogo({ titulo, onCerrar, lateral = false, className = "", children }) {
  const ref = useRef(null);
  // En una ref para que volver a dibujar la pantalla (p. ej. al escribir una nota)
  // no reinicie el efecto ni mueva el foco.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    const previo = document.activeElement;
    const nodo = ref.current;
    const primero = nodo?.querySelector(ENFOCABLES);
    (primero || nodo)?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); cerrarRef.current(); return; }
      if (e.key !== "Tab" || !nodo) return;
      const items = [...nodo.querySelectorAll(ENFOCABLES)];
      if (!items.length) return;
      const [ini, fin] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fin.focus(); }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); ini.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (previo && previo.focus) previo.focus();
    };
  }, []);

  return (
    <div
      className={`dialogo-fondo${lateral ? " dialogo-fondo--lateral" : ""}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarRef.current(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`dialogo${lateral ? " dialogo--lateral" : ""} ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
