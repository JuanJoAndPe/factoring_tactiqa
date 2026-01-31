const facturas = [];
const $ = (id) => document.getElementById(id);

function num(v){
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function fix(v){ return Number(v || 0).toFixed(2); }

function addFactura(){
  // 1. Obtener valores
  const dias = num($("dias").value);
  const subtotal = num($("subtotal").value);
  const retFte = num($("retFte").value);
  const retIva = num($("retIva").value);
  
  // Validación básica
  if(subtotal <= 0){
    alert("Ingresa un subtotal válido.");
    return;
  }

  // --- CÁLCULOS (Según nueva instrucción) ---

  // 1. Valor Líquido
  // Fórmula: subtotal - retencion fuente - retencion iva
  const liquido = subtotal - retFte - retIva;

  // 2. Retención 20%
  // Fórmula: valor liquido * 20%
  const retencion20 = liquido * 0.20;

  // 3. Valor Anticipado (Valor a Desembolsar)
  // Fórmula: valor liquido - retencion 20%
  const anticipado = liquido - retencion20;

  // Guardar en arreglo
  facturas.push({ dias, subtotal, liquido, retencion20, anticipado });
  
  render();

  // Limpiar campos
  $("dias").value = "";
  $("subtotal").value = "";
  $("retFte").value = "";
  $("retIva").value = "";
  $("subtotal").focus();
}

function render(){
  const tbody = document.querySelector("#tablaFacturas tbody");
  tbody.innerHTML = "";

  let tLiquido = 0, tRet = 0, tAnt = 0;

  facturas.forEach((f, i) => {
    tLiquido += f.liquido;
    tRet += f.retencion20;
    tAnt += f.anticipado;

    const tr = document.createElement("tr");

    // Construcción de celdas
    const tdDias = document.createElement("td");
    tdDias.textContent = String(f.dias || 0); // Días es solo referencial ahora

    const tdSub = document.createElement("td");
    tdSub.textContent = fix(f.subtotal);

    const tdLiq = document.createElement("td");
    tdLiq.textContent = fix(f.liquido);
    tdLiq.style.color = "#2A4A73"; // Azul corporativo

    const tdRet = document.createElement("td");
    tdRet.textContent = fix(f.retencion20);
    tdRet.style.color = "#d32f2f"; // Rojo (deducción)

    const tdAnt = document.createElement("td");
    tdAnt.textContent = fix(f.anticipado);
    tdAnt.style.fontWeight = "bold";
    tdAnt.style.color = "#1F3A5F"; // Azul oscuro (Total)

    const tdAcc = document.createElement("td");
    tdAcc.innerHTML = `<button class="btn ghost small" style="padding:4px 8px; color:red;" onclick="delFactura(${i})">✕</button>`;

    tr.append(tdDias, tdSub, tdLiq, tdRet, tdAnt, tdAcc);
    tbody.appendChild(tr);
  });

  // Actualizar Totales del Footer
  $("t_liquido").textContent = fix(tLiquido);
  $("t_retencion").textContent = fix(tRet);
  $("t_anticipado").textContent = fix(tAnt);
}

function delFactura(i){
  facturas.splice(i, 1);
  render();
}

// Exponer globalmente para el onclick en HTML
window.delFactura = delFactura;

// Event Listeners
$("btnAddFactura").addEventListener("click", addFactura);