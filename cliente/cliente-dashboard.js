(function () {
  "use strict";

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
    const s = String(status || "").toLowerCase();
    if (s.includes("pagad") || s.includes("cerrad") || s.includes("final")) return { cls: "badge ok", txt: "Finalizada" };
    if (s.includes("vigente") || s.includes("activa")) return { cls: "badge warn", txt: "Vigente" };
    if (s.includes("mora")) return { cls: "badge bad", txt: "En mora" };
    return { cls: "badge", txt: status || "—" };
  }

  /* ========= DATA ========= */
  const DEFAULT_DEMO_DATA = {
    cliente: { nombre: "Cliente Demo", desde: "2019-06-06", estado: "Activo" },
    kpis: { historialOps: 144, historialMonto: 2300399.41, opsVigentes: 12, lineaAsignada: 146000, valorNegociado: 147552.10, saldoCapital: 147552.10, lineaDisponible: -1552.10 },
    operaciones: [{ fecha: "2026-01-21", numero: "OP-001248", deudor: "COMERCIAL XYZ", valor: 12500, anticipo: 10000, estado: "Vigente" }]
  };

  function getZeroState(nombreCliente) {
    return {
      cliente: { nombre: nombreCliente || "Nuevo Cliente", desde: new Date().toISOString(), estado: "Pendiente" },
      kpis: { historialOps: 0, historialMonto: 0.00, opsVigentes: 0, lineaAsignada: 0.00, valorNegociado: 0.00, saldoCapital: 0.00, lineaDisponible: 0.00 },
      operaciones: []
    };
  }

  const STORAGE_CLIENTES = "tactiqa_clientes";
  const STORAGE_LOCAL_USERS = "tqa_local_users";
  const STORAGE_DASH_PREFIX = "tactiqa_cliente_dashboard_"; 
  const deepClone = (o) => { try { return structuredClone(o); } catch { return JSON.parse(JSON.stringify(o)); } };
  const getClientIdFromURL = () => { const p = new URLSearchParams(window.location.search); return p.get("id") || ""; };

  function loadDataByClientId(id) {
    // 1. Usuario Nuevo Local
    try {
        const localUsers = JSON.parse(localStorage.getItem(STORAGE_LOCAL_USERS) || "[]");
        const foundLocal = localUsers.find(u => u.id === id);
        if (foundLocal) return getZeroState(foundLocal.name);
    } catch (e) {}

    // 2. Datos persistidos
    try {
      const raw = localStorage.getItem(STORAGE_DASH_PREFIX + id);
      if (raw) return { ...deepClone(DEFAULT_DEMO_DATA), ...JSON.parse(raw) };
    } catch {}

    // 3. Demo / Mock
    if (id) return getZeroState("Cliente " + id);
    return deepClone(DEFAULT_DEMO_DATA);
  }

  function renderAll(data) {
    document.getElementById("clienteNombre").textContent = data.cliente.nombre;
    document.getElementById("desdeFecha").textContent = formatDateISOToDMY(data.cliente.desde);
    document.getElementById("estadoCuenta").textContent = data.cliente.estado;
    document.getElementById("ultimaActualizacion").textContent = nowHHMM();

    document.getElementById("historialOps").textContent = data.kpis.historialOps;
    document.getElementById("historialMonto").textContent = formatMoneyUSD(data.kpis.historialMonto);
    document.getElementById("opsVigentes").textContent = data.kpis.opsVigentes;
    document.getElementById("lineaAsignada").textContent = formatMoneyUSD(data.kpis.lineaAsignada);
    document.getElementById("valorNegociado").textContent = formatMoneyUSD(data.kpis.valorNegociado);
    document.getElementById("saldoCapital").textContent = formatMoneyUSD(data.kpis.saldoCapital);

    const disp = Number(data.kpis.lineaDisponible);
    document.getElementById("lineaDisponible").textContent = formatMoneyUSD(disp);
    document.getElementById("cardLineaDisponible").classList.toggle("neg", disp < 0);

    renderTable(data.operaciones);
    renderResumenRapido(data);
  }

  function renderTable(ops) {
    const tbody = document.querySelector("#tablaOperaciones tbody");
    tbody.innerHTML = "";
    if (!ops || ops.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">No existen operaciones registradas.</td></tr>`;
        return;
    }
    ops.slice(0, 5).forEach(op => {
      const badge = pickBadge(op.estado);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatDateISOToShort(op.fecha)}</td><td><strong>${op.numero}</strong></td><td>${op.deudor}</td><td style="text-align:right;">${formatMoneyUSD(op.valor)}</td><td style="text-align:right;">${formatMoneyUSD(op.anticipo)}</td><td><span class="${badge.cls}">${badge.txt}</span></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderResumenRapido(data) {
    const wrap = document.getElementById("resumenRapido");
    wrap.innerHTML = "";
    [["Línea asignada", formatMoneyUSD(data.kpis.lineaAsignada)], ["Disponible", formatMoneyUSD(data.kpis.lineaDisponible)], ["Operaciones vigentes", data.kpis.opsVigentes], ["Saldo capital", formatMoneyUSD(data.kpis.saldoCapital)]].forEach(([l, v]) => {
      const div = document.createElement("div"); div.className = "quick-item"; div.innerHTML = `<div class="label">${l}</div><div class="value">${v}</div>`; wrap.appendChild(div);
    });
  }

  const clientId = getClientIdFromURL();
  const state = loadDataByClientId(clientId);
  document.getElementById("yearNow").textContent = new Date().getFullYear();
  
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", () => renderAll(loadDataByClientId(clientId)));

  const btnVerTodo = document.getElementById("btnVerTodo");
  if (btnVerTodo) btnVerTodo.addEventListener("click", () => window.location.href = `cartera.html?id=${clientId}`);

  renderAll(state);
})();