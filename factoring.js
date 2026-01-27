const IVA = 0.15;
const ANTICIPO = 0.15;
const FACTOR = 0.000633;
const FACTOR_ADM = 0.000167;

const facturas = [];

const $ = id => document.getElementById(id);

function num(v){ return Number(v || 0); }
function fix(v){ return v.toFixed(2); }

function addFactura(){
  const subtotal = num($("subtotal").value);
  const iva = subtotal * IVA;
  const total = subtotal + iva;

  const retFte = num($("retFte").value);
  const retIva = num($("retIva").value);
  const dias = num($("dias").value);

  const liquido = total - retFte - retIva;
  const anticipado = liquido * (1 - ANTICIPO);

  const dscto = anticipado * FACTOR * dias;
  const gastoAdm = anticipado * FACTOR_ADM * dias;
  const ivaGAdm = gastoAdm * IVA;

  const totalGasto = dscto + gastoAdm + ivaGAdm;
  const depositar = anticipado - totalGasto;

  facturas.push({
    factura: $("factura").value,
    fecha: $("fechaFactura").value,
    dias,
    total,
    anticipado,
    dscto,
    depositar
  });

  render();
}

function render(){
  const tbody = document.querySelector("#tablaFacturas tbody");
  tbody.innerHTML = "";

  let tTotal = 0, tAnt = 0, tDscto = 0, tDep = 0;

  facturas.forEach((f,i)=>{
    tTotal += f.total;
    tAnt += f.anticipado;
    tDscto += f.dscto;
    tDep += f.depositar;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.factura}</td>
      <td>${f.fecha}</td>
      <td>${f.dias}</td>
      <td>${fix(f.total)}</td>
      <td>${fix(f.anticipado)}</td>
      <td>${fix(f.dscto)}</td>
      <td>${fix(f.depositar)}</td>
      <td><button onclick="del(${i})">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  $("t_total").textContent = fix(tTotal);
  $("t_anticipado").textContent = fix(tAnt);
  $("t_dscto").textContent = fix(tDscto);
  $("t_depositar").textContent = fix(tDep);
}

function del(i){
  facturas.splice(i,1);
  render();
}

$("btnAddFactura").onclick = addFactura;

$("btnEnviar").onclick = () => {
  if (!facturas.length) {
    alert("Agrega al menos una factura");
    return;
  }

  const operacion = {
    id: crypto.randomUUID(),
    tipo: "factoring",
    empresa: $("empresa").value,
    fechaDesembolso: $("fechaDesembolso").value,
    totalDepositar: $("t_depositar").textContent,
    facturas,
    createdAt: new Date().toISOString()
  };

  const cartera = JSON.parse(localStorage.getItem("cartera_factoring") || "[]");
  cartera.push(operacion);
  localStorage.setItem("cartera_factoring", JSON.stringify(cartera));

  alert("✅ Operación guardada en cartera (local)");

  // opcional: descarga JSON
  const blob = new Blob([JSON.stringify(operacion, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `factoring_${operacion.id}.json`;
  a.click();
};
