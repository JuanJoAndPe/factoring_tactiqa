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

// Inicializar vistas y tabs
safeOnClick("#btnPersonaNatural", () => showView("#view-natural"));
safeOnClick("#btnPersonaJuridica", () => showView("#view-juridica"));
setupTabs($("#view-juridica"));
setupTabs($("#view-natural"));

// Contador de caracteres (PJ)
const pjText = document.querySelector('textarea[name="pj_detalle_actividad"]');
const pjCount = $("#pjCount");
if(pjText && pjCount){
  const update = () => pjCount.textContent = String(pjText.value.length);
  pjText.addEventListener("input", update);
  update();
}

// =========================================================
// CEREBRO: DETECCIÓN DE MODO (COMERCIAL vs PÚBLICO)
// =========================================================

// Verificar si hay sesión activa (Comercial/Admin)
// Nota: getSession debe estar disponible desde auth.js si está importado, si no, leemos localStorage manual
function getLocalSession() {
    try { return JSON.parse(localStorage.getItem('tqa_session')); } catch { return null; }
}

const session = getLocalSession();
const isLoggedStaff = session && (session.role === 'COMERCIAL' || session.role === 'ADMIN' || session.role === 'OPERATIVO');

// Configurar botón "Volver" dinámicamente
safeOnClick("#btnVolverGeneral", (e) => {
    e.preventDefault();
    if (isLoggedStaff) {
        window.location.href = "menu.html"; // Comercial vuelve al menú
    } else {
        window.location.href = "index.html"; // Público vuelve al login
    }
});

// =========================
// GUARDADO DE DATOS
// =========================

function makeId() { return `cli_${Date.now()}_${Math.floor(Math.random()*1000)}`; }

// Registrar usuario en la "Base de Datos de Login" (tqa_local_users)
function registerLoginUser(cliente, tipo) {
    let email, password, nombre;

    if (tipo === 'PN') {
        email = cliente.data.pn_email;
        password = cliente.data.pn_num_id; // Clave inicial = Cédula
        nombre = `${cliente.data.pn_nombre} ${cliente.data.pn_apellido}`;
    } else {
        email = cliente.data.pj_contacto_email;
        password = cliente.data.pj_ruc; // Clave inicial = RUC
        nombre = cliente.data.pj_razon_social;
    }

    const newUser = {
        email: email,
        pass: password, 
        role: "CLIENTE",
        name: nombre,
        id: cliente.id,
        isLocal: true
    };

    const currentUsers = JSON.parse(localStorage.getItem('tqa_local_users') || "[]");
    // Evitar duplicados por email
    if(!currentUsers.find(u => u.email === email)) {
        currentUsers.push(newUser);
        localStorage.setItem('tqa_local_users', JSON.stringify(currentUsers));
    }
    return newUser;
}

// Registrar cliente en la "Lista Maestra de Clientes" (tactiqa_clientes)
function registerInClientList(cliente, tipo) {
    let nombreDisplay, rucDisplay;
    if (tipo === 'PN') {
        nombreDisplay = `${cliente.data.pn_nombre} ${cliente.data.pn_apellido}`;
        rucDisplay = cliente.data.pn_ruc || cliente.data.pn_num_id;
    } else {
        nombreDisplay = cliente.data.pj_razon_social;
        rucDisplay = cliente.data.pj_ruc;
    }

    const clientSummary = {
        id: cliente.id,
        nombre: nombreDisplay,
        ruc: rucDisplay,
        tipo: tipo,
        estado: "En Proceso", 
        fechaRegistro: new Date().toISOString()
    };

    const clientList = JSON.parse(localStorage.getItem('tactiqa_clientes') || "[]");
    clientList.push(clientSummary);
    localStorage.setItem('tactiqa_clientes', JSON.stringify(clientList));
}

// =========================
// MANEJO DEL SUBMIT (UNIFICADO)
// =========================

function attachSubmit(formId, tipo){
  const form = $(formId);
  if(!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    // Limpieza de espacios
    Object.keys(data).forEach(k => { if(typeof data[k] === "string") data[k] = data[k].trim(); });

    const cliente = {
      id: makeId(),
      tipo, 
      creadoEn: new Date().toISOString(),
      data
    };

    // 1. Guardar en BD local y Crear Usuario
    const newUserObj = registerLoginUser(cliente, tipo);
    registerInClientList(cliente, tipo);
    
    // Guardar borrador (legacy)
    localStorage.setItem("tqa_cliente_draft", JSON.stringify(cliente));

    // 2. LÓGICA DE REDIRECCIÓN A DOCUMENTOS
    alert("✅ Registro exitoso. A continuación podrá cargar su documentación financiera.");

    if (isLoggedStaff) {
        // CASO A: Es el Comercial registrando a otro
        // Vamos a finanzas pasando el ID del cliente en la URL
        window.location.href = `finanzas-cliente.html?clientId=${cliente.id}`;
    } else {
        // CASO B: Es el Cliente registrándose solo
        // ACCIÓN CLAVE: Auto-Login inmediato
        const newSession = {
            email: newUserObj.email,
            role: "CLIENTE",
            name: newUserObj.name,
            id: newUserObj.id,
            loginTime: Date.now()
        };
        localStorage.setItem('tqa_session', JSON.stringify(newSession));

        // Redirigir directamente (ya logueado)
        window.location.href = "finanzas-cliente.html";
    }
  });
}

attachSubmit("#pjForm", "PJ");
attachSubmit("#pnForm", "PN");