// DATOS MOCK: Simulamos operaciones vivas
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
    {
        id: "OP-2026-002",
        client: "Servicios Tecnológicos Globales",
        payer: "CONSTRUCTORA HIDALGO",
        dueDate: "2026-01-28",
        amount: 12500.00,
        balance: 12500.00,
        status: "VENCIDO"
    },
    {
        id: "OP-2025-889",
        client: "Constructora Andes",
        payer: "GOBIERNO PROVINCIAL GUAYAS",
        dueDate: "2025-12-15",
        amount: 50000.00,
        balance: 50000.00,
        status: "MORA"
    },
    {
        id: "OP-2026-003",
        client: "Importadora del Pacífico S.A.",
        payer: "TIA S.A.",
        dueDate: "2026-02-28", 
        amount: 15000.00,
        balance: 5000.00,
        status: "VIGENTE"
    },
    {
        id: "OP-2025-900",
        client: "Exportadora Bananera Noboa",
        payer: "WALMART INC.",
        dueDate: "2026-01-10", 
        amount: 100000.00,
        balance: 0.00, 
        status: "PAGADO"
    }
];

// Variable global para mantener los datos filtrados según el rol
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos brutos
    let rawData = JSON.parse(localStorage.getItem('tqa_cartera_activa'));
    if (!rawData || rawData.length === 0) {
        rawData = MOCK_PORTFOLIO;
        localStorage.setItem('tqa_cartera_activa', JSON.stringify(rawData));
    }

    // 2. APLICAR FILTRO DE SEGURIDAD (SEGÚN ROL)
    filteredData = applySecurityFilter(rawData);

    // 3. Renderizar lo que el usuario TIENE PERMISO de ver
    renderPortfolio(filteredData);
    calculateKPIs(filteredData); // Los KPIs de arriba también se ajustan

    // 4. Configurar búsqueda sobre los datos ya filtrados
    document.getElementById('searchOp').addEventListener('keyup', (e) => filterLocalView(e.target.value));
    document.getElementById('filterState').addEventListener('change', () => filterLocalView(document.getElementById('searchOp').value));
});

// === LÓGICA DE SEGURIDAD ===
function applySecurityFilter(allData) {
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    
    // Si no hay sesión o es Admin/Operativo/Comercial, ve todo
    if (!session || ['ADMIN', 'OPERATIVO', 'COMERCIAL', 'APROBADOR'].includes(session.role)) {
        return allData;
    }

    // Si es CLIENTE, solo ve sus propias operaciones
    if (session.role === 'CLIENTE') {
        // Filtramos donde el nombre del cliente coincida (parcialmente para evitar errores de espacios)
        const myName = session.nombre.toLowerCase();
        
        return allData.filter(item => {
            // Compara el campo 'client' de la operación con el nombre del usuario logueado
            return item.client.toLowerCase().includes(myName);
        });
    }

    return []; // Por seguridad, si el rol no existe, no retorna nada
}

// === FILTRO VISUAL (Buscador) ===
function filterLocalView(searchTerm) {
    const stateFilter = document.getElementById('filterState').value;
    searchTerm = searchTerm.toLowerCase();

    // Filtramos sobre 'filteredData', no sobre 'localStorage' directo, para mantener la seguridad
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

        // Si es cliente, ocultamos el botón de gestión (teléfono)
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