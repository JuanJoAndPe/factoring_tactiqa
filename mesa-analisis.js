// Variables globales
let currentTask = null;
let currentType = null;

document.addEventListener('DOMContentLoaded', () => {
    loadInbox();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'report') loadReport();
}

// --- 1. CARGAR BANDEJA UNIFICADA ---
async function loadInbox() {
    const container = document.getElementById('taskList');
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> Consultando base de datos...</div>';

    try {
        // Consultamos las 3 fuentes de datos EN PARALELO
        const [resOps, resCli, resPag] = await Promise.all([
            fetch(`${API_URL}/operaciones`),
            fetch(`${API_URL}/clientes`),
            fetch(`${API_URL}/pagadores`)
        ]);

        const dataOps = resOps.ok ? await resOps.json() : { items: [] };
        const dataCli = resCli.ok ? await resCli.json() : { items: [] };
        const dataPag = resPag.ok ? await resPag.json() : { items: [] };

        const allOps = dataOps.items || [];
        const allCli = dataCli.items || [];
        const allPag = dataPag.items || [];

        let tasks = [];

        // --- A) CLIENTES (SIN FILTROS: MUESTRA TODO LO QUE EXISTA) ---
        allCli.forEach(c => {
            // Normalizamos el estado. Si viene vacío o null, le ponemos "SIN ESTADO"
            const estado = c.estado ? c.estado.toUpperCase() : 'SIN ESTADO';
            
            // --- CAMBIO CLAVE: NO HAY IF --- 
            // Agregamos TODOS los clientes a la lista sin importar su estado.
            
            let iconColor = '#999'; // Gris por defecto
            let statusText = estado;

            if(estado === 'ACTIVO') { iconColor = '#27ae60'; statusText = '🟢 ACTIVO'; }
            if(estado === 'EN_REVISION') { iconColor = '#f39c12'; statusText = '🟡 EN REVISIÓN'; }
            if(estado === 'PENDIENTE_COMITE') { iconColor = '#e74c3c'; statusText = '🔴 POR APROBAR'; }
            if(estado === 'SIN ESTADO') { iconColor = '#7f8c8d'; statusText = '⚪ BORRADOR / NUEVO'; }

            tasks.push({
                type: 'CLIENT',
                id: c.id,
                title: c.razon_social || c.nombre || "Cliente Sin Nombre",
                subtitle: `RUC: ${c.ruc || 'S/N'} | Estado: ${statusText}`,
                date: c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleDateString() : "Fecha desc.",
                raw: c,
                color: iconColor
            });
        });

        // --- B) OPERACIONES ---
        allOps.forEach(op => {
            // Mostramos todas las operaciones excepto las eliminadas
            if (op.estado !== 'ELIMINADO') {
                tasks.push({
                    type: 'INVOICE',
                    id: op.id,
                    title: `Op. Facturas: ${op.cliente_nombre || 'Cliente'}`,
                    subtitle: `Monto: $${parseFloat(op.monto_total || 0).toFixed(2)} | Docs: ${op.cantidad_docs}`,
                    date: op.fecha_carga ? new Date(op.fecha_carga).toLocaleDateString() : "Reciente",
                    raw: op
                });
            }
        });

        // --- C) PAGADORES ---
        allPag.forEach(p => {
            if (p.estado !== 'ELIMINADO') {
                tasks.push({
                    type: 'PAYER',
                    id: p.ruc,
                    title: `Pagador: ${p.nombre || p.ruc}`,
                    subtitle: `RUC: ${p.ruc}`,
                    date: "Pendiente",
                    raw: p
                });
            }
        });

        // Actualizar contador
        document.getElementById('countPendientes').textContent = tasks.length;

        // Renderizar
        if (tasks.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">
                <i class="fa-solid fa-check-circle" style="font-size:40px; margin-bottom:10px; color:#e0e0e0;"></i><br>
                Bandeja vacía. No hay registros en la base de datos.
            </div>`;
            return;
        }

        container.innerHTML = '';
        tasks.forEach(task => {
            let icon = '';
            let typeClass = '';
            let customStyle = '';

            if (task.type === 'CLIENT') {
                icon = '<i class="fa-solid fa-user-tie"></i>';
                typeClass = 'type-client';
                if(task.color) customStyle = `background-color: ${task.color};`;
            } else if (task.type === 'INVOICE') {
                icon = '<i class="fa-solid fa-file-invoice-dollar"></i>';
                typeClass = 'type-invoice';
            } else {
                icon = '<i class="fa-solid fa-building"></i>';
                typeClass = 'type-payer';
            }

            const safeTask = encodeURIComponent(JSON.stringify(task));

            container.innerHTML += `
            <div class="task-card">
                <div style="display:flex; align-items:center;">
                    <div class="task-icon ${typeClass}" style="${customStyle}">${icon}</div>
                    <div>
                        <div style="font-weight:bold; color:#333;">${task.title}</div>
                        <div style="font-size:12px; color:#666;">${task.subtitle}</div>
                    </div>
                </div>
                <button class="btn small primary" onclick="abrirAnalisis('${safeTask}')">Analizar</button>
            </div>`;
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color:#c0392b; padding:20px; text-align:center;">Error de conexión: ${e.message}</div>`;
    }
}

// --- 2. ABRIR MODAL DE ANÁLISIS ---
window.abrirAnalisis = async (safeTask) => {
    const task = JSON.parse(decodeURIComponent(safeTask));
    currentTask = task.raw;
    currentType = task.type;

    const modalTitle = document.getElementById('modalTitle');
    const infoGrid = document.getElementById('modalInfoGrid');
    const prevSection = document.getElementById('prevAnalysisSection');
    const docList = document.getElementById('modalDocList');
    
    // Limpiar UI
    document.getElementById('modalObs').value = '';
    document.getElementById('analysisModal').style.display = 'flex';
    docList.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando expediente...</div>';

    // === CASO A: CLIENTE ===
    if (task.type === 'CLIENT') {
        modalTitle.innerText = "Evaluación de Riesgo: Cliente";
        
        let informeOp = {};
        try { informeOp = typeof currentTask.informe_riesgo === 'string' ? JSON.parse(currentTask.informe_riesgo) : (currentTask.informe_riesgo || {}); } catch(e) {}

        // Validar campos para que no salga "undefined"
        const score = informeOp.score || 'Pendiente';
        const capPago = informeOp.capacidadPago || '$0.00';

        infoGrid.innerHTML = `
            <div class="info-item"><label>Razón Social</label><span>${currentTask.razon_social || currentTask.nombre}</span></div>
            <div class="info-item"><label>RUC</label><span>${currentTask.ruc}</span></div>
            <div class="info-item"><label>Estado Actual</label><span>${currentTask.estado || 'SIN ESTADO'}</span></div>
            <div class="info-item"><label>Score (Operativo)</label><span>${score}</span></div>
        `;

        if(prevSection) {
            prevSection.style.display = 'block';
            document.getElementById('prevAnalysisText').innerText = informeOp.conclusion || "Sin informe previo cargado.";
        }

        // Cargar Documentos del Cliente
        let docs = [];
        try { docs = typeof currentTask.documentos_financieros === 'string' ? JSON.parse(currentTask.documentos_financieros) : (currentTask.documentos_financieros || []); } catch(e) {}
        renderDocs(docs);

    // === CASO B: OPERACIÓN ===
    } else if (task.type === 'INVOICE') {
        modalTitle.innerText = "Aprobación de Operación";
        if(prevSection) prevSection.style.display = 'none';

        infoGrid.innerHTML = `
            <div class="info-item"><label>Cliente</label><span>${currentTask.cliente_nombre}</span></div>
            <div class="info-item"><label>Pagador</label><span>${currentTask.pagador_ruc || 'Varios'}</span></div>
            <div class="info-item"><label>Monto</label><span style="color:#27ae60;">$${parseFloat(currentTask.monto_total).toFixed(2)}</span></div>
            <div class="info-item"><label>Docs</label><span>${currentTask.cantidad_docs} Facturas</span></div>
        `;

        try {
            const res = await fetch(`${API_URL}/operaciones/documentos?id=${currentTask.id}`);
            const data = await res.json();
            renderDocs(data.facturas || [], true);
        } catch (e) {
            docList.innerHTML = 'Error cargando documentos.';
        }

    // === CASO C: PAGADOR ===
    } else if (task.type === 'PAYER') {
        modalTitle.innerText = "Calificación de Pagador";
        if(prevSection) prevSection.style.display = 'none';

        infoGrid.innerHTML = `
            <div class="info-item"><label>Razón Social</label><span>${currentTask.nombre}</span></div>
            <div class="info-item"><label>RUC</label><span>${currentTask.ruc}</span></div>
            <div class="info-item"><label>Tipo</label><span>Pagador</span></div>
            <div class="info-item"><label>Estado</label><span>${currentTask.estado}</span></div>
        `;

        const docsPagador = [];
        if (currentTask.doc_ruc) docsPagador.push({ name: "Copia de RUC", url: currentTask.doc_ruc });
        if (currentTask.doc_otros) docsPagador.push({ name: "Informe Buró / Otros", url: currentTask.doc_otros });
        
        renderDocs(docsPagador);
    }
};

// --- RENDERIZAR DOCUMENTOS ---
function renderDocs(docs, isOp = false) {
    const list = document.getElementById('modalDocList');
    if (!docs || docs.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">No hay documentos digitales disponibles.</div>';
        return;
    }
    list.innerHTML = '';
    docs.forEach(d => {
        const url = isOp ? d.url_pdf : d.url;
        const name = isOp ? `Factura ${d.clave_acceso ? d.clave_acceso.slice(-8) : 'XML'} - $${d.monto}` : (d.name || 'Documento');
        
        list.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
            <div style="font-size:13px; display:flex; align-items:center; gap:8px;">
                <i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i> ${name}
            </div>
            <button class="btn-icon" onclick="openSecureDocument('${url}')" style="cursor:pointer; border:none; background:#f0f4f8; padding:5px 10px; border-radius:4px;">
                <i class="fa-solid fa-eye" style="color:#1F3A5F;"></i> Ver
            </button>
        </div>`;
    });
}

// --- 3. ENVIAR RESOLUCIÓN ---
window.submitResolution = async (decision) => {
    const obs = document.getElementById('modalObs').value;
    if (!obs && decision === 'RECHAZADO') return alert("Para rechazar, es obligatorio ingresar el motivo.");

    if (!confirm(`¿Confirmar resolución: ${decision}?`)) return;

    const btn = event.target;
    btn.disabled = true;
    btn.innerText = "Guardando...";

    try {
        let payload = {};
        let endpoint = '';
        let method = 'PUT';

        if (currentType === 'CLIENT') {
            endpoint = `/clientes?id=${currentTask.id}`;
            // Si apruebas, pasa a ACTIVO. Si rechazas, a CORRECCION.
            payload = { estado: decision === 'APROBADO' ? 'ACTIVO' : 'CORRECCION' };

        } else if (currentType === 'INVOICE') {
            endpoint = `/operaciones`;
            method = 'POST';
            payload = {
                id: currentTask.id,
                cliente_id: currentTask.cliente_id,
                pagador_ruc: currentTask.pagador_ruc,
                cantidad_docs: currentTask.cantidad_docs,
                monto_total: currentTask.monto_total,
                estado: decision === 'APROBADO' ? 'COMITE' : 'RECHAZADO',
                creado_por: 'MESA_RIESGOS'
            };

        } else if (currentType === 'PAYER') {
            endpoint = `/pagadores`;
            method = 'POST'; 
            payload = {
                ruc: currentTask.ruc,
                nombre: currentTask.nombre,
                estado: decision === 'APROBADO' ? 'ACTIVO' : 'RECHAZADO',
                doc_ruc: currentTask.doc_ruc,
                doc_otros: currentTask.doc_otros
            };
        }

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Resolución guardada correctamente.");
            closeModal();
            loadInbox();
        } else {
            throw new Error("Error en la respuesta del servidor.");
        }

    } catch (e) {
        console.error(e);
        alert("Error al procesar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirmar";
    }
};

window.closeModal = () => document.getElementById('analysisModal').style.display = 'none';

window.openSecureDocument = async (publicUrl) => {
    if (!publicUrl) return;
    try {
        const urlObj = new URL(publicUrl);
        const key = urlObj.pathname.substring(1); 
        
        const btn = event.target.closest('button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const res = await fetch(`${API_URL}/files/read-url?key=${encodeURIComponent(key)}`);
        const data = await res.json();
        
        btn.innerHTML = originalHTML;

        if (data.success) {
            window.open(data.url, '_blank');
        } else {
            alert("Acceso denegado: " + (data.message || "Archivo privado"));
        }
    } catch (e) { 
        console.error(e);
        alert("Error al intentar abrir el archivo.");
    }
};

async function loadReport() {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Historial de resoluciones (Próximamente)...</td></tr>';
}