document.addEventListener('DOMContentLoaded', () => {

    // Identificar en qué página estamos por la existencia de elementos únicos
    const isAnalystPage = !!document.getElementById('selectRecomendacion');
    const isCommitteePage = !!document.getElementById('selectDecision');

    loadCommonData(); // Carga datos del cliente y documentos
    setupDocumentsModal();

    if (isAnalystPage) {
        setupAnalystLogic();
    } 
    
    if (isCommitteePage) {
        loadAnalystReport(); // El comité necesita ver lo que dijo el analista
        setupCommitteeLogic();
    }

    // --- FUNCIONES COMUNES ---
    function loadCommonData() {
        // 1. Cargar Cliente
        const draftJSON = localStorage.getItem("tqa_cliente_draft");
        if (draftJSON) {
            try {
                const client = JSON.parse(draftJSON);
                const data = client.data || {};
                // Llenar campos si existen en el HTML
                setVal('viewEmpresa', client.tipo === "PJ" ? data.pj_razon_social : (data.pn_razon || data.pn_nombre + ' ' + data.pn_apellido));
                setVal('viewRuc', client.tipo === "PJ" ? data.pj_ruc : data.pn_ruc);
            } catch (e) { console.error("Error cargando cliente", e); }
        }

        // 2. Cargar KPIs automáticos (Score, SRI, Judicial)
        // Nota: Asumimos que estos datos ya se guardaron previamente en 'tqa_financial_kpis' o similar
        const reportJSON = localStorage.getItem('tqa_risk_report_final');
        if (reportJSON) {
            try {
                const report = JSON.parse(reportJSON);
                setVal('viewScore', report.score || "N/A");
                setVal('viewJudicial', report.chkJudicial === 'ok' ? 'SIN NOVEDADES' : 'CON ALERTAS');
                setVal('viewSri', report.chkSri === 'ok' ? 'SIN DEUDAS' : 'CON DEUDAS');
                
                // Si estamos en analista, mostrar también la conclusión automática del sistema si existe
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
                // Simulación de carga de documentos y facturas
                const docsJSON = localStorage.getItem('finanzasPro_DocsTemp');
                list.innerHTML = '';
                
                // 1. Mostrar Facturas Cargadas (Si existen)
                const facturasJSON = localStorage.getItem('tqa_facturas_carga');
                if(facturasJSON) {
                    const facts = JSON.parse(facturasJSON);
                    const factHeader = document.createElement('h4');
                    factHeader.textContent = "Operaciones de Facturas";
                    factHeader.style.color = "#1F3A5F";
                    list.appendChild(factHeader);
                    
                    facts.forEach(f => {
                         const item = document.createElement('div');
                         item.style.cssText = "padding:8px; background:#f9f9f9; border:1px solid #eee; margin-bottom:5px; font-size:12px;";
                         item.innerHTML = `<strong>Factura:</strong> ${f.claveAcceso.substring(0,20)}... <br> <strong>Monto:</strong> $${f.monto} | <strong>Estado SRI:</strong> ${f.estado}`;
                         list.appendChild(item);
                    });
                }

                // 2. Mostrar Documentos PDF
                if (docsJSON) {
                    const data = JSON.parse(docsJSON);
                    const docHeader = document.createElement('h4');
                    docHeader.textContent = "Expediente Digital";
                    docHeader.style.color = "#1F3A5F";
                    docHeader.style.marginTop = "15px";
                    list.appendChild(docHeader);

                    (data.documents || []).forEach(doc => {
                        const item = document.createElement('div');
                        item.style.cssText = "display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #eee; font-size:13px;";
                        item.innerHTML = `<i class="fa-solid fa-file-pdf" style="color:#e74c3c"></i> ${doc.name}`;
                        list.appendChild(item);
                    });
                }

                if(!docsJSON && !facturasJSON) list.innerHTML = "<p>No hay documentos cargados.</p>";
                
                modal.classList.add('active');
            });
        }
    }

    // --- LÓGICA ROL 1: ANALISTA ---
    function setupAnalystLogic() {
        const btnSubmit = document.getElementById('btnSubmitAnalysis');
        
        btnSubmit.addEventListener('click', () => {
            const recomendacion = document.getElementById('selectRecomendacion').value;
            const analisis = document.getElementById('txtAnalisis').value;

            if (!recomendacion) return alert("Debe seleccionar una recomendación.");
            if (!analisis) return alert("Debe ingresar el informe técnico detallado.");

            // Guardar el informe del analista para que lo vea el comité
            const analystReport = {
                recomendacion: recomendacion,
                texto: analisis,
                fecha: new Date().toLocaleString(),
                analista: "Analista de Riesgo 01" // Esto vendría del login real
            };

            localStorage.setItem('tqa_analyst_feedback', JSON.stringify(analystReport));

            alert("✅ INFORME ENVIADO A COMITÉ\n\nEl análisis ha sido registrado y la solicitud pasó a la bandeja del comité.");
            // Aquí redirigirías al dashboard o limpiarías
            window.location.href = 'dashboard.html'; // Ejemplo
        });
    }

    // --- LÓGICA ROL 2: COMITÉ ---
    function loadAnalystReport() {
        const feedbackJSON = localStorage.getItem('tqa_analyst_feedback');
        const badge = document.getElementById('badgeRecomendacion');
        const texto = document.getElementById('viewAnalisisTexto');

        if (feedbackJSON) {
            const data = JSON.parse(feedbackJSON);
            texto.textContent = `"${data.texto}" - (Fecha: ${data.fecha})`;
            badge.textContent = data.recomendacion;

            // Colorear el badge según recomendación
            if (data.recomendacion === 'FAVORABLE') {
                badge.className = 'badge ok';
            } else if (data.recomendacion === 'DESFAVORABLE') {
                badge.className = 'badge bad';
            } else {
                badge.className = 'badge warn';
            }
        } else {
            texto.textContent = "⚠️ No se ha recibido el informe del analista aún.";
            badge.className = 'badge bad';
            badge.textContent = "SIN ANÁLISIS";
            // Podrías bloquear el botón de decisión si es obligatorio el análisis previo
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
            if (!decision) return alert("Seleccione la decisión final.");

            if (decision === 'APROBADO') {
                const tasa = document.getElementById('inputTasa').value;
                const dias = document.getElementById('inputDias').value;
                const cupo = document.getElementById('inputCupo').value;
                if (!tasa || !dias || !cupo) return alert("Complete las condiciones financieras.");

                // Guardar decisión final
                alert(`✅ APROBADO FINALIZADO\nCupo: $${cupo}\nTasa: ${tasa}%\n\nSe notificará al cliente.`);
            } else if (decision === 'NEGADO') {
                if(!document.getElementById('txtMotivoNeg').value) return alert("Ingrese motivo.");
                alert("❌ SOLICITUD NEGADA.");
            }
        });
    }

    // Helper simple
    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
});document.addEventListener('DOMContentLoaded', () => {

    // Identificar en qué página estamos por la existencia de elementos únicos
    const isAnalystPage = !!document.getElementById('selectRecomendacion');
    const isCommitteePage = !!document.getElementById('selectDecision');

    loadCommonData(); // Carga datos del cliente y documentos
    setupDocumentsModal();

    if (isAnalystPage) {
        setupAnalystLogic();
    } 
    
    if (isCommitteePage) {
        loadAnalystReport(); // El comité necesita ver lo que dijo el analista
        setupCommitteeLogic();
    }

    // --- FUNCIONES COMUNES ---
    function loadCommonData() {
        // 1. Cargar Cliente
        const draftJSON = localStorage.getItem("tqa_cliente_draft");
        if (draftJSON) {
            try {
                const client = JSON.parse(draftJSON);
                const data = client.data || {};
                // Llenar campos si existen en el HTML
                setVal('viewEmpresa', client.tipo === "PJ" ? data.pj_razon_social : (data.pn_razon || data.pn_nombre + ' ' + data.pn_apellido));
                setVal('viewRuc', client.tipo === "PJ" ? data.pj_ruc : data.pn_ruc);
            } catch (e) { console.error("Error cargando cliente", e); }
        }

        // 2. Cargar KPIs automáticos (Score, SRI, Judicial)
        // Nota: Asumimos que estos datos ya se guardaron previamente en 'tqa_financial_kpis' o similar
        const reportJSON = localStorage.getItem('tqa_risk_report_final');
        if (reportJSON) {
            try {
                const report = JSON.parse(reportJSON);
                setVal('viewScore', report.score || "N/A");
                setVal('viewJudicial', report.chkJudicial === 'ok' ? 'SIN NOVEDADES' : 'CON ALERTAS');
                setVal('viewSri', report.chkSri === 'ok' ? 'SIN DEUDAS' : 'CON DEUDAS');
                
                // Si estamos en analista, mostrar también la conclusión automática del sistema si existe
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
                // Simulación de carga de documentos y facturas
                const docsJSON = localStorage.getItem('finanzasPro_DocsTemp');
                list.innerHTML = '';
                
                // 1. Mostrar Facturas Cargadas (Si existen)
                const facturasJSON = localStorage.getItem('tqa_facturas_carga');
                if(facturasJSON) {
                    const facts = JSON.parse(facturasJSON);
                    const factHeader = document.createElement('h4');
                    factHeader.textContent = "Operaciones de Facturas";
                    factHeader.style.color = "#1F3A5F";
                    list.appendChild(factHeader);
                    
                    facts.forEach(f => {
                         const item = document.createElement('div');
                         item.style.cssText = "padding:8px; background:#f9f9f9; border:1px solid #eee; margin-bottom:5px; font-size:12px;";
                         item.innerHTML = `<strong>Factura:</strong> ${f.claveAcceso.substring(0,20)}... <br> <strong>Monto:</strong> $${f.monto} | <strong>Estado SRI:</strong> ${f.estado}`;
                         list.appendChild(item);
                    });
                }

                // 2. Mostrar Documentos PDF
                if (docsJSON) {
                    const data = JSON.parse(docsJSON);
                    const docHeader = document.createElement('h4');
                    docHeader.textContent = "Expediente Digital";
                    docHeader.style.color = "#1F3A5F";
                    docHeader.style.marginTop = "15px";
                    list.appendChild(docHeader);

                    (data.documents || []).forEach(doc => {
                        const item = document.createElement('div');
                        item.style.cssText = "display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #eee; font-size:13px;";
                        item.innerHTML = `<i class="fa-solid fa-file-pdf" style="color:#e74c3c"></i> ${doc.name}`;
                        list.appendChild(item);
                    });
                }

                if(!docsJSON && !facturasJSON) list.innerHTML = "<p>No hay documentos cargados.</p>";
                
                modal.classList.add('active');
            });
        }
    }

    // --- LÓGICA ROL 1: ANALISTA ---
    function setupAnalystLogic() {
        const btnSubmit = document.getElementById('btnSubmitAnalysis');
        
        btnSubmit.addEventListener('click', () => {
            const recomendacion = document.getElementById('selectRecomendacion').value;
            const analisis = document.getElementById('txtAnalisis').value;

            if (!recomendacion) return alert("Debe seleccionar una recomendación.");
            if (!analisis) return alert("Debe ingresar el informe técnico detallado.");

            // Guardar el informe del analista para que lo vea el comité
            const analystReport = {
                recomendacion: recomendacion,
                texto: analisis,
                fecha: new Date().toLocaleString(),
                analista: "Analista de Riesgo 01" // Esto vendría del login real
            };

            localStorage.setItem('tqa_analyst_feedback', JSON.stringify(analystReport));

            alert("✅ INFORME ENVIADO A COMITÉ\n\nEl análisis ha sido registrado y la solicitud pasó a la bandeja del comité.");
            // Aquí redirigirías al dashboard o limpiarías
            window.location.href = 'dashboard.html'; // Ejemplo
        });
    }

    // --- LÓGICA ROL 2: COMITÉ ---
    function loadAnalystReport() {
        const feedbackJSON = localStorage.getItem('tqa_analyst_feedback');
        const badge = document.getElementById('badgeRecomendacion');
        const texto = document.getElementById('viewAnalisisTexto');

        if (feedbackJSON) {
            const data = JSON.parse(feedbackJSON);
            texto.textContent = `"${data.texto}" - (Fecha: ${data.fecha})`;
            badge.textContent = data.recomendacion;

            // Colorear el badge según recomendación
            if (data.recomendacion === 'FAVORABLE') {
                badge.className = 'badge ok';
            } else if (data.recomendacion === 'DESFAVORABLE') {
                badge.className = 'badge bad';
            } else {
                badge.className = 'badge warn';
            }
        } else {
            texto.textContent = "⚠️ No se ha recibido el informe del analista aún.";
            badge.className = 'badge bad';
            badge.textContent = "SIN ANÁLISIS";
            // Podrías bloquear el botón de decisión si es obligatorio el análisis previo
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
            if (!decision) return alert("Seleccione la decisión final.");

            if (decision === 'APROBADO') {
                const tasa = document.getElementById('inputTasa').value;
                const dias = document.getElementById('inputDias').value;
                const cupo = document.getElementById('inputCupo').value;
                if (!tasa || !dias || !cupo) return alert("Complete las condiciones financieras.");

                // Guardar decisión final
                alert(`✅ APROBADO FINALIZADO\nCupo: $${cupo}\nTasa: ${tasa}%\n\nSe notificará al cliente.`);
            } else if (decision === 'NEGADO') {
                if(!document.getElementById('txtMotivoNeg').value) return alert("Ingrese motivo.");
                alert("❌ SOLICITUD NEGADA.");
            }
        });
    }

    // Helper simple
    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
});