document.addEventListener('DOMContentLoaded', () => {

    loadData();
    setupDocuments();
    setupDecisionLogic();

    function loadData() {
        // 1. Cargar Cliente (Draft inicial)
        const draftJSON = localStorage.getItem("tqa_cliente_draft");
        if (draftJSON) {
            try {
                const client = JSON.parse(draftJSON);
                const data = client.data || {};
                if (client.tipo === "PJ") {
                    setVal('viewEmpresa', data.pj_razon_social);
                    setVal('viewRuc', data.pj_ruc);
                } else {
                    setVal('viewEmpresa', data.pn_razon || `${data.pn_nombre} ${data.pn_apellido}`);
                    setVal('viewRuc', data.pn_ruc);
                }
            } catch (e) { console.error(e); }
        }

        // 2. Cargar Informe del Analista (Enviado desde informe_riesgo.html)
        const reportJSON = localStorage.getItem('tqa_risk_report_final');
        const kpiJSON = localStorage.getItem('tqa_financial_kpis'); 
        
        if (reportJSON) {
            try {
                const report = JSON.parse(reportJSON);
                setVal('viewConclusion', report.conclusion || "Sin observaciones.");
                setVal('viewScore', report.score || "N/A");
                
                // Traducir los códigos de verificaciones a texto legible
                setVal('viewJudicial', report.chkJudicial === 'ok' ? 'SIN NOVEDADES' : 'CON ALERTAS');
                setVal('viewSri', report.chkSri === 'ok' ? 'SIN DEUDAS' : 'CON DEUDAS');

            } catch (e) { console.error(e); }
        } else {
            document.getElementById('viewConclusion').value = "⚠️ No se ha recibido el informe del analista aún.";
        }

        if (kpiJSON) {
            try {
                const kpis = JSON.parse(kpiJSON);
                setVal('viewEndeudamiento', kpis.endeudamiento || "0.00");
            } catch (e) { console.error(e); }
        }
    }

    function setupDecisionLogic() {
        const select = document.getElementById('selectDecision');
        const box = document.getElementById('decisionBox');
        const approvedFields = document.getElementById('approvedFields');
        const deniedFields = document.getElementById('deniedFields');
        const btnSave = document.getElementById('btnSaveDecision');

        select.addEventListener('change', (e) => {
            const val = e.target.value;
            box.className = 'decision-box'; // reset
            approvedFields.classList.add('hidden');
            deniedFields.classList.add('hidden');

            if (val === 'APROBADO') {
                box.classList.add('approved');
                approvedFields.classList.remove('hidden');
            } else if (val === 'NEGADO') {
                box.classList.add('denied');
                deniedFields.classList.remove('hidden');
            }
        });

        btnSave.addEventListener('click', () => {
            const decision = select.value;
            if (!decision) return alert("Debe seleccionar una decisión.");

            if (decision === 'APROBADO') {
                const tasa = document.getElementById('inputTasa').value;
                const dias = document.getElementById('inputDias').value;
                const cupo = document.getElementById('inputCupo').value;

                if (!tasa || !dias || !cupo) return alert("Complete Tasa, Días y Cupo para aprobar.");

                alert(`✅ OPERACIÓN APROBADA\n\nSe ha generado el cupo de $${cupo} con éxito.`);
                // Aquí podrías guardar el estado final en localStorage si hay otro paso
            } else if (decision === 'NEGADO') {
                if(!document.getElementById('txtMotivoNeg').value) return alert("Debe ingresar el motivo del rechazo.");
                alert("❌ Operación Negada y notificada.");
            } else {
                alert("Operación devuelta al analista.");
            }
        });
    }

    function setupDocuments() {
        const btnViewDocs = document.getElementById('btnViewDocs');
        const modal = document.getElementById('docsModal');
        const listContainer = document.getElementById('docsList');

        if (btnViewDocs) {
            btnViewDocs.addEventListener('click', () => {
                loadDocumentsList();
                modal.classList.add('active');
            });
        }
        window.onclick = function(event) { if (event.target == modal) modal.classList.remove('active'); }

        function loadDocumentsList() {
            const docsJSON = localStorage.getItem('finanzasPro_DocsTemp');
            listContainer.innerHTML = ''; 
            if(!docsJSON) { listContainer.innerHTML = '<p style="color:#999; text-align:center;">Sin documentos.</p>'; return; }
            
            try {
                const data = JSON.parse(docsJSON);
                (data.documents || []).forEach(doc => {
                    const item = document.createElement('div');
                    item.style.cssText = "display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #eee;";
                    item.innerHTML = `
                        <div style="font-size:20px; color:#e74c3c;"><i class="fa-solid fa-file-pdf"></i></div>
                        <div style="flex:1; font-size:13px;"><strong>${doc.name}</strong><br><span style="color:#666; font-size:11px;">${doc.size}</span></div>
                        <button style="border:none; background:#f0f2f5; padding:6px 12px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-download"></i></button>
                    `;
                    item.querySelector('button').onclick = () => alert(`Descargando ${doc.name}...`);
                    listContainer.appendChild(item);
                });
            } catch(e) { console.error(e); }
        }
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
});