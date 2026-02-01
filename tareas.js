/**
 * GESTIÓN DE TAREAS - MESA UNIFICADA (CONECTADA A AWS)
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar Sesión
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Configurar Pantalla según Rol
    const role = session.role;
    document.getElementById('roleBadge').textContent = role;
    setupHeader(role);

    // 3. Cargar Tareas REALES
    loadRealTasks(role);
});

function setupHeader(role) {
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSub');
    
    if (role === 'ANALISTA') {
        title.textContent = "Mesa de Análisis";
        sub.textContent = "Solicitudes pendientes de revisión técnica";
    } else if (role === 'APROBADOR' || role === 'COMITE') {
        title.textContent = "Comité de Crédito";
        sub.textContent = "Solicitudes esperando resolución final";
    }
}

async function loadRealTasks(role) {
    const list = document.getElementById('tasksList');
    list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">🔄 Buscando pendientes en la nube...</td></tr>';

    try {
        // Determinamos a qué ruta llamar según el rol
        let endpoint = '';
        if (role === 'ANALISTA') endpoint = '/analista/dashboard';
        else if (role === 'APROBADOR' || role === 'COMITE') endpoint = '/comite/dashboard';
        else {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tu rol no tiene bandeja de entrada configurada.</td></tr>';
            return;
        }

        // LLAMADA A AWS
        if (typeof API_URL === 'undefined') { console.error("Falta auth.js"); return; }
        
        const response = await fetch(`${API_URL}${endpoint}`);
        const data = await response.json();

        list.innerHTML = ''; // Limpiar loader

        if (!data.success || !data.items || data.items.length === 0) {
            document.getElementById('emptyState').classList.remove('hidden');
            return;
        }

        // Ocultar mensaje de vacío si hay datos
        document.getElementById('emptyState').classList.add('hidden');

        // Renderizar Tareas Reales
        data.items.forEach(task => {
            const tr = document.createElement('tr');
            tr.className = 'task-row';
            
            // Configuración visual según tipo
            const isAnalista = role === 'ANALISTA';
            const borderClass = isAnalista ? 'status-risk' : 'status-com';
            const icon = isAnalista ? 'fa-magnifying-glass-chart' : 'fa-gavel';
            const btnText = isAnalista ? 'Analizar' : 'Resolver';
            const valor = parseFloat(task.valor).toLocaleString('en-US', {style:'currency', currency:'USD'});

            // Acción al hacer click
            tr.onclick = () => {
                // Redirigir al módulo correspondiente
                if (task.tipo === 'PAGADOR') window.location.href = 'pagadores.html'; // Ahí verán el botón correspondiente a su rol
                else if (task.tipo === 'OPERACION') window.location.href = 'cartera.html';
            };

            tr.innerHTML = `
                <td class="${borderClass}">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="avatar">${task.detalle.substring(0,2).toUpperCase()}</div>
                        <div>
                            <div style="font-weight:700; color:#2c3e50;">${task.detalle}</div>
                            <div style="font-size:11px; color:#7f8c8d;">${task.sub_detalle || '---'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-size:13px; font-weight:600;">${task.tipo}</div>
                    <div style="font-size:11px; color:#7f8c8d;">${valor}</div>
                </td>
                <td style="font-size:13px; color:#555;">${new Date(task.fecha_creacion).toLocaleDateString()}</td>
                <td><span class="badge warn" style="font-size:10px;">Pendiente</span></td>
                <td style="text-align:right;">
                    <button class="btn ghost small"><i class="fa-solid ${icon}"></i> ${btnText}</button>
                </td>
            `;
            list.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        list.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de conexión con AWS.</td></tr>';
    }
}