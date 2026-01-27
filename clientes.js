/**
 * =========================
 * Configuración futura
 * =========================
 */
const USE_MOCK = true;
const API_BASE = "";              // ej: https://tu-backend.render.com
const ENDPOINT = "/api/clientes"; // GET ?q=

const $ = (id) => document.getElementById(id);

const STORAGE_CLIENTES = "tactiqa_clientes"; // 👈 dashboard lo leerá

const MOCK = [
  { id:"C-001", tipo:"Natural",  nombre:"Juan Pérez",  identificacion:"1712345678", email:"juan@mail.com",  telefono:"0999999999", estado:"Activo" },
  { id:"C-002", tipo:"Jurídica", nombre:"ACME S.A.",   identificacion:"1799999999001", email:"info@acme.com", telefono:"022345678",  estado:"Pendiente" },
  { id:"C-003", tipo:"Natural",  nombre:"María López", identificacion:"0922222222", email:"maria@mail.com", telefono:"0988888888", estado:"Inactivo" }
];

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function badgeEstado(e){
  const v = String(e || "").toLowerCase();
  if(v === "activo") return `<span class="badge ok">Activo</span>`;
  if(v === "pendiente") return `<span class="badge warn">Pendiente</span>`;
  if(v === "inactivo") return `<span class="badge off">Inactivo</span>`;
  return `<span class="badge">${esc(e)}</span>`;
}

function filtrarLocal(items, q){
  if(!q) return items;
  const qq = q.toLowerCase();
  return items.filter(it =>
    Object.values(it).join(" ").toLowerCase().includes(qq)
  );
}

function saveClientesToStorage(items){
  try{
    localStorage.setItem(STORAGE_CLIENTES, JSON.stringify(items));
  }catch{}
}

function openDashboardById(id){
  if(!id) return;
  window.location.href = `cliente-dashboard.html?id=${encodeURIComponent(id)}`;
}

async function cargar(){
  const q = $("q").value.trim();
  const tbody = document.querySelector("#tblClientes tbody");
  const meta = $("meta");
  const empty = $("empty");

  tbody.innerHTML = "";
  meta.textContent = "Cargando...";
  empty.style.display = "none";

  try{
    let items = [];

    if(USE_MOCK){
      items = filtrarLocal(MOCK, q);
      // Guardamos el mock completo (no filtrado) para que el dashboard pueda encontrar por ID
      saveClientesToStorage(MOCK);
    }else{
      const res = await fetch(`${API_BASE}${ENDPOINT}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
      saveClientesToStorage(items);
    }

    meta.textContent = `Mostrando ${items.length} cliente(s)`;

    if(items.length === 0){
      empty.style.display = "block";
      empty.textContent = "No se encontraron clientes.";
      return;
    }

    items.forEach(it => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.setAttribute("tabindex", "0");
      tr.dataset.id = it.id;

      tr.innerHTML = `
        <td><strong>${esc(it.id)}</strong></td>
        <td>${esc(it.tipo)}</td>
        <td>${esc(it.nombre)}</td>
        <td>${esc(it.identificacion)}</td>
        <td>${esc(it.email)}</td>
        <td>${esc(it.telefono)}</td>
        <td>${badgeEstado(it.estado)}</td>
      `;

      tr.addEventListener("click", () => openDashboardById(it.id));
      tr.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          openDashboardById(it.id);
        }
      });

      tbody.appendChild(tr);
    });

  }catch(err){
    meta.textContent = "";
    empty.style.display = "block";
    empty.textContent = "Error cargando clientes.";
  }
}

$("btnBuscar").addEventListener("click", cargar);
$("btnLimpiar").addEventListener("click", () => { $("q").value = ""; cargar(); });
$("q").addEventListener("keydown", e => { if(e.key === "Enter") cargar(); });

cargar();
