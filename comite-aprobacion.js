// Variable para la operación actual
let currentComiteOp = null;

document.addEventListener('DOMContentLoaded', () => {
    loadInbox();
});

function switchTab(tabId) {
    // Manejo visual de pestañas
    document.getElementById('inbox').style.display = 'none';
    document.getElementById('report').style.display = 'none';
    document.getElementById('tab-inbox').style.color = 'var(--muted)';
    document.getElementById('tab-inbox').style.borderBottomColor = 'transparent';
    document.getElementById('tab-report').style.color = 'var(--muted)';
    document.getElementById('tab-report').style.borderBottomColor = 'transparent';

    document.getElementById(tabId).style.display = 'block';
    
    // Activar pestaña seleccionada
    const activeBtn = document.getElementById(`tab-${tabId}`);
    activeBtn.style.color = 'var(--primary)';
    activeBtn.style.borderBottomColor = 'var(--primary)';

    if(tabId === 'report') loadReport();
}

// --- 1. CARGAR BANDEJA ---
async function loadInbox() {
    const container = document.getElementById('taskList');
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--muted);"><i class="fa-solid fa-spinner fa-spin"></i> Conectando...</div>';

    try {
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        
        const res = await fetch(`${apiUrl}/operaciones`);
        if (!res.ok) throw new Error("Error de conexión");
        
        const data = await res.json();
        const todas = data.items || [];

        // Filtro: COMITE
        const pendientes = todas.filter(op => {
            const st = (op.estado || '').toUpperCase().trim();
            return st === 'COMITE' || st === 'PENDIENTE_COMITE';
        });

        const countEl = document.getElementById('countPendientes');
        if(countEl) countEl.textContent = pendientes.length;

        if(pendientes.length === 0) {
            container.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:var(--muted);">
                <i class="fa-solid fa-check-circle" style="font-size:40px; margin-bottom:15px; opacity:0.2;"></i>
                <br>No hay operaciones pendientes de comité.
            </div>`;
            return;
        }

        container.innerHTML = '';
        
        pendientes.forEach(item => {
            const monto = item.monto_total ? `$${parseFloat(item.monto_total).toFixed(2)}` : '$0.00';
            const cliente = item.cliente_nombre || "Cliente Desconocido";
            const itemStr = encodeURIComponent(JSON.stringify(item));
            const fecha = item.fecha_carga ? new Date(item.fecha_carga).toLocaleDateString() : 'Hoy';

            // HTML Estilo Corporativo
            container.innerHTML += `
            <div class="operation-card">
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:40px; height:40px; background:var(--bg); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--primary);">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </div>
                    <div class="op-info">
                        <h4>${cliente}</h4>
                        <p><span class="op-tag tag-comite">POR APROBAR</span> • ID: ${item.id} • ${fecha}</p>
                    </div>
                </div>
                
                <div style="text-align:right; display:flex; align-items:center; gap:20px;">
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Monto Total</div>
                        <div style="font-size:16px; font-weight:bold; color:var(--text);">${monto}</div>
                    </div>
                    <button class="btn primary small" onclick="abrirComite('${itemStr}')">
                        Revisar
                    </button>
                </div>
            </div>`;
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="color:var(--error-text); padding:20px; text-align:center;">No se pudieron cargar las operaciones.</div>';
    }
}

// --- 2. MODAL Y DOCUMENTOS ---
window.abrirComite = async (itemStr) => {
    const item = JSON.parse(decodeURIComponent(itemStr));
    currentComiteOp = item; 

    // UI
    document.getElementById('modalClientName').innerText = item.cliente_nombre || "Cliente";
    document.getElementById('modalPagador').innerText = `Pagador: ${item.pagador_ruc || 'N/A'}`;
    document.getElementById('modalAmount').innerText = item.monto_total ? `$${parseFloat(item.monto_total).toFixed(2)}` : '$0.00';
    document.getElementById('modalObs').value = '';
    
    // Mostrar Modal
    document.getElementById('comiteModal').style.display = 'flex';
    
    // Documentos
    const list = document.getElementById('modalDocList');
    list.innerHTML = '<div style="padding:15px; text-align:center; color:var(--muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</div>';

    try {
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/operaciones/documentos?id=${item.id}`);
        const data = await res.json();

        list.innerHTML = ''; 

        if (data.success && data.facturas && data.facturas.length > 0) {
            data.facturas.forEach(doc => {
                let icon = '<i class="fa-regular fa-file"></i>';
                if (doc.url_pdf && doc.url_pdf.includes('.xml')) icon = '<i class="fa-regular fa-file-code" style="color:#e67e22;"></i>';
                else if (doc.url_pdf) icon = '<i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i>';

                list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--line);">
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${icon}
                        <div style="font-size:13px;">
                            <div style="font-weight:500;">Factura Electrónica</div>
                            <div style="font-size:11px; color:var(--muted);">$${doc.monto || '0.00'}</div>
                        </div>
                    </div>
                    <button class="btn ghost small" onclick="openSecureDocument('${doc.url_pdf}')" title="Ver Documento">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>`;
            });
        } else {
             list.innerHTML = '<div style="padding:15px; text-align:center; color:var(--muted); font-size:13px;">No hay documentos adjuntos.</div>';
        }
    } catch (e) {
        list.innerHTML = '<div style="color:var(--error-text); font-size:12px; padding:10px;">Error al obtener documentos.</div>';
    }
};

window.openSecureDocument = async (publicUrl) => {
    if (!publicUrl) return;
    try {
        const urlObj = new URL(publicUrl);
        const key = urlObj.pathname.substring(1); 
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/files/read-url?key=${encodeURIComponent(key)}`);
        const data = await res.json();

        if (data.success) window.open(data.url, '_blank');
        else alert("Acceso denegado.");
    } catch (e) { console.error(e); }
};

