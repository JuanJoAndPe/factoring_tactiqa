document.addEventListener('DOMContentLoaded', () => {
    loadDynamicTasks();
});

function loadDynamicTasks() {
    // 1. Obtener Clientes Pendientes (De la base de datos local de Clientes)
    // Estos vienen de "nuevo-cliente.html"
    const allClients = JSON.parse(localStorage.getItem('tactiqa_clientes')) || [];
    
    // Filtramos los que tengan estado 'Pendiente' o 'En Revisión'
    const pendingClients = allClients.filter(c => 
        c.estado === 'Pendiente' || c.estado === 'En Revisión'
    );

    // 2. Obtener Operaciones de Facturas Pendientes
    // Estas vendrían de "carga-facturas.html" (asumimos que guardan en 'tqa_ops_pendientes')
    const pendingOps = JSON.parse(localStorage.getItem('tqa_ops_pendientes')) || [];

    // 3. Unificar y Formatear para la UI
    let tasks = [];

    // A) Mapear Clientes a Tareas
    pendingClients.forEach(c => {
        tasks.push({
            id: c.id || `CLI-${Math.floor(Math.random()*1000)}`, // ID único
            type: "CLIENT",
            clientName: c.razon_social || `${c.nombres} ${c.apellidos}`,
            ruc: c.ruc || c.cedula,
            date: c.fecha_registro || new Date().toLocaleDateString(),
            status: "PENDIENTE",
            docs: ["Documentos Legales", "Buro de Crédito"] // Simulado si no hay array de docs real
        });
    });

    // B) Mapear Operaciones a Tareas
    pendingOps.forEach(op => {
        if(op.estado === 'EN_REVISION_OPERATIVA') {
            tasks.push({
                id: op.id,
                type: "INVOICE",
                clientName: op.cliente_nombre,
                amount: op.total_monto, // Ej: "$15,000"
                date: op.fecha_carga,
                status: "PENDIENTE",
                docs: op.documentos || ["Facturas XML", "Soportes PDF"]
            });
        }
    });

    // 4. Renderizar
    renderTasks(tasks);
}

