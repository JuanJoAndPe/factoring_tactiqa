// Configuración PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Aseguramos que API_URL esté definida (por si auth.js no cargó antes)
if (typeof API_URL === 'undefined') {
    window.API_URL = 'https://prtjv5sj7h.execute-api.us-east-2.amazonaws.com/default';
}

const MAP_BG = { "ACTIVO CORRIENTE": "101", "ACTIVO NO CORRIENTE": "102", "INVENTARIOS": "10103", "ACTIVO": "1", "PASIVO CORRIENTE": "201", "PASIVO NO CORRIENTE": "202", "PASIVO": "2", "PATRIMONIO NETO": "3", "RESULTADOS DEL EJERCICIO": "307" };
const MAP_ER = { "INGRESOS DE ACTIVIDADES ORDINARIAS": "401", "GANANCIA BRUTA": "402", "OTROS INGRESOS": "403", "COSTO DE VENTAS Y PRODUCCIÓN": "501", "GASTOS FINANCIEROS":"50203", "GANANCIA ANTES DE IMPUESTOS": "602", "IMPUESTO A LA RENTA CAUSADO": "603", "GANANCIA NETA DEL PERIODO": "707" };

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(tab.dataset.target);
        if (panel) panel.classList.add('active');
    });
});

async function extractDataFromPDF(file, mapType) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + " ";
    }

    const map = mapType === 'BG' ? MAP_BG : MAP_ER;
    const results = {};

    for (const [key, code] of Object.entries(map)) {
        const regex = new RegExp(`${code}\\s+.*?([\\d\\.,]+)`, "i");
        const match = fullText.match(regex);
        if (match) {
            results[key] = match[1];
        }
    }
    return results;
}

['fileBG', 'fileER'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;
            
            const file = e.target.files[0];
            const type = id === 'fileBG' ? 'BG' : 'ER';
            const statusId = id === 'fileBG' ? 'statusBG' : 'statusER';
            const statusEl = document.getElementById(statusId);
            
            if(statusEl) statusEl.innerHTML = '<span class="status-loading">Procesando...</span>';
    
            try {
                const data = await extractDataFromPDF(file, type);
                fillTable(data, type === 'BG' ? '#tableBG' : '#tableER');
                if(statusEl) statusEl.innerHTML = '<span class="status-success">✓ Datos extraídos</span>';
            } catch (err) {
                console.error(err);
                if(statusEl) statusEl.innerHTML = '<span style="color:red">Error al leer PDF</span>';
            }
        });
    }
});

function fillTable(data, tableId) {
    const rows = document.querySelectorAll(`${tableId} tr[data-key]`);
    rows.forEach(row => {
        const key = row.getAttribute('data-key');
        if (data[key]) {
            const input = row.querySelector('td:nth-child(2) input');
            if(input) input.value = data[key];
        }
    });
}

// === LÓGICA DE GUARDADO Y REDIRECCIÓN MODIFICADA ===
document.getElementById('btnSave').addEventListener('click', () => {
    const data = { bg: {}, er: {} };

    const readTable = (tableId, obj) => {
        document.querySelectorAll(`${tableId} tr[data-key]`).forEach(row => {
            const key = row.getAttribute('data-key');
            const val = row.querySelector('td:nth-child(2) input').value;
            obj[key] = val;
        });
    };

    readTable('#tableBG', data.bg);
    readTable('#tableER', data.er);

    const actCte = parseFloat(data.bg["ACTIVO CORRIENTE"]?.replace(/,/g, '') || 0);
    const pasCte = parseFloat(data.bg["PASIVO CORRIENTE"]?.replace(/,/g, '') || 0);
    const liquidez = pasCte ? (actCte / pasCte).toFixed(2) : "0.00";

    const activo = parseFloat(data.bg["ACTIVO"]?.replace(/,/g, '') || 0);
    const pasivo = parseFloat(data.bg["PASIVO"]?.replace(/,/g, '') || 0);
    const endeudamiento = activo ? (pasivo / activo).toFixed(2) : "0.00";

    const kpis = { liquidez, endeudamiento, data };

    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');

    if (clientId) {
        // 1. Guardado Local (Backup y UI)
        const clientes = JSON.parse(localStorage.getItem('tactiqa_clientes') || "[]");
        const clienteIndex = clientes.findIndex(c => c.id === clientId);
        if (clienteIndex >= 0) {
            clientes[clienteIndex].estado = "EN_REVISION"; // Actualización visual local
            localStorage.setItem('tactiqa_clientes', JSON.stringify(clientes));
        }
        localStorage.setItem(`tqa_financial_kpis_${clientId}`, JSON.stringify(kpis));

        // 2. CONEXIÓN A BD: Actualizar estado a 'EN_REVISION'
        // Esto hace que aparezca en la bandeja del Operativo
        if (typeof API_URL !== 'undefined') {
            console.log("Enviando cliente a revisión:", clientId);
            fetch(`${API_URL}/clientes/${clientId}`, {
                method: 'PUT', // Asegúrate que tu API soporte PUT para updates
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado_proceso: 'EN_REVISION' // <--- CAMBIO CLAVE PARA TU BASE DE DATOS
                })
            }).then(res => {
                if(res.ok) console.log("✅ Cliente enviado a operaciones (DB actualizada)");
                else console.warn("⚠️ No se pudo actualizar estado en DB, pero se guardó localmente.");
            }).catch(err => console.error("Error conectando a API:", err));
        }
    } else {
        localStorage.setItem('tqa_financial_kpis', JSON.stringify(kpis));
    }

    alert("✅ Información guardada. El expediente ha sido enviado a Operaciones para revisión.");

    // Redirección inteligente según rol
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    const userRole = session ? session.role : '';

    if (userRole === 'COMERCIAL' && clientId) {
        // El comercial termina y vuelve a su menú o lista
        window.location.href = `menu.html`; 
    } else {
        // Flujo original o Admin
        window.location.href = 'informe_riesgo.html';
    }
});