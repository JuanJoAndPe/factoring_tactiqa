    // Lógica Frontend Incrustada para simplicidad
    document.addEventListener('DOMContentLoaded', () => {
        checkAuth(); // De auth.js
        loadInbox();
    });

    function switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        if(tabId === 'report') loadReport();
    }

    async function loadInbox() {
        const container = document.getElementById('taskList');
        try {
            const res = await fetch(`${API_URL}/analista/dashboard`);
            const data = await res.json();
            
            if(!data.success || data.items.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;"> ¡Todo limpio! No hay tareas pendientes.</div>';
                document.getElementById('countPendientes').textContent = '0';
                return;
            }

            document.getElementById('countPendientes').textContent = data.items.length;
            container.innerHTML = '';

            data.items.forEach(item => {
                const isPagador = item.tipo === 'PAGADOR';
                const iconClass = isPagador ? 'type-pagador' : 'type-operacion';
                const icon = isPagador ? 'fa-building' : 'fa-file-invoice-dollar';
                const label = isPagador ? 'Calificación de Pagador' : 'Análisis de Operación';
                const actionUrl = isPagador ? 'pagadores.html' : 'cartera.html'; // Redirige al módulo correcto

                const card = `
                <div class="task-card">
                    <div style="display:flex; align-items:center;">
                        <div class="task-icon ${iconClass}"><i class="fa-solid ${icon}"></i></div>
                        <div>
                            <div style="font-weight:bold; color:#333;">${item.detalle}</div>
                            <div style="font-size:12px; color:#666;">${label} • ${item.sub_detalle}</div>
                            <div style="font-size:11px; color:#999;">Ingreso: ${new Date(item.fecha_creacion).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <button class="btn small primary" onclick="window.location.href='${actionUrl}'">
                        Analizar <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>`;
                container.innerHTML += card;
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = 'Error de conexión';
        }
    }

    async function loadReport() {
        const tbody = document.getElementById('reportTableBody');
        tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
        
        try {
            const res = await fetch(`${API_URL}/analista/reporte`);
            const data = await res.json();
            
            tbody.innerHTML = '';
            data.items.forEach(item => {
                let badge = 'ghost';
                if(item.estado === 'CALIFICADO' || item.estado === 'APROBADO') badge = 'ok';
                if(item.estado === 'RECHAZADO') badge = 'error';
                if(item.estado === 'EN_APROBACION' || item.estado === 'COMITE') badge = 'warn';

                tbody.innerHTML += `
                    <tr>
                        <td>${item.fecha ? new Date(item.fecha).toLocaleDateString() : 'Reciente'}</td>
                        <td><span style="font-size:11px; font-weight:bold;">${item.tipo}</span></td>
                        <td>${item.detalle}</td>
                        <td><span class="badge ${badge}">${item.estado}</span></td>
                    </tr>
                `;
            });
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="4" style="color:red">Error al cargar reporte</td></tr>';
        }
    }