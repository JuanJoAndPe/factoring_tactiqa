document.addEventListener('DOMContentLoaded', () => {
    
    const today = new Date();
    document.getElementById('reportDate').textContent = today.toLocaleDateString('es-EC');
    
    loadClientData();
    loadDocuments();
    loadFinancialKPIs();

    const btnSend = document.getElementById('btnSendToCommittee') || document.getElementById('btnFinalize');
    const btnViewDocs = document.getElementById('btnViewDocs');
    const modal = document.getElementById('docsModal');

    if (btnViewDocs) {
        btnViewDocs.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }
    window.onclick = function(event) {
        if (event.target == modal) modal.classList.remove('active');
    }

    if (btnSend) {
        btnSend.addEventListener('click', () => {
            const riskData = {
                fecha: document.getElementById('reportDate').textContent,
                score: document.getElementById('viewScore').value,
                capacidadPago: document.getElementById('viewCapacidad').value,
                
                chkJudicial: document.querySelector('input[name="chkJudicial"]:checked')?.value,
                chkSri: document.querySelector('input[name="chkSri"]:checked')?.value,
                chkUafe: document.querySelector('input[name="chkUafe"]:checked')?.value,
                
                conclusion: document.getElementById('txtConclusion').value
            };

            if (!riskData.conclusion) {
                alert("⚠️ Por favor ingrese una conclusión.");
                return;
            }

            // TODO: API CALL (SQL: INSERT INTO InformesRiesgo (cliente_id, score, estado, json_detalle) VALUES (?, ?, 'PENDIENTE_COMITE', ?))
            localStorage.setItem('tqa_risk_report_final', JSON.stringify(riskData));

            alert("✅ INFORME ENVIADO A COMITÉ.\n\nEl expediente ha sido transferido.");
            window.location.href = 'menu.html';
        });
    }

    function loadDocuments() {
        // TODO: API CALL (SQL: SELECT * FROM Documentos WHERE cliente_id = ?)
        const docsJSON = localStorage.getItem('finanzasPro_DocsTemp');
        const list = document.getElementById('docsList');
        if(!list) return;

        const data = docsJSON ? JSON.parse(docsJSON) : { documents: [] };

        if (data.documents && data.documents.length > 0) {
            let html = '<ul style="list-style:none; padding:0;">';
            data.documents.forEach(doc => {
                 html += `<li style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
                            <a href="#" style="color:#2980b9; text-decoration:none;">
                                <i class="fa-solid fa-file-pdf"></i> ${doc.name}
                            </a>
                          </li>`;
            });
            html += '</ul>';
            list.innerHTML = html;
        } else {
            list.innerHTML = '<p style="color:#999; font-style:italic;">No se han cargado documentos digitales.</p>';
        }
    }

    function loadFinancialKPIs() {
        // TODO: API CALL (SQL: SELECT kpis_json FROM AnalisisFinanciero WHERE cliente_id = ? ORDER BY id DESC LIMIT 1)
        const kpiJSON = localStorage.getItem('tqa_financial_kpis');
        
        if (kpiJSON) {
            const kpis = JSON.parse(kpiJSON);
            document.getElementById('viewEndeudamiento').value = kpis.endeudamiento || "0.00";
            
            let score = 500;
            if (parseFloat(kpis.liquidez) > 1.5) score += 200;
            if (parseFloat(kpis.endeudamiento) < 0.6) score += 150;
            
            document.getElementById('viewScore').value = score;
            document.getElementById('viewCapacidad').value = `$ ${parseFloat(kpis.liquidez * 10000).toFixed(2)}`; 
        }
    }

    function loadClientData() {
        // TODO: API CALL (SQL: SELECT * FROM Clientes WHERE id = ?)
        const draftJSON = localStorage.getItem("tqa_cliente_draft");
        if (draftJSON) {
            try {
                const client = JSON.parse(draftJSON);
                const data = client.data || {};
                
                const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };

                if (client.tipo === "PJ") {
                    setVal('txtEmpresa', data.pj_razon_social);
                    setVal('txtRuc', data.pj_ruc);
                    setVal('txtActividad', data.pj_actividad_economica); 
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
    }
});