// --- 3. DECISIÓN ---
window.submitDecision = async (decision) => {
    if (!currentComiteOp) return;
    const obs = document.getElementById('modalObs').value;
    
    // Validación simple
    if (!obs && decision === 'RECHAZADO') return alert("Debe ingresar el motivo del rechazo.");

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Procesando...";
    btn.disabled = true;

    const payload = {
        id: currentComiteOp.id,
        cliente_id: currentComiteOp.cliente_id,
        pagador_ruc: currentComiteOp.pagador_ruc,
        cantidad_docs: currentComiteOp.cantidad_docs,
        monto_total: currentComiteOp.monto_total,
        estado: decision, 
        creado_por: 'COMITE'
    };

    try {
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/operaciones`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            closeModal();
            loadInbox();
        } else {
            alert("Error: " + (data.message || "No se pudo guardar"));
        }
    } catch (e) {
        alert("Error de conexión");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.closeModal = () => document.getElementById('comiteModal').style.display = 'none';

// --- REPORTE ---
async function loadReport() {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando...</td></tr>';
    try {
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/operaciones`);
        const data = await res.json();
        const historial = (data.items || []).filter(op => ['DESEMBOLSADO', 'APROBADO_FINAL', 'RECHAZADO'].includes((op.estado||'').toUpperCase()));
        
        tbody.innerHTML = '';
        if(historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:20px;">Sin registros recientes.</td></tr>';
            return;
        }

        historial.forEach(item => {
            let color = item.estado === 'DESEMBOLSADO' ? 'var(--success-text)' : 'var(--error-text)';
            let bg = item.estado === 'DESEMBOLSADO' ? 'var(--success-bg)' : 'var(--error-bg)';
            
            tbody.innerHTML += `<tr>
                <td>${new Date(item.fecha_carga).toLocaleDateString()}</td>
                <td>${item.cliente_nombre}</td>
                <td style="font-weight:bold;">$${item.monto_total}</td>
                <td><span style="background:${bg}; color:${color}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${item.estado}</span></td>
            </tr>`;
        });
    } catch (e) {}
}