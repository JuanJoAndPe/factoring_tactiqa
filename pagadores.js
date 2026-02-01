/**
 * GESTIÓN DE PAGADORES - WORKFLOW POR ROLES
 */

let currentUserRole = ''; // Guardaremos el rol aquí

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener sesión y rol
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUserRole = session.role; // 'COMERCIAL', 'OPERATIVO', 'ANALISTA', 'APROBADOR'
    console.log("Rol detectado:", currentUserRole);

    if (typeof API_URL === 'undefined') {
        alert("Error: Falta auth.js");
        return;
    }

    loadPayers();

    // Filtros
    document.getElementById('searchPayer').addEventListener('keyup', filtrarTablaLocal);
    document.getElementById('filterStatus').addEventListener('change', filtrarTablaLocal);
});

let allPayers = [];

async function loadPayers() {
    const tbody = document.getElementById('payersTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">🔄 Cargando cartera...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/pagadores`);
        const data = await response.json();

        if (data.success) {
            allPayers = data.items || [];
            renderTable(allPayers);
            document.getElementById('totalPayersCount').textContent = allPayers.length;
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Error de conexión.</td></tr>';
    }
}

function renderTable(lista) {
    const tbody = document.getElementById('payersTableBody');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay registros.</td></tr>';
        return;
    }

    lista.forEach(p => {
        const cupo = parseFloat(p.cupo_solicitado || 0).toLocaleString('en-US', {style:'currency', currency:'USD'});
        
        // --- LÓGICA DEL BOTÓN SEGÚN ROL Y ESTADO ---
        let btnAction = `<span style="color:#999; font-size:11px;">En proceso...</span>`; // Default
        
        // 1. Si eres COMERCIAL: Solo miras, nunca tocas.
        if (currentUserRole === 'COMERCIAL') {
            btnAction = `<span class="badge ghost">En Trámite</span>`;
            if (p.estado === 'CALIFICADO') btnAction = `<span class="badge ok">¡Listo!</span>`;
        }
        
        // 2. Si eres OPERATIVO: Tu trabajo es revisar documentos de los NUEVOS
        else if (currentUserRole === 'OPERATIVO') {
            if (p.estado === 'POR_REVISAR') {
                btnAction = `<button class="btn small primary" onclick="openModal('${p.id}', 'OPERATIVO')">
                                <i class="fa-solid fa-folder-open"></i> Validar Docs
                             </button>`;
            } else {
                btnAction = `<span style="color:green; font-size:11px;">✓ Enviado a Análisis</span>`;
            }
        }

        // 3. Si eres ANALISTA: Tu trabajo es analizar a los que ya tienen DOCS OK
        else if (currentUserRole === 'ANALISTA') {
            if (p.estado === 'EN_ANALISIS') {
                btnAction = `<button class="btn small info" onclick="openModal('${p.id}', 'ANALISTA')">
                                <i class="fa-solid fa-chart-pie"></i> Analizar Riesgo
                             </button>`;
            } else if (p.estado === 'POR_REVISAR') {
                btnAction = `<span style="color:#999; font-size:11px;">Esperando Docs...</span>`;
            }
        }

        // 4. Si eres APROBADOR: Tu trabajo es dar el OK final
        else if (currentUserRole === 'APROBADOR') {
            if (p.estado === 'EN_APROBACION') {
                btnAction = `<button class="btn small warn" onclick="openModal('${p.id}', 'APROBADOR')">
                                <i class="fa-solid fa-gavel"></i> Resolución
                             </button>`;
            }
        }

        // Si ya está terminado
        if (p.estado === 'CALIFICADO' || p.estado === 'RECHAZADO') {
            btnAction = `<button class="btn small ghost" onclick="alert('Ver historial')">Ver Detalle</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:700;">${p.nombre}</div>
                <div style="font-size:11px; color:#666;">RUC: ${p.ruc}</div>
            </td>
            <td>${p.cliente_asociado || '---'}</td>
            <td style="text-align:center;">${p.rating || '-'}</td>
            <td><span class="badge ${getStatusBadge(p.estado)}">${p.estado}</span></td>
            <td style="text-align:center;">${btnAction}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAL Y ACCIONES ---
let currentPayerId = null;
let currentActionRole = null;

function openModal(id, roleAction) {
    currentPayerId = id;
    currentActionRole = roleAction;
    
    const modal = document.getElementById('reviewModal');
    const title = document.getElementById('modalTitle');
    const btn = document.getElementById('btnSendReview');

    // Personalizar el Modal según quién lo abre
    if (roleAction === 'OPERATIVO') {
        title.textContent = "Validación Documental (Operaciones)";
        btn.innerHTML = "Confirmar y Enviar a Analista";
        btn.className = "btn primary";
    } else if (roleAction === 'ANALISTA') {
        title.textContent = "Análisis de Riesgo";
        btn.innerHTML = "Aprobar y Enviar a Comité";
        btn.className = "btn info";
    } else if (roleAction === 'APROBADOR') {
        title.textContent = "Resolución de Comité";
        btn.innerHTML = "✅ Aprobar Cupo Final";
        btn.className = "btn ok";
    }

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

async function sendToApprover() {
    let nextStatus = '';

    // Definir el siguiente paso del flujo
    if (currentActionRole === 'OPERATIVO') nextStatus = 'EN_ANALISIS';
    else if (currentActionRole === 'ANALISTA') nextStatus = 'EN_APROBACION';
    else if (currentActionRole === 'APROBADOR') nextStatus = 'CALIFICADO';

    const obs = document.getElementById('txtObservation').value;

    if(!confirm(`¿Estás seguro de cambiar el estado a: ${nextStatus}?`)) return;

    try {
        const response = await fetch(`${API_URL}/pagadores`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentPayerId,
                nuevo_estado: nextStatus,
                observacion: obs
            })
        });
        
        const data = await response.json();
        if (data.success) {
            alert("✅ Flujo avanzado correctamente.");
            closeModal();
            loadPayers(); // Recargar tabla
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
    }
}

// Auxiliar para colores
function getStatusBadge(estado) {
    if (estado === 'POR_REVISAR') return 'warn';
    if (estado === 'EN_ANALISIS') return 'info';
    if (estado === 'EN_APROBACION') return 'warn'; // O naranja
    if (estado === 'CALIFICADO') return 'ok';
    return 'ghost';
}

function filtrarTablaLocal() {
    const texto = document.getElementById('searchPayer').value.toLowerCase();
    const estado = document.getElementById('filterStatus').value;

    const filtrados = allPayers.filter(p => {
        const matchTexto = p.nombre.toLowerCase().includes(texto) || p.ruc.includes(texto);
        const matchEstado = estado === 'ALL' || p.estado === estado;
        return matchTexto && matchEstado;
    });

    renderTable(filtrados);
}
