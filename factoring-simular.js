const IVA = 0.15;
const ANTICIPO = 0.15;
const FACTOR = 0.000633;
const FACTOR_ADM = 0.000167;

const facturas = [];
const $ = (id) => document.getElementById(id);

function num(v){
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function fix(v){ return Number(v || 0).toFixed(2); }

function addFactura(){
  const dias = num($("dias").value);
  const subtotal = num($("subtotal").value);
  const retFte = num($("retFte").value);
  const retIva = num($("retIva").value);

  if(subtotal <= 0){
    alert("Ingresa un subtotal válido.");
    return;
  }

  const iva = subtotal * IVA;
  const total = subtotal + iva;

  const liquido = total - retFte - retIva;
  const anticipado = liquido * (1 - ANTICIPO);

  const dscto = anticipado * FACTOR * dias;
  const gastoAdm = anticipado * FACTOR_ADM * dias;
  const ivaGAdm = gastoAdm * IVA;

  const totalGasto = dscto + gastoAdm + ivaGAdm;
  const depositar = anticipado - totalGasto;

  facturas.push({ dias, total, anticipado, dscto, depositar });
  render();

  $("dias").value = "";
  $("subtotal").value = "";
  $("retFte").value = "";
  $("retIva").value = "";
}

function render(){
  const tbody = document.querySelector("#tablaFacturas tbody");
  tbody.innerHTML = "";

  let tTotal = 0, tAnt = 0, tDscto = 0, tDep = 0;

  facturas.forEach((f, i) => {
    tTotal += f.total;
    tAnt += f.anticipado;
    tDscto += f.dscto;
    tDep += f.depositar;

    const tr = document.createElement("tr");

    // ✅ EXACTAMENTE 6 <td> en el mismo orden del <thead>
    const tdDias = document.createElement("td");
    tdDias.textContent = String(f.dias);

    const tdTotal = document.createElement("td");
    tdTotal.textContent = fix(f.total);

    const tdAnt = document.createElement("td");
    tdAnt.textContent = fix(f.anticipado);

    const tdDscto = document.createElement("td");
    tdDscto.textContent = fix(f.dscto);

    const tdDep = document.createElement("td");
    tdDep.textContent = fix(f.depositar);

    const tdAcc = document.createElement("td");
    tdAcc.innerHTML = `<button type="button" onclick="delFactura(${i})">✕</button>`;

    tr.append(tdDias, tdTotal, tdAnt, tdDscto, tdDep, tdAcc);
    tbody.appendChild(tr);
  });

  $("t_total").textContent = fix(tTotal);
  $("t_anticipado").textContent = fix(tAnt);
  $("t_dscto").textContent = fix(tDscto);
  $("t_depositar").textContent = fix(tDep);
}

function delFactura(i){
  facturas.splice(i, 1);
  render();
}

window.delFactura = delFactura;
$("btnAddFactura").addEventListener("click", addFactura);
