document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener Sesión
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const role = session.role;
    document.getElementById('roleBadge').textContent = role;
    setupHeader(role);
    loadTasks(role);

    // Configurar títulos según rol
    function setupHeader(role) {
        const title = document.getElementById('pageTitle');
        const sub = document.getElementById('pageSub');
        
        if (role === 'ANALISTA') {
            title.textContent = "Mesa de Análisis";
            sub.textContent = "Solicitudes pendientes de revisión técnica";
        } else if (role === 'COMITE') {
            title.textContent = "Comité de Crédito";
            sub.textContent = "Solicitudes esperando resolución final";
        }
    }

    // Cargar tareas simuladas
    function loadTasks(role) {
        const list = document.getElementById('tasksList');
        list.innerHTML = '';

        // TAREAS DEMO
        const allTasks = [
            {
                id: 1,
                client: "Importadora Andina S.A.",
                ruc: "1790011223001",
                type: "Factoring Nacional",
                amount: "15,000.00",
                date: "30/01/2026",
                stage: "ANALISTA", // Tarea para analista
                statusText: "⏳ Pendiente Análisis"
            },
            {
                id: 2,
                client: "Constructora del Pacífico",
                ruc: "0990055443001",
                type: "Línea de Crédito",
                amount: "50,000.00",
                date: "28/01/2026",
                stage: "COMITE", // Tarea para comité
                statusText: "⚖️ Esperando Resolución"
            }
        ];

        // Filtrar tareas según el rol del usuario
        let myTasks = [];
        if (role === 'ADMIN') {
            myTasks = allTasks; // Admin ve todo
        } else {
            myTasks = allTasks.filter(t => t.stage === role);
        }

        if (myTasks.length === 0) {
            document.getElementById('emptyState').classList.remove('hidden');
            return;
        }

        // Renderizar
        myTasks.forEach(task => {
            const tr = document.createElement('tr');
            tr.className = 'task-row';
            tr.onclick = () => openTask(task);

            // Estilos dinámicos
            let borderClass = task.stage === 'ANALISTA' ? 'status-risk' : 'status-com';
            let icon = task.stage === 'ANALISTA' ? 'fa-magnifying-glass-chart' : 'fa-gavel';
            let btnText = task.stage === 'ANALISTA' ? 'Analizar' : 'Resolver';

            tr.innerHTML = `
                <td class="${borderClass}">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="avatar">${task.client.substring(0,2)}</div>
                        <div>
                            <div style="font-weight:700; color:#2c3e50;">${task.client}</div>
                            <div style="font-size:11px; color:#7f8c8d;">RUC: ${task.ruc}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-size:13px; font-weight:600;">${task.type}</div>
                    <div style="font-size:11px; color:#7f8c8d;">$${task.amount}</div>
                </td>
                <td style="font-size:13px; color:#555;">${task.date}</td>
                <td><span class="badge warn" style="font-size:10px;">${task.statusText}</span></td>
                <td style="text-align:right;">
                    <button class="btn ghost small"><i class="fa-solid ${icon}"></i> ${btnText}</button>
                </td>
            `;
            list.appendChild(tr);
        });
    }

    function openTask(task) {
        // Guardar contexto del cliente seleccionado
        localStorage.setItem('tqa_cliente_draft', JSON.stringify({
            tipo: 'PJ',
            data: { pj_razon_social: task.client, pj_ruc: task.ruc }
        }));

        // Redirigir según el tipo de tarea
        if (task.stage === 'ANALISTA') {
            window.location.href = 'aprobador_analista.html';
        } else if (task.stage === 'COMITE') {
            window.location.href = 'aprobador_comite.html';
        }
    }
});