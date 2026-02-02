// URL DE TU API GATEWAY
const API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';

document.addEventListener('DOMContentLoaded', () => {
    loadDynamicTasks();
});

// Variables globales para mantener los datos en memoria
let loadedClients = [];
let loadedOps = [];

let currentTaskType = null;
let currentTaskId = null;
let currentTaskData = null; // Guardará el objeto completo (cliente u operación)

// --- CARGA DE DATOS DESDE AWS ---
async function loadDynamicTasks() {
    const container = document.getElementById('taskListContainer');
    container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Conectando con servidor...</p>';

    try {
        console.log("--- Consultando API ---");

        // 1. Peticiones paralelas
        const [resClientes, resOperaciones] = await Promise.all([
            fetch(`${API_URL}/clientes`),
            fetch(`${API_URL}/operaciones`)
        ]);

        if (!resClientes.ok || !resOperaciones.ok) throw new Error("Error en la respuesta del servidor");

        const dataClientes = await resClientes.json();
        const dataOperaciones = await resOperaciones.json();

        // 2. Guardar datos crudos en memoria (items puede venir null si no hay datos)
        const rawClients = dataClientes.items || [];
        const rawOps = dataOperaciones.items || [];

        // 3. Filtrar lo que le interesa al Operativo
        // Clientes: Pendientes, En Revisión
        loadedClients = rawClients.filter(c => {
            const estado = (c.estado || '').toUpperCase().trim();
            return ['PENDIENTE', 'EN REVISION', 'EN REVISIÓN', 'REGISTRADO'].includes(estado);
        });

        // Operaciones: En Revisión Operativa
        loadedOps = rawOps.filter(o => {
            const estado = (o.estado || '').toUpperCase().trim();
            // A veces guardas como 'PENDIENTE' al crear, asegúrate de filtrar lo correcto
            return ['EN_REVISION_OPERATIVA', 'PENDIENTE_OPERATIVO', 'PENDIENTE'].includes(estado);
        });

        console.log(`Cargados: ${loadedClients.length} Clientes y ${loadedOps.length} Operaciones.`);

        // 4. Mapear para la Interfaz
        let tasks = [];

        // Clientes
        loadedClients.forEach(c => {
            tasks.push({
                id: c.ruc || c.id,      // Usamos RUC como ID visual si existe
                dbId: c.id,             // ID real de BD
                type: "CLIENT",
                title: c.razon_social || c.nombre || "Sin Nombre",
                subtitle: `RUC: ${c.ruc || 'S/N'}`,
                date: c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleDateString() : "Reciente",
                originalData: c         // Guardamos todo el objeto para usarlo luego
            });
        });

        // Operaciones
        loadedOps.forEach(op => {
            tasks.push({
                id: op.id,
                type: "INVOICE",
                title: op.cliente_nombre || "Cliente Desconocido",
                subtitle: `Monto: $${parseFloat(op.monto_total || 0).toFixed(2)}`,
                date: op.fecha_carga ? new Date(op.fecha_carga).toLocaleDateString() : "Reciente",
                originalData: op        // Guardamos todo el objeto para el UPDATE
            });
        });

        renderTasks(tasks);

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#e74c3c;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; margin-bottom: 15px;"></i>
                <br>No se pudo conectar con el sistema.
                <br><small>${error.message}</small>
            </div>`;
    }
}

// --- RENDERIZADO DE TARJETAS ---
function renderTasks(tasksToRender) {
    const container = document.getElementById('taskListContainer');
    container.innerHTML = '';

    if (tasksToRender.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#999;">
                <i class="fa-solid fa-clipboard-check" style="font-size: 40px; margin-bottom: 15px; color:#e0e0e0;"></i>
                <br>Bandeja vacía. No hay tareas pendientes.
            </div>`;
        return;
    }

    tasksToRender.forEach(task => {
        const isClient = task.type === 'CLIENT';
        const badgeClass = isClient ? 'type-client' : 'type-invoice';
        const typeLabel = isClient ? 'ALTA CLIENTE' : 'OPERACIÓN';
        const icon = isClient ? '<i class="fa-solid fa-user-shield"></i>' : '<i class="fa-solid fa-file-invoice-dollar"></i>';
        
        // Determinar ID para pasar a la función (BD ID para clientes, ID string para ops)
        const idParam = isClient ? task.dbId : task.id;

        const actionFunction = `openReviewModal('${task.type}', '${task.id}', '${task.dbId || ''}')`;
        const btnClass = isClient ? 'primary' : 'success';
        const btnText = isClient ? 'Revisar' : 'Validar';

        const html = `
            <div class="task-card">
                <div class="task-info">
                    <div class="task-meta">
                        <span class="task-type ${badgeClass}">${icon} ${typeLabel}</span>
                        <span><i class="fa-regular fa-clock"></i> ${task.date}</span>
                    </div>
                    <div class="task-title">${task.title}</div>
                    <div style="font-size:13px; color:#666;">${task.subtitle}</div>
                </div>
                <div class="task-actions">
                    <button class="btn small ${btnClass}" onclick="${actionFunction}">
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- APERTURA DEL MODAL ---
window.openReviewModal = async (type, displayId, dbId) => {
    currentTaskType = type;
    currentTaskId = displayId; 
    
    const docList = document.getElementById('modalDocList');
    const modalTitle = document.getElementById('modalTitle');
    const clientNameDisplay = document.getElementById('modalClientName');
    const actionBtn = document.getElementById('modalMainActionBtn');
    
    // Resetear UI
    document.getElementById('modalObs').value = ''; 
    docList.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando documentos...</div>';
    document.getElementById('reviewModal').classList.add('active');

    if (type === 'CLIENT') {
        // ... (Lógica de cliente se mantiene igual) ...
        const client = loadedClients.find(c => c.id == dbId || c.ruc == displayId);
        currentTaskData = client;
        modalTitle.innerText = "Revisión de Cliente";
        clientNameDisplay.innerText = client ? (client.razon_social || client.nombre) : "Cliente";
        actionBtn.innerText = "Ir a Informe de Riesgo";
        actionBtn.className = "btn primary";
        docList.innerHTML = '<p class="small-note">Funcionalidad de documentos de cliente pendiente de endpoint.</p>';

    } else if (type === 'INVOICE') {
        // 1. Configurar Modal
        const op = loadedOps.find(o => o.id === displayId);
        currentTaskData = op; 
        modalTitle.innerText = "Validación Operativa";
        clientNameDisplay.innerText = op ? op.cliente_nombre : "Operación";
        actionBtn.innerText = "Precalificar Operación";
        actionBtn.className = "btn success";

        // 2. FETCH PARA TRAER LOS DOCUMENTOS REALES
        try {
            // Llamamos al nuevo endpoint que creamos en el Paso 1
            const response = await fetch(`${API_URL}/operaciones/documentos?id=${displayId}`);
            const data = await response.json();

            docList.innerHTML = ''; // Limpiar cargando

            if (data.success && data.facturas && data.facturas.length > 0) {
                
                // Pintar cada factura/documento encontrado
                data.facturas.forEach(doc => {
                    // Determinar icono
                    let icon = '<i class="fa-regular fa-file" style="color:#666;"></i>';
                    if (doc.url_pdf && doc.url_pdf.endsWith('.xml')) icon = '<i class="fa-regular fa-file-code" style="color:#e67e22;"></i>';
                    else if (doc.url_pdf) icon = '<i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i>';

                    // Botón de ver (si hay URL)
                    const btnVer = doc.url_pdf 
                        ? `<button class="btn-icon" onclick="openSecureDocument('${doc.url_pdf}')" title="Ver Archivo"><i class="fa-solid fa-eye"></i></button>`
                        : `<span style="font-size:11px; color:#999;">Sin archivo</span>`;

                    docList.innerHTML += `
                        <div class="doc-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
                            <div class="doc-name" style="display:flex; gap:10px; align-items:center;">
                                ${icon}
                                <div>
                                    <div style="font-weight:500; font-size:13px;">Factura ${doc.clave_acceso.substring(0, 15)}...</div>
                                    <div style="font-size:11px; color:#666;">Monto: $${doc.monto || '0.00'} | SRI: ${doc.estado_sri || 'Pendiente'}</div>
                                </div>
                            </div>
                            <div class="doc-actions">
                                ${btnVer}
                            </div>
                        </div>
                    `;
                });

            } else {
                // Si no hay facturas en detalle, mostramos el PDF general si existe
                if (op && op.doc_factura_pdf) {
                     docList.innerHTML = `
                        <div class="doc-item">
                            <div class="doc-name"><i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i> Reporte Consolidado</div>
                            <div class="doc-actions">
                                <button class="btn-icon" onclick="window.open('${op.doc_factura_pdf}', '_blank')"><i class="fa-solid fa-eye"></i> Ver</button>
                            </div>
                        </div>`;
                } else {
                    docList.innerHTML = `
                        <div style="text-align:center; padding:20px; color:#999;">
                            <i class="fa-regular fa-folder-open" style="font-size:24px; margin-bottom:5px;"></i><br>
                            No hay documentos adjuntos.
                        </div>`;
                }
            }

        } catch (error) {
            console.error(error);
            docList.innerHTML = `<p style="color:red; font-size:12px;">Error cargando documentos: ${error.message}</p>`;
        }
    }
};

window.closeModal = () => document.getElementById('reviewModal').classList.remove('active');

// --- ACCIÓN PRINCIPAL (APROBAR) ---
window.submitReview = async () => {
    const obs = document.getElementById('modalObs').value;
    const actionBtn = document.getElementById('modalMainActionBtn');

    if (currentTaskType === 'INVOICE') {
        if (!currentTaskData) return alert("Error de datos.");

        // PREPARAR EL UPDATE
        // Tu backend exige enviar TODOS los campos obligatorios para hacer un UPDATE
        // Usamos currentTaskData que guardamos al cargar para rellenar lo que falta
        const payload = {
            id: currentTaskData.id,
            cliente_id: currentTaskData.cliente_id, // Requerido por backend
            pagador_ruc: currentTaskData.pagador_ruc, // Requerido por backend
            cantidad_docs: currentTaskData.cantidad_docs,
            monto_total: currentTaskData.monto_total,
            estado: 'APROBADO_OPERATIVO', // EL CAMBIO QUE QUEREMOS
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
                loadDynamicTasks(); // Recargar lista
            } else {
                throw new Error(result.message || "Error desconocido");
            }
        } catch (e) {
            alert("Error al actualizar: " + e.message);
        } finally {
            actionBtn.innerHTML = 'Aprobar Operación';
            actionBtn.disabled = false;
        }

    } else if (currentTaskType === 'CLIENT') {
        // Para clientes, guardamos en LocalStorage temporalmente para pasar al HTML de Informe
        // ya que esa pantalla aun no está conectada 100% al backend en este flujo
        if(currentTaskData) {
            localStorage.setItem('tqa_cliente_draft', JSON.stringify({
                tipo: currentTaskData.tipo,
                data: {
                    pj_razon_social: currentTaskData.razon_social,
                    pj_ruc: currentTaskData.ruc,
                    pj_contacto_email: currentTaskData.email_contacto,
                    pn_nombre: currentTaskData.nombre,
                    // Mapea los campos necesarios...
                }
            }));
            window.location.href = 'informe_riesgo.html';
        }
    }
};

// Filtro simple para Tabs
window.filterTasks = (type) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Recarga visual (sin llamar a la API de nuevo para ahorrar tráfico)
    const container = document.getElementById('taskListContainer');
    const cards = container.querySelectorAll('.task-card');
    
    cards.forEach(card => {
        const text = card.innerHTML;
        const isClient = text.includes('ALTA CLIENTE');
        const isOps = text.includes('OPERACIÓN');
        
        if (type === 'all') card.style.display = 'flex';
        else if (type === 'CLIENT') card.style.display = isClient ? 'flex' : 'none';
        else if (type === 'INVOICE') card.style.display = isOps ? 'flex' : 'none';
    });
};

// --- FUNCIÓN PARA ABRIR ARCHIVOS SEGUROS ---
window.openSecureDocument = async (publicUrl) => {
    // 1. Extraer la "Key" (nombre del archivo) de la URL pública
    // La URL suele ser: https://BUCKET.s3.REGION.amazonaws.com/CARPETA/ARCHIVO
    // Cortamos todo lo que está después de .amazonaws.com/
    
    if (!publicUrl) return;

    try {
        // Truco para sacar la key: usar el objeto URL
        const urlObj = new URL(publicUrl);
        // pathname viene con una barra al inicio /carpeta/archivo, la quitamos
        const key = urlObj.pathname.substring(1); 
        
        // 2. Pedir al backend la URL firmada
        const btn = event.currentTarget; // Referencia al botón que se clickeó
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Loading

        const response = await fetch(`${API_URL}/files/read-url?key=${encodeURIComponent(key)}`);
        const data = await response.json();

        btn.innerHTML = originalIcon; // Restaurar icono

        if (data.success) {
            // 3. Abrir la URL firmada (que sí tiene permiso)
            window.open(data.url, '_blank');
        } else {
            alert("No se pudo obtener acceso al archivo: " + (data.message || "Error desconocido"));
        }

    } catch (e) {
        console.error(e);
        alert("Error procesando el archivo. Revisa la consola.");
    }
};