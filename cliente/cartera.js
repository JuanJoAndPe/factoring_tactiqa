(function() {
    "use strict";

    /* ========= Helpers ========= */
    const pad2 = n => String(n).padStart(2, "0");
    const formatMoneyUSD = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const formatDateISOToShort = iso => {
      if (!iso) return "--";
      const d = new Date(iso);
      return isNaN(d) ? "--" : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
    };

    /* ========= LOGIC ========= */
    const STORAGE_LOCAL_USERS = "tqa_local_users";
    const STORAGE_DASH_PREFIX = "tactiqa_cliente_dashboard_"; 
    
    // Mock Data Default
    const DEFAULT_DEMO_DATA = { operaciones: [{ fecha: "2026-01-21", numero: "OP-001248", deudor: "COMERCIAL XYZ", valor: 12500, anticipo: 10000, estado: "Vigente" }] };

    function loadDataByClientId(id) {
        // 1. Usuario Nuevo Local
        try {
            const localUsers = JSON.parse(localStorage.getItem(STORAGE_LOCAL_USERS) || "[]");
            const foundLocal = localUsers.find(u => u.id === id);
            if (foundLocal) return { operaciones: [] }; // CERO
        } catch (e) {}

        // 2. Datos persistidos
        try {
            const raw = localStorage.getItem(STORAGE_DASH_PREFIX + id);
            if (raw) return { operaciones: JSON.parse(raw).operaciones || [] };
        } catch {}

        // 3. Si no es conocido, asumimos vacío (seguridad) o demo si no hay ID
        if (!id) return DEFAULT_DEMO_DATA;
        return { operaciones: [] };
    }

    function pickBadge(status) {
        const s = String(status || "").toLowerCase();
        if (s.includes("pagad") || s.includes("cerrad") || s.includes("final")) return { cls: "badge ok", txt: "Finalizada" };
        if (s.includes("vigente") || s.includes("activa")) return { cls: "badge warn", txt: "Vigente" };
        if (s.includes("mora")) return { cls: "badge bad", txt: "En mora" };
        return { cls: "badge", txt: status || "—" };
    }

    function renderTable(ops) {
        const tbody = document.querySelector("#tablaCartera tbody");
        tbody.innerHTML = "";

        if (!ops || ops.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #777;">No existen operaciones registradas para este cliente.</td></tr>`;
            return;
        }

        ops.forEach(op => {
            const badge = pickBadge(op.estado);
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${formatDateISOToShort(op.fecha)}</td><td><strong>${op.numero}</strong></td><td>${op.deudor}</td><td style="text-align:right;">${formatMoneyUSD(op.valor)}</td><td style="text-align:right;">${formatMoneyUSD(op.anticipo)}</td><td><span class="${badge.cls}">${badge.txt}</span></td>`;
            tbody.appendChild(tr);
        });
    }

    /* ========= INIT ========= */
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("id") || "";

    const data = loadDataByClientId(clientId);
    renderTable(data.operaciones);

    const btnVolver = document.getElementById("btnVolver");
    if(btnVolver){
        btnVolver.addEventListener("click", () => {
            if(clientId) window.location.href = `cliente-dashboard.html?id=${clientId}`;
            else window.history.back();
        });
    }
})();