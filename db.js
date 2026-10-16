/* =====================================================================
   AMIGÓ 360 · Capa de datos compartida (DEMO)
   ---------------------------------------------------------------------
   Ambos portales (Solicitante y Dirección Financiera) leen y escriben
   en el localStorage del navegador. Así, si se abren en dos pestañas
   del MISMO navegador, se comunican en tiempo real.
   En producción esto se reemplaza por una base de datos + API (servidor).
   ===================================================================== */

const DB_KEY = "amigo360_db_v3";

/* ---------- Centros de costo con presupuesto anual (datos de ejemplo) ---------- */
const CENTROS = {
  "APT-ING": { nombre: "Ingeniería de Sistemas",                    sede: "Apartadó", presupuesto: 45000000,  ejecutado: 0 },
  "APT-PSI": { nombre: "Psicología",                                sede: "Apartadó", presupuesto: 32000000,  ejecutado: 0 },
  "APT-ADM": { nombre: "Administración de Empresas",                sede: "Apartadó", presupuesto: 38000000,  ejecutado: 0 },
  "APT-LLE": { nombre: "Licenciatura en Lenguas Extranjeras",       sede: "Apartadó", presupuesto: 28000000,  ejecutado: 0 },
  "APT-BIE": { nombre: "Bienestar Universitario",                  sede: "Apartadó", presupuesto: 22000000,  ejecutado: 0 },
  "MED-INV": { nombre: "Dirección de Investigaciones",             sede: "Medellín", presupuesto: 120000000, ejecutado: 0 },
  "MED-EXT": { nombre: "Dirección de Extensión",                   sede: "Medellín", presupuesto: 80000000,  ejecutado: 0 },
  "MED-INT": { nombre: "Dirección de Internacionalización",        sede: "Medellín", presupuesto: 50000000,  ejecutado: 0 },
};

/* ---------- Estados del trámite ---------- */
const ESTADOS = {
  radicada:   { fin: "Nueva · Por revisar",      est: "Radicada · En espera de revisión", cls: "st-rad",  paso: 1 },
  info:       { fin: "Esperando al solicitante", est: "Requiere tu respuesta",            cls: "st-info", paso: 1 },
  revision:   { fin: "Presupuesto aprobado",     est: "Presupuesto aprobado",             cls: "st-rev",  paso: 2 },
  cotizacion: { fin: "En cotización",            est: "En cotización con proveedores",    cls: "st-cot",  paso: 3 },
  orden:      { fin: "Orden emitida",            est: "Orden de compra emitida",          cls: "st-ok",   paso: 4 },
  rechazada:  { fin: "Rechazada",                est: "Rechazada",                        cls: "st-no",   paso: 0 },
};

/* ---------- Plantillas: Luz Marly NO redacta, solo elige ---------- */
const PLANTILLAS_INFO = {
  rut:           "Adjunta el RUT actualizado del proveedor.",
  cotizacion:    "Adjunta al menos una cotización formal del proveedor (con NIT, valor y vigencia).",
  justificacion: "Amplía la justificación: ¿para qué actividad académica o institucional se usará y cuántas personas se benefician?",
  aval:          "Adjunta el visto bueno (aval) del decano o jefe de tu unidad.",
  bancaria:      "Adjunta la certificación bancaria del proveedor para poder realizar el pago.",
};
const MOTIVOS_RECHAZO = {
  saldo:     "El centro de costo no tiene saldo presupuestal suficiente en este periodo.",
  politica:  "La solicitud no cumple la política institucional de adquisiciones.",
  duplicada: "Ya existe una solicitud igual en trámite.",
  noinst:    "La necesidad no corresponde a un gasto institucional.",
};
const PROVEEDORES = [
  "Software de Colombia Ltda. (Medellín)",
  "Sistemas Urabá S.A.S. (Apartadó)",
  "Papelería y Suministros del Darién (Apartadó)",
  "Logística Antioquia Eventos S.A.S. (Medellín)",
  "Transportes Golfo de Urabá S.A.S. (Apartadó)",
];

