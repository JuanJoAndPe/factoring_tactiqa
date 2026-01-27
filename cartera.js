const tbody = document.querySelector("#tablaCartera tbody");

function money(v){
  return Number(v || 0).toFixed(2);
}

function loadCartera(){
  const cartera = JSON.parse(localStorage.getItem("cartera_factoring") || "[]");
  tbody.innerHTML = "";

  if (!cartera.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#777">
          No existen operaciones registradas
        </td>
      </tr>`;
    return;
  }

  cartera.forEach((op, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.empresa}</td>
      <td>${op.fechaDesembolso}</td>
      <td>${op.facturas.length}</td>
      <td>${op.totalDepositar}</td>
      <td>${new Date(op.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="action-btn" onclick="ver(${i})">Ver</button>
        |
        <button class="action-btn danger" onclick="del(${i})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function ver(i){
  const cartera = JSON.parse(localStorage.getItem("cartera_factoring") || "[]");
  const op = cartera[i];

  let detalle = `Empresa: ${op.empresa}\n\n`;
  op.facturas.forEach(f=>{
    detalle += `Factura ${f.factura}\n`;
    detalle += `Total: ${f.total}\n`;
    detalle += `Anticipado: ${f.anticipado}\n`;
    detalle += `Depositado: ${f.depositar}\n\n`;
  });

  alert(detalle);
}

function del(i){
  if(!confirm("¿Eliminar esta operación?")) return;
  const cartera = JSON.parse(localStorage.getItem("cartera_factoring") || "[]");
  cartera.splice(i,1);
  localStorage.setItem("cartera_factoring", JSON.stringify(cartera));
  loadCartera();
}

loadCartera();
