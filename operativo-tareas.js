// URL DE TU API GATEWAY
const API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';

document.addEventListener('DOMContentLoaded', () => {
    loadDynamicTasks();
});

// Variables globales
let loadedClients = [];
let loadedOps = [];
let loadedPagadores = []; // <--- NUEVO

let currentTaskType = null;
let currentTaskId = null;
let currentTaskData = null;

// --- CARGA DE DATOS DESDE AWS ---
async function loadDynamicTasks() {
    const container = document.getElementById('taskListContainer');
    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Conectando con servidor...</p>';

    try {
        console.log("--- Consultando API (Clientes, Operaciones y Pagadores) ---");

        // 1. Peticiones paralelas (AHORA INCLUYE PAGADORES)
        const [resClientes, resOperaciones, resPagadores] = await Promise.all([
            fetch(`${API_URL}/clientes`),
            fetch(`${API_URL}/operaciones`),
            fetch(`${API_URL}/pagadores`) // <--- NUEVA FUENTE
        ]);

        if (!resClientes.ok || !resOperaciones.ok) throw new Error("Error en la respuesta del servidor");
        // Si pagadores falla (ej. tabla vacía), no bloqueamos todo, asumimos array vacío
        const dataPagadores = resPagadores.ok ? await resPagadores.json() : { items: [] };

        const dataClientes = await resClientes.json();
        const dataOperaciones = await resOperaciones.json();

        const rawClients = dataClientes.items || [];
        console.log("=== LISTA CRUDA DE CLIENTES (DESDE BD) ===");
        console.table(rawClients.map(c => ({ Nombre: c.nombre || c.razon_social, Estado: c.estado, RUC: c.ruc })));

        const rawOps = dataOperaciones.items || [];
        const rawPagadores = dataPagadores.items || [];

        // 2. FILTROS DE "BANDEJA DE ENTRADA"
        // Aquí capturamos todo lo que venga de Comercial, Cliente o Registro Público

        // A) Clientes (Nuevos registros)
        loadedClients = rawClients.filter(c => {
            const estado = (c.estado || '').toUpperCase().trim();
            
            // Ocultamos lo que ya está terminado o no requiere acción
            const excluidos = ['ACTIVO', 'ELIMINADO', 'BLOQUEADO', 'RECHAZADO'];
            
            // Si el estado NO está en la lista de excluidos, se muestra en la bandeja
            return !excluidos.includes(estado);
        });

        // B) Operaciones (Facturas subidas por Cliente o Comercial)
        loadedOps = rawOps.filter(o => {
            const estado = (o.estado || '').toUpperCase().trim();
            // Aceptamos variantes de nombres para asegurar que no se pierda nada
            return ['EN_REVISION', 'PENDIENTE', 'EN_REVISION_OPERATIVA', 'PENDIENTE_OPERATIVO'].includes(estado);
        });

        // C) Pagadores (Solicitudes de calificación de Cliente o Comercial)
        loadedPagadores = rawPagadores.filter(p => {
            const estado = (p.estado || '').toUpperCase().trim();
            return ['EN_REVISION', 'PENDIENTE'].includes(estado);
        });

        console.log(`Cargados: ${loadedClients.length} Clientes, ${loadedOps.length} Ops, ${loadedPagadores.length} Pagadores.`);

        // 3. UNIFICAR EN UNA SOLA LISTA DE TAREAS
        let tasks = [];

        // Mapeo Clientes
        loadedClients.forEach(c => {
            tasks.push({
                id: c.ruc || c.id,
                dbId: c.id,
                type: "CLIENT",
                title: c.razon_social || c.nombre || "Nuevo Cliente",
                subtitle: `Solicitud de Alta | RUC: ${c.ruc || 'S/N'}`,
                date: c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleDateString() : "Reciente",
                originalData: c
            });
        });

        // Mapeo Operaciones
        loadedOps.forEach(op => {
            tasks.push({
                id: op.id,
                type: "INVOICE",
                title: op.cliente_nombre || "Operación de Factoring",
                subtitle: `Monto: $${parseFloat(op.monto_total || 0).toFixed(2)} | Pagador: ${op.pagador_nombre || '---'}`,
                date: op.fecha_carga ? new Date(op.fecha_carga).toLocaleDateString() : "Reciente",
                originalData: op
            });
        });

        // Mapeo Pagadores (NUEVO)
        loadedPagadores.forEach(p => {
            tasks.push({
                id: p.ruc, // El ID del pagador es su RUC
                type: "PAYER",
                title: p.nombre || p.razon_social || "Nuevo Pagador",
                subtitle: `Solicitud de Cupo/Calificación | RUC: ${p.ruc}`,
                date: p.fecha || "Reciente",
                originalData: p
            });
        });

        renderTasks(tasks);

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#e74c3c;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; margin-bottom: 15px;"></i>
                <br>Error de conexión. <small>${error.message}</small>
            </div>`;
    }
}

// --- RENDERIZADO VISUAL ---
function renderTasks(tasksToRender) {
    const container = document.getElementById('taskListContainer');
    container.innerHTML = '';

    if (tasksToRender.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px; color:#999;">
                <i class="fa-solid fa-check-circle" style="font-size: 50px; margin-bottom: 20px; color:#e0e0e0;"></i>
                <br>¡Todo al día! No hay tareas pendientes.
            </div>`;
        return;
    }

    tasksToRender.forEach(task => {
        let badgeClass = '';
        let typeLabel = '';
        let icon = '';
        let btnClass = 'primary';
        let btnText = 'Revisar';

        if (task.type === 'CLIENT') {
            badgeClass = 'type-client';
            typeLabel = 'ALTA CLIENTE';
            icon = '<i class="fa-solid fa-user-plus"></i>';
        } else if (task.type === 'INVOICE') {
            badgeClass = 'type-invoice';
            typeLabel = 'OPERACIÓN';
            icon = '<i class="fa-solid fa-file-invoice-dollar"></i>';
            btnClass = 'success';
            btnText = 'Validar';
        } else if (task.type === 'PAYER') { // Estilo para Pagador
            badgeClass = 'type-client'; // Reusamos estilo azul
            typeLabel = 'CALIFICAR PAGADOR';
            icon = '<i class="fa-solid fa-building"></i>';
            btnText = 'Calificar';
        }

        // Determinar ID seguro para pasar a la función
        const idParam = (task.type === 'CLIENT') ? task.dbId : task.id;

        const html = `
            <div class="task-card">
                <div class="task-info">
                    <div class="task-meta">
                        <span class="task-type ${badgeClass}" style="display:flex; gap:5px; align-items:center;">
                            ${icon} ${typeLabel}
                        </span>
                        <span><i class="fa-regular fa-clock"></i> ${task.date}</span>
                    </div>
                    <div class="task-title">${task.title}</div>
                    <div style="font-size:13px; color:#666;">${task.subtitle}</div>
                </div>
                <div class="task-actions">
                    <button class="btn small ${btnClass}" onclick="openReviewModal('${task.type}', '${task.id}', '${task.dbId || ''}')">
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- MODAL DE REVISIÓN (CEREBRO) ---
window.openReviewModal = async (type, displayId, dbId) => {
    currentTaskType = type;
    currentTaskId = displayId; 
    
    const docList = document.getElementById('modalDocList');
    const modalTitle = document.getElementById('modalTitle');
    const clientNameDisplay = document.getElementById('modalClientName');
    const extraInfoDisplay = document.getElementById('modalExtraInfo');
    const actionBtn = document.getElementById('modalMainActionBtn');
    
    // Resetear UI
    document.getElementById('modalObs').value = ''; 
    docList.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>';
    document.getElementById('reviewModal').classList.add('active');

    // === CASO 1: CLIENTES NUEVOS ===
    if (type === 'CLIENT') {
        const client = loadedClients.find(c => c.id == dbId || c.ruc == displayId);
        currentTaskData = client;
        modalTitle.innerText = "Revisión de Cliente Nuevo";
        clientNameDisplay.innerText = client ? (client.razon_social || client.nombre) : "Cliente";
        extraInfoDisplay.innerText = `RUC: ${client.ruc || 'S/N'} | Origen: Registro Web`;
        actionBtn.innerText = "Ir a Informe de Riesgo";
        actionBtn.className = "btn primary";
        docList.innerHTML = '<p class="small-note">La documentación legal se revisará en la etapa de Informe de Riesgo.</p>';

    // === CASO 2: OPERACIONES (FACTURAS) ===
    } else if (type === 'INVOICE') {
        const op = loadedOps.find(o => o.id === displayId);
        currentTaskData = op; 
        modalTitle.innerText = "Validación de Operación";
        clientNameDisplay.innerText = op ? op.cliente_nombre : "Operación";
        extraInfoDisplay.innerText = `ID Op: ${op.id} | Carga: ${op.creado_por || 'Cliente'}`;
        actionBtn.innerText = "Aprobar Operación";
        actionBtn.className = "btn success";

        // Fetch de facturas
        try {
            const response = await fetch(`${API_URL}/operaciones/documentos?id=${displayId}`);
            const data = await response.json();
            docList.innerHTML = ''; 

            if (data.success && data.facturas && data.facturas.length > 0) {
                data.facturas.forEach(doc => {
                    let icon = '<i class="fa-regular fa-file" style="color:#666;"></i>';
                    if (doc.url_pdf && doc.url_pdf.toLowerCase().includes('xml')) icon = '<i class="fa-regular fa-file-code" style="color:#e67e22;"></i>';
                    else if (doc.url_pdf) icon = '<i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i>';

                    const btnVer = doc.url_pdf 
                        ? `<button class="btn-icon" onclick="openSecureDocument('${doc.url_pdf}')" title="Ver"><i class="fa-solid fa-eye"></i></button>`
                        : `<span style="font-size:11px; color:#999;">--</span>`;

                    docList.innerHTML += `
                        <div class="doc-item">
                            <div class="doc-name">
                                ${icon}
                                <div>
                                    <div style="font-weight:500;">Factura ${doc.clave_acceso.substring(0, 10)}...</div>
                                    <div style="font-size:11px;">$${doc.monto} | SRI: ${doc.estado_sri}</div>
                                </div>
                            </div>
                            <div class="doc-actions">${btnVer}</div>
                        </div>`;
                });
            } else {
                docList.innerHTML = `<div style="text-align:center; color:#999;">Sin documentos adjuntos.</div>`;
            }
        } catch (error) {
            docList.innerHTML = `<p style="color:red;">Error docs: ${error.message}</p>`;
        }

    // === CASO 3: PAGADORES (NUEVO) ===
    } else if (type === 'PAYER') {
        const payer = loadedPagadores.find(p => p.ruc === displayId);
        currentTaskData = payer;
        modalTitle.innerText = "Calificación de Pagador";
        clientNameDisplay.innerText = payer.nombre || "Razón Social";
        extraInfoDisplay.innerText = `RUC: ${payer.ruc}`;
        actionBtn.innerText = "Aprobar y Activar";
        actionBtn.className = "btn primary";

        docList.innerHTML = '';
        
        // Documento RUC
        if (payer.doc_ruc) {
            docList.innerHTML += `
                <div class="doc-item">
                    <div class="doc-name"><i class="fa-solid fa-id-card" style="color:#2980b9;"></i> Copia de RUC</div>
                    <div class="doc-actions"><button class="btn-icon" onclick="openSecureDocument('${payer.doc_ruc}')"><i class="fa-solid fa-eye"></i></button></div>
                </div>`;
        }
        // Documento Historial/Otros
        if (payer.doc_otros) {
            docList.innerHTML += `
                <div class="doc-item">
                    <div class="doc-name"><i class="fa-solid fa-chart-line" style="color:#27ae60;"></i> Historial CXC / Buró</div>
                    <div class="doc-actions"><button class="btn-icon" onclick="openSecureDocument('${payer.doc_otros}')"><i class="fa-solid fa-eye"></i></button></div>
                </div>`;
        }

        if (!payer.doc_ruc && !payer.doc_otros) {
            docList.innerHTML = `<div style="text-align:center; color:#999;">Este pagador no tiene documentos adjuntos.</div>`;
        }
    }
};

window.closeModal = () => document.getElementById('reviewModal').classList.remove('active');

// --- EJECUTAR APROBACIÓN ---
// --- ACCIÓN PRINCIPAL (APROBAR / IR A INFORME) ---
window.submitReview = async () => {
    const actionBtn = document.getElementById('modalMainActionBtn');

    // CASO 1: OPERACIONES (FACTURAS)
    if (currentTaskType === 'INVOICE') {
        // ... (Tu código de facturas se queda igual, no lo toques) ...
        if (!currentTaskData) return alert("Error de datos.");

        const payload = {
            id: currentTaskData.id,
            cliente_id: currentTaskData.cliente_id,
            pagador_ruc: currentTaskData.pagador_ruc,
            cantidad_docs: currentTaskData.cantidad_docs,
            monto_total: currentTaskData.monto_total,
            estado: 'APROBADO_OPERATIVO',
            creado_por: currentTaskData.creado_por || 'OPERACIONES'
        };

        try {
            actionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
            actionBtn.disabled = true;

            const response = await fetch(`${API_URL}/operaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                alert("✅ Operación aprobada exitosamente.");
                closeModal();
                loadDynamicTasks(); 
            } else {
                throw new Error(result.message || "Error desconocido");
            }
        } catch (e) {
            alert("Error al actualizar: " + e.message);
        } finally {
            actionBtn.innerHTML = 'Aprobar Operación';
            actionBtn.disabled = false;
        }

    // CASO 2: CLIENTES (Aquí estaba el error)
    } else if (currentTaskType === 'CLIENT') {
        if(currentTaskData) {
            // CORRECCIÓN: Agregamos "id: currentTaskData.id" para que el informe sepa a quién buscar
            localStorage.setItem('tqa_cliente_draft', JSON.stringify({
                id: currentTaskData.id, // <--- ¡ESTA ES LA LÍNEA QUE FALTABA!
                tipo: currentTaskData.tipo,
                data: {
                    // Guardamos datos básicos por si acaso, pero el ID es lo vital
                    id: currentTaskData.id, 
                    pj_razon_social: currentTaskData.razon_social,
                    pj_ruc: currentTaskData.ruc,
                    pj_contacto_email: currentTaskData.email_contacto,
                    pn_nombre: currentTaskData.nombre
                }
            }));
            
            // Ahora sí, viajamos al informe
            window.location.href = 'informe_riesgo.html';
        } else {
            alert("Error: No hay datos del cliente cargados en memoria.");
        }
    }
};

