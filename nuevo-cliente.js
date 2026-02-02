// =========================
// CONFIGURACIÓN API - VERIFICAR SI YA EXISTE
// =========================
if (typeof API_URL === 'undefined') {
    const API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
}

// O usar window para asegurar que sea global
window.API_URL = window.API_URL || 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';

// DEBUG: Mostrar URLs que se usarán
console.log('API URL configurada:', API_URL);
console.log('Check RUC URL:', `${API_URL}/clientes/check-ruc`);
console.log('POST Clientes URL:', `${API_URL}/clientes`);

function makeId() {
    return 'cli_' + Date.now() + Math.floor(Math.random() * 1000);
}

// =========================
// UTILIDADES DOM
// =========================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function showView(id) {
    $$(".view").forEach(v => v.classList.remove("active"));
    const el = $(id);
    if (!el) return;
    el.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function safeOnClick(id, fn) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("click", fn);
}

// =========================
// LÓGICA DE NAVEGACIÓN (TABS)
// =========================
function setupTabs(scopeEl) {
    if (!scopeEl) return;
    const tabs = $$(".tab", scopeEl);
    const panels = $$(".tabpanel", scopeEl);

    const activate = (key) => {
        tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
        panels.forEach(p => p.classList.toggle("active", p.dataset.panel === key));
        window.scrollTo({ top: 0, behavior: "smooth" });
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
if (pjText && pjCount) {
    const update = () => pjCount.textContent = String(pjText.value.length);
    pjText.addEventListener("input", update);
    update();
}

// =========================================================
// CEREBRO: DETECCIÓN DE MODO
// =========================================================

function getLocalSession() {
    try {
        return JSON.parse(localStorage.getItem('tqa_session'));
    } catch {
        return null;
    }
}

const session = getLocalSession();

// DEFINIR ROLES DE STAFF/ANALISTA
const isLoggedStaff = session && (
    session.role === 'COMERCIAL' || 
    session.role === 'ADMIN' || 
    session.role === 'OPERATIVO' ||
    session.role === 'ANALISTA'
);

// Modificado: Volver según el rol
safeOnClick("#btnVolverGeneral", (e) => {
    e.preventDefault();
    if (session && session.role === 'CLIENTE') {
        window.location.href = "finanzas-cliente.html";
    } else if (isLoggedStaff) {
        window.location.href = "menu.html"; 
    } else {
        window.location.href = "index.html"; 
    }
});

// =========================
// GUARDADO DE DATOS (CONECTADO A AWS)
// =========================

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
            if (response.status === 404) {
                throw new Error("Ruta no encontrada. Verifica la configuración de la API.");
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
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
        console.log(`Verificando RUC: ${ruc} en ${API_URL}/clientes/check-ruc?ruc=${ruc}`);

        const res = await fetch(`${API_URL}/clientes/check-ruc?ruc=${ruc}`);

        if (!res.ok) {
            console.warn(`API check-ruc respondió con status: ${res.status}`);
            return false;
        }

        const data = await res.json();
        return data.exists || false;
    } catch (e) {
        console.error("No se pudo verificar RUC", e);
        return false;
    }
}

// =========================
// MANEJO DEL SUBMIT - CON REDIRECCIÓN MEJORADA
// =========================

function attachSubmit(formId, tipo) {
    const form = $(formId);
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;

        const btnSubmit = form.querySelector('button[type="submit"]') || form.querySelector('button');
        let originalText = "Guardar";

        if (btnSubmit) {
            originalText = btnSubmit.textContent;
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Procesando...";
        }

        const data = Object.fromEntries(new FormData(form).entries());
        Object.keys(data).forEach(k => {
            if (typeof data[k] === "string") data[k] = data[k].trim();
        });

        const ruc = tipo === 'PN' ? data.pn_ruc : data.pj_ruc;

        try {
            const existe = await checkRucEnServidor(ruc);
            if (existe) {
                alert("⚠️ Este cliente (RUC/Cédula) ya está registrado en la base de datos.");
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = originalText;
                }
                return;
            }

            const cliente = {
                id: makeId(),
                tipo,
                data
            };

            console.log("Datos a enviar:", cliente);

            await enviarDatosAlServidor(cliente, tipo);

            localStorage.setItem("tqa_cliente_draft", JSON.stringify(cliente));

            alert("✅ Registro exitoso en la Nube.\n\nUsuario creado.");

            // REDIRECCIÓN MEJORADA
            const currentSession = getLocalSession();
            
            if (isLoggedStaff || (currentSession && currentSession.role !== 'CLIENTE')) {
                console.log("Redirigiendo a finanzas-pro.html (Staff/Analista)");
                window.location.href = `finanzas-pro.html?clientId=${cliente.id}`;
            } else {
                console.log("Redirigiendo a finanzas-cliente.html (Cliente)");
                
                const email = tipo === 'PN' ? data.pn_email : data.pj_contacto_email;
                const name = tipo === 'PN' ? `${data.pn_nombre} ${data.pn_apellido}` : data.pj_razon_social;
                
                const newSession = {
                    email: email,
                    role: "CLIENTE",
                    name: name,
                    id: cliente.id,
                    tipo: tipo,
                    loginTime: Date.now()
                };
                
                localStorage.setItem('tqa_session', JSON.stringify(newSession));
                window.location.href = "finanzas-cliente.html";
            }

        } catch (error) {
            console.error("Error en el submit:", error);
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = originalText;
            }
        }
    });
}

attachSubmit("#pjForm", "PJ");
attachSubmit("#pnForm", "PN");