// Configuración PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

if (typeof API_URL === 'undefined') {
    window.API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
}

// MAPEO DE CUENTAS (Mejorado para coincidir con tus PDFs)
const MAP_BG = { 
    "ACTIVO CORRIENTE": ["ACTIVO CORRIENTE", "TOTAL ACTIVO CORRIENTE"], 
    "ACTIVO NO CORRIENTE": ["ACTIVO NO CORRIENTE", "TOTAL ACTIVO NO CORRIENTE"], 
    "INVENTARIOS": ["INVENTARIOS"], 
    "ACTIVO": ["TOTAL DEL ACTIVO", "TOTAL ACTIVO", "ACTIVO"], 
    "PASIVO CORRIENTE": ["PASIVO CORRIENTE", "TOTAL PASIVO CORRIENTE"], 
    "PASIVO NO CORRIENTE": ["PASIVO NO CORRIENTE", "TOTAL PASIVO NO CORRIENTE"], 
    "PASIVO": ["TOTAL DEL PASIVO", "TOTAL PASIVO", "PASIVO"], 
    "PATRIMONIO NETO": ["PATRIMONIO NETO", "TOTAL PATRIMONIO", "PATRIMONIO"], 
    "RESULTADOS DEL EJERCICIO": ["RESULTADOS DEL EJERCICIO", "RESULTADO INTEGRAL DEL EJERCICIO", "GANANCIA NETA DEL PERIODO"] 
};

const MAP_ER = { 
    "INGRESOS DE ACTIVIDADES ORDINARIAS": ["INGRESOS DE ACTIVIDADES ORDINARIAS", "VENTAS NETAS"], 
    "GANANCIA BRUTA": ["GANANCIA BRUTA", "UTILIDAD BRUTA"], 
    "OTROS INGRESOS": ["OTROS INGRESOS"], 
    "COSTO DE VENTAS Y PRODUCCIÓN": ["COSTO DE VENTAS Y PRODUCCIÓN", "COSTO DE VENTAS"], 
    "GASTOS FINANCIEROS": ["GASTOS FINANCIEROS"], 
    "GANANCIA ANTES DE IMPUESTOS": ["GANANCIA ANTES DE IMPUESTOS", "UTILIDAD ANTES DE IMPUESTOS"], 
    "IMPUESTO A LA RENTA CAUSADO": ["IMPUESTO A LA RENTA CAUSADO", "IMPUESTO A LA RENTA"], 
    "GANANCIA NETA DEL PERIODO": ["GANANCIA NETA DEL PERIODO", "UTILIDAD NETA DEL EJERCICIO"] 
};

// --- 1. PESTAÑAS (TABS) ---
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPanel = document.querySelector(`.tabpanel[data-panel="${tab.getAttribute('data-tab')}"]`);
        if (targetPanel) targetPanel.classList.add('active');
    });
});

// --- 2. LECTURA INTELIGENTE DE PDF ---
async function extractDataFromPDF(file, mapType) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";

    // Unir todo el texto con espacios seguros
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join("  ") + "  "; 
    }

    const map = mapType === 'BG' ? MAP_BG : MAP_ER;
    const results = {};

    for (const [key, keywords] of Object.entries(map)) {
        for (const keyword of keywords) {
            // Regex: Busca Nombre -> Ignora Código numérico intermedio -> Captura Valor
            const escapedKeyword = keyword.replace('.', '\\.');
            const regex = new RegExp(`${escapedKeyword}[\\s\\S]{0,60}?\\s+\\d+[\\.\\d]*\\s+([\\d\\.,]+)`, "i");
            
            const match = fullText.match(regex);
            if (match) {
                // Limpieza de formato (1.000,00 o 1,000.00)
                let val = match[1];
                if (val.includes('.') && val.includes(',')) {
                    val = val.replace(/\./g, '').replace(',', '.');
                } else if (val.includes(',') && !val.includes('.')) {
                    val = val.replace(',', '.');
                }
                results[key] = val;
                break; 
            }
        }
    }
    return results;
}

