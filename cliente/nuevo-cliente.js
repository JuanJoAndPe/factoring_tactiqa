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
  $$("[data-next-tab]", scopeEl).forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.nextTab)));
  $$("[data-prev-tab]", scopeEl).forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.prevTab)));
}

// Navegación
safeOnClick("#btnPersonaNatural", () => showView("#view-natural"));
safeOnClick("#btnPersonaJuridica", () => showView("#view-juridica"));
safeOnClick("#cancelJuridica", () => showView("#view-selector"));
safeOnClick("#cancelNatural", () => showView("#view-selector"));

safeOnClick("#btnVolver", (e) => {
  e.preventDefault();
  window.location.href = "index.html";
});

setupTabs($("#view-juridica"));
setupTabs($("#view-natural"));

// Contador caracteres
const pjText = document.querySelector('textarea[name="pj_detalle_actividad"]');
const pjCount = $("#pjCount");
if(pjText && pjCount){
  const update = () => pjCount.textContent = String(pjText.value.length);
  pjText.addEventListener("input", update);
  update();
}

// =========================
// LÓGICA DE GUARDADO Y REGISTRO
// =========================

function registerNewUser(cliente, tipo) {
    // Extraemos credenciales basadas en el tipo
    let email, password, nombre;

    if (tipo === 'PN') {
        email = cliente.data.pn_email;
        password = cliente.data.pn_num_id; // La cédula será la clave
        nombre = `${cliente.data.pn_nombre} ${cliente.data.pn_apellido}`;
    } else {
        email = cliente.data.pj_contacto_email;
        password = cliente.data.pj_ruc; // El RUC será la clave
        nombre = cliente.data.pj_razon_social;
    }

    // Objeto de usuario compatible con auth.js
    const newUser = {
        email: email,
        pass: password, // IMPORTANTE: Clave es ID/RUC
        role: "CLIENTE",
        name: nombre,
        id: cliente.id,
        isLocal: true // Marca para saber que es local
    };

    // Guardar en lista de usuarios locales para Auth.js
    const currentUsers = JSON.parse(localStorage.getItem('tqa_local_users') || "[]");
    currentUsers.push(newUser);
    localStorage.setItem('tqa_local_users', JSON.stringify(currentUsers));

    console.log("Usuario registrado para login:", newUser);
}

function attachSubmit(formId, tipo){
  const form = $(formId);
  if(!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(k => { if(typeof data[k] === "string") data[k] = data[k].trim(); });

    const cliente = {
      id: `cli_${Date.now()}`,
      tipo, 
      creadoEn: new Date().toISOString(),
      data, 
    };

    // 1. Guardar datos del cliente (borrador)
    localStorage.setItem("tqa_cliente_draft", JSON.stringify(cliente));

    // 2. Registrar usuario para que pueda hacer LOGIN después
    registerNewUser(cliente, tipo);

    alert(`Cliente creado. \n\nPara iniciar sesión use:\nUsuario: ${tipo === 'PN' ? data.pn_email : data.pj_contacto_email}\nClave: ${tipo === 'PN' ? data.pn_num_id : data.pj_ruc}`);

    // 3. Redirigir a carga de documentos
    window.location.href = "finanzascliente.html";
  });
}

attachSubmit("#pjForm", "PJ");
attachSubmit("#pnForm", "PN");