// ======================================================
// VARIABLES GLOBALES Y SELECTORES
// ======================================================
const tbody = document.getElementById('tablaBody');
const emptyMsg = document.getElementById('emptyMsg');
let contador = 0; // Para generar IDs únicos por fila

// ======================================================
// INICIALIZACIÓN Y GESTIÓN DE ROLES
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener Sesión (usando auth.js si está disponible, o localStorage directo)
    const session = typeof getSession === 'function' ? getSession() : JSON.parse(localStorage.getItem('tqa_session'));
    
    // Si no hay sesión, auth.js debería haber redirigido, pero por seguridad paramos.
    if (!session) return; 

    // 2. Lógica para COMERCIAL (Staff)
    // Si el rol es uno de estos, activamos el "Modo Gestor"
    const isStaff = ['COMERCIAL', 'ADMIN', 'OPERATIVO'].includes(session.role);
    
    if (isStaff) {
        initStaffMode();
    }

    // 3. Cargar la lista de pagadores (Deudores)
    cargarPagadoresDesdeMemoria();
    
    // 4. Asegurar que la zona de carga inicie bloqueada visualmente
    const zona = document.getElementById('zonaCarga');
    if(zona) {
        zona.classList.remove('active');
        zona.classList.add('disabled-zone');
    }
});

// Función exclusiva para el perfil COMERCIAL
function initStaffMode() {
    const selectorDiv = document.getElementById('staffClientSelector');
    const selectCliente = document.getElementById('selectClienteReal');
    
    if (selectorDiv && selectCliente) {
        selectorDiv.style.display = 'block'; // Mostrar la barra azul

        // Cargar clientes creados desde la base de datos local
        const clientesDB = JSON.parse(localStorage.getItem('tactiqa_clientes') || "[]");
        
        // Llenar el select
        clientesDB.forEach(cli => {
            const opt = document.createElement('option');
            opt.value = cli.id;
            opt.textContent = `${cli.nombre} (RUC: ${cli.ruc})`;
            selectCliente.appendChild(opt);
        });

        // Pre-seleccionar si viene por URL (ej: desde la lista de clientes)
        const urlParams = new URLSearchParams(window.location.search);
        const preSelectedId = urlParams.get('clientId');
        if (preSelectedId) {
            selectCliente.value = preSelectedId;
        }
    }
}

function cargarPagadoresDesdeMemoria() {
    const select = document.getElementById('selectPagador');
    if (!select) return;

    // Leemos la "base de datos" local de pagadores
    const pagadoresGuardados = JSON.parse(localStorage.getItem('db_pagadores')) || [];

    pagadoresGuardados.forEach(pagador => {
        const option = document.createElement('option');
        option.value = pagador.ruc; 
        option.textContent = `${pagador.razonSocial} (${pagador.ruc})`; 
        select.appendChild(option);
    });
}

function activarCarga() {
    const selector = document.getElementById('selectPagador');
    const zona = document.getElementById('zonaCarga');
    
    // Validación extra para comercial: Debe haber cliente seleccionado en la barra azul
    const selectClienteReal = document.getElementById('selectClienteReal');
    // Verificamos si el selector de cliente es visible (offsetParent != null) y si está vacío
    if (selectClienteReal && selectClienteReal.offsetParent !== null && selectClienteReal.value === "") {
        // Si está en modo comercial pero no eligió cliente, no desbloqueamos la zona
        return; 
    }

    if (selector && selector.value !== "") {
        zona.classList.add('active');
        zona.classList.remove('disabled-zone');
    } else {
        zona.classList.remove('active');
        zona.classList.add('disabled-zone');
    }
}

// Escuchar cambios en el selector de cliente también para activar zona dinámicamente
const cliSelect = document.getElementById('selectClienteReal');
if(cliSelect) {
    cliSelect.addEventListener('change', activarCarga);
}

// ======================================================
// FUNCIONES DE INTERFAZ (UI)
// ======================================================

function checkEmpty() {
    if (tbody.children.length === 0) emptyMsg.style.display = 'block';
    else emptyMsg.style.display = 'none';
}

