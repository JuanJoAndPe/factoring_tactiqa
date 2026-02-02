/**
 * SISTEMA MAESTRO DE SEGURIDAD (TACTIQA)
 * Versión: FIX-ROLES-DATABASE
 */

const API_URL = "https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default";

// 1. CONFIGURACIÓN DE PERMISOS (Exactamente como tus data-roles en HTML)
const PAGE_ACCESS = {
    'CLIENTE': ['cliente-dashboard.html', 'carga-facturas.html', 'cartera.html', 'calificar-pagador.html', 'finanzas-cliente.html', 'menu.html', 'simulador.html', 'pagadores.html'],
    'COMERCIAL': ['nuevo-cliente.html', 'clientes.html', 'cartera.html', 'comercial-tareas.html', 'finanzas-pro.html', 'menu.html', 'carga-facturas.html', 'factoring-simular.html', 'pagadores.html'],   
    'OPERATIVO': ['cliente-dashboard.html', 'clientes.html', 'cartera.html', 'finanzas-pro.html', 'informe_riesgo.html', 'menu.html', 'pagadores.html'],
    'ANALISTA': ['clientes.html', 'finanzas-pro.html', 'informe_riesgo.html', 'menu.html', 'mesa-analisis.html', 'cartera.html', 'pagadores.html'],
    'APROBADOR': ['cartera.html', 'informe_riesgo.html', 'calificar-pagador.html', 'clientes.html', 'menu.html', 'tareas.html'],
    'COMITE': ['tareas.html', 'menu.html'],
    'ADMIN': ['*'] 
};

// 2. INICIAR SESIÓN
async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // DETECTIVE DE DATOS: Vemos qué envía AWS exactamente
            console.log("Datos recibidos:", data.user);

            // Extraemos el rol de la columna 'rol' de tu tabla SQL
            let dbRole = data.user.rol || data.user.role || "";
            dbRole = dbRole.toString().toUpperCase().trim(); // Lo pasamos a MAYÚSCULAS para que coincida con tu tabla

            // ASIGNACIÓN FINAL: Si el rol de la DB no existe o está vacío, usamos CLIENTE
            // Pero si el rol de la DB es ANALISTA, ADMIN, etc., lo respetamos.
            const finalRole = dbRole && PAGE_ACCESS[dbRole] ? dbRole : 'CLIENTE';

            const session = {
                id: data.user.id,
                email: data.user.email,
                name: data.user.nombre || data.user.name || email.split('@')[0],
                role: finalRole, 
                token: data.token,
                loginTime: Date.now()
            };

            console.log("Sesión establecida con rol:", session.role);
            localStorage.setItem('tqa_session', JSON.stringify(session));
            return { success: true };
        } else {
            return { success: false, message: data.message || "Error de credenciales" };
        }
    } catch (error) {
        console.error("Error fatal en login:", error);
        return { success: false, message: "Error de conexión con el servidor." };
    }
}

// 3. FUNCIONES DE APOYO
function getSession() {
    return JSON.parse(localStorage.getItem('tqa_session'));
}

function logout() {
    localStorage.removeItem('tqa_session');
    window.location.href = 'index.html';
}

// 4. PROTECCIÓN DE RUTA (Impide entrar por URL si no tienes permiso)
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
        window.location.href = 'menu.html';
    }
}

// 5. GESTOR VISUAL DEL MENÚ
function applyMenuPermissions() {
    const session = getSession();
    if (!session) return; 

    const userRole = session.role;
    
    // Actualizar saludo
    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = `Hola, ${session.name} (${userRole})`;

    // Filtrar botones del menú
    document.querySelectorAll('[data-roles]').forEach(el => {
        const allowedRoles = el.getAttribute('data-roles').split(',').map(r => r.trim());
        
        if (userRole === 'ADMIN' || allowedRoles.includes(userRole)) {
            el.style.display = 'grid'; // Asegura que se vea
        } else {
            el.style.display = 'none'; // Lo oculta si no tienes el rol
        }
    });
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('userNameDisplay')) {
        applyMenuPermissions();
    }
});