// Listener de Carga de Archivos
document.querySelectorAll('.pdf-autofill').forEach(input => {
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const type = e.target.getAttribute('data-type').toUpperCase();
        const colIndex = parseInt(e.target.getAttribute('data-col')); 
        const statusEl = document.getElementById(`status-${type.toLowerCase()}-${colIndex}`);
        
        if(statusEl) statusEl.innerHTML = '<span class="status-loading">⏳ Analizando...</span>';

        try {
            const data = await extractDataFromPDF(file, type);
            // Validación simple: Si encontró al menos un dato clave
            const checkKey = type === 'BG' ? 'ACTIVO' : 'GANANCIA BRUTA';
            
            if (data[checkKey]) {
                fillTable(data, type === 'BG' ? '#table-bg' : '#table-er', colIndex);
                if(statusEl) statusEl.innerHTML = '<span class="status-success">✅ Datos leídos</span>';
            } else {
                if(statusEl) statusEl.innerHTML = '<span class="status-error">⚠️ Lectura manual</span>';
            }
        } catch (err) {
            console.error(err);
            if(statusEl) statusEl.innerHTML = '<span class="status-error">❌ Error archivo</span>';
        }
    });
});

function fillTable(data, tableId, colIndex) {
    const cssCol = colIndex + 2; 
    const rows = document.querySelectorAll(`${tableId} tr[data-key]`);
    rows.forEach(row => {
        const key = row.getAttribute('data-key');
        if (data[key]) {
            const input = row.querySelector(`td:nth-child(${cssCol}) input`);
            if(input) {
                input.value = data[key];
                input.classList.add('autofilled');
            }
        }
    });
}