const CATEGORIAS = {
  financiera:    { id: "financiera",    nombre: "Compras y Contratación",         encargado: "Luz Marly Alzate Grajales",       badge: "st-rad",  icono: "🛒" },
  internacional: { id: "internacional", nombre: "Movilidad e Internacionalización", encargado: "Santiago Hernández Trejos",       badge: "st-cot",  icono: "🌍" },
  extension:     { id: "extension",     nombre: "Banco de Proyectos de Extensión", encargado: "Dirección de Extensión",          badge: "st-rev",  icono: "📁" },
  investigacion: { id: "investigacion", nombre: "Semilleros e Investigación",     encargado: "Nataly Restrepo Restrepo",        badge: "st-info", icono: "🔬" },
};

const DIRECTOR_ACCOUNTS = {
  "luz.alzate@amigo.edu.co":         { pass: "Financiera2026", rol: "Directora Financiera",           nombre: "Luz Marly Alzate Grajales",     portal: "financiera.html",          cat: "financiera" },
  "santiago.hernandez@amigo.edu.co": { pass: "Inter2026",      rol: "Director de Internacionalización", nombre: "Santiago Hernández Trejos",   portal: "internacionalizacion.html", cat: "internacional" },
  "extension@amigo.edu.co":          { pass: "Extension2026",  rol: "Dirección de Extensión",          nombre: "Dirección de Extensión",        portal: "extension.html",           cat: "extension" },
  "nataly.restrepo@amigo.edu.co":    { pass: "Investiga2026",  rol: "Directora de Investigaciones",     nombre: "Nataly Restrepo Restrepo",      portal: "investigaciones.html",     cat: "investigacion" },
  "mauricio.rector@amigo.edu.co":    { pass: "Rectoria2026",   rol: "Padre Rector",                    nombre: "P. Mauricio",                   portal: "financiera.html#rec",      cat: "rectoria" },
};

/* ---------- Utilidades ---------- */
const fmt   = n => "$" + Number(n || 0).toLocaleString("es-CO");
const solId = id => "SOL-" + String(id).padStart(4, "0");
const esc   = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = ts => new Date(ts).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/* ---------- Datos iniciales de ejemplo ---------- */
function seed() {
  const now = Date.now(), h = 3600e3;
  const S = (id, horas, cat, sol, cc, tipo, desc, cant, valor, just, estado, hist, extra = {}) => ({
    id, creada: now - horas * h, actualizada: now - horas * h + h,
    categoria: cat || "financiera",
    solicitante: sol, cc, tipo, descripcion: desc, cantidad: cant, valor, justificacion: just,
    proveedorSugerido: "", adjuntos: [], estado, estadoPrevio: null, oc: null,
    historial: hist, noLeidoFin: false, noLeidoEst: false, ...extra,
  });
  const sis = (ts, t) => ({ ts, autor: "sistema", texto: t });
  const fin = (ts, t) => ({ ts, autor: "financiera", texto: t });

  return {
    version: now,
    nextId: 106,
    solicitudes: [
      S(100, 360, "financiera", { nombre: "Jorge Cuesta", codigo: "E-2023118", rol: "Estudiante", sede: "Apartadó", unidad: "Bienestar Universitario" },
        "APT-BIE", "Compra de bien", "Dotación de implementos deportivos y juegos de mesa (Bienestar)", 1, 15600000,
        "Dotación semestral de implementos deportivos y mesas de tenis para la sede Apartadó.", "orden",
        [sis(now - 360 * h, "Solicitud radicada desde el portal institucional por Jorge Cuesta."),
         fin(now - 300 * h, "Tu solicitud fue revisada. La Dirección Financiera validó y reservó el presupuesto en el centro de costo APT-BIE (Bienestar Universitario)."),
         fin(now - 200 * h, "Tu solicitud está en cotización con proveedores autorizados de la región de Urabá."),
         fin(now - 100 * h, "Se emitió la Orden de Compra OC-2026-0042 firmada digitalmente por la Dirección Financiera (Luz Marly Alzate). Proveedor: Deportes y Dotaciones de Urabá S.A.S. Valor: $15.600.000 COP. Bienes recibidos a satisfacción.")],
        { oc: { numero: "OC-2026-0042", proveedor: "Deportes y Dotaciones de Urabá S.A.S.", valor: 15600000, fecha: now - 100 * h } }),
      S(102, 26, "extension", { nombre: "Carlos Mejía", codigo: "A-10422", rol: "Administrativo", sede: "Apartadó", unidad: "Dirección de Extensión" },
        "MED-EXT", "Iniciativa de Extensión", "Diplomado en Gerencia Logística y Portuaria para Urabá", 1, 6500000,
        "Diplomado ofertado en alianza con empresas del sector portuario de Urabá.", "revision",
        [sis(now - 26 * h, "Propuesta radicada en el Banco de Proyectos."),
         fin(now - 6 * h, "Evaluación de pertinencia social aprobada por Extensión.")]),
      S(103, 12, "internacional", { nombre: "Sophie Miller", codigo: "INT-8821", rol: "Estudiante", sede: "Apartadó", unidad: "Facultad de Ingenierías" },
        "APT-ING", "Acompañamiento Psicológico (Movilidad)", "Acompañamiento por adaptación cultural en Apartadó", 1, 0,
        "Estudiante foránea de intercambio en Apartadó solicitando apoyo ante choque cultural y clima.", "radicada",
        [sis(now - 12 * h, "Solicitud de apoyo emocional radicada."),
         fin(now - 8 * h, "Dirección de Internacionalización y Psicología revisando caso.")], { noLeidoFin: true })
    ],
  };
}

