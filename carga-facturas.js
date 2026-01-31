// ======================================================
// VARIABLES GLOBALES Y SELECTORES
// ======================================================
const tbody = document.getElementById('tablaBody');
const emptyMsg = document.getElementById('emptyMsg');
let contador = 0; // Para generar IDs únicos por fila

// ======================================================
// INICIALIZACIÓN Y GESTIÓN DE PAGADOR (NUEVO)
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar la lista de pagadores desde la memoria del navegador
    cargarPagadoresDesdeMemoria();
    
    // 2. Asegurar que la zona de carga inicie bloqueada visualmente
    const zona = document.getElementById('zonaCarga');
    if(zona) {
        zona.classList.remove('active');
        zona.classList.add('disabled-zone'); // Asegúrate de tener el CSS para esto
    }
});

function cargarPagadoresDesdeMemoria() {
    const select = document.getElementById('selectPagador');
    if (!select) return;

    // Leemos la "base de datos" local
    const pagadoresGuardados = JSON.parse(localStorage.getItem('db_pagadores')) || [];

    // Si hay datos, creamos las opciones
    pagadoresGuardados.forEach(pagador => {
        const option = document.createElement('option');
        option.value = pagador.ruc; // El valor que se enviará
        option.textContent = `${pagador.razonSocial} (${pagador.ruc})`; // Lo que ve el usuario
        select.appendChild(option);
    });
}

function activarCarga() {
    const selector = document.getElementById('selectPagador');
    const zona = document.getElementById('zonaCarga');
    
    if (selector && selector.value !== "") {
        // Desbloquear si hay selección
        zona.classList.add('active');
        zona.classList.remove('disabled-zone');
    } else {
        // Bloquear si vuelve a "Seleccione..."
        zona.classList.remove('active');
        zona.classList.add('disabled-zone');
    }
}

// ======================================================
// FUNCIONES DE INTERFAZ (UI - ORIGINALES)
// ======================================================

// Verifica si la tabla está vacía para mostrar el mensaje "No hay facturas"
function checkEmpty() {
    if (tbody.children.length === 0) emptyMsg.style.display = 'block';
    else emptyMsg.style.display = 'none';
}

// Agrega una fila desde el input manual
function agregarManual() {
    // Validar que exista pagador primero (doble seguridad)
    const pagador = document.getElementById('selectPagador').value;
    if (pagador === "") {
        alert("⚠️ Seleccione un pagador para continuar.");
        return;
    }

    const input = document.getElementById('inputClave');
    const err = document.getElementById('errorMsg');
    const clave = input.value.trim();

    // Validación básica de longitud y números
    if (clave.length !== 49 || isNaN(clave)) {
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';
    crearFila(clave);
    input.value = ''; // Limpiar input
}

// Procesa el archivo de texto plano (.txt) con claves masivas
function procesarTXT(input) {
    if (!input.files[0]) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Dividir por saltos de línea
        const lines = e.target.result.split(/\r\n|\n/);
        lines.forEach(l => {
            const c = l.trim();
            // Solo procesar líneas que parezcan claves válidas
            if (c.length === 49 && !isNaN(c)) crearFila(c);
        });
        input.value = ''; // Resetear input para permitir recargar el mismo archivo
    };
    reader.readAsText(input.files[0]);
}

// Crea la estructura HTML de la fila e inicia la validación
function crearFila(clave) {
    contador++;
    const rowId = `row-${contador}`;
    const tr = document.createElement('tr');
    tr.id = rowId;
    
    // HTML inicial de la fila (estado: Cargando...)
    tr.innerHTML = `
        <td style="text-align:center">${contador}</td>
        <td class="key-cell">${clave}</td>
        <td class="col-info">
            <div class="loading-spinner" style="width:12px;height:12px; border:2px solid #ccc; border-top-color:#333; border-radius:50%; animation: spin 1s linear infinite;"></div>
        </td>
        <td class="col-monto">-</td>
        <td class="col-estado"><span class="status-badge status-wait">Consultando...</span></td>
        <td class="col-accion">
            <button class="btn small ghost" style="color:#d53b3b; padding:2px 6px; border:none; background:transparent; cursor:pointer;" onclick="eliminarFila('${rowId}')">✕</button>
        </td>
    `;
    
    tbody.appendChild(tr);
    checkEmpty();
    
    // Llamada inmediata al servicio del SRI
    validarSRI_REAL(clave, rowId);
}

// Elimina una fila y actualiza el estado vacío
function eliminarFila(id) {
    const row = document.getElementById(id);
    if (row) row.remove();
    checkEmpty();
}

