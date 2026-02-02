// ======================================================
// VARIABLES GLOBALES
// ======================================================
const tbody = document.getElementById('tablaBody');
const emptyMsg = document.getElementById('emptyMsg');
let contador = 0; 

// ======================================================
// INICIALIZACIÓN
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
    const session = typeof getSession === 'function' ? getSession() : JSON.parse(localStorage.getItem('tqa_session'));
    if (!session) return; 

    // Modo COMERCIAL
    const isStaff = ['COMERCIAL', 'ADMIN', 'OPERATIVO'].includes(session.role);
    if (isStaff) {
        initStaffMode();
    }

    cargarPagadoresDesdeBD();
    
    const zona = document.getElementById('zonaCarga');
    if(zona) {
        zona.classList.remove('active');
        zona.classList.add('disabled-zone');
    }
});

function initStaffMode() {
    const selectorDiv = document.getElementById('staffClientSelector');
    const selectCliente = document.getElementById('selectClienteReal');
    
    if (selectorDiv && selectCliente) {
        selectorDiv.style.display = 'block';

        const clientesDB = JSON.parse(localStorage.getItem('tactiqa_clientes') || "[]");
        
        clientesDB.forEach(cli => {
            const opt = document.createElement('option');
            opt.value = cli.id;
            opt.textContent = `${cli.nombre} (RUC: ${cli.ruc})`;
            selectCliente.appendChild(opt);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const preSelectedId = urlParams.get('clientId');
        if (preSelectedId) {
            selectCliente.value = preSelectedId;
        }
    }
}

async function cargarPagadoresDesdeBD() {
    const select = document.getElementById('selectPagador');
    if (!select) return;

    try {
        const res = await fetch(`${API_URL}/pagadores`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.items) {
                while (select.options.length > 1) {
                    select.remove(1);
                }
                data.items.forEach(pagador => {
                    const option = document.createElement('option');
                    option.value = pagador.ruc || pagador.RUC;
                    option.textContent = `${pagador.nombre || pagador.RazonSocial} (${pagador.ruc || pagador.RUC})`;
                    select.appendChild(option);
                });
                return;
            }
        }
    } catch (e) {
        console.log("Usando pagadores locales (API offline).");
    }

    const pagadoresGuardados = JSON.parse(localStorage.getItem('db_pagadores')) || [];
    while (select.options.length > 1) {
        select.remove(1);
    }
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
    const selectClienteReal = document.getElementById('selectClienteReal');

    if (selectClienteReal && selectClienteReal.offsetParent !== null && selectClienteReal.value === "") {
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

const cliSelect = document.getElementById('selectClienteReal');
if(cliSelect) {
    cliSelect.addEventListener('change', activarCarga);
}

// ======================================================
// FUNCIONES UI
// ======================================================

function checkEmpty() {
    if (tbody.children.length === 0) emptyMsg.style.display = 'block';
    else emptyMsg.style.display = 'none';
}

function agregarManual() {
    const pagador = document.getElementById('selectPagador').value;
    if (pagador === "") { 
        alert("⚠️ Seleccione un pagador para continuar."); 
        return; 
    }
    
    const cliSelect = document.getElementById('selectClienteReal');
    if (cliSelect && cliSelect.offsetParent !== null && cliSelect.value === "") {
        alert("⚠️ MODO GESTOR: Debe seleccionar a qué CLIENTE pertenece esta carga.");
        cliSelect.focus();
        return;
    }

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
// GUARDADO (SQL TRANSACCIONAL - ACTUALIZADO)
// ======================================================
async function guardarTodo() {
    const selectPagador = document.getElementById('selectPagador');
    const pagadorRuc = selectPagador.value;
    const pagadorTexto = selectPagador.options[selectPagador.selectedIndex].text;

    if (pagadorRuc === "") { alert("⚠️ Seleccione un Pagador."); return; }

    const rows = document.querySelectorAll('#tablaBody tr');
    if (rows.length === 0) { alert("⚠️ Ingrese al menos una clave."); return; }

    if (document.getElementById('fileFacturas').files.length === 0) {
        alert("⚠️ Debe subir los archivos PDF.");
        return;
    }

    const session = JSON.parse(localStorage.getItem('tqa_session'));
    let clienteIdFinal = session.id;
    let clienteNombreFinal = session.name;
    let subidoPor = "CLIENTE"; 

    const selectClienteReal = document.getElementById('selectClienteReal');
    if (selectClienteReal && selectClienteReal.offsetParent !== null) {
        if (selectClienteReal.value === "") {
            alert("⚠️ Seleccione el CLIENTE.");
            return;
        }
        clienteIdFinal = selectClienteReal.value;
        clienteNombreFinal = selectClienteReal.options[selectClienteReal.selectedIndex].text;
        subidoPor = session.role; 
    }

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

    // Objeto local para backup
    const nuevoLote = {
        id: "LOTE-" + Date.now().toString().slice(-6),
        fecha: new Date().toISOString(),
        pagador: pagadorTexto,
        rucPagador: pagadorRuc,
        cantidadDocs: docsValidos,
        total: sumaTotal,
        estado: "EN_REVISION", // Localmente también actualizado
        usuarioId: clienteIdFinal,
        usuarioNombre: clienteNombreFinal,
        creadoPor: subidoPor
    };

    // SUBIDA S3
    try {
        if (typeof uploadFilesMulti !== 'function') {
            throw new Error("Falta script upload.js");
        }

        const baseFolder = `OPERACIONES/${nuevoLote.id}`;
        const facturasSubidas = await uploadFilesMulti('fileFacturas', `${baseFolder}/FACTURAS`, { maxMB: 20, hideButtonState: true });

        const retencionesSubidas = document.getElementById('fileRet')?.files?.length
            ? await uploadFilesMulti('fileRet', `${baseFolder}/RETENCIONES`, { maxMB: 20, hideButtonState: true })
            : [];

        const guiasSubidas = document.getElementById('fileGuia')?.files?.length
            ? await uploadFilesMulti('fileGuia', `${baseFolder}/GUIAS`, { maxMB: 20, hideButtonState: true })
            : [];

        nuevoLote.documentos = {
            facturas: facturasSubidas,
            retenciones: retencionesSubidas,
            guias: guiasSubidas
        };

        if (!nuevoLote.documentos.facturas.length) {
            alert("⚠️ No se subió ninguna factura a S3.");
            return;
        }

    } catch (e) {
        console.error(e);
        alert("❌ Error subiendo documentos a S3: " + e.message);
        return;
    }

    // GUARDADO EN BD
    try {
        if (typeof API_URL === 'undefined') throw new Error("API_URL no definido.");

        // 6.1 Crear Operación (ESTADO: EN_REVISION)
        const opRes = await fetch(`${API_URL}/operaciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: nuevoLote.id,
                cliente_id: clienteIdFinal,
                pagador_ruc: pagadorRuc,
                cantidad_docs: docsValidos,
                monto_total: sumaTotal,
                estado_operacion: "EN_REVISION", // <--- CAMBIO: Directo a la bandeja del operativo
                creado_por: subidoPor
            })
        });
        const opData = await opRes.json();
        if (!opRes.ok || !opData.success) {
            throw new Error(opData.message || "No se pudo crear la operación en BD.");
        }

        // 6.2 Mapear PDFs
        const claves = Array.from(rows).map(r => (r.querySelector('.key-cell')?.innerText || '').trim());
        const pdfs = (nuevoLote.documentos?.facturas || []);
        const pdfPorClave = {};
        
        if (pdfs.length === claves.length) {
            claves.forEach((k, i) => { pdfPorClave[k] = pdfs[i]?.publicUrl || null; });
        } else {
            for (const k of claves) {
                const found = pdfs.find(p => (p.fileName || '').includes(k));
                pdfPorClave[k] = found ? found.publicUrl : null;
            }
        }

        // 6.3 Detalle Facturas
        const detalles = Array.from(rows).map(r => {
            const clave = (r.querySelector('.key-cell')?.innerText || '').trim();
            const montoTxt = (r.querySelector('.col-monto')?.innerText || '').replace('$','').trim();
            const monto = parseFloat(montoTxt);
            const estadoSri = (r.querySelector('.col-estado')?.innerText || '').trim();

            return {
                clave_acceso: clave,
                monto: isNaN(monto) ? null : monto,
                estado_sri: estadoSri || null,
                url_pdf: pdfPorClave[clave] || null
            };
        });

        const detRes = await fetch(`${API_URL}/operaciones/facturas/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operacion_id: nuevoLote.id, facturas: detalles })
        });
        
        if (!detRes.ok) throw new Error("No se pudo guardar detalle facturas.");

        // 6.4 Link resumen
        if (pdfs[0]?.publicUrl) {
            await fetch(`${API_URL}/files/save-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tabla: 'Operaciones', id: nuevoLote.id, columna: 'doc_factura_pdf', url: pdfs[0].publicUrl })
            });
        }

    } catch (e) {
        console.error(e);
        // Fallback local
        const dbCartera = JSON.parse(localStorage.getItem('db_cartera_lotes')) || [];
        dbCartera.push(nuevoLote);
        localStorage.setItem('db_cartera_lotes', JSON.stringify(dbCartera));
        alert("⚠️ Se guardó en modo local (Error BD: " + e.message + ")");
        return;
    }

    alert(`✅ Operación ENVIADA A REVISIÓN.\nLote ${nuevoLote.id} creado.`);
    // Redirigir a menú (o cartera si prefieres)
    window.location.href = 'menu.html';
}

// ======================================================
// CONEXIÓN SRI 
// ======================================================

async function validarSRI_REAL(clave, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return; 

    const targetURL = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";
    const proxyURL = "https://corsproxy.io/?"; 
    const urlFinal = proxyURL + encodeURIComponent(targetURL);

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
    
    const estadoNode = xmlDoc.getElementsByTagName("estado")[0];
    const estado = estadoNode ? estadoNode.textContent : "DESCONOCIDO";
    
    if (estado === "AUTORIZADO") {
        const comprobanteNode = xmlDoc.getElementsByTagName("comprobante")[0];
        if (comprobanteNode) {
            const innerXML = comprobanteNode.textContent;
            const innerDoc = parser.parseFromString(innerXML, "text/xml");
            
            let razonSocial = "---";
            let importeTotal = "0.00";
            let tipoDoc = "OTRO";

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

            updateRow(rowId, "AUTORIZADO", razonSocial, importeTotal, tipoDoc);

        } else {
            updateRow(rowId, "AUTORIZADO", "XML corrupto", "---", "ERROR");
        }
    } else {
        const mensaje = xmlDoc.getElementsByTagName("mensaje")[0]?.textContent || "Clave inválida";
        updateRow(rowId, estado, mensaje, "0.00", "ERROR");
    }
}

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

function updateRow(rowId, estado, emisor, monto, tipoDoc) {
    const row = document.getElementById(rowId);
    if (!row) return; 

    const celdaInfo = row.querySelector('.col-info');
    const celdaMonto = row.querySelector('.col-monto');
    const celdaEstado = row.querySelector('.col-estado');

    let tipoBadge = "";
    if (tipoDoc === "FACTURA")      tipoBadge = `<span style="background:#0d6efd; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">FACTURA</span>`;
    
    if (celdaInfo) celdaInfo.innerHTML = `${tipoBadge}<span style="font-weight:600; color:#444;">${emisor}</span>`;
    
    if (celdaMonto) {
        if(monto === "---") celdaMonto.textContent = "-";
        else celdaMonto.textContent = `$ ${monto}`;
    }
    
    if (celdaEstado) {
        if (estado === "AUTORIZADO") {
            celdaEstado.innerHTML = `<span class="status-badge status-valid" style="background:#d1e7dd; color:#0f5132; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">AUTORIZADO</span>`;
        } else {
            celdaEstado.innerHTML = `<span class="status-badge status-err" style="background:#f8d7da; color:#842029; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">${estado}</span>`;
        }
    }
}