/* ---------- Lectura / escritura (Híbrida: Servidor + LocalStorage) ---------- */
window.__lastVersion = 0;
const IS_SERVER_MODE = window.location.protocol.startsWith("http");

if (IS_SERVER_MODE) {
  fetch("/api/db", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      if (data && Array.isArray(data.solicitudes)) {
        window.__lastVersion = data.version;
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        if (typeof window.__onExternalDbChange === "function") {
          window.__onExternalDbChange();
        }
      } else {
        const d = dbLoad();
        fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d)
        }).catch(() => {});
      }
    })
    .catch(() => {});

  setInterval(() => {
    fetch("/api/db", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (data && data.version && data.version !== window.__lastVersion) {
          window.__lastVersion = data.version;
          localStorage.setItem(DB_KEY, JSON.stringify(data));
          if (typeof window.__onExternalDbChange === "function") {
            window.__onExternalDbChange();
          }
        }
      })
      .catch(() => {});
  }, 800);
}

function dbLoad() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { }
  if (!d || !Array.isArray(d.solicitudes)) { d = seed(); dbSave(d); }
  if (d && Array.isArray(d.solicitudes) && d.solicitudes.some(x => x.id === 104)) {
    d.solicitudes = d.solicitudes.filter(x => x.id !== 104);
    dbSave(d);
  }
  return d;
}

function dbSave(d) {
  d.version = Date.now() + Math.random();
  window.__lastVersion = d.version;
  localStorage.setItem(DB_KEY, JSON.stringify(d));
  if (IS_SERVER_MODE) {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d)
    }).catch(() => {});
  }
}

function dbUpdate(fn) { const d = dbLoad(); fn(d); dbSave(d); return d; }
function dbReset() { localStorage.removeItem(DB_KEY); const d = dbLoad(); return d; }

/* Escucha cambios hechos desde OTRA pestaña o dispositivo */
function onDbChange(cb) {
  window.__onExternalDbChange = cb;
  window.addEventListener("storage", e => {
    if (e.key === DB_KEY) {
      try { window.__lastVersion = JSON.parse(e.newValue).version; } catch (x) { }
      cb();
    }
  });
  setInterval(() => {
    try {
      const v = JSON.parse(localStorage.getItem(DB_KEY))?.version;
      if (v && v !== window.__lastVersion) { window.__lastVersion = v; cb(); }
    } catch (e) { }
  }, 1200);
}

