// Variable para guardar la operación actual
let currentAnalysisOp = null;

document.addEventListener('DOMContentLoaded', () => {
    // Si usas auth.js, descomenta esto:
    // if (typeof checkAuth === 'function') checkAuth();
    loadInbox();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'report') loadReport();
}

// --- 1. CARGAR BANDEJA DEL ANALISTA ---
async function loadInbox() {
    const container = document.getElementById('taskList');
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> Conectando...</div>';

    try {
        // Obtenemos API_URL de auth.js o la definimos si falla
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        
        const res = await fetch(`${apiUrl}/operaciones`);
        if (!res.ok) throw new Error("Error de conexión");
        
        const data = await res.json();
        const todas = data.items || [];

        // FILTRO CRUCIAL: Solo lo que el Operativo ya validó
        const pendientes = todas.filter(op => {
            const st = (op.estado || '').toUpperCase().trim();
            // Aceptamos APROBADO_OPERATIVO (lo que viene del paso 2) o PENDIENTE_ANALISIS
            return st === 'APROBADO_OPERATIVO' || st === 'PENDIENTE_ANALISIS';
        });

        const countEl = document.getElementById('countPendientes');
        if(countEl) countEl.textContent = pendientes.length;

        if(pendientes.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">Bandeja limpia.<br><small>Esperando validaciones del equipo Operativo.</small></div>`;
            return;
        }

        container.innerHTML = '';
        pendientes.forEach(item => {
            const monto = item.monto_total ? `$${parseFloat(item.monto_total).toFixed(2)}` : '$0.00';
            const cliente = item.cliente_nombre || "Cliente";
            // Guardamos el objeto completo encodeado para pasarlo al click
            const itemStr = encodeURIComponent(JSON.stringify(item));

            container.innerHTML += `
            <div class="task-card">
                <div style="display:flex; align-items:center;">
                    <div class="task-icon type-operacion"><i class="fa-solid fa-chart-line"></i></div>
                    <div>
                        <div style="font-weight:bold; color:#333;">${cliente}</div>
                        <div style="font-size:12px; color:#666;">ID: ${item.id} • Monto: <b style="color:#27ae60;">${monto}</b></div>
                    </div>
                </div>
                <button class="btn small primary" onclick="abrirAnalisis('${itemStr}')">Analizar</button>
            </div>`;
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="color:red; padding:20px; text-align:center;">Error cargando datos.</div>';
    }
}

// --- 2. ABRIR MODAL Y CARGAR DOCUMENTOS ---
window.abrirAnalisis = async (itemStr) => {
    const item = JSON.parse(decodeURIComponent(itemStr));
    currentAnalysisOp = item; 

    // Llenar datos del modal
    document.getElementById('modalClientName').innerText = item.cliente_nombre || "Cliente";
    document.getElementById('modalAmount').innerText = item.monto_total ? `$${parseFloat(item.monto_total).toFixed(2)}` : '$0.00';
    document.getElementById('modalObs').value = '';
    
    // Mostrar Modal
    document.getElementById('analysisModal').style.display = 'flex';
    
    // Cargar Documentos del Backend
    const list = document.getElementById('modalDocList');
    list.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando archivos...</div>';

    try {
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/operaciones/documentos?id=${item.id}`);
        const data = await res.json();

        list.innerHTML = ''; 

        if (data.success && data.facturas && data.facturas.length > 0) {
            data.facturas.forEach(doc => {
                let icon = '<i class="fa-regular fa-file" style="color:#666;"></i>';
                if (doc.url_pdf && doc.url_pdf.includes('.xml')) icon = '<i class="fa-regular fa-file-code" style="color:#e67e22;"></i>';
                else if (doc.url_pdf) icon = '<i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i>';

                list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${icon}
                        <div style="font-size:13px;">
                            <div>Factura/Doc: ...${doc.clave_acceso ? doc.clave_acceso.slice(-8) : 'S/N'}</div>
                            <div style="font-size:11px; color:#666;">$${doc.monto || '0.00'}</div>
                        </div>
                    </div>
                    <button class="btn-icon" onclick="openSecureDocument('${doc.url_pdf}')" title="Ver" style="cursor:pointer; border:none; background:#f0f4f8; padding:5px 10px; border-radius:4px;">
                        <i class="fa-solid fa-eye" style="color:#2A4A73;"></i>
                    </button>
                </div>`;
            });
        } else {
             list.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">No hay documentos adjuntos.</div>';
        }

    } catch (e) {
        list.innerHTML = '<div style="color:red; font-size:12px;">Error cargando documentos.</div>';
    }
};

// --- 3. VER DOCUMENTOS (Link Seguro S3) ---
window.openSecureDocument = async (publicUrl) => {
    if (!publicUrl) return;
    try {
        const urlObj = new URL(publicUrl);
        const key = urlObj.pathname.substring(1); 
        
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/files/read-url?key=${encodeURIComponent(key)}`);
        const data = await res.json();

        if (data.success) {
            window.open(data.url, '_blank');
        } else {
            alert("No se pudo abrir el archivo.");
        }
    } catch (e) {
        console.error(e);
        alert("Error al intentar abrir el documento.");
    }
};

// --- 4. ENVIAR AL COMITÉ (Paso 4) ---
window.submitResolution = async (decision) => {
    if (!currentAnalysisOp) return;

    const obs = document.getElementById('modalObs').value;
    if (!obs && decision === 'RECHAZADO') return alert("Para rechazar, debe ingresar una observación.");

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Procesando...";
    btn.disabled = true;

    // Payload completo para el Backend
    const payload = {
        id: currentAnalysisOp.id,
        cliente_id: currentAnalysisOp.cliente_id,
        pagador_ruc: currentAnalysisOp.pagador_ruc,
        cantidad_docs: currentAnalysisOp.cantidad_docs,
        monto_total: currentAnalysisOp.monto_total,
        estado: decision, // 'COMITE' o 'RECHAZADO'
        creado_por: 'ANALISTA' 
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
            alert(`✅ Operación enviada correctamente a: ${decision}`);
            closeModal();
            loadInbox(); // Recargar lista
        } else {
            throw new Error(data.message || "Error al guardar");
        }

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.closeModal = () => {
    document.getElementById('analysisModal').style.display = 'none';
};

// --- REPORTE ---
async function loadReport() {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    try {
        const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
        const res = await fetch(`${apiUrl}/operaciones`);
        const data = await res.json();
        const historial = (data.items || []).filter(op => ['COMITE', 'RECHAZADO', 'DESEMBOLSADO'].includes((op.estado||'').toUpperCase()));
        
        tbody.innerHTML = '';
        historial.forEach(item => {
            tbody.innerHTML += `<tr>
                <td>${new Date(item.fecha_carga).toLocaleDateString()}</td>
                <td>OPERACIÓN</td>
                <td>${item.cliente_nombre}</td>
                <td>${item.estado}</td>
            </tr>`;
        });
    } catch (e) {}
}