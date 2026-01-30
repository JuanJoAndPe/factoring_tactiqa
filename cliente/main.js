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
// Auth helpers
// =========================
const API_BASE = ""; // mismo dominio
const SESSION_KEY = "tqa_session";
const HOME_URL = "plataforma.html"; // <-- cambia esto por tu home real cuando exista

function setMsg(el, text, ok=false){
  if(!el) return;
  el.style.display = "block";
  el.textContent = text;
  el.style.color = ok ? "#2f7a3f" : "#8a1f1f";
}

function clearMsg(el){
  if(!el) return;
  el.style.display = "none";
  el.textContent = "";
}

async function api(path, { method="GET", body } = {}){
  const headers = { "Content-Type":"application/json" };

  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if(session?.token) headers["Authorization"] = `Bearer ${session.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    const msg = data?.error || data?.message || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// =========================
// LOGIN
// =========================
safeOnClick("#btnIngresar", async () => {
  const u = ($("#loginUser")?.value || "").trim();
  const p = ($("#loginPass")?.value || "").trim();
  const msg = $("#loginMsg");
  clearMsg(msg);

  if(!u || !p){
    return setMsg(msg, "Ingresa usuario y clave.");
  }

  try{
    const out = await api("/api/auth/login", {
      method: "POST",
      body: { username: u, password: p }
    });

    // out esperado: { token, user: { id, name, username, role } }
    localStorage.setItem(SESSION_KEY, JSON.stringify(out));
    setMsg(msg, `✅ Bienvenido ${out?.user?.name || u}`, true);

    // Redirección a tu home real (ajusta HOME_URL arriba)
    window.location.href = HOME_URL;

  }catch(err){
    setMsg(msg, `❌ ${err.message}`);
  }
});

// =========================
// RECUPERAR CONTRASEÑA (UI)
// =========================
safeOnClick("#goRecover", (e) => {
  e.preventDefault();
  clearMsg($("#recoverMsg"));
  $("#recoverEmail").value = "";
  showView("#view-recover");
});

safeOnClick("#goNuevoCliente", (e) => {
  e.preventDefault();
  window.location.href = "nuevo-cliente.html";
});

safeOnClick("#backToLogin", (e) => {
  e.preventDefault();
  clearMsg($("#loginMsg"));
  showView("#view-login");
});

// =========================
// RECUPERAR CONTRASEÑA (API)
// =========================
// Endpoint sugerido: POST /api/auth/recover-request { email }
// (Tu backend envía el correo con link/código)
safeOnClick("#btnEnviarRecover", async () => {
  const email = ($("#recoverEmail")?.value || "").trim();
  const msg = $("#recoverMsg");
  clearMsg(msg);

  if(!email){
    return setMsg(msg, "Ingresa tu correo.");
  }

  // Validación simple
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return setMsg(msg, "Ingresa un correo válido.");
  }

  try{
    await api("/api/auth/recover-request", {
      method: "POST",
      body: { email }
    });

    // Mensaje “seguro” (no revela si existe o no el correo)
    setMsg(msg, "✅ Si el correo existe, te llegará un mensaje con instrucciones.", true);
  }catch(err){
    setMsg(msg, `❌ ${err.message}`);
  }
});