/* ---------- Presupuesto ---------- */
function ejecutado(d, cc, excluirId) {
  return d.solicitudes
    .filter(s => s.cc === cc && s.id !== excluirId && s.estado === "orden")
    .reduce((t, s) => t + (s.oc ? s.oc.valor : s.valor), 0);
}
function reservado(d, cc, excluirId) {
  return d.solicitudes
    .filter(s => s.cc === cc && s.id !== excluirId && ["revision", "cotizacion"].includes(s.estado))
    .reduce((t, s) => t + (s.oc ? s.oc.valor : s.valor), 0);
}
function infoPresupuesto(d, s) {
  const c = { ...(CENTROS[s.cc] || { nombre: s.cc, presupuesto: 0, ejecutado: 0 }) };
  const ej = ejecutado(d, s.cc, s.id);
  const res = reservado(d, s.cc, s.id);
  c.ejecutado = ej;
  const saldo = c.presupuesto - ej - res;
  return { centro: c, ejecutado: ej, reservadoOtras: res, saldo, saldoDespues: saldo - s.valor, alcanza: saldo >= s.valor };
}

/* ---------- Operaciones del SOLICITANTE ---------- */
function crearSolicitud(datos) {
  let id;
  dbUpdate(d => {
    id = d.nextId++;
    const now = Date.now();
    const cat = datos.categoria || "financiera";
    const dest = CATEGORIAS[cat]?.encargado || "Dirección de Área";
    d.solicitudes.push({
      id, creada: now, actualizada: now, ...datos,
      categoria: cat,
      estado: "radicada", estadoPrevio: null, oc: null,
      historial: [{ ts: now, autor: "sistema", texto: `Solicitud radicada desde el portal. Enviada en tiempo real a: ${dest}.` }],
      noLeidoFin: true, noLeidoEst: false,
    });
  });
  return id;
}
function responderSolicitante(id, texto, adjuntos) {
  dbUpdate(d => {
    const s = d.solicitudes.find(x => x.id === id); if (!s) return;
    const now = Date.now();
    s.historial.push({ ts: now, autor: "solicitante", texto, adjuntos });
    if (adjuntos && adjuntos.length) s.adjuntos.push(...adjuntos);
    if (s.estado === "info") { s.estado = s.estadoPrevio || "radicada"; s.estadoPrevio = null; }
    s.respuestaNueva = true;
    s.noLeidoFin = true; s.actualizada = now;
  });
}

/* ---------- Operaciones de la DIRECCIÓN FINANCIERA ---------- */
function accionFinanciera(id, accion, opts = {}) {
  dbUpdate(d => {
    const s = d.solicitudes.find(x => x.id === id); if (!s) return;
    const now = Date.now();
    let auto = "";
    switch (accion) {
      case "aprobar":
        s.estado = "revision";
        auto = `Tu solicitud fue revisada. La Dirección Financiera validó y reservó el presupuesto en el centro de costo ${s.cc} (${CENTROS[s.cc]?.nombre || ""}). Siguiente paso: cotización.`;
        break;
      case "info":
        if (s.estado !== "info") s.estadoPrevio = s.estado;
        s.estado = "info";
        auto = "Para continuar con tu trámite necesitamos lo siguiente: " + (PLANTILLAS_INFO[opts.plantilla] || "información adicional.") + " Respóndenos desde este mismo portal.";
        break;
      case "cotizar":
        s.estado = "cotizacion";
        auto = "Tu solicitud está en cotización con proveedores. Te avisaremos apenas se emita la orden de compra.";
        break;
      case "orden": {
        s.estado = "orden";
        const num = "OC-2026-" + String(400 + s.id).padStart(4, "0");
        s.oc = { numero: num, proveedor: opts.proveedor || PROVEEDORES[0], valor: Number(opts.valor) || s.valor, fecha: now };
        const dias = ((now - s.creada) / 86400e3);
        auto = `Se emitió la Orden de Compra ${num} firmada digitalmente por la Dirección Financiera. Proveedor: ${s.oc.proveedor}. Valor: ${fmt(s.oc.valor)}. Tiempo total del trámite: ${dias < 1 ? "menos de 1 día" : dias.toFixed(1) + " días"}.`;
        break;
      }
      case "rechazar":
        s.estado = "rechazada";
        auto = "Tu solicitud no fue aprobada. Motivo: " + (MOTIVOS_RECHAZO[opts.motivo] || "No especificado.");
        break;
      case "nota":
        break;
    }
    if (auto) s.historial.push({ ts: now, autor: "financiera", texto: auto, auto: true });
    if (opts.nota && opts.nota.trim()) s.historial.push({ ts: now + 1, autor: "financiera", texto: opts.nota.trim() });
    s.respuestaNueva = false;
    s.noLeidoEst = true; s.noLeidoFin = false; s.actualizada = now;
  });
}

