// Configuración PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Mapeos Contables
const MAP_BG = { "ACTIVO CORRIENTE": "101", "ACTIVO NO CORRIENTE": "102", "INVENTARIOS": "10103", "ACTIVO": "1", "PASIVO CORRIENTE": "201", "PASIVO NO CORRIENTE": "202", "PASIVO": "2", "PATRIMONIO NETO": "3", "RESULTADOS DEL EJERCICIO": "307" };
const MAP_ER = { "INGRESOS DE ACTIVIDADES ORDINARIAS": "401", "GANANCIA BRUTA": "402", "OTROS INGRESOS": "403", "COSTO DE VENTAS Y PRODUCCIÓN": "501", "GANANCIA ANTES DE IMPUESTOS": "602", "IMPUESTO A LA RENTA CAUSADO": "603", "GANANCIA NETA DEL PERIODO": "707" };

// Lógica de Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
});

// Lectura de PDF
document.querySelectorAll('.pdf-autofill').forEach(input => {
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        input.parentElement.style.opacity = "0.5";
        try {
            const text = await extractTextFromPDF(file);
            const type = input.dataset.type;
            const map = type === 'bg' ? MAP_BG : MAP_ER;
            const tableId = type === 'bg' ? 'table-bg' : 'table-er';
            fillTable(text, map, tableId, parseInt(input.dataset.col));
            input.parentElement.style.opacity = "1";
            input.style.borderColor = "#28a745"; 
        } catch (err) { console.error(err); input.parentElement.style.opacity = "1"; }
    });
});

async function extractTextFromPDF(file) {
    const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
    let txt = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const c = await p.getTextContent();
        let lastY = -1;
        c.items.forEach(item => {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) txt += "\n";
            txt += item.str + " ";
            lastY = item.transform[5];
        });
        txt += "\n";
    }
    return txt;
}

function fillTable(text, map, tableId, colIdx) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const lines = text.split('\n');
    for (const [key, code] of Object.entries(map)) {
        for (let line of lines) {
            if (new RegExp(`\\b${code}\\b`).test(line)) {
                const m = line.match(/(\(?[\d,.]+\)?)\s*$/);
                if (m) {
                    const row = table.querySelector(`tr[data-key="${key}"]`);
                    if(row) {
                        const inp = row.cells[colIdx + 1].querySelector('input');
                        if(inp) { inp.value = parseNumber(m[0]); inp.classList.add('autofilled'); }
                    }
                    break;
                }
            }
        }
    }
}

function parseNumber(str) {
    if (!str) return 0;
    let neg = str.includes('(') || str.includes(')');
    str = str.replace(/[()]/g, '');
    str = (str.lastIndexOf(',') > str.lastIndexOf('.')) ? str.replace(/\./g, '').replace(',', '.') : str.replace(/,/g, '');
    let v = parseFloat(str);
    return isNaN(v) ? 0 : (neg ? v * -1 : v);
}

// === BOTÓN GUARDAR ===
document.getElementById('btnSave').addEventListener('click', () => {
    // 1. Guardar Lista de Documentos (Metadatos)
    const docList = [];
    document.querySelectorAll('input[type="file"]').forEach(input => {
        if (input.files.length > 0) {
            let lbl = "Documento";
            const box = input.closest('.doc-box');
            if(box && box.querySelector('label')) lbl = box.querySelector('label').innerText.replace('*','').trim();
            docList.push({ name: input.files[0].name, type: lbl, size: (input.files[0].size/1024).toFixed(1)+" KB" });
        }
    });

    localStorage.setItem('finanzasPro_DocsTemp', JSON.stringify({
        years: { 
            year1: document.getElementById('year1').value, 
            year2: document.getElementById('year2').value, 
            year3: document.getElementById('year3').value 
        },
        documents: docList, // Importante: Guarda la lista aquí
        timestamp: new Date().toISOString()
    }));

    // 2. Calcular KPIs (Basado en Año 1 - Columna 0)
    const getVal = (tid, key) => {
        const row = document.getElementById(tid)?.querySelector(`tr[data-key="${key}"]`);
        const val = row?.querySelectorAll('input')[0]?.value?.replace(/,/g, '') || 0;
        return parseFloat(val) || 0;
    };

    const actCte = getVal('table-bg', 'ACTIVO CORRIENTE');
    const pasCte = getVal('table-bg', 'PASIVO CORRIENTE');
    const inv = getVal('table-bg', 'INVENTARIOS');
    const act = getVal('table-bg', 'ACTIVO');
    const pas = getVal('table-bg', 'PASIVO');
    const pat = getVal('table-bg', 'PATRIMONIO NETO');
    const util = getVal('table-er', 'GANANCIA NETA DEL PERIODO');
    const ventas = getVal('table-er', 'INGRESOS DE ACTIVIDADES ORDINARIAS');

    const kpis = {
        liquidez: pasCte ? (actCte/pasCte).toFixed(2) : "0.00",
        pruebaAcida: pasCte ? ((actCte-inv)/pasCte).toFixed(2) : "0.00",
        margenNeto: ventas ? ((util/ventas)*100).toFixed(2)+"%" : "0.00%",
        roa: act ? ((util/act)*100).toFixed(2)+"%" : "0.00%",
        roe: pat ? ((util/pat)*100).toFixed(2)+"%" : "0.00%",
        endeudamiento: act ? (pas/act).toFixed(2) : "0.00"
    };

    localStorage.setItem('tqa_financial_kpis', JSON.stringify(kpis));

    alert("Guardado correctamente. Redirigiendo al informe...");
    window.location.href = "informe_riesgo.html";
});