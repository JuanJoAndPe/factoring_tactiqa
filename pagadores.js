// DATA MOCK (Solo carga si está 100% vacío)
const MOCK_PAYERS = [
    {
        id: "P001",
        name: "SUPERMERCADOS LA FAVORITA C.A.",
        ruc: "1790016919001",
        client: "Importadora del Pacífico S.A.",
        rating: "AAA",
        quota: 500000.00,
        used: 125000.00,
        status: "ACTIVO",
        docsVerified: true
    }
];

let currentIdToReview = null;

document.addEventListener('DOMContentLoaded', () => {
    // Intentar sincronizar al cargar
    syncAllSources();
    
    // Cargar tabla
    loadPayers();

    // Listeners de Filtros
    document.getElementById('searchPayer').addEventListener('keyup', loadPayers);
    document.getElementById('filterStatus').addEventListener('change', loadPayers);
});

// === FUNCIÓN MAESTRA DE SINCRONIZACIÓN ===
function syncAllSources() {
    let foundNew = 0;
    foundNew += syncClientRequests();      // Solicitudes directas
    foundNew += syncPayersFromInvoices();  // Facturas XML
    
    if(foundNew > 0) {
        console.log(`✅ Sincronización completa: ${foundNew} nuevos pagadores detectados.`);
        loadPayers(); // Refrescar tabla si hubo cambios
    } else {
        console.log("Sincronización completa: No hay nuevos pagadores.");
    }
    return foundNew;
}

// Botón manual de sincronización
window.manualSync = () => {
    const nuevos = syncAllSources();
    if(nuevos > 0) {
        alert(`✅ Se encontraron e importaron ${nuevos} nuevas solicitudes de pagadores.`);
    } else {
        alert("🔄 Sincronizado. No se encontraron solicitudes nuevas pendientes.");
    }
};

// 1. Sincronizar Solicitudes Directas (Busca en múltiples llaves por seguridad)
function syncClientRequests() {
    let payers = JSON.parse(localStorage.getItem('tqa_pagadores')) || [];
    
    // BUSCAR EN TODAS LAS POSIBLES LLAVES DONDE EL CLIENTE PUDO GUARDAR
    const sources = [
        JSON.parse(localStorage.getItem('tactiqa_solicitudes_cupo')) || [],
        JSON.parse(localStorage.getItem('tqa_solicitudes_cupo')) || [],
        JSON.parse(localStorage.getItem('solicitudes_pagadores')) || []
    ];

    // Aplanar array
    const allRequests = sources.flat();
    let addedCount = 0;

    allRequests.forEach(req => {
        // Validar datos mínimos
        if (!req.ruc && !req.nombre) return; 

        // Evitar duplicados por RUC o Nombre exacto
        const exists = payers.find(p => 
            (req.ruc && p.ruc === req.ruc) || 
            (req.nombre && p.name.toLowerCase() === req.nombre.toLowerCase())
        );

        if (!exists) {
            payers.push({
                id: req.id || `REQ-${Math.floor(Math.random() * 100000)}`,
                name: (req.nombre || req.razon_social || "Sin Nombre").toUpperCase(),
                ruc: req.ruc || "N/A",
                client: req.cliente_solicitante || "Cliente Portal",
                rating: "B", 
                quota: parseFloat(req.monto_solicitado) || 0.00,
                used: 0.00,
                status: "POR_REVISAR", // Estado clave para el Operativo
                docsVerified: false,
                origin: "SOLICITUD_DIRECTA",
                observation: req.comentarios || ""
            });
            addedCount++;
        }
    });

    if(addedCount > 0) {
        localStorage.setItem('tqa_pagadores', JSON.stringify(payers));
    }
    return addedCount;
}

// 2. Sincronizar desde Facturas
function syncPayersFromInvoices() {
    let payers = JSON.parse(localStorage.getItem('tqa_pagadores')) || [];
    
    // Inicializar con Mock si está vacío totalmente
    if (payers.length === 0 && MOCK_PAYERS.length > 0) {
        payers = JSON.parse(JSON.stringify(MOCK_PAYERS)); // Copia profunda
    }

    const invoices = JSON.parse(localStorage.getItem('tqa_ops_pendientes')) || [];
    let addedCount = 0;

    invoices.forEach(op => {
        const payerName = op.pagador_nombre || "Pagador Desconocido"; 
        const payerRuc = op.pagador_ruc || "9999999999001";
        
        const exists = payers.find(p => p.ruc === payerRuc || p.name === payerName);
        
        if (!exists) {
            payers.push({
                id: `PAY-${Math.floor(Math.random() * 100000)}`,
                name: payerName.toUpperCase(),
                ruc: payerRuc,
                client: op.cliente_nombre || "N/A",
                rating: "B",
                quota: 0.00,
                used: 0.00,
                status: "POR_REVISAR",
                docsVerified: false,
                origin: "FACTURA_XML"
            });
            addedCount++;
        }
    });

    if(addedCount > 0 || payers.length !== (JSON.parse(localStorage.getItem('tqa_pagadores'))?.length || 0)) {
        localStorage.setItem('tqa_pagadores', JSON.stringify(payers));
    }
    return addedCount;
}

