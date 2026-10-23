import { useEffect, useState } from "react";
import { HERO_VIDEO_PLACEHOLDER } from "./heroVideoPlaceholder";

// Video de dron de proyectos reales: el mismo del banner de la página web.
// Mismas reglas que allá para no frenar la carga:
// - Se pide después del evento `load`, cuando el navegador está libre.
// - No se carga con movimiento reducido, ahorro de datos ni conexión 2G/3G.
// - En pantallas pequeñas usa la versión de 640 px.
// Mientras llega (o si no se carga) se ve una miniatura borrosa de <1 KB.
export default function VideoFondo() {
  const [base, setBase] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const conn = navigator.connection;
    if (conn?.saveData || /(^|-)(2g|3g)$/.test(conn?.effectiveType ?? "")) return;

    // Safari no tiene requestIdleCallback: ahí se espera 1,5 s después del load.
    const hasIdle = typeof window.requestIdleCallback === "function";
    let handle;
    const elegir = () => setBase(window.innerWidth < 768 ? "/videos/hero-loop-sm" : "/videos/hero-loop");
    const start = () => {
      handle = hasIdle ? window.requestIdleCallback(elegir, { timeout: 3000 }) : window.setTimeout(elegir, 1500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (handle === undefined) return;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return (
    <div className="login-video" aria-hidden="true">
      <div className="login-video__placeholder" style={{ backgroundImage: `url(${HERO_VIDEO_PLACEHOLDER})` }} />
      {base && (
        <video
          className={`login-video__media${listo ? " is-ready" : ""}`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          onPlaying={() => setListo(true)}
        >
          <source src={`${process.env.PUBLIC_URL}${base}.webm`} type="video/webm" />
          <source src={`${process.env.PUBLIC_URL}${base}.mp4`} type="video/mp4" />
        </video>
      )}
      <div className="login-video__veil" />
    </div>
  );
}