function agregarManual() {
    // 1. Validar Pagador
    const pagador = document.getElementById('selectPagador').value;
    if (pagador === "") { 
        alert("⚠️ Seleccione un pagador para continuar."); 
        return; 
    }
    
    // 2. Validación Comercial (Si aplica)
    const cliSelect = document.getElementById('selectClienteReal');
    if (cliSelect && cliSelect.offsetParent !== null && cliSelect.value === "") {
        alert("⚠️ MODO GESTOR: Debe seleccionar a qué CLIENTE pertenece esta carga.");
        cliSelect.focus();
        return;
    }

    // 3. Validar Clave
    const input = document.getElementById('inputClave');
    const err = document.getElementById('errorMsg');
    const clave = input.value.trim();

    if (clave.length !== 49 || isNaN(clave)) {
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';
    crearFila(clave);
    input.value = '';
}

function procesarTXT(input) {
    if (!input.files[0]) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split(/\r\n|\n/);
        lines.forEach(l => {
            const c = l.trim();
            if (c.length === 49 && !isNaN(c)) crearFila(c);
        });
        input.value = ''; 
    };
    reader.readAsText(input.files[0]);
}

function crearFila(clave) {
    contador++;
    const rowId = `row-${contador}`;
    const tr = document.createElement('tr');
    tr.id = rowId;
    
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
    
    // Llamada al SRI
    validarSRI_REAL(clave, rowId);
}

function eliminarFila(id) {
    const row = document.getElementById(id);
    if (row) row.remove();
    checkEmpty();
}

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

// ======================================================
// GUARDADO DEL LOTE (LÓGICA CRÍTICA DE ROLES)
// ======================================================
function guardarTodo() {
    // 1. Datos básicos
    const selectPagador = document.getElementById('selectPagador');
    const pagadorRuc = selectPagador.value;
    const pagadorTexto = selectPagador.options[selectPagador.selectedIndex].text;

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

    // --- IDENTIFICACIÓN DEL PROPIETARIO DEL LOTE ---
    const session = JSON.parse(localStorage.getItem('tqa_session'));
    let clienteIdFinal = session.id;
    let clienteNombreFinal = session.name;
    let subidoPor = "CLIENTE"; // Audit log

    // Si es Comercial, leemos el selector azul
    const selectClienteReal = document.getElementById('selectClienteReal');
    if (selectClienteReal && selectClienteReal.offsetParent !== null) {
        if (selectClienteReal.value === "") {
            alert("⚠️ MODO GESTOR: Seleccione para qué CLIENTE es esta carga.");
            return;
        }
        clienteIdFinal = selectClienteReal.value;
        clienteNombreFinal = selectClienteReal.options[selectClienteReal.selectedIndex].text;
        subidoPor = session.role; // "COMERCIAL"
    }
    // ----------------------------------------------

    // 4. Calcular Totales
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

    // 5. Crear Objeto Lote
    const nuevoLote = {
        id: "LOTE-" + Date.now().toString().slice(-6), // ID único corto
        fecha: new Date().toISOString(),
        pagador: pagadorTexto,
        rucPagador: pagadorRuc,
        cantidadDocs: docsValidos,
        total: sumaTotal,
        estado: "PENDIENTE",
        
        // DATOS DE PROPIEDAD
        usuarioId: clienteIdFinal,      // IMPORTANTE: El ID del cliente real
        usuarioNombre: clienteNombreFinal, // Para mostrar en la tabla de Cartera
        creadoPor: subidoPor            // Quien hizo la acción (auditoría)
    };

    // 6. Guardar en Memoria
    const dbCartera = JSON.parse(localStorage.getItem('db_cartera_lotes')) || [];
    dbCartera.push(nuevoLote);
    localStorage.setItem('db_cartera_lotes', JSON.stringify(dbCartera));

    // 7. Feedback y Redirección
    console.log("Lote guardado:", nuevoLote);
    alert(`✅ Operación registrada exitosamente para ${clienteNombreFinal}.\nLote ${nuevoLote.id} enviado a Cartera.`);
    
    window.location.href = 'cartera.html'; 
}


// ======================================================
// LÓGICA DE CONEXIÓN SRI (SOAP + XML PARSING)
// ======================================================