// Filtro Tabs
window.filterTasks = (type) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    const container = document.getElementById('taskListContainer');
    const cards = container.querySelectorAll('.task-card');
    
    cards.forEach(card => {
        const text = card.innerHTML;
        const isClient = text.includes('ALTA CLIENTE');
        const isOps = text.includes('OPERACIÓN');
        // Pagadores se muestran en "Todas" o si tuviéramos tab específico
        // Por ahora, asumimos que se muestran en "Todas"
        
        if (type === 'all') card.style.display = 'flex';
        else if (type === 'CLIENT') card.style.display = isClient ? 'flex' : 'none';
        else if (type === 'INVOICE') card.style.display = isOps ? 'flex' : 'none';
    });
};

// Abrir documento seguro
window.openSecureDocument = async (publicUrl) => {
    if (!publicUrl) return;
    try {
        const urlObj = new URL(publicUrl);
        const key = urlObj.pathname.substring(1); 
        
        const btn = event.currentTarget;
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const response = await fetch(`${API_URL}/files/read-url?key=${encodeURIComponent(key)}`);
        const data = await response.json();

        btn.innerHTML = originalIcon;

        if (data.success) {
            window.open(data.url, '_blank');
        } else {
            alert("Acceso denegado: " + (data.message || "Error desconocido"));
        }
    } catch (e) {
        console.error(e);
        alert("Error procesando el archivo.");
    }
};

