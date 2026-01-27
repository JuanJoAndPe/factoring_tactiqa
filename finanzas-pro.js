// Configuración robusta del worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} else {
    console.error("La librería PDF.js no se cargó correctamente en el HTML.");
}

// ==========================================
// 1. MAPEO (Códigos SUPERCIAS exactos)
// ==========================================
// Nota: Usamos solo el código numérico para la búsqueda para evitar errores de tipeo en los nombres.

const MAP_BG = {
    "ACTIVO CORRIENTE": "101",
    "ACTIVO NO CORRIENTE": "102", 
    "INVENTARIOS": "10103",
    "ACTIVO": "1", // Total Activo
    "PASIVO CORRIENTE": "201",
    "PASIVO NO CORRIENTE": "202",
    "PASIVO": "2", // Total Pasivo
    "PATRIMONIO NETO": "3",
    "RESULTADOS DEL EJERCICIO": "307" 
};

const MAP_ER = {
    "INGRESOS DE ACTIVIDADES ORDINARIAS": "401",
    "GANANCIA BRUTA": "402",
    "OTROS INGRESOS": "403",
    "COSTO DE VENTAS Y PRODUCCIÓN": "501",
    "GANANCIA ANTES DE IMPUESTOS": ["602", "600"], // A veces cambia el código en formularios viejos
    "IMPUESTO A LA RENTA CAUSADO": "603",
    "GANANCIA NETA DEL PERIODO": "707"
};

// ==========================================
// 2. INTERFAZ Y TABS
// ==========================================
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
});

// ==========================================
// 3. LECTURA DE PDF (Lógica mejorada)
// ==========================================

document.querySelectorAll('.pdf-autofill').forEach(input => {
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Feedback visual: Mostrar "Cargando..."
        const type = input.dataset.type; // bg o er
        const colIdx = parseInt(input.dataset.col); 
        const statusSpan = document.getElementById(`status-${type}-${colIdx}`);
        if(statusSpan) {
            statusSpan.textContent = "Leyendo...";
            statusSpan.className = "status-text status-loading";
        }

        try {
            const text = await extractTextFromPDF(file);
            console.log("TEXTO EXTRAÍDO (Primeros 200 chars):", text.substring(0, 200));

            const dataMap = (type === 'bg') ? MAP_BG : MAP_ER;
            const tableId = (type === 'bg') ? 'table-bg' : 'table-er';

            fillTable(text, dataMap, tableId, colIdx);

            // Feedback Exitoso
            if(statusSpan) {
                statusSpan.textContent = "✓ Completado";
                statusSpan.className = "status-text status-success";
            }
            // Ir automáticamente a la pestaña correspondiente para que el usuario vea la magia
            document.querySelector(`.tab[data-tab="${type}"]`).click();

        } catch (err) {
            console.error(err);
            if(statusSpan) {
                statusSpan.textContent = "Error";
                statusSpan.className = "status-text status-error";
            }
            alert("Error al leer el PDF. Asegúrese de que no esté protegido con contraseña.");
        }
    });
});

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Unimos con espacios, pero mantenemos cierto orden.
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + " ";
    }
    // Limpieza básica: quitar tabulaciones y saltos de línea raros
    return fullText.replace(/\s+/g, " ");
}

// ==========================================
// 4. MOTOR DE EXTRACCIÓN (NUEVO)
// ==========================================

function fillTable(text, map, tableId, colIdx) {
    const table = document.getElementById(tableId);
    
    // Recorremos cada concepto (Activo, Pasivo, etc)
    for (const [key, codeDefinition] of Object.entries(map)) {
        
        // Manejar si el código es un array (por si hay variaciones) o un string único
        const codes = Array.isArray(codeDefinition) ? codeDefinition : [codeDefinition];
        let foundValue = null;

        for (let code of codes) {
            // ESTRATEGIA DE BÚSQUEDA FUZZY:
            // 1. Buscar el Código (ej: 101)
            // 2. Permitir cualquier cosa en medio (letras, puntos, espacios) que NO sea un número largo
            // 3. Capturar el siguiente patrón numérico (ej: 5.300,00 o 5300.00)
            
            // Regex explicada:
            // \b${code}\b  -> Busca el código exacto como palabra completa (evita que '1' encuentre '101')
            // [^\d]*?      -> Ignora cualquier carácter que NO sea dígito (lazy) inmediatamente después
            // ([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}) -> Captura formato moneda (ej: 1,000.00 o 1000.00)
            
            const regex = new RegExp(`\\b${code}\\b[^\\d-]*?(-?[\\d]{1,3}(?:[.,]\\d{3})*[.,]\\d{2})`, "i");
            const match = text.match(regex);

            if (match && match[1]) {
                foundValue = match[1];
                console.log(`Encontrado ${key} (${code}): ${foundValue}`);
                break; // Si encontramos con el primer código, dejamos de buscar
            }
        }

        if (foundValue) {
            const row = table.querySelector(`tr[data-key="${key}"]`);
            if (row) {
                const input = row.cells[colIdx + 1].querySelector('input');
                if (input) {
                    input.value = foundValue; // Mantenemos el formato original del PDF
                    input.classList.add('autofilled');
                }
            }
        } else {
            console.warn(`No se encontró valor para: ${key}`);
        }
    }
}

// ==========================================
// 5. GUARDAR DATOS
// ==========================================
document.getElementById('btnSave').addEventListener('click', () => {
    const form = document.getElementById('docsForm');
    if (!form.checkValidity()) {
        alert("Faltan documentos obligatorios (*).");
        return;
    }
    
    // Recopilar Datos de las tablas
    const datosFinancieros = {
        bg: extractData('table-bg'),
        er: extractData('table-er')
    };
    
    console.log("Datos Guardados:", datosFinancieros);
    alert("Información extraída y guardada correctamente.");
});

function extractData(tableId) {
    const data = [];
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
        const inputs = tr.querySelectorAll('input');
        data.push({
            cuenta: tr.dataset.key,
            año1: inputs[0].value,
            año2: inputs[1].value,
            año3: inputs[2].value
        });
    });
    return data;
}