(function() {
    "use strict";

    // 1. Obtener sesión segura desde auth.js
    // Usamos getSession() para asegurar que leemos el usuario logueado correctamente
    const session = typeof getSession === 'function' ? getSession() : null;
    
    // Si no hay sesión, auth.js se encarga de redirigir, pero por seguridad paramos aquí.
    if (!session) return; 

    const userRole = session.role;
    const userId = session.id;

    // Definimos quién tiene permiso de editar (Aprobador o Admin)
    const esAprobador = ['ADMIN', 'APROBADOR'].includes(userRole);

    console.log(`Cargando Cartera. Usuario: ${session.name} (${userRole}). Modo Aprobador: ${esAprobador}`);

    // ========= HELPERS =========
    const formatMoney = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const formatDate = iso => {
      if (!iso) return "--";
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth() + 1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    // ========= ELEMENTOS DOM =========
    const STORAGE_KEY = "db_cartera_lotes";
    const tbody = document.getElementById("tbodyCartera");
    const emptyMsg = document.getElementById("emptyMsg");
    const thAcciones = document.getElementById("thAcciones");

    // ========= RENDERIZADO =========
    function renderTable() {
        // A. Controlar visibilidad de la columna Acción (Header)
        if (thAcciones) {
            thAcciones.style.display = esAprobador ? '' : 'none';
        }

        // B. Leer datos de la base de datos simulada
        let lotes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        
        // FILTRO OPCIONAL: Si quisieras que el Cliente solo vea SUS lotes
        // if (userRole === 'CLIENTE') {
        //    lotes = lotes.filter(l => l.usuarioId === userId); // Requiere guardar usuarioId al crear el lote
        // }

        tbody.innerHTML = "";

        if (lotes.length === 0) {
            if(emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if(emptyMsg) emptyMsg.style.display = 'none';

        // C. Renderizar filas (Inverso para ver recientes primero)
        [...lotes].reverse().forEach((lote, index) => {
            const realIndex = lotes.length - 1 - index; 

            const tr = document.createElement("tr");
            
            // Estilos de Badge según estado
            let badgeClass = "badge"; 
            if(lote.estado === "PENDIENTE") badgeClass = "badge warn";
            else if(lote.estado === "APROBADO") badgeClass = "badge ok"; 
            else if(lote.estado === "RECHAZADO") badgeClass = "badge" // Rojo o default

            // Celda de Acción (Solo se construye si es Aprobador)
            let celdaAccion = "";
            
            if (esAprobador) {
                // Bloquear si ya está decidido
                const disabledAttr = (lote.estado === "APROBADO" || lote.estado === "RECHAZADO") ? "disabled" : "";
                
                // Color visual para el select si está deshabilitado
                const styleSelect = disabledAttr ? "background:#f9f9f9; color:#999;" : "background:#fff; color:#333;";

                celdaAccion = `
                    <td>
                        <select onchange="cambiarEstado(${realIndex}, this.value)" ${disabledAttr} 
                                style="padding:4px; border-radius:4px; border:1px solid #ccc; font-size:12px; width:100%; ${styleSelect}">
                            <option value="" disabled selected>-- Decisión --</option>
                            <option value="APROBADO">✅ Aprobar</option>
                            <option value="RECHAZADO">❌ Rechazar</option>
                            <option value="PENDIENTE">⏳ Pendiente</option>
                        </select>
                    </td>
                `;
            }

            tr.innerHTML = `
                <td style="font-size:12px;">${formatDate(lote.fecha)}</td>
                <td style="font-family:monospace; font-weight:bold; color:var(--primary);">${lote.id}</td>
                <td>${lote.pagador}</td>
                <td style="text-align:center;">${lote.cantidadDocs}</td>
                <td style="text-align:right; font-weight:bold;">${formatMoney(lote.total)}</td>
                <td style="text-align:center;"><span class="${badgeClass}">${lote.estado}</span></td>
                ${celdaAccion} 
            `;
            tbody.appendChild(tr);
        });
    }

    // ========= FUNCIÓN GLOBAL PARA CAMBIAR ESTADO =========
    window.cambiarEstado = function(index, nuevoEstado) {
        if(!esAprobador) return; // Seguridad extra

        if(!confirm(`¿Confirma cambiar el estado de este lote a ${nuevoEstado}?`)) {
            renderTable(); // Revertir visualmente si cancela
            return;
        }

        const lotes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        if(lotes[index]) {
            lotes[index].estado = nuevoEstado;
            // Aquí podríamos agregar fecha de aprobación o quién lo aprobó
            lotes[index].aprobadoPor = session.name;
            lotes[index].fechaAprobacion = new Date().toISOString();
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lotes));
        renderTable();
    };

    // ========= INICIALIZAR =========
    renderTable();

})();