async function validarSRI_REAL(clave, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return; 

    // Endpoint ÚNICO para todos los documentos
    const targetURL = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";
    
    // Proxy CORS
    const proxyURL = "https://corsproxy.io/?"; 
    const urlFinal = proxyURL + encodeURIComponent(targetURL);

    // Cuerpo SOAP
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
    
    // 1. Obtener Estado
    const estadoNode = xmlDoc.getElementsByTagName("estado")[0];
    const estado = estadoNode ? estadoNode.textContent : "DESCONOCIDO";
    
    if (estado === "AUTORIZADO") {
        // 2. Extraer el "comprobante" (CDATA)
        const comprobanteNode = xmlDoc.getElementsByTagName("comprobante")[0];
        if (comprobanteNode) {
            const innerXML = comprobanteNode.textContent;
            const innerDoc = parser.parseFromString(innerXML, "text/xml");
            
            let razonSocial = "---";
            let importeTotal = "0.00";
            let tipoDoc = "OTRO";

            // Detección de Tipo
            if (innerDoc.getElementsByTagName("factura").length > 0) {
                tipoDoc = "FACTURA";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = getTagValue(innerDoc, "importeTotal");
            }
            else if (innerDoc.getElementsByTagName("comprobanteRetencion").length > 0) {
                tipoDoc = "RETENCIÓN";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = sumarRetenciones(innerDoc);
            }
            else if (innerDoc.getElementsByTagName("guiaRemision").length > 0) {
                tipoDoc = "GUÍA";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = "0.00"; 
            }
            else if (innerDoc.getElementsByTagName("notaCredito").length > 0) {
                tipoDoc = "N. CRÉDITO";
                razonSocial = getTagValue(innerDoc, "razonSocial");
                importeTotal = getTagValue(innerDoc, "valorModificacion");
            }
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
        const mensaje = xmlDoc.getElementsByTagName("mensaje")[0]?.textContent || "Clave inválida";
        updateRow(rowId, estado, mensaje, "0.00", "ERROR");
    }
}

//Helpers XML
function getTagValue(doc, tagName) {
    const nodes = doc.getElementsByTagName(tagName);
    return nodes.length > 0 ? nodes[0].textContent : "---";
}

function sumarRetenciones(doc) {
    let total = 0;
    const impuestos = doc.getElementsByTagName("impuesto");
    for (let i = 0; i < impuestos.length; i++) {
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

    // Badges visuales
    let tipoBadge = "";
    if (tipoDoc === "FACTURA")      tipoBadge = `<span style="background:#0d6efd; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">FACTURA</span>`;
    else if (tipoDoc === "RETENCIÓN") tipoBadge = `<span style="background:#198754; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">RETENCIÓN</span>`;
    else if (tipoDoc === "GUÍA")    tipoBadge = `<span style="background:#fd7e14; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">GUÍA</span>`;
    else if (tipoDoc === "N. CRÉDITO") tipoBadge = `<span style="background:#6f42c1; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">N.C.</span>`;
    else if (tipoDoc === "ERROR")   tipoBadge = `<span style="background:#dc3545; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">ERR</span>`;

    if (celdaInfo) celdaInfo.innerHTML = `${tipoBadge}<span style="font-weight:600; color:#444;">${emisor}</span>`;
    
    if (celdaMonto) {
        if(monto === "---") celdaMonto.textContent = "-";
        else celdaMonto.textContent = `$ ${monto}`;
    }
    
    if (celdaEstado) {
        if (estado === "AUTORIZADO") {
            celdaEstado.innerHTML = `<span class="status-badge status-valid" style="background:#d1e7dd; color:#0f5132; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">AUTORIZADO</span>`;
        } else if (estado === "ERROR_RED") {
             celdaEstado.innerHTML = `<span class="status-badge status-err" style="background:#f8d7da; color:#842029; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;" title="Fallo de conexión">ERROR RED</span>`;
        } else {
            celdaEstado.innerHTML = `<span class="status-badge status-err" style="background:#f8d7da; color:#842029; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">${estado}</span>`;
        }
    }
}