// --- NUEVA FUNCIÓN: DEVOLVER TAREA (RECHAZAR) ---
window.rejectTask = async () => {
    // 1. Validar que haya observación
    const obs = document.getElementById('modalObs').value.trim();
    if (!obs) {
        alert("⚠️ OBLIGATORIO: Para devolver un trámite, debes escribir el motivo en el campo 'Observaciones'.");
        document.getElementById('modalObs').focus();
        document.getElementById('modalObs').style.border = "2px solid #e74c3c"; // Resaltar en rojo
        return;
    }

    if (!confirm("¿Seguro que deseas DEVOLVER este trámite para correcciones?")) return;

    // 2. Efecto visual de carga
    const btnReject = document.querySelector('button[onclick="rejectTask()"]');
    const originalText = btnReject.innerHTML;
    btnReject.disabled = true;
    btnReject.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
        const motivo = `DEVUELTO POR OPERACIONES: ${obs}`;

        // A) SI ES UNA OPERACIÓN (FACTURAS)
        if (currentTaskType === 'INVOICE') {
            const payload = {
                id: currentTaskData.id,
                cliente_id: currentTaskData.cliente_id, // Datos obligatorios para el update
                pagador_ruc: currentTaskData.pagador_ruc,
                cantidad_docs: currentTaskData.cantidad_docs,
                monto_total: currentTaskData.monto_total,
                estado: 'CORRECCION', // <--- ESTADO CLAVE PARA QUE EL COMERCIAL SEPA QUE DEBE ARREGLAR
                creado_por: currentTaskData.creado_por // Mantenemos el autor original
                // Idealmente aquí guardaríamos el 'motivo' en una columna de observaciones en BD
            };

            await fetch(`${API_URL}/operaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

        // B) SI ES UN PAGADOR
        } else if (currentTaskType === 'PAYER') {
            const payload = {
                ruc: currentTaskData.ruc,
                nombre: currentTaskData.nombre,
                estado: 'RECHAZADO', // O 'CORRECCION' si permites reintentos
                doc_ruc: currentTaskData.doc_ruc,
                doc_otros: currentTaskData.doc_otros
            };
            
            await fetch(`${API_URL}/pagadores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

        // C) SI ES UN CLIENTE
        } else if (currentTaskType === 'CLIENT') {
            alert("Para rechazar clientes se requiere endpoint de actualización (PUT).");
            // Aquí iría la lógica similar a las anteriores cuando tengas el endpoint
        }

        alert("✅ Trámite devuelto correctamente.");
        closeModal();
        loadDynamicTasks(); // Recargar la lista (la tarea desaparecerá)

    } catch (e) {
        console.error(e);
        alert("Error al procesar: " + e.message);
    } finally {
        btnReject.disabled = false;
        btnReject.innerHTML = originalText;
    }
};