// Actualiza visualmente los inputs de carga de archivos (PDFs)
function updateLabel(inputId, labelId, required) {
    const input = document.getElementById(inputId);
    const lbl = document.getElementById(labelId);
    
    if (input.files.length > 0) {
        lbl.textContent = `${input.files.length} PDF(s) cargado(s)`;
        lbl.style.color = 'var(--success, #2a9d8f)';
        lbl.style.fontWeight = 'bold';
    } else {
        lbl.textContent = required ? "Obligatorio" : "Opcional";
        lbl.style.color = 'var(--muted, #999)';
        lbl.style.fontWeight = 'normal';
    }
}

// Validar antes de enviar (ACTUALIZADO CON PAGADOR)
function guardarTodo() {
    // 1. Validar Pagador
    const select = document.getElementById('selectPagador');
    const pagadorRuc = select.value;
    const pagadorTexto = select.options[select.selectedIndex].text; // "Nombre (RUC)"

    if (pagadorRuc === "") {
        alert("⚠️ Error: Debe seleccionar un Pagador antes de continuar.");
        return;
    }

    // 2. Validar filas
    const rows = document.querySelectorAll('#tablaBody tr');
    if (rows.length === 0) {
        alert("⚠️ Error: Debe ingresar al menos una clave de acceso.");
        return;
    }

    // 3. Validar PDF
    if (document.getElementById('fileFacturas').files.length === 0) {
        alert("⚠️ Error: Debe subir los archivos PDF de las facturas.");
        return;
    }

    // 4. CALCULAR TOTALES DEL LOTE
    let sumaTotal = 0;
    let docsValidos = 0;

    rows.forEach(row => {
        const celdaMonto = row.querySelector('.col-monto');
        const txt = celdaMonto.innerText.replace('$','').trim();
        const valor = parseFloat(txt);
        
        if (!isNaN(valor)) {
            sumaTotal += valor;
            docsValidos++;
        }
    });

    // 5. CREAR OBJETO "LOTE"
    const nuevoLote = {
        id: "LOTE-" + Date.now().toString().slice(-6), // ID único corto
        fecha: new Date().toISOString(),
        pagador: pagadorTexto,
        rucPagador: pagadorRuc,
        cantidadDocs: docsValidos,
        total: sumaTotal,
        estado: "PENDIENTE" // Estado inicial
    };

    // 6. GUARDAR EN MEMORIA (Simulación de Base de Datos)
    const dbCartera = JSON.parse(localStorage.getItem('db_cartera_lotes')) || [];
    dbCartera.push(nuevoLote);
    localStorage.setItem('db_cartera_lotes', JSON.stringify(dbCartera));

    // 7. FEEDBACK
    console.log("Lote guardado:", nuevoLote);
    alert(`✅ Lote ${nuevoLote.id} enviado exitosamente a Cartera para aprobación.`);
    
    // Opcional: Recargar o limpiar
    window.location.href = 'cartera.html'; // Redirigir para ver el resultado
}


// ======================================================
// LÓGICA DE CONEXIÓN SRI (SOAP + XML PARSING)
// ======================================================

