// DATOS MOCK (FALLBACK)
const MOCK_PORTFOLIO = [
    {
        id: "OP-2026-001",
        client: "Importadora del Pacífico S.A.",
        payer: "SUPERMERCADOS LA FAVORITA",
        dueDate: "2026-02-15",
        amount: 25000.00,
        balance: 25000.00,
        status: "VIGENTE"
    },
    // ...
];

let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos brutos
    // TODO: API CALL (SQL: SELECT o.id, c.nombre as client, o.monto ... FROM Operaciones o JOIN Clientes c ON o.cliente_id = c.id WHERE ...)
    let rawData = JSON.parse(localStorage.getItem('tqa_cartera_activa'));
    if (!rawData || rawData.length === 0) {
        rawData = MOCK_PORTFOLIO;
        localStorage.setItem('tqa_cartera_activa', JSON.stringify(rawData));
    }

    // 2. APLICAR FILTRO DE SEGURIDAD
    filteredData = applySecurityFilter(rawData);

    // 3. Renderizar
    renderPortfolio(filteredData);
    calculateKPIs(filteredData);

    // 4. Configurar búsqueda
    document.getElementById('searchOp').addEventListener('keyup', (e) => filterLocalView(e.target.value));
    document.getElementById('filterState').addEventListener('change', () => filterLocalView(document.getElementById('searchOp').value));
});

// === LÓGICA DE SEGURIDAD ===
function applySecurityFilter(allData) {
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    
    if (!session || ['ADMIN', 'OPERATIVO', 'COMERCIAL', 'APROBADOR'].includes(session.role)) {
        return allData;
    }

    // Cliente ve solo lo suyo
    if (session.role === 'CLIENTE') {
        const myName = session.nombre.toLowerCase();
        return allData.filter(item => {
            return item.client.toLowerCase().includes(myName);
        });
    }
    return []; 
}

// === FILTRO VISUAL (Buscador) ===
function filterLocalView(searchTerm) {
    const stateFilter = document.getElementById('filterState').value;
    searchTerm = searchTerm.toLowerCase();

    const visibleData = filteredData.filter(item => {
        const matchesText = 
            item.client.toLowerCase().includes(searchTerm) || 
            item.payer.toLowerCase().includes(searchTerm) ||
            item.id.toLowerCase().includes(searchTerm);
        
        const matchesState = stateFilter === 'ALL' || 
                             (stateFilter === 'VIGENTE' && item.status === 'VIGENTE') ||
                             (stateFilter === 'VENCIDO' && (item.status === 'VENCIDO' || item.status === 'MORA')) ||
                             (stateFilter === 'PAGADO' && item.status === 'PAGADO');

        return matchesText && matchesState;
    });

    renderPortfolio(visibleData);
}

function renderPortfolio(data) {
    const tbody = document.getElementById('portfolioBody');
    tbody.innerHTML = '';
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    const isClient = session && session.role === 'CLIENTE';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#999;">No hay operaciones visibles para su perfil.</td></tr>';
        return;
    }

    const today = new Date();

    data.forEach(op => {
        const due = new Date(op.dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        let statusHtml = '';

        if (op.balance === 0) {
            statusHtml = '<span class="badge ok">PAGADO</span>';
        } else if (diffDays < 0) {
            const daysOverdue = Math.abs(diffDays);
            statusHtml = daysOverdue > 30 
                ? `<span class="badge bad">MORA +30 (${daysOverdue}d)</span>`
                : `<span class="badge warn">VENCIDO (${daysOverdue}d)</span>`;
        } else {
            statusHtml = `<span class="badge" style="background:#e3f2fd; color:#1565c0;">VIGENTE (${diffDays}d)</span>`;
        }

        const actionBtn = isClient 
            ? `<span style="color:#ccc; font-size:11px;">-</span>`
            : `<button class="btn ghost small" onclick="openGestion('${op.id}')" title="Registrar Gestión"><i class="fa-solid fa-phone"></i></button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; font-size:12px;">${op.id}</td>
            <td>${op.client}</td>
            <td>${op.payer}</td>
            <td>
                <div>${op.dueDate}</div>
                <div style="font-size:10px; color:#999;">${diffDays > 0 ? 'Faltan ' + diffDays + ' días' : 'Venció hace ' + Math.abs(diffDays)}</div>
            </td>
            <td style="text-align:right; font-family:'Consolas', monospace; font-weight:700;">$${op.balance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td style="text-align:center;">${statusHtml}</td>
            <td style="text-align:center;">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function calculateKPIs(data) {
    let totalVigente = 0;
    let totalPorVencer = 0;
    let totalVencido1 = 0; 
    let totalVencido2 = 0; 

    const today = new Date();

    data.forEach(op => {
        if (op.balance > 0) {
            const due = new Date(op.dueDate);
            const diffTime = due - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            totalVigente += op.balance;

            if (diffDays >= 0 && diffDays <= 15) {
                totalPorVencer += op.balance;
            } else if (diffDays < 0) {
                const overdue = Math.abs(diffDays);
                if (overdue <= 30) totalVencido1 += op.balance;
                else totalVencido2 += op.balance;
            }
        }
    });

    document.getElementById('kpiTotal').textContent = "$" + totalVigente.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('kpiCurrent').textContent = "$" + totalPorVencer.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('kpiOverdue1').textContent = "$" + totalVencido1.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('kpiOverdue2').textContent = "$" + totalVencido2.toLocaleString('en-US', {minimumFractionDigits: 2});
}

window.openGestion = (id) => {
    document.getElementById('modalOpId').textContent = id;
    document.getElementById('gestionModal').style.display = 'flex';
};