// Renderizar la lista (UI)
function renderTasks(tasksToRender) {
    const container = document.getElementById('taskListContainer');
    container.innerHTML = '';

    if (tasksToRender.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#999;">
                <i class="fa-solid fa-clipboard-check" style="font-size: 40px; margin-bottom: 15px; color:#e0e0e0;"></i>
                <br>No hay tareas pendientes. 
                <br><small>Las solicitudes de nuevos clientes y cargas de facturas aparecerán aquí.</small>
            </div>`;
        return;
    }

    tasksToRender.forEach(task => {
        const isClient = task.type === 'CLIENT';
        const badgeClass = isClient ? 'type-client' : 'type-invoice';
        const typeLabel = isClient ? 'PRECALIFICACIÓN CLIENTE' : 'OPERACIÓN FACTURAS';
        const icon = isClient ? '<i class="fa-solid fa-user-plus"></i>' : '<i class="fa-solid fa-file-invoice-dollar"></i>';
        
        const detailText = isClient 
            ? `RUC: ${task.ruc}`
            : `Monto: <b>${task.amount}</b>`;

        // Botones de Acción
        // Nota: Para clientes pasamos el ID real para que cargue los datos del LocalStorage
        const btnAction = isClient 
            ? `<button class="btn small primary" onclick="processClient('${task.ruc}')">Analizar Riesgo</button>`
            : `<button class="btn small success" onclick="openInvoiceModal('${task.id}')">Revisar Carga</button>`;

        const html = `
            <div class="task-card">
                <div class="task-info">
                    <div class="task-meta">
                        <span class="task-type ${badgeClass}">${icon} ${typeLabel}</span>
                        <span><i class="fa-regular fa-clock"></i> ${task.date}</span>
                    </div>
                    <div class="task-title">${task.clientName}</div>
                    <div style="font-size:13px; color:#666;">${detailText}</div>
                </div>
                <div class="task-actions">
                    ${btnAction}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// Filtrado de Tabs (Front-end filtering)
window.filterTasks = (type) => {
    // Para filtrar volvemos a cargar y filtramos en memoria
    // En un sistema real, esto se hace con clases CSS o re-render
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Recargar lógica base
    const allClients = JSON.parse(localStorage.getItem('tactiqa_clientes')) || [];
    const pendingOps = JSON.parse(localStorage.getItem('tqa_ops_pendientes')) || [];
    
    let filtered = [];

    if (type === 'all' || type === 'CLIENT') {
        const clients = allClients.filter(c => c.estado === 'Pendiente').map(c => ({
            id: c.ruc, type: "CLIENT", clientName: c.razon_social || c.nombres, 
            ruc: c.ruc, date: c.fecha_registro, status: "PENDIENTE"
        }));
        filtered = [...filtered, ...clients];
    }

    if (type === 'all' || type === 'INVOICE') {
        const ops = pendingOps.filter(o => o.estado === 'EN_REVISION_OPERATIVA').map(op => ({
            id: op.id, type: "INVOICE", clientName: op.cliente_nombre, 
            amount: op.total_monto, date: op.fecha_carga, status: "PENDIENTE"
        }));
        filtered = [...filtered, ...ops];
    }

    renderTasks(filtered);
};

// LOGICA: PROCESAR CLIENTE
window.processClient = (clientRuc) => {
    // 1. Buscar los datos reales del cliente en LocalStorage
    const allClients = JSON.parse(localStorage.getItem('tactiqa_clientes')) || [];
    const clientData = allClients.find(c => c.ruc === clientRuc || c.cedula === clientRuc);
    
    if(!clientData) {
        alert("Error: No se encontraron datos del cliente.");
        return;
    }

    // 2. Preparar el Draft para Informe de Riesgo
    // Transformamos la estructura de 'nuevo-cliente' a la que espera 'informe_riesgo'
    const draft = {
        tipo: clientData.tipo_persona === 'Jurídica' ? 'PJ' : 'PN',
        data: {
            pj_razon_social: clientData.razon_social,
            pj_ruc: clientData.ruc,
            pj_detalle_actividad: clientData.actividad,
            pj_rep_nombre: clientData.nombres_rep, // Ajustar según tu modelo de datos exacto
            pj_rep_apellido: clientData.apellidos_rep,
            pn_nombre: clientData.nombres,
            pn_apellido: clientData.apellidos,
            pn_ruc: clientData.cedula
        }
    };
    
    localStorage.setItem('tqa_cliente_draft', JSON.stringify(draft));
    
    // Borrar KPIs viejos para obligar a recalcular
    localStorage.removeItem('tqa_financial_kpis'); 

    // 3. Ir al informe
    window.location.href = 'informe_riesgo.html';
};

// LOGICA: MODAL FACTURAS (Mantenemos la lógica visual, conectada a datos)
window.openInvoiceModal = (opId) => {
    const ops = JSON.parse(localStorage.getItem('tqa_ops_pendientes')) || [];
    const op = ops.find(o => o.id === opId);
    if(!op) return;

    window.currentInvoiceOpId = opId; // Guardar ID globalmente para el submit
    
    document.getElementById('modalClientName').value = op.cliente_nombre;
    document.getElementById('modalObs').value = ''; 
    
    const list = document.getElementById('modalDocList');
    list.innerHTML = '';
    
    // Si la operación tiene documentos guardados
    const docs = op.documentos || ["Lote de Facturas.xml", "Reporte SRI.pdf"];
    docs.forEach(doc => {
        list.innerHTML += `
            <div class="doc-item">
                <span><i class="fa-solid fa-file-code" style="color:#2A4A73;"></i> ${doc}</span>
                <span style="color:#27ae60; font-size:11px;">Validado SRI</span>
            </div>`;
    });

    document.getElementById('invoiceModal').classList.add('active');
};

window.closeModal = () => {
    document.getElementById('invoiceModal').classList.remove('active');
};

window.submitInvoiceReview = () => {
    const obs = document.getElementById('modalObs').value;
    if(!obs.trim()) {
        alert("⚠️ Por favor ingrese una observación.");
        return;
    }

    // Actualizar estado en la "Base de Datos" local
    let ops = JSON.parse(localStorage.getItem('tqa_ops_pendientes')) || [];
    const idx = ops.findIndex(o => o.id === window.currentInvoiceOpId);
    
    if(idx >= 0) {
        // Cambiar estado y mover a historial (o dejar ahí con otro estado)
        ops[idx].estado = "APROBADO_OPERATIVO"; // Listo para nivel Gerencial
        ops[idx].obs_operativo = obs;
        localStorage.setItem('tqa_ops_pendientes', JSON.stringify(ops));
    }

    alert("✅ Operación validada y enviada al Aprobador.");
    closeModal();
    loadDynamicTasks(); // Refrescar lista
};