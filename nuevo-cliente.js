function makeId() {
    return 'cli_' + Date.now() + Math.floor(Math.random() * 1000);
};

// =========================
// UTILIDADES DOM
// =========================
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

// =========================
// LÓGICA DE NAVEGACIÓN (TABS)
// =========================
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
  $$("[data-next-tab]", scopeEl).forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.nextTab)));
  $$("[data-prev-tab]", scopeEl).forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.prevTab)));
}

safeOnClick("#btnPersonaNatural", () => showView("#view-natural"));
safeOnClick("#btnPersonaJuridica", () => showView("#view-juridica"));
setupTabs($("#view-juridica"));
setupTabs($("#view-natural"));

const pjText = document.querySelector('textarea[name="pj_detalle_actividad"]');
const pjCount = $("#pjCount");
if(pjText && pjCount){
  const update = () => pjCount.textContent = String(pjText.value.length);
  pjText.addEventListener("input", update);
  update();
}

// =========================================================
// CEREBRO: DETECCIÓN DE MODO
// =========================================================

function getLocalSession() {
    try { return JSON.parse(localStorage.getItem('tqa_session')); } catch { return null; }
}

const session = getLocalSession();
const isLoggedStaff = session && (session.role === 'COMERCIAL' || session.role === 'ADMIN' || session.role === 'OPERATIVO');

safeOnClick("#btnVolverGeneral", (e) => {
    e.preventDefault();
    if (isLoggedStaff) {
        window.location.href = "menu.html"; 
    } else {
        window.location.href = "index.html"; 
    }
});

// =========================
// GUARDADO DE DATOS (CONECTADO A AWS)
// =========================

function makeId() { return `cli_${Date.now()}`; }

// Función principal de envío
async function enviarDatosAlServidor(cliente, tipo) {
    try {
        console.log("Enviando datos...", cliente);
        
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cliente)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Error al guardar en el servidor");
        }

        return await response.json();
    } catch (error) {
        console.error(error);
        alert("❌ Error de conexión: " + error.message);
        throw error;
    }
}

// Validar duplicados en el servidor
async function checkRucEnServidor(ruc) {
    try {
        const res = await fetch(`${API_URL}/clientes/check-ruc?ruc=${ruc}`);
        const data = await res.json();
        return data.exists; // Devuelve true o false
    } catch (e) {
        console.error("No se pudo verificar RUC", e);
        return false; // Asumimos que no existe si falla la red para no bloquear
    }
}

// =========================
// MANEJO DEL SUBMIT
// =========================

function attachSubmit(formId, tipo){
  const form = $(formId);
  if(!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!form.reportValidity()) return;

    // === CORRECCIÓN AQUÍ ===
    // Intentamos buscar el botón de varias formas para no fallar
    const btnSubmit = form.querySelector('button[type="submit"]') || form.querySelector('button');
    let originalText = "Guardar";

    // Solo intentamos cambiar el texto si el botón existe
    if (btnSubmit) {
        originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Procesando...";
    }
    // ========================

    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(k => { if(typeof data[k] === "string") data[k] = data[k].trim(); });

    // 1. Validar Duplicado en Nube
    const ruc = tipo === 'PN' ? data.pn_num_id : data.pj_ruc;
    
    try {
        const existe = await checkRucEnServidor(ruc);
        if(existe) {
            alert("⚠️ Este cliente (RUC/Cédula) ya está registrado en la base de datos.");
            if(btnSubmit) { // Restaurar botón
                btnSubmit.disabled = false;
                btnSubmit.textContent = originalText;
            }
            return;
        }

        // 2. Preparar Objeto
        const cliente = {
          id: makeId(),
          tipo, 
          data
        };

        // 3. Enviar a AWS Lambda
        await enviarDatosAlServidor(cliente, tipo);
        
        // Cache temporal
        localStorage.setItem("tqa_cliente_draft", JSON.stringify(cliente));

        alert("✅ Registro exitoso en la Nube.\n\nUsuario creado.");

        // 4. Redirección
        if (isLoggedStaff) {
            window.location.href = `finanzas-pro.html?clientId=${cliente.id}`;
        } else {
            // Auto-login simulado
            const email = tipo === 'PN' ? data.pn_email : data.pj_contacto_email;
            const name = tipo === 'PN' ? `${data.pn_nombre} ${data.pn_apellido}` : data.pj_razon_social;
            
            const newSession = {
                email: email,
                role: "CLIENTE",
                name: name,
                id: cliente.id,
                loginTime: Date.now()
            };
            localStorage.setItem('tqa_session', JSON.stringify(newSession));
            window.location.href = "finanzas-cliente.html";
        }

    } catch (error) {
        console.error(error);
        // Si falló algo, restauramos el botón para que pueda intentar de nuevo
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    }
  });
}

attachSubmit("#pjForm", "PJ");
attachSubmit("#pnForm", "PN");