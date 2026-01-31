(function() {
    "use strict";

    // 1. Obtener sesión
    const session = typeof getSession === 'function' ? getSession() : null;
    if (!session) return; 

    console.log(`Cargando Tareas Comercial. Usuario: ${session.name}`);

    // ========= HELPERS =========
    const formatMoney = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const formatDate = iso => {
      if (!iso) return "--";
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth() + 1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    // ========= LOGIC =========
    const STORAGE_KEY = "db_cartera_lotes"; // Leemos los lotes reales
    const tbody = document.getElementById("tbodyTareas");
    const emptyMsg = document.getElementById("emptyMsg");

    function renderTable() {
        // Leemos la "Base de Datos" compartida
        let lotes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        
        tbody.innerHTML = "";

        if (lotes.length === 0) {
            if(emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if(emptyMsg) emptyMsg.style.display = 'none';

        // Renderizamos (Orden inverso: lo más nuevo arriba)
        [...lotes].reverse().forEach((lote) => {
            const tr = document.createElement("tr");
            
            // Lógica de colores para el estado
            let badgeClass = "badge"; 
            let estadoTexto = lote.estado;

            if(lote.estado === "PENDIENTE") {
                badgeClass = "badge warn";
                estadoTexto = "⏳ Pendiente";
            }
            else if(lote.estado === "APROBADO") {
                badgeClass = "badge ok";
                estadoTexto = "✅ Aprobado";
            }
            else if(lote.estado === "RECHAZADO") {
                badgeClass = "badge bad"; // Usa el estilo rojo definido en styles.css
                estadoTexto = "❌ Negado";
            }

            tr.innerHTML = `
                <td style="font-size:12px; color:var(--muted);">${formatDate(lote.fecha)}</td>
                <td style="font-family:monospace; font-weight:700; color:var(--primary);">${lote.id}</td>
                <td>${lote.pagador}</td>
                <td style="text-align:center;">${lote.cantidadDocs}</td>
                <td style="text-align:right; font-weight:700;">${formatMoney(lote.total)}</td>
                <td style="text-align:center;"><span class="${badgeClass}">${estadoTexto}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Inicializar
    renderTable();

})();