async function validarSRI_REAL(clave, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return; // Si el usuario eliminó la fila antes de terminar, salir.

    // Endpoint ÚNICO para todos los documentos
    const targetURL = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";
    
    // Proxy CORS (Necesario para que funcione desde el navegador directamente)
    const proxyURL = "https://corsproxy.io/?"; 
    const urlFinal = proxyURL + encodeURIComponent(targetURL);

    // Cuerpo de la petición SOAP (Estándar para cualquier documento)
    const soapRequest = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
        <soapenv:Header/>
        <soapenv:Body>
            <ec:autorizacionComprobante>
                <claveAccesoComprobante>${clave}</claveAccesoComprobante>
            </ec:autorizacionComprobante>
        </soapenv:Body>
        </soapenv:Envelope>`;

    try {
        const response = await fetch(urlFinal, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            body: soapRequest
        });

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const textXML = await response.text();
        
        if (textXML.includes("Envelope")) {
            parsearRespuestaSRI(textXML, rowId);
        } else {
            throw new Error("Respuesta no legible del SRI");
        }

    } catch (error) {
        console.error("Error SRI:", error);
        updateRow(rowId, "ERROR_RED", "Fallo de conexión", "---", "ERROR");
    }
}

function parsearRespuestaSRI(xmlStr, rowId) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
    
    // 1. Obtener Estado de la Autorización
    const estadoNode = xmlDoc.getElementsByTagName("estado")[0];
    const estado = estadoNode ? estadoNode.textContent : "DESCONOCIDO";
    
    if (estado === "AUTORIZADO") {
        // 2. Extraer el "comprobante" (es un string XML dentro de CDATA)
        const comprobanteNode = xmlDoc.getElementsByTagName("comprobante")[0];
        if (comprobanteNode) {
            const innerXML = comprobanteNode.textContent;
            const innerDoc = parser.parseFromString(innerXML, "text/xml");
            
            let razonSocial = "---";
            let importeTotal = "0.00";
            let tipoDoc = "OTRO"; // Identificador del tipo

            // =================================================
            // DETECCIÓN INTELIGENTE DEL TIPO DE DOCUMENTO
            // =================================================

            // CASO A: FACTURA
            if (innerDoc.getElementsByTagName("factura").length > 0) {
                tipoDoc = "FACTURA";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = getTagValue(innerDoc, "importeTotal");
            }
            
            // CASO B: COMPROBANTE DE RETENCIÓN
            else if (innerDoc.getElementsByTagName("comprobanteRetencion").length > 0) {
                tipoDoc = "RETENCIÓN";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                // Las retenciones no tienen "total", sumamos los valores retenidos
                importeTotal = sumarRetenciones(innerDoc);
            }
            
            // CASO C: GUÍA DE REMISIÓN
            else if (innerDoc.getElementsByTagName("guiaRemision").length > 0) {
                tipoDoc = "GUÍA";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = "0.00"; // No tienen valor monetario directo
            }
            
            // CASO D: NOTA DE CRÉDITO
            else if (innerDoc.getElementsByTagName("notaCredito").length > 0) {
                tipoDoc = "N. CRÉDITO";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = getTagValue(innerDoc, "valorModificacion");
            }

            // CASO E: LIQUIDACIÓN DE COMPRA
            else if (innerDoc.getElementsByTagName("liquidacionCompra").length > 0) {
                tipoDoc = "LIQ. COMPRA";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = getTagValue(innerDoc, "importeTotal");
            }

            updateRow(rowId, "AUTORIZADO", razonSocial, importeTotal, tipoDoc);

        } else {
            updateRow(rowId, "AUTORIZADO", "XML corrupto", "---", "ERROR");
        }
    } else {
        // Manejo de rechazos (NO AUTORIZADO, DEVUELTA, ETC)
        const mensaje = xmlDoc.getElementsByTagName("mensaje")[0]?.textContent || "Clave inválida";
        updateRow(rowId, estado, mensaje, "0.00", "ERROR");
    }
}

// --- Helpers para leer XML ---
function getTagValue(doc, tagName) {
    const nodes = doc.getElementsByTagName(tagName);
    return nodes.length > 0 ? nodes[0].textContent : "---";
}

function sumarRetenciones(doc) {
    let total = 0;
    const impuestos = doc.getElementsByTagName("impuesto");
    for (let i = 0; i < impuestos.length; i++) {
        // En retenciones viejas puede ser valorRetenido, en nuevas puede variar, 
        // pero generalmente está dentro de <impuesto>
        const val = impuestos[i].getElementsByTagName("valorRetenido")[0];
        if (val) total += parseFloat(val.textContent);
    }
    return total.toFixed(2);
}

// ======================================================
// ACTUALIZACIÓN DE LA FILA (RENDER)
// ======================================================

function updateRow(rowId, estado, emisor, monto, tipoDoc) {
    const row = document.getElementById(rowId);
    if (!row) return; 

    const celdaInfo = row.querySelector('.col-info');
    const celdaMonto = row.querySelector('.col-monto');
    const celdaEstado = row.querySelector('.col-estado');

    // 1. Crear Badge (Etiqueta de color) según tipo
    let tipoBadge = "";
    if (tipoDoc === "FACTURA")      tipoBadge = `<span style="background:#0d6efd; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">FACTURA</span>`;
    else if (tipoDoc === "RETENCIÓN") tipoBadge = `<span style="background:#198754; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">RETENCIÓN</span>`;
    else if (tipoDoc === "GUÍA")    tipoBadge = `<span style="background:#fd7e14; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">GUÍA</span>`;
    else if (tipoDoc === "N. CRÉDITO") tipoBadge = `<span style="background:#6f42c1; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">N.C.</span>`;
    else if (tipoDoc === "ERROR")   tipoBadge = `<span style="background:#dc3545; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">ERR</span>`;

    // 2. Renderizar Datos
    if (celdaInfo) celdaInfo.innerHTML = `${tipoBadge}<span style="font-weight:600; color:#444;">${emisor}</span>`;
    
    if (celdaMonto) {
        // Si es Guía o Error, mostramos guión o 0.00 limpio
        if(monto === "---") celdaMonto.textContent = "-";
        else celdaMonto.textContent = `$ ${monto}`;
    }
    
    // 3. Renderizar Estado
    if (celdaEstado) {
        if (estado === "AUTORIZADO") {
            celdaEstado.innerHTML = `<span class="status-badge status-valid" style="background:#d1e7dd; color:#0f5132; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">AUTORIZADO</span>`;
        } else if (estado === "ERROR_RED") {
             celdaEstado.innerHTML = `<span class="status-badge status-err" style="background:#f8d7da; color:#842029; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;" title="Verifique su internet o el proxy">ERROR RED</span>`;
        } else {
            // Rechazado, Devuelta, etc.
            celdaEstado.innerHTML = `<span class="status-badge status-err" style="background:#f8d7da; color:#842029; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">${estado}</span>`;
        }
    }
}