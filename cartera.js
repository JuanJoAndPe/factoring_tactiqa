(function() {
    "use strict";

    // 1. Obtener sesión
    const session = typeof getSession === 'function' ? getSession() : null;
    if (!session) return; 

    const userRole = session.role;
    
    // DEFINICIÓN DE PERMISOS
    const esCliente = userRole === 'CLIENTE';
    const esStaff = !esCliente; // Comercial, Operativo, Aprobador, Admin
    const esAprobador = ['ADMIN', 'APROBADOR'].includes(userRole);

    console.log(`Cargando Cartera. Rol: ${userRole}. Es Staff: ${esStaff}. Puede Aprobar: ${esAprobador}`);

    // ========= VARIABLES =========
    const STORAGE_KEY = "db_cartera_lotes";
    let memoryLotes = []; 

    // ========= DOM ELEMENTS =========
    const tbody = document.getElementById("tbodyCartera");
    const emptyMsg = document.getElementById("emptyMsg");
    const thAcciones = document.getElementById("thAcciones");
    const thCliente = document.getElementById("thCliente");
    const inputBusqueda = document.getElementById("inputBusqueda");

    // ========= HELPERS =========
    const formatMoney = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const formatDate = iso => {
      if (!iso) return "--";
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth() + 1).padStart(2,'0')}/${d.getFullYear()}`;
    };

    // ========= CARGA DE DATOS =========
    function loadData() {
        memoryLotes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        
        // Si es CLIENTE, filtramos para que solo vea SUS lotes (simulado por ahora, 
        // en producción filtraríamos por session.id)
        /* if(esCliente) {
            memoryLotes = memoryLotes.filter(l => l.usuarioId === session.id);
        }
        */
        
        renderTable(memoryLotes);
    }

    // ========= RENDERIZADO =========
    function renderTable(listaDatos) {
        // 1. Gestión de Columnas
        if (thCliente) thCliente.style.display = esStaff ? '' : 'none'; // Comercial ve Cliente
        if (thAcciones) thAcciones.style.display = esAprobador ? '' : 'none'; // Solo Aprobador ve Acciones

        tbody.innerHTML = "";

        if (listaDatos.length === 0) {
            if(emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if(emptyMsg) emptyMsg.style.display = 'none';

        // 2. Generar Filas
        [...listaDatos].reverse().forEach((lote) => {
            const originalIndex = memoryLotes.findIndex(item => item.id === lote.id);
            const tr = document.createElement("tr");
            
            // Badge Estado
            let badgeClass = "badge"; 
            if(lote.estado === "PENDIENTE") badgeClass = "badge warn";
            else if(lote.estado === "APROBADO") badgeClass = "badge ok"; 
            else if(lote.estado === "RECHAZADO") badgeClass = "badge bad"; 

            // A. Celda Cliente (Solo para Staff/Comercial)
            let celdaClienteHTML = "";
            if (esStaff) {
                // Si el lote no tiene nombre guardado, mostramos uno genérico o el del pagador
                const nombreCli = lote.usuarioNombre || "Cliente Desconocido";
                celdaClienteHTML = `<td style="font-weight:600; color:var(--primary);">${nombreCli}</td>`;
            }

            // B. Celda Acción (Solo para Aprobador)
            let celdaAccionHTML = "";
            if (esAprobador) {
                const disabledAttr = (lote.estado === "APROBADO" || lote.estado === "RECHAZADO") ? "disabled" : "";
                const styleSelect = disabledAttr ? "background:#f9f9f9; color:#999;" : "background:#fff; color:#333;";

                celdaAccionHTML = `
                    <td>
                        <select onchange="cambiarEstado(${originalIndex}, this.value)" ${disabledAttr} 
                                style="padding:4px; border-radius:4px; border:1px solid #ccc; font-size:12px; width:100%; ${styleSelect}">
                            <option value="" disabled selected>--</option>
                            <option value="APROBADO">✅ Aprobar</option>
                            <option value="RECHAZADO">❌ Rechazar</option>
                            <option value="PENDIENTE">⏳ Pendiente</option>
                        </select>
                    </td>
                `;
            }

            tr.innerHTML = `
                <td style="font-size:12px;">${formatDate(lote.fecha)}</td>
                ${celdaClienteHTML}
                <td style="font-family:monospace; font-weight:bold;">${lote.id}</td>
                <td>${lote.pagador}</td>
                <td style="text-align:right; font-weight:bold;">${formatMoney(lote.total)}</td>
                <td style="text-align:center;"><span class="${badgeClass}">${lote.estado}</span></td>
                ${celdaAccionHTML}
            `;
            tbody.appendChild(tr);
        });
    }

    // ========= FILTRADO =========
    if(inputBusqueda){
        inputBusqueda.addEventListener("keyup", (e) => {
            const term = e.target.value.toLowerCase();
            const filtrados = memoryLotes.filter(lote => 
                (lote.pagador && lote.pagador.toLowerCase().includes(term)) ||
                (lote.id && lote.id.toLowerCase().includes(term)) ||
                (lote.estado && lote.estado.toLowerCase().includes(term)) ||
                (lote.usuarioNombre && lote.usuarioNombre.toLowerCase().includes(term))
            );
            renderTable(filtrados);
        });
    }

    // ========= CAMBIAR ESTADO =========
    window.cambiarEstado = function(index, nuevoEstado) {
        if(!esAprobador) return;

        if(!confirm(`¿Confirma cambiar el estado a ${nuevoEstado}?`)) {
            loadData(); 
            return;
        }

        if(memoryLotes[index]) {
            memoryLotes[index].estado = nuevoEstado;
            memoryLotes[index].aprobadoPor = session.name;
            memoryLotes[index].fechaAprobacion = new Date().toISOString();
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryLotes));
        
        // Refrescar manteniendo filtro
        const term = inputBusqueda.value.toLowerCase();
        if(term && term.length > 0) {
             inputBusqueda.dispatchEvent(new Event('keyup'));
        } else {
            renderTable(memoryLotes);
        }
    };

    // ========= EXPORTAR EXCEL =========
    window.exportarExcel = function() {
        if(memoryLotes.length === 0) { alert("Sin datos."); return; }

        let csvContent = "data:text/csv;charset=utf-8,";
        // Encabezados dinámicos según rol
        let header = "Fecha,ID Lote,Pagador,Total,Estado";
        if(esStaff) header += ",Cliente Solicitante";
        if(esAprobador) header += ",Aprobado Por";
        csvContent += header + "\n";

        // Obtener datos visibles (filtrados)
        const term = inputBusqueda.value.toLowerCase();
        const dataToExport = term 
            ? memoryLotes.filter(l => 
                (l.pagador && l.pagador.toLowerCase().includes(term)) || 
                (l.id && l.id.toLowerCase().includes(term)))
            : memoryLotes;

        dataToExport.forEach(row => {
            const fecha = formatDate(row.fecha);
            const total = row.total.toFixed(2);
            const pagador = `"${(row.pagador || '').replace(/"/g, '""')}"`;
            
            let line = `${fecha},${row.id},${pagador},${total},${row.estado}`;
            if(esStaff) line += `,${row.usuarioNombre || 'N/A'}`;
            if(esAprobador) line += `,${row.aprobadoPor || '-'}`;
            
            csvContent += line + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `cartera_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Inicio
    loadData();
})();