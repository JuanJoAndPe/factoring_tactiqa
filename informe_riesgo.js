document.addEventListener('DOMContentLoaded', () => {
    
    // Configuración API
    const API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
    
    document.getElementById('reportDate').textContent = new Date().toLocaleDateString('es-EC');

    // Referencias DOM
    const btnSend = document.getElementById('btnSendToCommittee');
    const btnReject = document.getElementById('btnReject');
    const btnViewDocs = document.getElementById('btnViewDocs');
    const modal = document.getElementById('docsModal');

    // 1. INICIALIZACIÓN: CARGAR DATOS REALES DE LA API
    initReport();

    async function initReport() {
        // Recuperar ID desde el borrador actualizado
        const draft = JSON.parse(localStorage.getItem("tqa_cliente_draft") || "{}");
        const clientId = draft.id || (draft.data ? draft.data.id : null);

        if (!clientId) {
            alert("Error: No se ha seleccionado un cliente. Vuelva a la bandeja de entrada.");
            return;
        }

        console.log("Cargando datos para cliente:", clientId);

        try {
            const response = await fetch(`${API_URL}/clientes?id=${clientId}`);
            const data = await response.json();
            const client = data.items ? data.items[0] : data;

            if (!client) throw new Error("Cliente no encontrado en BD");

            // A. Llenar Datos Básicos
            fillBasicData(client);

            // B. Llenar Documentos
            let docs = [];
            if (client.documentos_financieros) {
                docs = typeof client.documentos_financieros === 'string' 
                    ? JSON.parse(client.documentos_financieros) 
                    : client.documentos_financieros;
            }
            renderDocuments(docs);

            // C. Llenar KPIs
            if (client.kpis_financieros) {
                const kpis = typeof client.kpis_financieros === 'string'
                    ? JSON.parse(client.kpis_financieros)
                    : client.kpis_financieros;
                
                fillKPIs(kpis);
            }

        } catch (e) {
            console.error(e);
            alert("Error cargando expediente: " + e.message);
        }
    }

    // --- FUNCIONES DE LLENADO ---

    function fillBasicData(client) {
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

        if (client.tipo === 'PJ' || client.razon_social) {
            setVal('txtEmpresa', client.razon_social);
            setVal('txtRuc', client.ruc);
            setVal('txtActividad', "Comercial / Servicios");
            setVal('txtRepLegal', "Representante Legal"); 
        } else {
            setVal('txtEmpresa', client.nombre);
            setVal('txtRuc', client.ruc || client.id);
            setVal('txtActividad', "Persona Natural");
        }
        
        const session = JSON.parse(localStorage.getItem('tqa_session') || "{}");
        if(session.nombre) document.getElementById('analystName').textContent = session.nombre;
    }

    // CORRECCIÓN AQUÍ: Usamos openSecureDocument en lugar de window.open directo
    function renderDocuments(docs) {
        const list = document.getElementById('docsList');
        if (!docs || docs.length === 0) {
            list.innerHTML = '<p style="color:#999; text-align:center;">No hay documentos digitales cargados.</p>';
            return;
        }

        list.innerHTML = "";
        docs.forEach(doc => {
            list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <div style="font-size:13px; font-weight:500; display:flex; align-items:center; gap:10px;">
                        <i class="fa-regular fa-file-pdf" style="color:#e74c3c;"></i> 
                        ${doc.name || 'Documento Adjunto'}
                    </div>
                    <button class="btn-icon" onclick="openSecureDocument('${doc.url}')" title="Ver Documento" style="cursor:pointer; border:none; background:none; color:#1F3A5F;">
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </div>
            `;
        });
    }

    function fillKPIs(kpis) {
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
        
        let score = 500;
        const liq = parseFloat(kpis.liquidez || 0);
        const end = parseFloat(kpis.endeudamiento || 0);
        
        if (liq > 1.0) score += 200;
        if (end < 0.7 && end > 0) score += 150;
        
        setVal('scoreCredito', score);
        
        const cards = document.querySelectorAll('.kpi-card');
        cards.forEach(card => {
            const label = card.querySelector('label').innerText.toUpperCase();
            const valueSpan = card.querySelector('.value');
            
            if(label.includes('LIQUIDEZ')) valueSpan.innerText = liq.toFixed(2);
            if(label.includes('P. ÁCIDA')) valueSpan.innerText = (liq * 0.8).toFixed(2);
            if(label.includes('ENDEUDAMIENTO') || label.includes('DEUDA')) valueSpan.innerText = end.toFixed(2);
        });
    }

    // === UI HANDLERS ===
    
    if (btnViewDocs) {
        btnViewDocs.addEventListener('click', () => modal.classList.add('active'));
    }
    window.onclick = (e) => { if (e.target == modal) modal.classList.remove('active'); };

    if (btnSend) {
        btnSend.addEventListener('click', async () => {
            if(!validateConclusion()) return;
            if (!confirm("¿Enviar a Comité de Riesgos?")) return;
            await updateStatus('PENDIENTE_COMITE', document.getElementById('txtConclusion').value);
        });
    }

    if (btnReject) {
        btnReject.addEventListener('click', async () => {
            if(!validateConclusion(true)) return;
            if (!confirm("¿Devolver a Comercial para correcciones?")) return;
            await updateStatus('CORRECCION', "DEVUELTO: " + document.getElementById('txtConclusion').value);
        });
    }

    function validateConclusion(isReject = false) {
        const val = document.getElementById('txtConclusion').value.trim();
        if (!val) {
            const msg = isReject ? "Para devolver, debe explicar el motivo." : "Debe ingresar una conclusión.";
            alert("⚠️ " + msg);
            document.getElementById('txtConclusion').focus();
            return false;
        }
        return true;
    }

    async function updateStatus(newState, obs) {
        const draft = JSON.parse(localStorage.getItem("tqa_cliente_draft") || "{}");
        const clientId = draft.id || (draft.data ? draft.data.id : null);

        const btn = newState === 'PENDIENTE_COMITE' ? btnSend : btnReject;
        const original = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '...';

        try {
            await fetch(`${API_URL}/clientes?id=${clientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: newState,
                    informe_riesgo: {
                        fecha: new Date().toLocaleDateString(),
                        conclusion: obs,
                        score: document.getElementById('scoreCredito').value
                    }
                })
            });
            alert(newState === 'CORRECCION' ? "↩️ Devuelto correctamente." : "✅ Enviado a Comité.");
            window.location.href = 'operativo-tareas.html';
        } catch (e) {
            alert("Error: " + e.message);
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    // === NUEVA FUNCIÓN: ABRIR DOCUMENTO SEGURO ===
    // Esta función pide permiso a la API antes de abrir el PDF
    window.openSecureDocument = async (publicUrl) => {
        if (!publicUrl) return;

        try {
            // Extraer la "key" (ruta del archivo) de la URL
            const urlObj = new URL(publicUrl);
            const key = urlObj.pathname.substring(1); // Quita la primera barra '/'
            
            // UI Feedback
            const btn = event.currentTarget; 
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            // Pedir URL firmada
            const response = await fetch(`${API_URL}/files/read-url?key=${encodeURIComponent(key)}`);
            const data = await response.json();

            btn.innerHTML = originalHTML;

            if (data.success) {
                window.open(data.url, '_blank'); // Abre la URL temporal que sí funciona
            } else {
                alert("Acceso denegado al archivo.");
            }

        } catch (e) {
            console.error(e);
            alert("Error al abrir el documento.");
        }
    };
});