// --- RENDERIZADO ---
function loadPayers() {
    const payers = JSON.parse(localStorage.getItem('tqa_pagadores')) || [];
    const txtSearch = (document.getElementById('searchPayer').value || '').toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;

    const tbody = document.getElementById('payersTableBody');
    tbody.innerHTML = '';

    const filtered = payers.filter(p => {
        const matchText = (p.name || '').toLowerCase().includes(txtSearch) || (p.ruc || '').includes(txtSearch);
        const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
        return matchText && matchStatus;
    });

    // Actualizar contador
    document.getElementById('totalPayersCount').textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#999;">
            No se encontraron pagadores.<br><small>Use el botón 'Sincronizar' si acaba de crear uno.</small>
        </td></tr>`;
        return;
    }

    filtered.forEach(p => {
        // Badges y Botones
        let statusBadge = '';
        let btnText = 'Revisar';
        let btnClass = 'primary';
        let icon = 'fa-magnifying-glass';

        if(p.status === 'POR_REVISAR') {
            statusBadge = '<span class="badge warn">⚠️ Pendiente Revisión</span>';
        } else if (p.status === 'ENVIADO_APROBADOR') {
            statusBadge = '<span class="badge" style="background:#e3f2fd; color:#1565c0;">✈️ En Aprobación</span>';
            btnText = 'Ver Detalle';
            btnClass = 'ghost';
            icon = 'fa-eye';
        } else if (p.status === 'CALIFICADO' || p.status === 'ACTIVO') {
            statusBadge = '<span class="badge ok">✅ Calificado</span>';
            btnText = 'Docs';
            btnClass = 'ghost';
            icon = 'fa-folder';
        } else if (p.status === 'BLOQUEADO') {
            statusBadge = '<span class="badge bad">⛔ Bloqueado</span>';
            btnText = 'Info';
            btnClass = 'ghost';
        }

        const cupoVal = p.quota ? parseFloat(p.quota).toLocaleString('en-US', {minimumFractionDigits: 2}) : "0.00";

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight:700; color:var(--primary); font-size:13px;">${p.name}</div>
                <div style="font-size:11px; color:#666;">RUC: ${p.ruc}</div>
                ${p.origin === 'SOLICITUD_DIRECTA' ? '<span style="font-size:10px; color:#d35400; font-weight:bold;">★ Solicitud Web</span>' : ''}
            </td>
            <td>
                <div style="font-size:13px;">${p.client}</div>
            </td>
            <td style="text-align:center;">
                <div style="font-weight:bold; font-size:14px;">${p.rating || '-'}</div>
            </td>
            <td>
                ${statusBadge}
                <div style="font-size:10px; margin-top:4px; color:#666;">Cupo: $${cupoVal}</div>
            </td>
            <td style="text-align:center;">
                <button class="btn ${btnClass} small" onclick="openReviewModal('${p.id}')">
                    <i class="fa-solid ${icon}"></i> ${btnText}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// === MODAL DE REVISIÓN ===
window.openReviewModal = (id) => {
    const payers = JSON.parse(localStorage.getItem('tqa_pagadores'));
    const p = payers.find(item => item.id === id);
    if (!p) return;

    currentIdToReview = id;

    document.getElementById('modalTitle').textContent = "Revisión: " + p.name;
    document.getElementById('lblCupo').textContent = "$" + parseFloat(p.quota || 0).toLocaleString();
    document.getElementById('lblStatus').textContent = (p.status || '').replace(/_/g, ' ');

    // Lógica visual del checklist
    const isPending = (p.status === 'POR_REVISAR');
    
    document.querySelectorAll('.doc-check').forEach(chk => {
        chk.checked = !isPending; 
        chk.disabled = !isPending; 
    });
    
    const txtObs = document.getElementById('txtObservation');
    txtObs.value = p.observation || "";
    txtObs.disabled = !isPending;

    // Mostrar/Ocultar botón enviar
    const btnSend = document.getElementById('btnSendReview');
    if(btnSend) {
        btnSend.style.display = isPending ? 'inline-flex' : 'none';
    }

    document.getElementById('reviewModal').style.display = 'flex';
};

window.closeModal = () => {
    document.getElementById('reviewModal').style.display = 'none';
};

window.sendToApprover = () => {
    // Validar Checkbox
    const checks = document.querySelectorAll('.doc-check');
    let allChecked = true;
    checks.forEach(c => { if(!c.checked) allChecked = false; });

    if(!allChecked) {
        alert("⚠️ Debe marcar todos los documentos como revisados.");
        return;
    }

    const obs = document.getElementById('txtObservation').value;

    // Actualizar Estado
    let payers = JSON.parse(localStorage.getItem('tqa_pagadores'));
    const idx = payers.findIndex(p => p.id === currentIdToReview);
    
    if(idx >= 0) {
        payers[idx].status = "ENVIADO_APROBADOR";
        payers[idx].observation = obs;
        payers[idx].docsVerified = true;
        
        localStorage.setItem('tqa_pagadores', JSON.stringify(payers));
        
        alert("✅ Enviado al Aprobador correctamente.");
        closeModal();
        loadPayers();
    }
};