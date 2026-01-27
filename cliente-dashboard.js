(function () {
  "use strict";

  /* ========= Helpers ========= */
  const pad2 = n => String(n).padStart(2, "0");

  const formatMoneyUSD = v =>
    Number(v || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD"
    });

  const formatDateISOToDMY = iso => {
    if (!iso) return "--/--/----";
    const d = new Date(iso);
    return isNaN(d) ? "--/--/----" :
      `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const formatDateISOToShort = iso => {
    if (!iso) return "--";
    const d = new Date(iso);
    return isNaN(d) ? "--" :
      `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  };

  const nowHHMM = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  /* ========= BADGES (alineados a styles.css) ========= */
  function pickBadge(status) {
    const s = String(status || "").toLowerCase();

    if (s.includes("pagad") || s.includes("cerrad") || s.includes("final")) {
      return { cls: "badge ok", txt: "Finalizada" };
    }
    if (s.includes("vigente") || s.includes("activa") || s.includes("curso")) {
      return { cls: "badge warn", txt: "Vigente" };
    }
    if (s.includes("mora") || s.includes("atras")) {
      return { cls: "badge bad", txt: "En mora" };
    }
    return { cls: "badge", txt: status || "—" };
  }

  /* ========= DATA DEMO (modelo NO se cambia) ========= */
  const DEFAULT_DATA = {
    cliente: {
      nombre: "Cliente",
      desde: "2019-06-06",
      estado: "Activo"
    },
    kpis: {
      historialOps: 144,
      historialMonto: 2300399.41,
      opsVigentes: 12,
      lineaAsignada: 146000,
      valorNegociado: 147552.10,
      saldoCapital: 147552.10,
      lineaDisponible: -1552.10
    },
    operaciones: [
      { fecha: "2026-01-21", numero: "OP-001248", deudor: "COMERCIAL XYZ", valor: 12500, anticipo: 10000, estado: "Vigente" },
      { fecha: "2026-01-18", numero: "OP-001247", deudor: "INDUSTRIAS ABC", valor: 8900, anticipo: 7120, estado: "Finalizada" },
      { fecha: "2026-01-12", numero: "OP-001246", deudor: "SERVICIOS LMN", valor: 22000, anticipo: 17600, estado: "Vigente" },
      { fecha: "2026-01-08", numero: "OP-001245", deudor: "CONSTRUCCIONES QRS", valor: 6400, anticipo: 5120, estado: "Finalizada" }
    ]
  };

  const STORAGE_CLIENTES = "tactiqa_clientes";
  const STORAGE_DASH_PREFIX = "tactiqa_cliente_dashboard_"; // futuro: por cliente

  const deepClone = (o) => {
    try { return structuredClone(o); } catch { return JSON.parse(JSON.stringify(o)); }
  };

  const getClientIdFromURL = () => {
    const p = new URLSearchParams(window.location.search);
    return p.get("id") || "";
  };

  const readClientesFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_CLIENTES);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  // Genera KPIs “mock” deterministas por ID (para que cada cliente se vea distinto)
  function hashToInt(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function buildMockById(id, base) {
    const seed = hashToInt(id || "CLIENTE");
    const m = deepClone(base);

    const linea = 80000 + (seed % 120000); // 80k - 200k
    const vig = (seed % 14) + 1;
    const histOps = 40 + (seed % 260);
    const histMonto = 200000 + (seed % 3000000);

    const valorNeg = 10000 + (seed % 250000);
    const saldo = Math.max(0, valorNeg * 0.85);
    const disponible = linea - saldo;

    m.kpis.lineaAsignada = linea;
    m.kpis.opsVigentes = vig;
    m.kpis.historialOps = histOps;
    m.kpis.historialMonto = histMonto;
    m.kpis.valorNegociado = valorNeg;
    m.kpis.saldoCapital = saldo;
    m.kpis.lineaDisponible = disponible;

    // operaciones mock con sufijo por id
    const suf = String(seed).slice(-3);
    m.operaciones = m.operaciones.map((op, i) => ({
      ...op,
      numero: `OP-${suf}${pad2(i + 1)}`,
    }));

    return m;
  }

  function loadDataByClientId(id) {
    // 1) si existe un dashboard guardado por cliente (futuro), úsalo
    try {
      const raw = localStorage.getItem(STORAGE_DASH_PREFIX + id);
      if (raw) {
        const parsed = JSON.parse(raw);
        // merge suave sobre el modelo base
        return { ...deepClone(DEFAULT_DATA), ...parsed };
      }
    } catch {}

    // 2) si no existe, arma un estado base + mock “por ID”
    const state = buildMockById(id, DEFAULT_DATA);

    // 3) intenta completar datos del cliente desde la lista (clientes.html guarda esto)
    const clientes = readClientesFromStorage();
    const found = clientes.find(c => String(c.id) === String(id));

    if (found) {
      state.cliente.nombre = found.nombre || state.cliente.nombre;
      state.cliente.estado = found.estado || state.cliente.estado;

      // “desde” futuro: si no existe, ponemos una fecha mock estable por id
      if (!found.desde) {
        const d = new Date(2018, (hashToInt(id) % 12), (hashToInt(id) % 27) + 1);
        state.cliente.desde = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      } else {
        state.cliente.desde = found.desde;
      }
    } else {
      // si no encontramos el cliente, mantenemos mock
      state.cliente.nombre = id ? `Cliente ${id}` : state.cliente.nombre;
    }

    return state;
  }

  /* ========= RENDER ========= */
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
    const dispEl = document.getElementById("lineaDisponible");
    const dispCard = document.getElementById("cardLineaDisponible");

    dispEl.textContent = formatMoneyUSD(disp);
    dispCard.classList.toggle("neg", disp < 0);

    renderTable(data.operaciones);
    renderResumenRapido(data);
  }

  function renderTable(ops) {
    const tbody = document.querySelector("#tablaOperaciones tbody");
    tbody.innerHTML = "";

    ops.forEach(op => {
      const badge = pickBadge(op.estado);
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${formatDateISOToShort(op.fecha)}</td>
        <td><strong>${op.numero}</strong></td>
        <td>${op.deudor}</td>
        <td style="text-align:right;">${formatMoneyUSD(op.valor)}</td>
        <td style="text-align:right;">${formatMoneyUSD(op.anticipo)}</td>
        <td><span class="${badge.cls}">${badge.txt}</span></td>
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
      ["Saldo capital", formatMoneyUSD(data.kpis.saldoCapital)]
    ];

    items.forEach(([label, value]) => {
      const div = document.createElement("div");
      div.className = "quick-item";
      div.innerHTML = `
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      `;
      wrap.appendChild(div);
    });
  }

  /* ========= INIT ========= */
  const clientId = getClientIdFromURL();
  const state = loadDataByClientId(clientId);

  document.getElementById("yearNow").textContent = new Date().getFullYear();

  // botones existentes (no cambiamos HTML)
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", () => renderAll(loadDataByClientId(clientId)));

  renderAll(state);

})();
