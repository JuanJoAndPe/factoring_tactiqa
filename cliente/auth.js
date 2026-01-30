/**
 * SISTEMA DE SEGURIDAD Y ROLES (TACTIQA)
 * Archivo: auth.js
 */

// 1. BASE DE DATOS FIJA (Usuarios predeterminados para demos)
const STATIC_DB = [
    { email: "cliente", pass: "1234", role: "CLIENTE", name: "Juan Pérez", id: "C-001" },
    { email: "comercial", pass: "1234", role: "COMERCIAL", name: "Ejecutivo Comercial", id: "EMP-01" },
    { email: "operativo", pass: "1234", role: "OPERATIVO", name: "Analista Operativo", id: "EMP-02" },
    { email: "aprobador", pass: "1234", role: "APROBADOR", name: "Gerente de Riesgo", id: "EMP-03" },
    { email: "admin", pass: "1234", role: "ADMIN", name: "Super Admin", id: "ADM-01" }
];

// 2. INICIAR SESIÓN
function loginUser(email, password) {
    // A. Obtener usuarios registrados localmente (desde nuevo-cliente.html)
    const localUsers = JSON.parse(localStorage.getItem('tqa_local_users') || "[]");
    
    // B. Combinar ambas bases de datos
    const allUsers = [...STATIC_DB, ...localUsers];

    // C. Buscar coincidencia
    const user = allUsers.find(u => u.email === email && u.pass === password);

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

// 3. OBTENER SESIÓN ACTUAL
function getSession() {
    return JSON.parse(localStorage.getItem('tqa_session'));
}

// 4. CERRAR SESIÓN
function logout() {
    localStorage.removeItem('tqa_session');
    window.location.href = 'index.html';
}

// 5. APLICAR PERMISOS EN EL MENÚ
function applyMenuPermissions() {
    const session = getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const userRole = session.role;
    const userId = session.id;
    
    // Seleccionar elementos protegidos por roles
    const protectedElements = document.querySelectorAll('[data-roles]');

    protectedElements.forEach(el => {
        const allowedRoles = el.getAttribute('data-roles').split(',');
        
        if (allowedRoles.includes(userRole)) {
            el.style.display = ''; // Mostrar
            
            // Lógica especial para el botón "Mi Dashboard" de Clientes
            // Inyectamos el ID del usuario en la redirección
            const target = el.getAttribute('data-go');
            if (userRole === 'CLIENTE' && target && target.includes('cliente-dashboard.html')) {
                el.onclick = function() {
                    window.location.href = `cliente-dashboard.html?id=${userId}`;
                };
                el.removeAttribute('data-go'); 
            }

        } else {
            el.style.display = 'none'; // Ocultar si no tiene permiso
        }
    });

    // Mostrar nombre del usuario en la barra superior
    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = `${session.name} (${session.role})`;
}