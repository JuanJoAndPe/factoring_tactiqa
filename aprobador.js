document.addEventListener('DOMContentLoaded', () => {

    const isAnalystPage = !!document.getElementById('selectRecomendacion');
    const isCommitteePage = !!document.getElementById('selectDecision');

    loadCommonData(); 
    setupDocumentsModal();

    if (isAnalystPage) setupAnalystLogic();
    if (isCommitteePage) {
        loadAnalystReport(); 
        setupCommitteeLogic();
    }

    function loadCommonData() {
        // TODO: API CALL (SQL: SELECT * FROM Clientes WHERE id = ?)
        const draftJSON = localStorage.getItem("tqa_cliente_draft");
        if (draftJSON) {
            try {
                const client = JSON.parse(draftJSON);
                const data = client.data || {};
                setVal('viewEmpresa', client.tipo === "PJ" ? data.pj_razon_social : (data.pn_razon || data.pn_nombre + ' ' + data.pn_apellido));
                setVal('viewRuc', client.tipo === "PJ" ? data.pj_ruc : data.pn_ruc);
            } catch (e) { console.error("Error cargando cliente", e); }
        }

        // TODO: API CALL (SQL: SELECT * FROM InformesRiesgo WHERE cliente_id = ?)
        const reportJSON = localStorage.getItem('tqa_risk_report_final');
        if (reportJSON) {
            try {
                const report = JSON.parse(reportJSON);
                setVal('viewScore', report.score || "N/A");
                setVal('viewJudicial', report.chkJudicial === 'ok' ? 'SIN NOVEDADES' : 'CON ALERTAS');
                setVal('viewSri', report.chkSri === 'ok' ? 'SIN DEUDAS' : 'CON DEUDAS');
                
                // TODO: API CALL (SQL: SELECT * FROM AnalisisFinanciero ...)
                const endeudamiento = localStorage.getItem('tqa_financial_kpis');
                if(endeudamiento) {
                    const kpis = JSON.parse(endeudamiento);
                    setVal('viewEndeudamiento', kpis.endeudamiento || "0.00");
                }
            } catch (e) {}
        }
    }

    function setupDocumentsModal() {
        const btn = document.getElementById('btnViewDocs');
        const modal = document.getElementById('docsModal');
        const list = document.getElementById('docsList');

        if (btn) {
            btn.addEventListener('click', () => {
                const docsJSON = localStorage.getItem('finanzasPro_DocsTemp');
                list.innerHTML = '';
                
                const facturasJSON = localStorage.getItem('tqa_facturas_carga');
                if(facturasJSON) {
                    const facts = JSON.parse(facturasJSON);
                    const factHeader = document.createElement('h4');
                    factHeader.textContent = "Operaciones de Facturas";
                    list.appendChild(factHeader);
                    
                    facts.forEach(f => {
                         const item = document.createElement('div');
                         item.style.cssText = "padding:8px; background:#f9f9f9; border:1px solid #eee; margin-bottom:5px; font-size:12px;";
                         item.innerHTML = `<strong>Factura:</strong> ${f.claveAcceso.substring(0,20)}... <br> <strong>Monto:</strong> $${f.monto}`;
                         list.appendChild(item);
                    });
                }

                if (docsJSON) {
                    const data = JSON.parse(docsJSON);
                    const docHeader = document.createElement('h4');
                    docHeader.textContent = "Expediente Digital";
                    list.appendChild(docHeader);

                    (data.documents || []).forEach(doc => {
                        const item = document.createElement('div');
                        item.style.cssText = "display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #eee; font-size:13px;";
                        item.innerHTML = `<i class="fa-solid fa-file-pdf" style="color:#e74c3c"></i> ${doc.name}`;
                        list.appendChild(item);
                    });
                }
                modal.classList.add('active');
            });
        }
    }

    function setupAnalystLogic() {
        const btnSubmit = document.getElementById('btnSubmitAnalysis');
        
        btnSubmit.addEventListener('click', () => {
            const recomendacion = document.getElementById('selectRecomendacion').value;
            const analisis = document.getElementById('txtAnalisis').value;

            if (!recomendacion) return alert("Seleccione recomendación.");
            if (!analisis) return alert("Ingrese informe técnico.");

            const analystReport = {
                recomendacion: recomendacion,
                texto: analisis,
                fecha: new Date().toLocaleString(),
                analista: "Analista 01" 
            };

            // TODO: API CALL (SQL: UPDATE InformesRiesgo SET recomendacion_analista=?, texto_analista=? WHERE id=?)
            localStorage.setItem('tqa_analyst_feedback', JSON.stringify(analystReport));

            alert("✅ INFORME ENVIADO A COMITÉ");
            window.location.href = 'menu.html'; 
        });
    }

    function loadAnalystReport() {
        // TODO: API CALL (SQL: SELECT recomendacion_analista FROM InformesRiesgo ...)
        const feedbackJSON = localStorage.getItem('tqa_analyst_feedback');
        const badge = document.getElementById('badgeRecomendacion');
        const texto = document.getElementById('viewAnalisisTexto');

        if (feedbackJSON) {
            const data = JSON.parse(feedbackJSON);
            texto.textContent = `"${data.texto}" - (Fecha: ${data.fecha})`;
            badge.textContent = data.recomendacion;
            badge.className = data.recomendacion === 'FAVORABLE' ? 'badge ok' : 'badge warn';
        } else {
            texto.textContent = "⚠️ Pendiente de análisis.";
            badge.className = 'badge bad';
            badge.textContent = "SIN ANÁLISIS";
        }
    }

    function setupCommitteeLogic() {
        const select = document.getElementById('selectDecision');
        const box = document.getElementById('decisionBox');
        const approvedFields = document.getElementById('approvedFields');
        const deniedFields = document.getElementById('deniedFields');
        const btnSave = document.getElementById('btnSaveDecision');

        select.addEventListener('change', (e) => {
            const val = e.target.value;
            box.className = 'decision-box'; 
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
            if (!decision) return alert("Seleccione decisión.");

            if (decision === 'APROBADO') {
                const tasa = document.getElementById('inputTasa').value;
                const dias = document.getElementById('inputDias').value;
                const cupo = document.getElementById('inputCupo').value;
                if (!tasa || !dias || !cupo) return alert("Complete condiciones.");

                // TODO: API CALL (SQL: UPDATE InformesRiesgo SET estado='APROBADO', cupo=?, tasa=? WHERE id=?)
                alert(`✅ APROBADO FINALIZADO\nCupo: $${cupo}`);
            } else if (decision === 'NEGADO') {
                if(!document.getElementById('txtMotivoNeg').value) return alert("Ingrese motivo.");
                alert("❌ SOLICITUD NEGADA.");
            }
            window.location.href = 'menu.html';
        });
    }

    function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
});