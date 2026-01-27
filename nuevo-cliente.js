const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function showView(id){
  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $(id);
  if(!el) return;
  el.classList.add("active");
  window.scrollTo({top:0, behavior:"smooth"});
}

function safeOnClick(id, fn){
  const el = $(id);
  if(!el) return;
  el.addEventListener("click", fn);
}

/** Tabs dentro de una pantalla */
function setupTabs(scopeEl){
  if(!scopeEl) return;

  const tabs = $$(".tab", scopeEl);
  const panels = $$(".tabpanel", scopeEl);

  const activate = (key) => {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
    panels.forEach(p => p.classList.toggle("active", p.dataset.panel === key));
    window.scrollTo({top:0, behavior:"smooth"});
  };

  tabs.forEach(tab => tab.addEventListener("click", () => activate(tab.dataset.tab)));

  $$("[data-next-tab]", scopeEl).forEach(btn => {
    btn.addEventListener("click", () => activate(btn.dataset.nextTab));
  });

  $$("[data-prev-tab]", scopeEl).forEach(btn => {
    btn.addEventListener("click", () => activate(btn.dataset.prevTab));
  });
}

// =========================
// Navegación (Nuevo Cliente)
// =========================
safeOnClick("#btnPersonaNatural", () => showView("#view-natural"));
safeOnClick("#btnPersonaJuridica", () => showView("#view-juridica"));

safeOnClick("#cancelJuridica", () => showView("#view-selector"));
safeOnClick("#cancelNatural", () => showView("#view-selector"));

safeOnClick("#btnVolver", (e) => {
  e.preventDefault();
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = "index.html";
  }
});

// Tabs
setupTabs($("#view-juridica"));
setupTabs($("#view-natural"));

// Contador PJ
const pjText = document.querySelector('textarea[name="pj_detalle_actividad"]');
const pjCount = $("#pjCount");
if(pjText && pjCount){
  const update = () => pjCount.textContent = String(pjText.value.length);
  pjText.addEventListener("input", update);
  update();
}

// =========================
// Persistencia (Futuro BD)
// =========================
const CLIENT_DRAFT_KEY = "tqa_cliente_draft";

/**
 * Crea un ID local temporal (hasta que el backend devuelva el real).
 */
function makeLocalId(prefix="cli"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Guarda el "cliente" en localStorage como borrador (simula BD).
 * En el futuro: reemplazar por POST /api/clientes y guardar el id devuelto.
 */
function saveDraftClient(cliente){
  localStorage.setItem(CLIENT_DRAFT_KEY, JSON.stringify(cliente));
}

/**
 * (FUTURO) Ejemplo de cómo quedaría cuando tengas backend.
 * - Descomenta y ajusta API_BASE/endpoint cuando exista.
 */
// async function saveClientToBackend(cliente){
//   const res = await fetch(`/api/clientes`, {
//     method: "POST",
//     headers: { "Content-Type":"application/json" },
//     body: JSON.stringify(cliente)
//   });
//   const data = await res.json().catch(() => ({}));
//   if(!res.ok) throw new Error(data?.error || data?.message || "Error guardando cliente");
//   return data; // esperado: { id, ... }
// }

// Submit (PN/PJ): guardar borrador y redirigir a finanzas
function attachSubmit(formId, tipo){
  const form = $(formId);
  if(!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());

    // Normalización mínima: trim de strings
    Object.keys(data).forEach(k => {
      if(typeof data[k] === "string") data[k] = data[k].trim();
    });

    // Construye el objeto cliente “unificado”
    const cliente = {
      id: makeLocalId(),
      tipo, // "PN" o "PJ"
      creadoEn: new Date().toISOString(),
      data, // todos los campos tal cual
    };

    // ✅ Hoy: guardamos como borrador local
    saveDraftClient(cliente);

    // ✅ En el futuro: guardar en BD
    // try{
    //   const saved = await saveClientToBackend(cliente);
    //   saveDraftClient({ ...cliente, id: saved.id }); // o guardar solo el id
    // }catch(err){
    //   alert(`❌ No se pudo guardar: ${err.message}`);
    //   return;
    // }

    // ✅ Ir al HTML indicado
    window.location.href = "finanzas-pro.html";
  });
}

attachSubmit("#pjForm", "PJ");
attachSubmit("#pnForm", "PN");
