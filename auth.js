/**
 * SISTEMA MAESTRO DE SEGURIDAD (TACTIQA)
 * Unifica gestión de sesiones, roles y protección de rutas.
 */

// 1. CONFIGURACIÓN DE ACCESO
const PAGE_ACCESS = {
    CLIENTE: ['cliente-dashboard.html', 'carga-facturas.html', 'cartera.html', 'calificar-pagador.html', 'finanzas-cliente.html', 'menu.html', 'simulador.html'],
    COMERCIAL: ['nuevo-cliente.html', 'clientes.html', 'cartera.html', 'comercial-tareas.html', 'finanzas-pro.html', 'menu.html', 'carga-facturas.html', 'factoring-simular.html'],   
    OPERATIVO: ['cliente-dashboard.html','clientes.html', 'cartera.html', 'finanzas-pro.html', 'informe_riesgo.html', 'menu.html'],
    APROBADOR: ['cartera.html', 'informe_riesgo.html', 'calificar-pagador.html', 'clientes.html', 'menu.html'],
    ADMIN: ['*'] 
};

// 2. BASE DE DATOS FIJA
const STATIC_DB = [
    { email: "cliente", pass: "1234", role: "CLIENTE", name: "Juan Pérez", id: "C-001" },
    { email: "comercial", pass: "1234", role: "COMERCIAL", name: "Ejecutivo Comercial", id: "EMP-01" },
    { email: "operativo", pass: "1234", role: "OPERATIVO", name: "Analista Operativo", id: "EMP-02" },
    { email: "aprobador", pass: "1234", role: "APROBADOR", name: "Gerente de Riesgo", id: "EMP-03" },
    { email: "analista", pass: "1234", role: "ANALISTA", name: "Aprobador", id: "EMP-04"},
    { email: "comite", pass: "1234", role: "COMITE", name: "Comite", id: "EMP-05"},
    { email: "admin", pass: "1234", role: "ADMIN", name: "Super Admin", id: "ADM-01" }
];

// 3. INICIAR SESIÓN
function loginUser(email, password) {
    // A. Buscar en DB estática
    let user = STATIC_DB.find(u => u.email === email && u.pass === password);

    // B. Buscar en usuarios locales
    if (!user) {
        const localUsers = JSON.parse(localStorage.getItem('tqa_local_users') || "[]");
        user = localUsers.find(u => u.email === email && u.pass === password);
    }

    if (user) {
        const session = {
            email: user.email,
            role: user.role,
            name: user.name,
            id: user.id,
            loginTime: Date.now()
        };
        localStorage.setItem('tqa_session', JSON.stringify(session));
        return { success: true };
    }
    return { success: false, message: "Usuario o contraseña incorrectos." };
}

// 4. OBTENER SESIÓN ACTUAL
function getSession() {
    try {
        return JSON.parse(localStorage.getItem('tqa_session'));
    } catch (e) {
        return null;
    }
}

// 5. CERRAR SESIÓN
function logout() {
    localStorage.removeItem('tqa_session');
    window.location.href = 'index.html';
}

// 6. PROTECCIÓN DE RUTAS
function checkAuth() {
    const session = getSession();
    const currentPage = window.location.pathname.split("/").pop(); 

    if (!session) {
        if (currentPage !== 'index.html') window.location.href = 'index.html';
        return;
    }

    if (session.role === 'ADMIN') return;

    const allowedPages = PAGE_ACCESS[session.role] || [];
    
    if (!allowedPages.includes(currentPage) && currentPage !== 'menu.html' && currentPage !== 'index.html') {
        alert(`⛔ Acceso Denegado.\nEl perfil ${session.role} no tiene permisos para ver esta pantalla.`);
        window.location.href = 'menu.html';
    }
}

// 7. GESTOR DE MENÚ
function applyMenuPermissions() {
    const session = getSession();
    if (!session) return; 

    const userRole = session.role;
    const userId = session.id;
    
    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = `Hola, ${session.name} (${userRole})`;

    const protectedElements = document.querySelectorAll('[data-roles]');
    protectedElements.forEach(el => {
        const allowedRoles = el.getAttribute('data-roles').split(',');
        
        if (allowedRoles.includes(userRole) || userRole === 'ADMIN') {
            el.style.display = ''; 
            
            const target = el.getAttribute('data-go');
            if (userRole === 'CLIENTE' && target && target.includes('cliente-dashboard.html')) {
                el.onclick = function(e) {
                    e.preventDefault();
                    window.location.href = `cliente-dashboard.html?id=${userId}`;
                };
                el.removeAttribute('data-go'); 
            }
        } else {
            el.style.display = 'none'; 
        }
    });
}