import React, { useState, useRef, useEffect, useCallback } from "react";
import "./agenteIA.css";

const API = process.env.REACT_APP_API_URL;

const SUGERENCIAS = [
  "¿Cuánto he cotizado en total y cuál es mi ticket promedio?",
  "¿Qué cotizaciones llevan más de 15 días sin cerrar?",
  "¿En qué ciudad tengo más demanda?",
  "Redáctame un WhatsApp de seguimiento para mi cotización más grande",
  "¿Por qué un sistema no siempre cubre el 100% del consumo?",
  "Compara mis cotizaciones cerradas contra las abiertas",
];

/* Render markdown mínimo: negritas, código, títulos, listas y tablas.
   Suficiente para lo que produce el agente, sin meter una dependencia nueva. */
function renderMarkdown(texto) {
  const bloques = [];
  const lineas = texto.split("\n");
  let i = 0;
  let key = 0;

  const inline = (s) =>
    s
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .map((parte, j) => {
        if (parte.startsWith("**") && parte.endsWith("**"))
          return <strong key={j}>{parte.slice(2, -2)}</strong>;
        if (parte.startsWith("`") && parte.endsWith("`"))
          return <code key={j} className="ia-code">{parte.slice(1, -1)}</code>;
        return parte;
      });

  while (i < lineas.length) {
    const linea = lineas[i];

    // Tabla markdown
    if (linea.includes("|") && lineas[i + 1]?.match(/^\s*\|?[\s:-]+\|/)) {
      const celdas = (l) =>
        l.split("|").map((c) => c.trim()).filter((c, idx, arr) =>
          !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === "")
        );
      const encabezado = celdas(linea);
      i += 2;
      const filas = [];
      while (i < lineas.length && lineas[i].includes("|")) {
        filas.push(celdas(lineas[i]));
        i++;
      }
      bloques.push(
        <div className="ia-tablaWrap" key={key++}>
          <table className="ia-tabla">
            <thead>
              <tr>{encabezado.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((f, j) => (
                <tr key={j}>{f.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Lista
    if (/^\s*[-*]\s+/.test(linea)) {
      const items = [];
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      bloques.push(
        <ul className="ia-lista" key={key++}>
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </ul>
      );
      continue;
    }

    // Título
    if (/^#{1,4}\s+/.test(linea)) {
      bloques.push(
        <h4 className="ia-titulo" key={key++}>
          {inline(linea.replace(/^#{1,4}\s+/, ""))}
        </h4>
      );
      i++;
      continue;
    }

    if (linea.trim() === "") {
      i++;
      continue;
    }

    bloques.push(<p className="ia-parrafo" key={key++}>{inline(linea)}</p>);
    i++;
  }

  return bloques;
}

export default function AgenteIA() {
  const [mensajes, setMensajes] = useState([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [disponible, setDisponible] = useState(null); // null = verificando
  const finRef = useRef(null);
  const abortRef = useRef(null);

  // ¿El backend tiene configurada la API key?
  useEffect(() => {
    fetch(`${API}/api/agente-ia/estado`)
      .then((r) => r.json())
      .then((d) => setDisponible(!!d.disponible))
      .catch(() => setDisponible(false));
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  const enviar = useCallback(
    async (texto) => {
      const pregunta = (texto ?? entrada).trim();
      if (!pregunta || cargando) return;

      setError(null);
      setEntrada("");
      const historial = [...mensajes, { role: "user", content: pregunta }];
      setMensajes([...historial, { role: "assistant", content: "" }]);
      setCargando(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = localStorage.getItem("token");
        const resp = await fetch(`${API}/api/agente-ia`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ mensajes: historial }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const d = await resp.json().catch(() => ({}));
          throw new Error(d.error || `Error ${resp.status}`);
        }

        // Lectura del stream SSE
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acumulado = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const partes = buffer.split("\n\n");
          buffer = partes.pop() ?? "";

          for (const parte of partes) {
            const evento = parte.match(/^event: (.+)$/m)?.[1];
            const datos = parte.match(/^data: (.+)$/m)?.[1];
            if (!evento || !datos) continue;
            const payload = JSON.parse(datos);

            if (evento === "texto") {
              acumulado += payload.texto;
              // Instantánea por iteración: el updater de setState puede ejecutarse
              // despues, y para entonces `acumulado` ya habria avanzado.
              const textoActual = acumulado;
              setMensajes((prev) => {
                const copia = [...prev];
                copia[copia.length - 1] = { role: "assistant", content: textoActual };
                return copia;
              });
            } else if (evento === "error") {
              throw new Error(payload.error);
            }
          }
        }

        // Si el stream terminó sin texto, avisamos en vez de dejar burbuja vacía
        if (!acumulado) {
          throw new Error("El agente no devolvió respuesta. Intenta de nuevo.");
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        setError(e.message);
        // Quitamos la burbuja vacía del asistente
        setMensajes((prev) => {
          const copia = [...prev];
          if (copia[copia.length - 1]?.content === "") copia.pop();
          return copia;
        });
      } finally {
        setCargando(false);
        abortRef.current = null;
      }
    },
    [entrada, mensajes, cargando]
  );

  const detener = () => abortRef.current?.abort();

  const limpiar = () => {
    setMensajes([]);
    setError(null);
  };

  if (disponible === false) {
    return (
      <div className="ia-wrap">
        <div className="ia-aviso">
          <div className="ia-avisoIcono">🔌</div>
          <h2>Agente IA sin configurar</h2>
          <p>
            Falta la variable <code>ANTHROPIC_API_KEY</code> en{" "}
            <code>backend/.env</code>. Agrégala y reinicia el servidor para
            activar el módulo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ia-wrap">
      <header className="ia-head">
        <div>
          <h1 className="ia-h1">Agente IA</h1>
          <p className="ia-sub">
            Pregunta lo que quieras sobre tus cotizaciones, dimensionamiento
            solar o cómo cerrar un cliente.
          </p>
        </div>
        {mensajes.length > 0 && (
          <button className="ia-btnGhost" onClick={limpiar} disabled={cargando}>
            Nueva conversación
          </button>
        )}
      </header>

      <div className="ia-chat">
        {mensajes.length === 0 && (
          <div className="ia-vacio">
            <div className="ia-vacioIcono">✨</div>
            <p className="ia-vacioTexto">Empieza con una de estas preguntas:</p>
            <div className="ia-sugerencias">
              {SUGERENCIAS.map((s) => (
                <button key={s} className="ia-sugerencia" onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`ia-msg ${m.role === "user" ? "ia-msg--user" : "ia-msg--bot"}`}
          >
            {m.role === "assistant" && <div className="ia-avatar">IA</div>}
            <div className="ia-burbuja">
              {m.content ? (
                renderMarkdown(m.content)
              ) : (
                <div className="ia-escribiendo">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </div>
        ))}

        {error && <div className="ia-error">⚠ {error}</div>}
        <div ref={finRef} />
      </div>

      <form
        className="ia-inputRow"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <textarea
          className="ia-input"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Escribe tu pregunta…  (Enter para enviar, Shift+Enter para salto de línea)"
          rows={1}
          disabled={cargando}
        />
        {cargando ? (
          <button type="button" className="ia-btnStop" onClick={detener}>
            Detener
          </button>
        ) : (
          <button type="submit" className="ia-btnSend" disabled={!entrada.trim()}>
            Enviar
          </button>
        )}
      </form>
    </div>
  );
}