/* ---------- Orden de compra imprimible ---------- */
function ocHTML(s) {
  if (!s.oc) return "";
  const c = CENTROS[s.cc] || {};
  return `
  <div class="oc">
    <div class="oc-top">
      <div><div class="oc-uni">UNIVERSIDAD CATÓLICA LUIS AMIGÓ</div><div class="muted">NIT 890.985.101-1 · Dirección Financiera</div></div>
      <div class="oc-num"><small>ORDEN DE COMPRA</small><b>${esc(s.oc.numero)}</b><small>${fecha(s.oc.fecha)}</small></div>
    </div>
    <table class="oc-t">
      <tr><th>Proveedor adjudicado</th><td>${esc(s.oc.proveedor)}</td></tr>
      <tr><th>Solicitud origen</th><td>${solId(s.id)} · ${esc(s.solicitante.nombre)} (${esc(s.solicitante.rol)})</td></tr>
      <tr><th>Sede / Unidad beneficiaria</th><td>${esc(c.sede || s.solicitante.sede)} · ${esc(c.nombre || s.solicitante.unidad)}</td></tr>
      <tr><th>Concepto</th><td>${esc(s.descripcion)} · Cantidad: ${esc(s.cantidad)}</td></tr>
      <tr><th>Centro de costo</th><td>${esc(s.cc)}</td></tr>
      <tr><th>Valor total autorizado</th><td><b>${fmt(s.oc.valor)} COP</b></td></tr>
    </table>
    <div class="oc-firma">
      <div class="sello">✓ FIRMADO DIGITALMENTE</div>
      <div><b>Luz Marly Alzate Grajales</b><br><span class="muted">Directora Financiera</span></div>
    </div>
    <p class="muted" style="font-size:11px;margin-top:10px">Documento generado automáticamente por la Plataforma Amigó 360 (demostración).</p>
  </div>`;
}

/* ---------- UI compartida ---------- */
function toast(msg, tipo = "") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.className = "toast show " + tipo; t.innerHTML = msg;
  clearTimeout(t._h); t._h = setTimeout(() => t.className = "toast", 3500);
}
function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination); o.frequency.value = f;
      const t0 = a.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      o.start(t0); o.stop(t0 + 0.3);
    });
  } catch (e) { }
}
function abrirOC(s) {
  let m = document.getElementById("ocModal");
  if (!m) {
    m = document.createElement("div"); m.id = "ocModal"; m.className = "modal-bg";
    m.innerHTML = `<div class="modal"><div id="ocBody"></div>
      <div class="modal-actions no-print"><button class="btn ghost" onclick="cerrarOC()">Cerrar</button>
      <button class="btn primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div></div>`;
    m.addEventListener("click", e => { if (e.target === m) cerrarOC(); });
    document.body.appendChild(m);
  }
  document.getElementById("ocBody").innerHTML = ocHTML(s);
  m.classList.add("show"); document.body.classList.add("printing-oc");
}
function cerrarOC() { document.getElementById("ocModal")?.classList.remove("show"); document.body.classList.remove("printing-oc"); }

