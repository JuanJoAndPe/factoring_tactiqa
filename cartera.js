// Configuración API
const API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';


let filteredData = [];
let originalData = [];
let clientesCache = {}; // Cache de nombres de clientes
let pagadoresCache = {}; // Cache de nombres de pagadores

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Precargar datos de clientes y pagadores
        await precacheClientesYPagadores();
        
        // 2. Cargar datos desde la base de datos
        await loadPortfolioFromDatabase();
        
        // 3. Configurar búsqueda
        document.getElementById('searchOp').addEventListener('keyup', (e) => filterLocalView(e.target.value));
        document.getElementById('filterState').addEventListener('change', () => filterLocalView(document.getElementById('searchOp').value));
        
    } catch (error) {
        console.error("Error crítico al cargar cartera:", error);
        showErrorMessage("No se pudo cargar la información de cartera. Por favor, recargue la página o contacte al administrador.");
    }
});

// === PRECACHE DE CLIENTES Y PAGADORES ===
async function precacheClientesYPagadores() {
    try {
        const session = JSON.parse(localStorage.getItem('tqa_session'));
        
        // Cargar clientes
        const clientesRes = await fetch(`${API_URL}/clientes`, {
            headers: {
                'Authorization': `Bearer ${session.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (clientesRes.ok) {
            const clientesData = await clientesRes.json();
            if (clientesData.success && clientesData.items) {
                clientesData.items.forEach(cliente => {
                    clientesCache[cliente.id] = cliente.nombre || cliente.razon_social || 'Cliente';
                });
            }
        }
        
        // Cargar pagadores
        const pagadoresRes = await fetch(`${API_URL}/pagadores`, {
            headers: {
                'Authorization': `Bearer ${session.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (pagadoresRes.ok) {
            const pagadoresData = await pagadoresRes.json();
            if (pagadoresData.success && pagadoresData.items) {
                pagadoresData.items.forEach(pagador => {
                    pagadoresCache[pagador.ruc] = pagador.nombre || pagador.razon_social || 'Pagador';
                });
            }
        }
        
    } catch (error) {
        console.warn("Error al cargar cache de clientes/pagadores:", error);
        // Continuamos sin cache, los nombres se obtendrán de otras fuentes
    }
}

// === CARGAR DESDE BASE DE DATOS ===
async function loadPortfolioFromDatabase() {
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    showLoadingState(true);
    
    try {
        // Construir URL según el rol del usuario
        let url = `${API_URL}/operaciones`;
        let queryParams = [];
        
        // Filtrar por estado activo
        queryParams.push('estado=ACTIVO');
        
        // Si es CLIENTE, filtrar solo sus operaciones
        if (session.role === 'CLIENTE') {
            queryParams.push(`cliente_id=${encodeURIComponent(session.id)}`);
        }
        
        // Agregar parámetros a la URL
        if (queryParams.length > 0) {
            url += '?' + queryParams.join('&');
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                alert("Sesión expirada. Por favor, inicie sesión nuevamente.");
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.items && Array.isArray(data.items)) {
            // Transformar datos de API
            originalData = await transformAPIData(data.items);
            filteredData = applySecurityFilter(originalData);
            
            if (filteredData.length === 0) {
                showNoDataMessage();
            } else {
                renderPortfolio(filteredData);
                calculateKPIs(filteredData);
            }
            
            // Guardar en cache local
            localStorage.setItem('tqa_cartera_cache', JSON.stringify({
                data: originalData,
                timestamp: Date.now()
            }));
            
        } else {
            throw new Error("Formato de respuesta inválido de la API");
        }
        
    } catch (error) {
        console.error("Error al cargar desde BD:", error);
        
        // Intentar cargar desde cache si existe
        const cache = JSON.parse(localStorage.getItem('tqa_cartera_cache'));
        if (cache && cache.data && Array.isArray(cache.data)) {
            const cacheAge = Date.now() - cache.timestamp;
            const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutos
            
            if (cacheAge < MAX_CACHE_AGE) {
                showWarningMessage("Mostrando datos en caché (última actualización hace " + Math.round(cacheAge/60000) + " minutos)");
                originalData = cache.data;
                filteredData = applySecurityFilter(originalData);
                renderPortfolio(filteredData);
                calculateKPIs(filteredData);
                return;
            }
        }
        
        showErrorMessage("No se pudo conectar con la base de datos. Por favor, revise su conexión e intente nuevamente.");
        
    } finally {
        showLoadingState(false);
    }
}

// === TRANSFORMAR DATOS DE API ===
async function transformAPIData(apiItems) {
    const transformedItems = [];
    
    for (const item of apiItems) {
        // 1. Obtener ID de operación
        const id = item.id || item.operacion_id || `OP-${Date.now().toString().slice(-6)}`;
        
        // 2. Obtener NOMBRE DEL CLIENTE
        let clienteNombre = 'Cliente';
        const clienteId = item.cliente_id || item.usuario_id;
        
        if (clienteId) {
            // Buscar en cache primero
            if (clientesCache[clienteId]) {
                clienteNombre = clientesCache[clienteId];
            } else if (item.cliente_nombre) {
                clienteNombre = item.cliente_nombre;
                clientesCache[clienteId] = clienteNombre; // Actualizar cache
            } else if (item.usuario_nombre) {
                clienteNombre = item.usuario_nombre;
                clientesCache[clienteId] = clienteNombre; // Actualizar cache
            } else {
                // Intentar obtener de la API si no está en cache
                try {
                    const clienteRes = await fetch(`${API_URL}/clientes/${clienteId}`);
                    if (clienteRes.ok) {
                        const clienteData = await clienteRes.json();
                        if (clienteData.success && clienteData.nombre) {
                            clienteNombre = clienteData.nombre;
                            clientesCache[clienteId] = clienteNombre;
                        }
                    }
                } catch (e) {
                    console.warn(`No se pudo obtener cliente ${clienteId}:`, e);
                }
            }
        }
        
        // 3. Obtener NOMBRE DEL PAGADOR
        let pagadorNombre = 'Pagador';
        const pagadorRuc = item.pagador_ruc;
        
        if (pagadorRuc) {
            // Buscar en cache primero
            if (pagadoresCache[pagadorRuc]) {
                pagadorNombre = pagadoresCache[pagadorRuc];
            } else if (item.pagador_nombre) {
                pagadorNombre = item.pagador_nombre;
                pagadoresCache[pagadorRuc] = pagadorNombre; // Actualizar cache
            } else if (item.pagador_razon_social) {
                pagadorNombre = item.pagador_razon_social;
                pagadoresCache[pagadorRuc] = pagadorNombre; // Actualizar cache
            } else {
                // Intentar obtener de la API si no está en cache
                try {
                    const pagadorRes = await fetch(`${API_URL}/pagadores/${pagadorRuc}`);
                    if (pagadorRes.ok) {
                        const pagadorData = await pagadorRes.json();
                        if (pagadorData.success && pagadorData.nombre) {
                            pagadorNombre = pagadorData.nombre;
                            pagadoresCache[pagadorRuc] = pagadorNombre;
                        }
                    }
                } catch (e) {
                    console.warn(`No se pudo obtener pagador ${pagadorRuc}:`, e);
                }
            }
        }
        
        // 4. Obtener fecha de vencimiento
        let fechaVencimiento = item.fecha_vencimiento || item.vencimiento || item.fecha_limite_pago;
        
        // Si no hay fecha de vencimiento, calcular 30 días después de la creación
        if (!fechaVencimiento && item.fecha_creacion) {
            const fechaCreacion = new Date(item.fecha_creacion);
            fechaCreacion.setDate(fechaCreacion.getDate() + 30);
            fechaVencimiento = fechaCreacion.toISOString().split('T')[0];
        } else if (!fechaVencimiento) {
            // Si no hay ninguna fecha, usar 30 días en el futuro
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            fechaVencimiento = futureDate.toISOString().split('T')[0];
        }
        
        // 5. Parsear montos
        const montoTotal = parseFloat(item.monto_total) || parseFloat(item.total) || 0;
        const saldoActual = parseFloat(item.saldo_actual) || parseFloat(item.balance) || montoTotal;
        
        // 6. Determinar estado basado en fecha y saldo
        let estado = item.estado || 'VIGENTE';
        if (saldoActual === 0) {
            estado = 'PAGADO';
        } else if (fechaVencimiento) {
            const hoy = new Date();
            const vencimiento = new Date(fechaVencimiento);
            if (vencimiento < hoy) {
                estado = 'VENCIDO';
            }
        }
        
        transformedItems.push({
            id: id,
            client: clienteNombre,
            payer: pagadorNombre,
            dueDate: fechaVencimiento,
            amount: montoTotal,
            balance: saldoActual,
            status: estado,
            cliente_id: clienteId,
            pagador_ruc: pagadorRuc,
            fecha_creacion: item.fecha_creacion || item.created_at,
            moneda: item.moneda || 'USD',
            tasa_interes: item.tasa_interes || 0,
            dias_mora: item.dias_mora || 0
        });
    }
    
    return transformedItems;
}

// === LÓGICA DE SEGURIDAD ===
function applySecurityFilter(allData) {
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    
    if (!session) {
        return [];
    }
    
    // Roles administrativos ven todo
    if (['ADMIN', 'OPERATIVO', 'APROBADOR', 'COMERCIAL'].includes(session.role)) {
        return allData;
    }

    // Cliente ve solo sus operaciones
    if (session.role === 'CLIENTE') {
        const clienteId = session.id;
        return allData.filter(item => {
            return item.cliente_id && item.cliente_id.toString() === clienteId.toString();
        });
    }
    
    return [];
}

// === FILTRO VISUAL (Buscador) ===
function filterLocalView(searchTerm) {
    const stateFilter = document.getElementById('filterState').value;
    searchTerm = (searchTerm || '').toLowerCase().trim();

    const visibleData = filteredData.filter(item => {
        const clientName = item.client ? item.client.toLowerCase() : '';
        const payerName = item.payer ? item.payer.toLowerCase() : '';
        const itemId = item.id ? item.id.toLowerCase() : '';
        const pagadorRuc = item.pagador_ruc ? item.pagador_ruc.toLowerCase() : '';
        
        const matchesText = searchTerm === '' || 
            clientName.includes(searchTerm) || 
            payerName.includes(searchTerm) ||
            itemId.includes(searchTerm) ||
            pagadorRuc.includes(searchTerm);
        
        const matchesState = stateFilter === 'ALL' || 
                             (stateFilter === 'VIGENTE' && item.status === 'VIGENTE') ||
                             (stateFilter === 'VENCIDO' && (item.status === 'VENCIDO' || item.status === 'MORA')) ||
                             (stateFilter === 'PAGADO' && item.status === 'PAGADO');

        return matchesText && matchesState;
    });

    renderPortfolio(visibleData);
}

// === RENDERIZAR TABLA ===
function renderPortfolio(data) {
    const tbody = document.getElementById('portfolioBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    const isClient = session && session.role === 'CLIENTE';
    const isOperativo = session && ['OPERATIVO', 'ADMIN', 'APROBADOR'].includes(session.role);

    if (!data || data.length === 0) {
        showNoDataMessage();
        return;
    }

    const today = new Date();

    data.forEach(op => {
        const opId = op.id || 'N/A';
        const clientName = op.client || 'Cliente';
        const payerName = op.payer || 'Pagador';
        const dueDate = op.dueDate || 'N/A';
        const balance = parseFloat(op.balance) || 0;
        const amount = parseFloat(op.amount) || 0;
        
        // Calcular días y estado
        let diffDays = 0;
        let statusHtml = '';
        let daysText = 'Fecha no disponible';
        
        if (dueDate !== 'N/A') {
            try {
                const due = new Date(dueDate);
                const diffTime = due - today;
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (balance === 0) {
                    statusHtml = '<span class="badge ok">PAGADO</span>';
                    daysText = 'Completado';
                } else if (diffDays < 0) {
                    const daysOverdue = Math.abs(diffDays);
                    if (daysOverdue > 30) {
                        statusHtml = `<span class="badge bad">MORA +30 (${daysOverdue}d)</span>`;
                    } else {
                        statusHtml = `<span class="badge warn">VENCIDO (${daysOverdue}d)</span>`;
                    }
                    daysText = `Venció hace ${daysOverdue} días`;
                } else {
                    statusHtml = `<span class="badge" style="background:#e3f2fd; color:#1565c0;">VIGENTE (${diffDays}d)</span>`;
                    daysText = `Faltan ${diffDays} días`;
                }
            } catch (e) {
                statusHtml = `<span class="badge" style="background:#f0f0f0; color:#666;">SIN FECHA</span>`;
                daysText = 'Error en fecha';
            }
        } else {
            statusHtml = `<span class="badge" style="background:#f0f0f0; color:#666;">SIN FECHA</span>`;
        }

        // Botones de acción según rol
        let actionBtn = '';
        if (isOperativo) {
            actionBtn = `
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button class="btn ghost small" onclick="openGestion('${opId}')" title="Registrar Gestión">
                        <i class="fa-solid fa-phone"></i>
                    </button>
                    <button class="btn ghost small" onclick="viewOperationDetails('${opId}')" title="Ver Detalles">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
            `;
        } else if (isClient) {
            actionBtn = `
                <button class="btn ghost small" onclick="viewOperationDetails('${opId}')" title="Ver Detalles">
                    <i class="fa-solid fa-eye"></i>
                </button>
            `;
        } else {
            actionBtn = '<span style="color:#ccc; font-size:11px;">-</span>';
        }

        // Porcentaje pagado
        const paidPercentage = amount > 0 ? ((amount - balance) / amount * 100).toFixed(1) : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; font-size:12px;">
                ${opId}
                ${paidPercentage > 0 ? `<br><small style="color:#27ae60; font-size:10px;">${paidPercentage}% pagado</small>` : ''}
            </td>
            <td>
                <div style="font-weight:600;">${clientName}</div>
                ${op.cliente_id ? `<small style="color:#666; font-size:10px;">ID: ${op.cliente_id}</small>` : ''}
            </td>
            <td>
                <div style="font-weight:600;">${payerName}</div>
                ${op.pagador_ruc ? `<small style="color:#666; font-size:10px;">RUC: ${op.pagador_ruc}</small>` : ''}
            </td>
            <td>
                <div>${dueDate}</div>
                <div style="font-size:10px; color:#999;">${daysText}</div>
            </td>
            <td style="text-align:right; font-family:'Consolas', monospace; font-weight:700;">
                $${balance.toLocaleString('en-US', {minimumFractionDigits: 2})}
                ${amount > balance ? `<br><small style="color:#888; font-size:10px;">de $${amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</small>` : ''}
            </td>
            <td style="text-align:center;">${statusHtml}</td>
            <td style="text-align:center;">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// === FUNCIONES RESTANTES (sin cambios) ===
function calculateKPIs(data) {
    let totalVigente = 0;
    let totalPorVencer = 0;
    let totalVencido1 = 0; 
    let totalVencido2 = 0; 

    const today = new Date();

    data.forEach(op => {
        const balance = parseFloat(op.balance) || 0;
        
        if (balance > 0) {
            const dueDate = op.dueDate;
            
            if (dueDate) {
                try {
                    const due = new Date(dueDate);
                    const diffTime = due - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    totalVigente += balance;

                    if (diffDays >= 0 && diffDays <= 15) {
                        totalPorVencer += balance;
                    } else if (diffDays < 0) {
                        const overdue = Math.abs(diffDays);
                        if (overdue <= 30) {
                            totalVencido1 += balance;
                        } else {
                            totalVencido2 += balance;
                        }
                    }
                } catch (e) {
                    console.warn("Error al calcular KPI para operación:", op.id, e);
                }
            }
        }
    });

    const kpiTotal = document.getElementById('kpiTotal');
    const kpiCurrent = document.getElementById('kpiCurrent');
    const kpiOverdue1 = document.getElementById('kpiOverdue1');
    const kpiOverdue2 = document.getElementById('kpiOverdue2');
    
    if (kpiTotal) kpiTotal.textContent = "$" + totalVigente.toLocaleString('en-US', {minimumFractionDigits: 2});
    if (kpiCurrent) kpiCurrent.textContent = "$" + totalPorVencer.toLocaleString('en-US', {minimumFractionDigits: 2});
    if (kpiOverdue1) kpiOverdue1.textContent = "$" + totalVencido1.toLocaleString('en-US', {minimumFractionDigits: 2});
    if (kpiOverdue2) kpiOverdue2.textContent = "$" + totalVencido2.toLocaleString('en-US', {minimumFractionDigits: 2});
}

function showLoadingState(show) {
    const tbody = document.getElementById('portfolioBody');
    if (!tbody) return;
    
    if (show) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:40px;">
                    <div style="display:inline-block; width:30px; height:30px; border:3px solid #f3f3f3; border-top:3px solid #3498db; border-radius:50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top:10px; color:#666;">Cargando datos de cartera...</p>
                </td>
            </tr>
        `;
        
        document.getElementById('searchOp').disabled = true;
        document.getElementById('filterState').disabled = true;
    } else {
        document.getElementById('searchOp').disabled = false;
        document.getElementById('filterState').disabled = false;
    }
}

function showErrorMessage(message) {
    const tbody = document.getElementById('portfolioBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center; padding:40px; color:#c0392b;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size:24px; margin-bottom:10px;"></i>
                <p style="margin:10px 0;">${message}</p>
                <button class="btn small" onclick="loadPortfolioFromDatabase()" style="margin-top:10px;">
                    <i class="fa-solid fa-refresh"></i> Reintentar
                </button>
            </td>
        </tr>
    `;
}

function showWarningMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f39c12;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function showNoDataMessage() {
    const tbody = document.getElementById('portfolioBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center; padding:40px; color:#666;">
                <i class="fa-solid fa-inbox" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i>
                <p style="margin:10px 0;">No hay operaciones registradas en su cartera.</p>
                <p style="font-size:12px; color:#999;">Para crear una nueva operación, vaya a "Carga de Facturas"</p>
                <button class="btn primary small" onclick="window.location.href='carga-facturas.html'" style="margin-top:15px;">
                    <i class="fa-solid fa-plus"></i> Crear Nueva Operación
                </button>
            </td>
        </tr>
    `;
}

// === FUNCIONES DE ACCIÓN ===
window.openGestion = (id) => {
    document.getElementById('modalOpId').textContent = id;
    document.getElementById('gestionModal').style.display = 'flex';
};

window.viewOperationDetails = (id) => {
    window.location.href = `detalle-operacion.html?id=${id}`;
};

// === REFRESCAR DATOS ===
async function refreshPortfolio() {
    // Limpiar cache antes de refrescar
    clientesCache = {};
    pagadoresCache = {};
    await loadPortfolioFromDatabase();
}

// === AGREGAR CSS ===
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
    }
    .badge.ok { background: #d1e7dd; color: #0f5132; }
    .badge.warn { background: #fff3cd; color: #856404; }
    .badge.bad { background: #f8d7da; color: #842029; }
`;
document.head.appendChild(style);

// === INICIALIZACIÓN ADICIONAL ===
document.addEventListener('DOMContentLoaded', () => {
    const actionsDiv = document.querySelector('.actions');
    if (actionsDiv && !document.querySelector('#refreshBtn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshBtn';
        refreshBtn.className = 'btn ghost';
        refreshBtn.innerHTML = '<i class="fa-solid fa-refresh icon"></i> Actualizar';
        refreshBtn.onclick = refreshPortfolio;
        actionsDiv.insertBefore(refreshBtn, actionsDiv.lastChild);
    }
});