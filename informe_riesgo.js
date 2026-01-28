document.addEventListener('DOMContentLoaded', () => {
    
    // Inicialización
    const today = new Date();
    document.getElementById('reportDate').textContent = today.toLocaleDateString('es-EC');
    
    loadClientData();
    loadDocuments();
    loadFinancialKPIs();

    // Referencias
    const btnFinalize = document.getElementById('btnFinalize');
    const btnDownload = document.getElementById('btnDownloadPDF');
    const btnViewDocs = document.getElementById('btnViewDocs');
    const modal = document.getElementById('docsModal');
    const reportContent = document.getElementById('reportContent');

    // 1. EVENTO VER DOCUMENTOS
    if (btnViewDocs) {
        btnViewDocs.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }
    window.onclick = function(event) {
        if (event.target == modal) modal.classList.remove('active');
    }

    // 2. FINALIZAR INFORME
    btnFinalize.addEventListener('click', () => {
        disableAllInputs();
        alert("Informe finalizado. Ahora puede descargar el PDF.");
        btnFinalize.style.display = 'none';
        btnDownload.style.display = 'inline-flex';
    });

    // 3. GENERAR PDF (CON CLASE TEMPORAL PARA AJUSTAR ANCHO)
    btnDownload.addEventListener('click', () => {
        
        // PASO CLAVE: Agregar clase para que se ajuste a ancho A4 SOLO durante la descarga
        reportContent.classList.add('pdf-mode');

        const opt = {
            margin:       15,
            filename:     `Informe_${document.getElementById('txtEmpresa').value || 'Cliente'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true,
                scrollY: 0
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Generar y luego quitar la clase
        html2pdf().set(opt).from(reportContent).save()
        .then(() => {
            // Restaurar vista de pantalla normal
            reportContent.classList.remove('pdf-mode');
        })
        .catch(err => {
            console.error("Error PDF:", err);
            reportContent.classList.remove('pdf-mode'); // Asegurar que se restaure aunque falle
            alert("Error al generar PDF.");
        });
    });

    // --- FUNCIONES AUXILIARES ---

    function loadDocuments() {
        const docsJSON = localStorage.getItem('finanzasPro_DocsTemp');
        const listContainer = document.getElementById('docsList');
        listContainer.innerHTML = ''; 

        if(!docsJSON) { 
            listContainer.innerHTML = '<p style="padding:10px; color:#999;">No hay documentos.</p>'; 
            return; 
        }
        
        try {
            const data = JSON.parse(docsJSON);
            const docs = data.documents || [];

            if (docs.length === 0) {
                listContainer.innerHTML = '<p style="padding:10px; color:#999;">No hay documentos.</p>'; 
                return;
            }

            docs.forEach(doc => {
                const item = document.createElement('div');
                item.style.cssText = "display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #eee;";
                item.innerHTML = `
                    <div style="font-size:20px; color:#e74c3c;"><i class="fa-solid fa-file-pdf"></i></div>
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:13px; color:#333;">${doc.name}</div>
                        <div style="font-size:11px; color:#666;">${doc.type} (${doc.size})</div>
                    </div>
                    <button class="btn-download-doc" style="cursor:pointer; background:#f0f2f5; border:none; padding:8px 12px; border-radius:4px; color:#0d0035; font-size:12px;">
                        <i class="fa-solid fa-download"></i> Descargar
                    </button>
                `;
                const btn = item.querySelector('.btn-download-doc');
                btn.addEventListener('click', () => downloadSimulation(doc.name));
                listContainer.appendChild(item);
            });

        } catch(e) { console.error(e); }
    }

    function downloadSimulation(filename) {
        const text = `Simulación de descarga para: ${filename}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function loadFinancialKPIs() {
        const kpiJSON = localStorage.getItem('tqa_financial_kpis');
        if (!kpiJSON) return;
        try {
            const kpis = JSON.parse(kpiJSON);
            const values = document.querySelectorAll('.kpi-card .value');
            if(values.length >= 6) {
                values[0].textContent = kpis.liquidez;
                values[1].textContent = kpis.pruebaAcida;
                values[2].textContent = kpis.margenNeto;
                values[3].textContent = kpis.roa;
                values[4].textContent = kpis.roe;
                values[5].textContent = kpis.endeudamiento;
            }
        } catch (e) { console.error(e); }
    }

    function loadClientData() {
        const draftJSON = localStorage.getItem("tqa_cliente_draft");
        if (!draftJSON) return;
        try {
            const client = JSON.parse(draftJSON);
            const data = client.data || {};
            if (client.tipo === "PJ") {
                setVal('txtEmpresa', data.pj_razon_social);
                setVal('txtRuc', data.pj_ruc);
                setVal('txtActividad', data.pj_detalle_actividad);
                setVal('txtRepLegal', `${data.pj_rep_nombre} ${data.pj_rep_apellido}`);
                setVal('txtCiRep', data.pj_rep_num);
            } else {
                setVal('txtEmpresa', data.pn_razon || `${data.pn_nombre} ${data.pn_apellido}`);
                setVal('txtRuc', data.pn_ruc);
                setVal('txtActividad', "Persona Natural");
                setVal('txtRepLegal', `${data.pn_nombre} ${data.pn_apellido}`);
                setVal('txtCiRep', data.pn_num_id);
            }
        } catch (e) { console.error(e); }
    }

    function disableAllInputs() {
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = true;
            // Estilos solo para cuando se bloquea, pero en pantalla se ve normal
            // El estilo de impresión lo maneja la clase .pdf-mode en CSS
            input.style.backgroundColor = "#fafafa";
            input.style.border = "1px solid #eee";
            
            if(input.tagName === 'SELECT'){
                const text = input.options[input.selectedIndex]?.text || "";
                const span = document.createElement('span');
                span.textContent = text;
                span.style.fontWeight = '600';
                input.parentNode.replaceChild(span, input);
            }
        });
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
});