function leerArchivos(input) {
  return Array.from(input?.files || []).map(f => ({ nombre: f.name, tam: Math.max(1, Math.round(f.size / 1024)) + " KB" }));
}

/* =====================================================================
   AMIGÓ 360 · INTEGRACIÓN DE GOOGLE GEMINI AI
   ===================================================================== */
function getGeminiKey() {
  return localStorage.getItem("amigo_gemini_key") || "";
}

function setGeminiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem("amigo_gemini_key", key.trim());
  } else {
    localStorage.removeItem("amigo_gemini_key");
  }
}

async function callGeminiRaw(userPrompt, systemInstruction = "") {
  const key = getGeminiKey();
  if (!key) return null;

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
  const payload = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.65, maxOutputTokens: 600 }
  };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      }
    } catch (e) {
      console.warn("Fallo temporal con modelo", model, e);
    }
  }
  return null;
}

/* Gemini para el Solicitante: Redactar Justificación Técnica Impecable */
async function geminiMejorarJustificacion(tipo, desc, borrador, unidad, sede) {
  const prompt = `Actúa como asesor experto en compras universitarias de la Universidad Católica Luis Amigó (Sede ${sede || "Apartadó"}).
El solicitante pertenece a: ${unidad || "Facultad de Ingenierías"}.
Tipo de solicitud: ${tipo}.
Descripción del bien o servicio: ${desc}.
Borrador de justificación del solicitante: "${borrador || "Uso para clases y prácticas del semestre"}".

Genera una justificación técnica, académica y presupuestal formal, sólida y convincente (1 párrafo de 4 a 6 líneas), explicando:
1. El impacto en la calidad académica o bienestar.
2. La población beneficiaria en la sede.
3. La pertinencia institucional.
Entrega SOLO el texto de la justificación mejorada, sin introducciones ni comillas.`;

  const res = await callGeminiRaw(prompt, "Eres redactor técnico de compras de la Universidad Católica Luis Amigó.");
  if (res) return res;

  // Fallback inteligente offline si no hay API Key:
  return `La adquisición de ${desc} resulta indispensable para fortalecer las actividades académicas y prácticas formativas de ${unidad} en la sede ${sede || "Apartadó"}. Esta compra impacta directamente los resultados de aprendizaje del semestre, garantizando los estándares de calidad institucional y beneficiando activamente a la comunidad estudiantil y docente en sus compromisos curriculares.`;
}

/* Gemini para Luz Marly: Dictamen Financiero Ejecutivo en 1 clic */
async function geminiDictamenFinanciero(s, centro, saldo) {
  const prompt = `Actúa como Copiloto Financiero de la Dirección Financiera de la Universidad Católica Luis Amigó.
Directora: Luz Marly Alzate Grajales.
Datos de la solicitud a evaluar:
- Radicado: ${solId(s.id)}
- Solicitante: ${s.solicitante.nombre} (${s.solicitante.rol}) - Sede ${s.solicitante.sede}
- Unidad: ${s.solicitante.unidad} (Centro de Costos: ${s.cc})
- Concepto: ${s.descripcion} (Cantidad: ${s.cantidad})
- Valor solicitado: ${fmt(s.valor)} COP
- Presupuesto Anual del centro: ${fmt(centro.presupuesto)} COP
- Saldo Disponible actual: ${fmt(saldo)} COP
- Justificación presentada: "${s.justificacion}"

Genera un dictamen financiero ejecutivo conciso (máximo 4 líneas con viñetas) que contenga:
1. Viabilidad presupuestal (porcentaje que representa sobre el saldo disponible).
2. Pertinencia del gasto para la sede.
3. Recomendación clara para Luz Marly (Aprobar presupuesto, Solicitar cotización o Ajustar).`;

  const res = await callGeminiRaw(prompt, "Eres el analista financiero experto de la Universidad Católica Luis Amigó.");
  if (res) return res;

  // Fallback inteligente offline:
  const pct = centro.presupuesto ? ((s.valor / centro.presupuesto) * 100).toFixed(1) : "0";
  const alcanza = saldo >= s.valor;
  return `• Viabilidad: ${alcanza ? "Favorable" : "Desfavorable"}. El valor solicitado representa el ${pct}% del presupuesto anual de ${centro.nombre}.\n• Cobertura: El saldo disponible (${fmt(saldo)}) ${alcanza ? "cubre con holgura la necesidad sin comprometer gastos futuros" : "es insuficiente para cubrir este monto"}.\n• Dictamen: ${alcanza ? "Recomendado continuar con aprobación y cuadro comparativo de cotizaciones." : "Recomendar ajuste de cantidad o verificar adición presupuestal."}`;
}