// --- 3. GUARDADO Y CÁLCULO DE KPIS ---
document.getElementById('btnSave').addEventListener('click', async () => {
    const btn = document.getElementById('btnSave');
    const originalText = btn.innerHTML;
    
    const urlParams = new URLSearchParams(window.location.search);
    const session = JSON.parse(localStorage.getItem('tqa_session') || "{}");
    let clientId = urlParams.get('clientId') || (session.role === 'CLIENTE' ? session.id : null);
    
    if (!clientId) return alert("❌ Error: No se identificó al cliente. Inicie sesión nuevamente.");
    if (!document.getElementById('checkTerminos').checked) return alert("⚠️ Debe aceptar los términos y condiciones.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
        // A) Subir Archivos a S3
        const uploadedDocs = [];
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const folderName = `FINANCIEROS/${clientId}/${Date.now()}`;

        for (const input of fileInputs) {
            if (input.files.length > 0) {
                if (!input.id) input.id = "doc_" + Math.random().toString(36).substr(2, 5);
                try {
                    let label = input.closest('.doc-box')?.querySelector('label')?.innerText.replace('*','').trim() || "Adjunto";
                    const res = await uploadFile(input.id, folderName, null, null, null, { hideButtonState: true });
                    if (res?.publicUrl) uploadedDocs.push({ name: label, url: res.publicUrl });
                } catch (e) { console.error("Error subida", e); }
            }
        }

        // B) Leer Tablas
        const data = { bg: {}, er: {} };
        const readTable = (tableId, obj) => {
            document.querySelectorAll(`${tableId} tr[data-key]`).forEach(row => {
                const key = row.getAttribute('data-key');
                obj[key] = [
                    row.querySelector('td:nth-child(2) input')?.value || "0",
                    row.querySelector('td:nth-child(3) input')?.value || "0",
                    row.querySelector('td:nth-child(4) input')?.value || "0"
                ];
            });
        };
        readTable('#table-bg', data.bg);
        readTable('#table-er', data.er);

        // C) Calcular KPIs (Detectando última columna con datos)
        const clean = (val) => parseFloat((val || "0").toString().replace(/,/g, '').replace(/[^0-9.-]+/g,"")) || 0;

        let idx = 2; // Por defecto Año 3
        if (clean(data.bg["ACTIVO"][2]) === 0) {
            if (clean(data.bg["ACTIVO"][1]) > 0) idx = 1;
            else if (clean(data.bg["ACTIVO"][0]) > 0) idx = 0;
        }

        // Variables KPI
        const activo = clean(data.bg["ACTIVO"][idx]);
        const pasivo = clean(data.bg["PASIVO"][idx]);
        const patrimonio = clean(data.bg["PATRIMONIO NETO"][idx]);
        const actCte = clean(data.bg["ACTIVO CORRIENTE"][idx]);
        const pasCte = clean(data.bg["PASIVO CORRIENTE"][idx]);
        const ventas = clean(data.er["INGRESOS DE ACTIVIDADES ORDINARIAS"][idx]);
        const utNeta = clean(data.er["GANANCIA NETA DEL PERIODO"][idx]);
        const ebitda = clean(data.er["GANANCIA ANTES DE IMPUESTOS"][idx]) + clean(data.er["GASTOS FINANCIEROS"][idx]);

        const kpis = { 
            liquidez: pasCte ? (actCte / pasCte).toFixed(2) : "0.00",
            endeudamiento: activo ? (pasivo / activo).toFixed(2) : "0.00",
            margen_neto: ventas ? ((utNeta / ventas) * 100).toFixed(2) + "%" : "0.00%",
            roa: activo ? ((utNeta / activo) * 100).toFixed(2) + "%" : "0.00%",
            roe: patrimonio ? ((utNeta / patrimonio) * 100).toFixed(2) + "%" : "0.00%",
            deuda_act: activo ? (pasivo / activo).toFixed(2) : "0.00",
            ebitda: ebitda.toFixed(2),
            raw_data: data
        };

        // D) Enviar a Base de Datos (USANDO LA URL CORRECTA ?id=)
        const response = await fetch(`${API_URL}/clientes?id=${clientId}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado: 'EN_REVISION',
                kpis_financieros: kpis,
                documentos_financieros: uploadedDocs
            })
        });

        if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);

        // E) Actualizar borrador local y redireccionar
        const draft = JSON.parse(localStorage.getItem('tqa_cliente_draft') || '{}');
        draft.id = clientId; 
        localStorage.setItem('tqa_cliente_draft', JSON.stringify(draft));

        alert("✅ Información guardada exitosamente.\n\nEl expediente ha sido enviado a la Mesa Operativa.");
        
        if (session.role === 'COMERCIAL' || session.role === 'CLIENTE') window.location.href = 'menu.html';
        else window.location.href = 'informe_riesgo.html';

    } catch (e) {
        console.error(e);
        alert("Hubo un problema al guardar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// Cargar datos previos al abrir
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const session = JSON.parse(localStorage.getItem('tqa_session') || "{}");
    let clientId = urlParams.get('clientId') || (session.role === 'CLIENTE' ? session.id : null);

    if (!clientId) return;

    try {
        const res = await fetch(`${API_URL}/clientes?id=${clientId}`);
        const result = await res.json();
        const client = result.items ? result.items[0] : result;

        if (client && client.kpis_financieros) {
            let kpis = typeof client.kpis_financieros === 'string' ? JSON.parse(client.kpis_financieros) : client.kpis_financieros;
            if(kpis.raw_data) {
                const fillRow = (tableId, dataObj) => {
                    Object.keys(dataObj).forEach(key => {
                        const vals = dataObj[key];
                        const row = document.querySelector(`${tableId} tr[data-key="${key}"]`);
                        if (row && Array.isArray(vals)) {
                            for(let i=0; i<3; i++) {
                                const input = row.querySelector(`td:nth-child(${i+2}) input`);
                                if(input) input.value = vals[i];
                            }
                        }
                    });
                };
                fillRow('#table-bg', kpis.raw_data.bg);
                fillRow('#table-er', kpis.raw_data.er);
            }
        }
    } catch(e) { console.log("Sin datos previos"); }
});