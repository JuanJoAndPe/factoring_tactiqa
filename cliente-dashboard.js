(function () {
  "use strict";

  // URL DE TU API (Asegúrate que coincida con la que usas en otros archivos)
  // Si ya la tienes global en un config.js, puedes quitar esta línea.
  const API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';

  /* ========= Helpers ========= */
  const pad2 = n => String(n).padStart(2, "0");
  const formatMoneyUSD = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  
  const formatDateISOToDMY = iso => {
    if (!iso) return "--/--/----";
    const d = new Date(iso);
    return isNaN(d) ? "--/--/----" : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  
  const formatDateISOToShort = iso => {
    if (!iso) return "--";
    const d = new Date(iso);
    return isNaN(d) ? "--" : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  };
  
  const nowHHMM = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

  function pickBadge(status) {
    const s = String(status || "").toUpperCase();
    if (s.includes("PAGADO")) return { cls: "badge ok", txt: "Pagado" };
    if (s.includes("AUTORIZADO") || s.includes("VIGENTE") || s.includes("ACTIVO")) return { cls: "badge warn", txt: "Vigente" };
    if (s.includes("EN_REVISION") || s.includes("PENDIENTE")) return { cls: "badge", txt: "En Revisión" };
    if (s.includes("RECHAZADA")) return { cls: "badge bad", txt: "Rechazada" };
    return { cls: "badge", txt: status || "—" };
  }

  /* ========= DATA LOADING ========= */
  
  async function fetchDashboardData(clientId) {
    try {
        const response = await fetch(`${API_URL}/dashboard/cliente?id=${clientId}`);
        if (!response.ok) throw new Error("Error de red");
        const json = await response.json();
        
        if (json.success) {
            return json.data;
        } else {
            console.warn("API Error:", json.message);
            return null;
        }
    } catch (error) {
        console.error("Error cargando dashboard:", error);
        return null;
    }
  }

  function renderAll(data) {
    if (!data) return; // Si falla la carga

    // 1. Info Cliente
    document.getElementById("clienteNombre").textContent = data.cliente.nombre || "Cliente";
    document.getElementById("desdeFecha").textContent = formatDateISOToDMY(data.cliente.desde);
    document.getElementById("estadoCuenta").textContent = data.cliente.estado || "Activo";
    document.getElementById("ultimaActualizacion").textContent = nowHHMM();

    // 2. KPIs
    // Historial
    document.getElementById("historialOps").textContent = data.kpis.historialOps;
    document.getElementById("historialMonto").textContent = formatMoneyUSD(data.kpis.historialMonto);
    
    // Vigentes
    document.getElementById("opsVigentes").textContent = data.kpis.opsVigentes;
    
    // Financieros
    document.getElementById("lineaAsignada").textContent = formatMoneyUSD(data.kpis.lineaAsignada);
    document.getElementById("valorNegociado").textContent = formatMoneyUSD(data.kpis.valorNegociado);
    document.getElementById("saldoCapital").textContent = formatMoneyUSD(data.kpis.saldoCapital);

    // Calculado: Disponible
    const disp = Number(data.kpis.lineaDisponible);
    document.getElementById("lineaDisponible").textContent = formatMoneyUSD(disp);
    
    // Alerta visual si se pasó del cupo
    const cardDisp = document.getElementById("cardLineaDisponible");
    if (disp < 0) {
        cardDisp.classList.add("neg");
        cardDisp.querySelector('.kpi-val').style.color = "#d32f2f";
    } else {
        cardDisp.classList.remove("neg");
        cardDisp.querySelector('.kpi-val').style.color = ""; // default
    }

    // 3. Tablas y Resumen
    renderTable(data.operaciones);
    renderResumenRapido(data);
  }

  function renderTable(ops) {
    const tbody = document.querySelector("#tablaOperaciones tbody");
    tbody.innerHTML = "";
    
    if (!ops || ops.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">No hay operaciones registradas.</td></tr>`;
        return;
    }
    
    ops.forEach(op => {
      const badge = pickBadge(op.estado);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDateISOToShort(op.fecha)}</td>
        <td style="font-weight:600; font-family:monospace;">${op.numero}</td>
        <td>${op.deudor}</td>
        <td style="text-align:right;">${formatMoneyUSD(op.valor)}</td>
        <td style="text-align:right;">${formatMoneyUSD(op.anticipo)}</td>
        <td style="text-align:center;"><span class="${badge.cls}">${badge.txt}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderResumenRapido(data) {
    const wrap = document.getElementById("resumenRapido");
    wrap.innerHTML = "";
    
    const items = [
        ["Línea asignada", formatMoneyUSD(data.kpis.lineaAsignada)],
        ["Disponible", formatMoneyUSD(data.kpis.lineaDisponible)],
        ["Operaciones vigentes", data.kpis.opsVigentes],
        ["Deuda Actual", formatMoneyUSD(data.kpis.saldoCapital)]
    ];

    items.forEach(([l, v]) => {
      const div = document.createElement("div"); 
      div.className = "quick-item"; 
      div.innerHTML = `<div class="label">${l}</div><div class="value">${v}</div>`; 
      wrap.appendChild(div);
    });
  }

  /* ========= INIT ========= */
  
  // Obtener sesión
  const session = JSON.parse(localStorage.getItem('tqa_session'));
  
  if (!session || !session.id) {
      // Si no hay sesión, redirigir a login
      console.warn("No hay sesión activa");
      window.location.href = "login.html";
  } else {
      const clientId = session.id;
      
      // Cargar datos iniciales
      fetchDashboardData(clientId).then(data => {
          if (data) renderAll(data);
      });
      
      document.getElementById("yearNow").textContent = new Date().getFullYear();
      
      // Botón Actualizar
      const btnRefresh = document.getElementById("btnRefresh");
      if (btnRefresh) {
          btnRefresh.addEventListener("click", () => {
              btnRefresh.classList.add('rotating'); // Efecto visual opcional
              fetchDashboardData(clientId).then(data => {
                  if (data) renderAll(data);
                  btnRefresh.classList.remove('rotating');
              });
          });
      }

      // Botón Ver Todo
      const btnVerTodo = document.getElementById("btnVerTodo");
      if (btnVerTodo) {
          btnVerTodo.addEventListener("click", () => window.location.href = `cartera.html`);
      }
  }

})();