/* Gemini para Luz Marly: Redactar nota formal al solicitante */
async function geminiRedactarNota(s, motivo) {
  const prompt = `Redacta un mensaje institucional formal y amable (máximo 3 líneas) de parte de Luz Marly Alzate Grajales (Directora Financiera) dirigido a ${s.solicitante.nombre} sobre la solicitud ${solId(s.id)} (${s.descripcion}).
Motivo del mensaje: "${motivo}".
Firma como: Dirección Financiera · Universidad Católica Luis Amigó.`;

  const res = await callGeminiRaw(prompt);
  if (res) return res;

  return `Estimado(a) ${s.solicitante.nombre}: Para dar continuidad a su solicitud ${solId(s.id)}, le solicitamos amablemente ${motivo}. Agradecemos su pronta respuesta desde este portal.\nAtentamente,\nDirección Financiera · Universidad Católica Luis Amigó`;
}

/* Modal universal de configuración de Gemini */
function abrirConfigGemini() {
  let m = document.getElementById("geminiModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "geminiModal";
    m.className = "modal-bg";
    m.innerHTML = `
      <div class="modal" style="max-width:460px">
        <h3 style="color:var(--azul);font-size:18px;margin-bottom:8px">✨ Conectar Google Gemini AI</h3>
        <p style="font-size:13px;color:var(--gris);margin-bottom:14px;line-height:1.5">
          Ingresa tu clave de API de Gemini para habilitar el copiloto con Inteligencia Artificial real tanto para los solicitantes como para la Dirección Financiera.
        </p>
        <div class="field">
          <label>API Key de Google Gemini</label>
          <input type="password" id="gKeyInput" placeholder="AIzaSy..." value="${esc(getGeminiKey())}" autocomplete="off">
          <div class="hint">Gratis en <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--azul2);font-weight:600">Google AI Studio</a>. Se guarda localmente en tu navegador.</div>
        </div>
        <div class="modal-actions" style="margin-top:14px">
          <button class="btn ghost" onclick="cerrarConfigGemini()">Cancelar</button>
          <button class="btn red" onclick="setGeminiKey(''); cerrarConfigGemini(); toast('Clave de Gemini removida.'); location.reload();">Quitar</button>
          <button class="btn primary" onclick="guardarConfigGemini()">Guardar y Activar</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  } else {
    document.getElementById("gKeyInput").value = getGeminiKey();
  }
  m.classList.add("show");
  setTimeout(() => document.getElementById("gKeyInput").focus(), 100);
}

function cerrarConfigGemini() {
  document.getElementById("geminiModal")?.classList.remove("show");
}

function guardarConfigGemini() {
  const k = document.getElementById("gKeyInput").value.trim();
  setGeminiKey(k);
  cerrarConfigGemini();
  toast(k ? "✨ Gemini AI activado con éxito en toda la plataforma." : "Modo asistido sin API Key.");
  setTimeout(() => location.reload(), 400);
}
