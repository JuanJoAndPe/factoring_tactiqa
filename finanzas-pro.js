// Configuración del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==========================================
// MAPEO DE CÓDIGOS SUPERCIAS A FILAS HTML
// ==========================================

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
    "GANANCIA ANTES DE IMPUESTOS": "602",
    "IMPUESTO A LA RENTA CAUSADO": "603",
    "GANANCIA NETA DEL PERIODO": "707"
};

// ==========================================
// LÓGICA DE INTERFAZ (TABS)
// ==========================================

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panelId = tab.dataset.tab;
        document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
    });
});

// ==========================================
// LÓGICA DE LECTURA DE PDFS
// ==========================================

document.querySelectorAll('.pdf-autofill').forEach(input => {
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        input.parentElement.style.opacity = "0.5";
        
        try {
            const type = input.dataset.type; // 'bg' o 'er'
            const colIdx = parseInt(input.dataset.col); 
            
            // 1. Extraer texto del PDF (Mejorado)
            const text = await extractTextFromPDF(file);
            console.log(`Muestra texto extraído:`, text.substring(0, 200));

            // 2. Determinar qué mapa y tabla usar
            const dataMap = (type === 'bg') ? MAP_BG : MAP_ER;
            const tableId = (type === 'bg') ? 'table-bg' : 'table-er';

            // 3. Llenar la tabla (Lógica mejorada)
            fillTable(text, dataMap, tableId, colIdx);

            input.parentElement.style.opacity = "1";
            input.style.borderColor = "#28a745"; 
            
        } catch (err) {
            console.error("Error procesando PDF:", err);
            alert("Error al leer el archivo.");
            input.parentElement.style.opacity = "1";
        }
    });
});

/**
 * Extrae texto preservando saltos de línea para facilitar búsqueda por fila.
 */
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // MODIFICACIÓN: Usamos "\n" para separar líneas visuales
        // Esto ayuda a mantener la estructura de tabla del PDF
        let lastY = -1;
        let pageText = "";

        // Lógica simple de reconstrucción de líneas basada en posición Y
        textContent.items.forEach(item => {
             // Si hay un cambio significativo en Y, es una nueva línea
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += "\n";
            }
            pageText += item.str + " ";
            lastY = item.transform[5];
        });

        fullText += pageText + "\n";
    }

    return fullText;
}

/**
 * Busca valores línea por línea.
 */
function fillTable(text, map, tableId, colIdx) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // Dividimos el texto en líneas para procesar fila por fila
    const lines = text.split('\n');

    for (const [key, code] of Object.entries(map)) {
        let foundValue = null;

        // 1. Recorrer línea por línea buscando el código
        for (let line of lines) {
            // Limpiamos espacios extra
            line = line.trim();
            
            // Regex para buscar el código aislado (ej: "101" pero no "10103")
            // \b asegura límite de palabra
            const codeRegex = new RegExp(`\\b${code}\\b`);

            if (codeRegex.test(line)) {
                // Si la línea contiene el código, buscamos el ÚLTIMO número de esa línea.
                // En balances, usualmente es: [Código] [Nombre] [Notas] [VALOR]
                
                // Esta regex busca números al final, soportando negativos ( ) y decimales
                // Ejemplos: 500.00 | 1,500.00 | (500.00) | -500
                const matches = line.match(/(\(?[\d,.]+\)?)\s*$/);

                if (matches) {
                    foundValue = matches[0]; // Tomamos el valor encontrado
                    console.log(`Encontrado ${key} (${code}): ${foundValue}`);
                    break; // Dejamos de buscar este código
                }
            }
        }

        if (foundValue) {
            const row = table.querySelector(`tr[data-key="${key}"]`);
            if (row) {
                const cellIndex = colIdx + 1; 
                const input = row.cells[cellIndex].querySelector('input');

                if (input) {
                    // Limpiamos el formato (quitar comas de miles, paréntesis, etc)
                    input.value = parseNumber(foundValue);
                    input.classList.add('autofilled'); 
                    input.dispatchEvent(new Event('change'));
                }
            }
        } else {
            console.warn(`No se encontró valor para: ${key} (Código ${code})`);
        }
    }
}

/**
 * Convierte formatos como "1,200.50", "(500)", "1.200,50" a float JS válido.
 */
function parseNumber(str) {
    if (!str) return 0;
    
    // 1. Detectar negativos con paréntesis: (500) -> -500
    let isNegative = false;
    if (str.includes('(') || str.includes(')')) {
        isNegative = true;
        str = str.replace(/[()]/g, '');
    }

    // 2. Normalizar separadores
    // Si hay puntos y comas, asumimos formato. 
    // Caso Ecuador/Latam común: 1.000,00 (Punto mil, Coma decimal)
    // Caso Inglés/Software: 1,000.00 (Coma mil, Punto decimal)
    
    // Si el último separador es coma, reemplazamos puntos por nada y la coma por punto
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
         str = str.replace(/\./g, '').replace(',', '.');
    } else {
         // Formato inglés: quitamos comas
         str = str.replace(/,/g, '');
    }

    let val = parseFloat(str);
    if (isNegative) val = val * -1;

    return isNaN(val) ? 0 : val;
}

// ==========================================
// VALIDACIÓN Y GUARDADO
// ==========================================

document.getElementById('btnSave').addEventListener('click', () => {
    const form = document.getElementById('docsForm');
    if (form && !form.checkValidity()) {
        alert("Por favor, cargue todos los documentos obligatorios.");
        form.reportValidity();
        return;
    }

    const data = {
        years: {
            year1: document.getElementById('year1')?.value || '',
            year2: document.getElementById('year2')?.value || '',
            year3: document.getElementById('year3')?.value || '',
        },
        balanceGeneral: extractTableData('table-bg'),
        estadoResultados: extractTableData('table-er')
    };

    console.log("Datos a guardar:", data);
    alert("Información procesada. Revisa la consola.");
});

function extractTableData(tableId) {
    const table = document.getElementById(tableId);
    if(!table) return [];
    
    const rows = table.querySelectorAll('tbody tr');
    const result = [];

    rows.forEach(row => {
        const key = row.dataset.key;
        const inputs = row.querySelectorAll('input');
        result.push({
            concepto: key,
            año1: inputs[0]?.value || 0,
            año2: inputs[1]?.value || 0,
            año3: inputs[2]?.value || 0
        });
    });
    return result;
}