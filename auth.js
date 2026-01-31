/**
 * SISTEMA MAESTRO DE SEGURIDAD (TACTIQA)
 * Unifica gestión de sesiones, roles y protección de rutas.
 */

// 1. CONFIGURACIÓN DE ACCESO (El mapa de la discoteca)
// Define qué páginas puede visitar cada rol si intenta entrar directo por URL.
const PAGE_ACCESS = {
    CLIENTE: ['cliente-dashboard.html', 'carga-facturas.html', 'cartera.html', 'calificar-pagador.html', 'finanzas-cliente.html', 'menu.html'],
    COMERCIAL: ['nuevo-cliente.html', 'clientes.html', 'cartera.html', 'menu.html'],
    OPERATIVO: ['clientes.html', 'cartera.html', 'finanzas-pro.html', 'informe_riesgo.html', 'menu.html'],
    APROBADOR: ['cartera.html', 'informe_riesgo.html', 'calificar-pagador.html', 'clientes.html', 'menu.html'],
    ADMIN: ['*'] // Comodín: acceso total
};

// 2. BASE DE DATOS FIJA (Usuarios predeterminados para demos)
const STATIC_DB = [
    { email: "cliente", pass: "1234", role: "CLIENTE", name: "Juan Pérez", id: "C-001" },
    { email: "comercial", pass: "1234", role: "COMERCIAL", name: "Ejecutivo Comercial", id: "EMP-01" },
    { email: "operativo", pass: "1234", role: "OPERATIVO", name: "Analista Operativo", id: "EMP-02" },
    { email: "aprobador", pass: "1234", role: "APROBADOR", name: "Gerente de Riesgo", id: "EMP-03" },
    { email: "admin", pass: "1234", role: "ADMIN", name: "Super Admin", id: "ADM-01" }
];

// 3. INICIAR SESIÓN (LOGIN)
function loginUser(email, password) {
    // A. Buscar en DB estática
    let user = STATIC_DB.find(u => u.email === email && u.pass === password);

    // B. Si no está, buscar en usuarios creados localmente (nuevo-cliente.html)
    if (!user) {
        const localUsers = JSON.parse(localStorage.getItem('tqa_local_users') || "[]");
        // Nota: Asumimos que los locales guardan email/pass. Si guardan RUC, adapta esto.
        user = localUsers.find(u => u.email === email && u.pass === password);
    }

    if (user) {
        // Crear sesión robusta
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
    // Limpiamos roles antiguos por si acaso
    localStorage.removeItem('userRole'); 
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}

// 6. PROTECCIÓN DE RUTAS ("EL PORTERO")
// Esta función se debe ejecutar al inicio de cada página protegida
function checkAuth() {
    const session = getSession();
    const currentPage = window.location.pathname.split("/").pop(); // ej: cartera.html

    // A. Si no hay sesión y no es el login, fuera.
    if (!session) {
        if (currentPage !== 'index.html') window.location.href = 'index.html';
        return;
    }

    // B. Si es Admin, pase usted.
    if (session.role === 'ADMIN') return;

    // C. Verificar lista de acceso
    const allowedPages = PAGE_ACCESS[session.role] || [];
    
    // Si la página actual NO está en su lista (y no es menu.html que es segura)
    if (!allowedPages.includes(currentPage) && currentPage !== 'menu.html' && currentPage !== 'index.html') {
        alert(`⛔ Acceso Denegado.\nEl perfil ${session.role} no tiene permisos para estar aquí.`);
        window.location.href = 'menu.html';
    }
}

// 7. GESTOR DE MENÚ (UI)
// Aplica los permisos visuales en menu.html
function applyMenuPermissions() {
    const session = getSession();
    if (!session) return; // checkAuth ya lo habrá expulsado si es necesario

    const userRole = session.role;
    const userId = session.id;
    
    // Nombre en el header
    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = `Hola, ${session.name} (${userRole})`;

    // Filtrar Botones
    const protectedElements = document.querySelectorAll('[data-roles]');
    protectedElements.forEach(el => {
        const allowedRoles = el.getAttribute('data-roles').split(',');
        
        if (allowedRoles.includes(userRole) || userRole === 'ADMIN') {
            el.style.display = ''; // Mostrar
            
            // LÓGICA ESPECIAL CLIENTE: Redirigir a SU dashboard específico
            const target = el.getAttribute('data-go');
            if (userRole === 'CLIENTE' && target && target.includes('cliente-dashboard.html')) {
                // Sobreescribimos el click para inyectar el ID
                el.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `cliente-dashboard.html?id=${userId}`;
                };
                // Quitamos data-go para que menu.js no interfiera
                el.removeAttribute('data-go'); 
            }
        } else {
            el.style.display = 'none'; // Ocultar
        }
    });
}

// Auto-ejecución de seguridad (Opcional: descomentar para activar modo estricto)
// checkAuth();