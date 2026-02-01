/**
 * GESTIÓN DE CLIENTES (VERSIÓN NUBE AWS)
 */

const $ = (id) => document.getElementById(id);
const tbody = document.querySelector('table tbody'); // Seleccionamos el cuerpo de la tabla

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Verificar si auth.js cargó la URL
    if (typeof API_URL === 'undefined') {
        alert("Error: auth.js no se ha cargado. Revisa el HTML.");
        return;
    }

    // 2. Limpiar la tabla visualmente (borrar los ejemplos C-001, C-002...)
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">🔄 Cargando datos reales de AWS...</td></tr>';

    // 3. Pedir datos a la Nube
    await cargarClientesReales();
});

async function cargarClientesReales() {
    try {
        // Hacemos la petición a tu API Gateway
        const response = await fetch(`${API_URL}/clientes`); // Usa la URL de auth.js
        
        if (!response.ok) {
            throw new Error(`Error API: ${response.status}`);
        }

        const data = await response.json();
        const listaClientes = data.items || [];

        // 4. Mostrar los datos
        renderizarTabla(listaClientes);

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:red; padding: 20px;">
                    <strong>Error de conexión:</strong> No se pudo traer la lista.<br>
                    <small>${error.message}</small>
                </td>
            </tr>`;
    }
}

function renderizarTabla(clientes) {
    tbody.innerHTML = ''; // Limpiar mensaje de carga

    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No hay clientes registrados en la Base de Datos.</td></tr>';
        return;
    }

    clientes.forEach(cliente => {
        const tr = document.createElement('tr');
        
        // Datos seguros (evitar null)
        const idVisual = cliente.id ? cliente.id.substring(0, 8) + '...' : '---';
        const nombre = cliente.razon_social || cliente.nombre || 'Sin Nombre';
        const ruc = cliente.ruc || '---';
        const email = cliente.email_contacto || '---';
        const estado = 'Activo'; // Por defecto

        tr.innerHTML = `
            <td><strong>${idVisual}</strong></td>
            <td>${cliente.tipo}</td>
            <td>${nombre}</td>
            <td>${ruc}</td>
            <td>${email}</td>
            <td>-</td>
            <td><span class="badge ok">${estado}</span></td>
        `;
        
        // Click para ir al detalle
        tr.style.cursor = "pointer";
        tr.addEventListener('click', () => {
            window.location.href = `finanzas-pro.html?clientId=${cliente.id}`;
        });

        tbody.appendChild(tr);
    });
}