/**
 * SISTEMA MAESTRO DE SEGURIDAD (TACTIQA)
 * Versión: CLOUD (AWS RDS + Lambda)
 */

// TU API EN LA NUBE (Asegúrate de que esta sea la URL correcta de tu API Gateway)
const API_URL = "https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default";

// 1. CONFIGURACIÓN DE PERMISOS (Quién puede ver qué)
const PAGE_ACCESS = {
    CLIENTE: ['cliente-dashboard.html', 'carga-facturas.html', 'cartera.html', 'calificar-pagador.html', 'finanzas-cliente.html', 'menu.html', 'simulador.html'],
    COMERCIAL: ['nuevo-cliente.html', 'clientes.html', 'cartera.html', 'comercial-tareas.html', 'finanzas-pro.html', 'menu.html', 'carga-facturas.html', 'factoring-simular.html'],   
    OPERATIVO: ['cliente-dashboard.html','clientes.html', 'cartera.html', 'finanzas-pro.html', 'informe_riesgo.html', 'menu.html'],
    ANALISTA: ['clientes.html', 'finanzas-pro.html', 'informe_riesgo.html', 'menu.html', 'mesa-analisis.html', 'cartera.html', 'pagadores.html'],
    APROBADOR: ['cartera.html', 'informe_riesgo.html', 'calificar-pagador.html', 'clientes.html', 'menu.html'],
    ADMIN: ['*'] // Admin ve todo
};

// 2. INICIAR SESIÓN (CONECTADO A AWS)
async function loginUser(email, password) {
    try {
        console.log("🔄 Conectando con AWS...");
        
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        // Si la respuesta no es OK (ej: 404, 500, 403), lanzamos error
        if (!response.ok) {
            throw new Error(`Error del Servidor: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // === CORRECCIÓN CRÍTICA ===
            // Mapeamos los campos de la Base de Datos (Español) al Frontend (Inglés)
            // BD: nombre, rol  --> Frontend: name, role
            const session = {
                id: data.user.id,
                email: data.user.email,
                name: data.user.nombre || data.user.name, // Aceptamos ambos por seguridad
                role: data.user.rol || data.user.role,    // Aceptamos ambos
                token: data.token,
                loginTime: Date.now()
            };
            
            // Guardamos la sesión en el navegador (Necesario para no perder login al cambiar de página)
            localStorage.setItem('tqa_session', JSON.stringify(session));
            return { success: true };
        } else {
            return { success: false, message: data.message || "Credenciales incorrectas" };
        }

    } catch (error) {
        console.error("Error de conexión:", error);
        return { success: false, message: "No hay conexión con el servidor. Revisa tu internet o la API." };
    }
}

// 3. OBTENER SESIÓN ACTUAL
function getSession() {
    try {
        const session = JSON.parse(localStorage.getItem('tqa_session'));
        if (!session) return null;
        return session;
    } catch (e) {
        return null;
    }
}

// 4. CERRAR SESIÓN
function logout() {
    localStorage.removeItem('tqa_session'); // Borramos la memoria del navegador
    window.location.href = 'index.html';
}

// 5. PROTECCIÓN DE RUTAS (Seguridad)
function checkAuth() {
    const session = getSession();
    const currentPage = window.location.pathname.split("/").pop(); 

    // Si no hay sesión y no estamos en el login, ¡fuera!
    if (!session) {
        if (currentPage !== 'index.html') window.location.href = 'index.html';
        return;
    }

    // Si es Admin, pase usted
    if (session.role === 'ADMIN') return;

    // Verificar permisos por rol
    const allowedPages = PAGE_ACCESS[session.role] || [];
    
    // Permitir siempre menu e index
    if (!allowedPages.includes(currentPage) && currentPage !== 'menu.html' && currentPage !== 'index.html') {
        alert(`⛔ Acceso Denegado.\nTu perfil (${session.role}) no puede ver esta página.`);
        window.location.href = 'menu.html';
    }
}

// 6. GESTOR DE MENÚ VISUAL (Muestra/Oculta botones)
function applyMenuPermissions() {
    const session = getSession();
    if (!session) return; 

    const userRole = session.role;
    const userId = session.id;
    
    // Mostramos el nombre corregido en la esquina
    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = `Hola, ${session.name} (${userRole})`;

    // Buscamos todos los botones protegidos
    const protectedElements = document.querySelectorAll('[data-roles]');
    
    protectedElements.forEach(el => {
        const allowedRoles = el.getAttribute('data-roles').split(',');
        
        // Si el rol del usuario está en la lista o es ADMIN, mostramos el botón
        if (allowedRoles.includes(userRole) || userRole === 'ADMIN') {
            el.style.display = ''; // Mostrar (quita el display:none)
            
            // Lógica especial para redirigir clientes a SU propio dashboard
            const target = el.getAttribute('data-go');
            if (userRole === 'CLIENTE' && target && target.includes('cliente-dashboard.html')) {
                el.onclick = function(e) {
                    e.preventDefault();
                    window.location.href = `cliente-dashboard.html?id=${userId}`;
                };
                el.removeAttribute('data-go'); 
            }
        } else {
            el.style.display = 'none'; // Ocultar botón
        }
    });
}