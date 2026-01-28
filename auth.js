/**
 * SISTEMA DE SEGURIDAD Y ROLES (TACTIQA)
 * Archivo: auth.js
 */

// 1. BASE DE DATOS DE USUARIOS (Simulada)
const MOCK_DB = [
    { 
        email: "cliente", 
        pass: "1234", 
        role: "CLIENTE", 
        name: "Juan Pérez", 
        id: "C-001" 
    },
    { 
        email: "comercial", 
        pass: "1234", 
        role: "COMERCIAL", 
        name: "Ejecutivo Comercial",
        id: "EMP-01"
    },
    { 
        email: "operativo", 
        pass: "1234", 
        role: "OPERATIVO", 
        name: "Analista Operativo",
        id: "EMP-02"
    },
    { 
        email: "aprobador", 
        pass: "1234", 
        role: "APROBADOR", 
        name: "Gerente de Riesgo",
        id: "EMP-03"
    },
    { 
        email: "admin", 
        pass: "1234", 
        role: "ADMIN", 
        name: "Super Admin",
        id: "ADM-01"
    }
];

// 2. INICIAR SESIÓN
function loginUser(email, password) {
    const user = MOCK_DB.find(u => u.email === email && u.pass === password);
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
    return { success: false, message: "Credenciales incorrectas." };
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
    
    // Seleccionar elementos protegidos
    const protectedElements = document.querySelectorAll('[data-roles]');

    protectedElements.forEach(el => {
        const allowedRoles = el.getAttribute('data-roles').split(',');
        
        // CAMBIO: Quitamos "|| userRole === 'ADMIN'"
        // Ahora el ADMIN debe estar explícito en el HTML para ver el elemento.
        if (allowedRoles.includes(userRole)) {
            el.style.display = ''; // Mostrar
            
            // Inyectar ID del cliente en su dashboard
            const target = el.getAttribute('data-go');
            if (userRole === 'CLIENTE' && target && target.includes('cliente-dashboard.html')) {
                el.onclick = function() {
                    window.location.href = `cliente-dashboard.html?id=${userId}`;
                };
                el.removeAttribute('data-go'); 
            }

        } else {
            el.style.display = 'none'; // Ocultar
        }
    });

    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = `${session.name} (${session.role})`;
}