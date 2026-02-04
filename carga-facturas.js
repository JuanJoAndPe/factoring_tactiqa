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
    // Verificar sesión
    const session = typeof getSession === 'function' ? getSession() : JSON.parse(localStorage.getItem('tqa_session'));
    if (!session) return; 

    // Modo COMERCIAL / STAFF
    const isStaff = ['COMERCIAL', 'ADMIN', 'OPERATIVO'].includes(session.role);
    if (isStaff) {
        initStaffMode();
    }

    cargarPagadoresDesdeBD();
    
    // Inicializar zona de carga
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
        // Intenta cargar desde API
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

    // Fallback local
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

    // Validación extra para modo staff
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

// Listener para cambio de cliente (modo staff)
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
    
    // Llamada a validación (NUEVA VERSIÓN LAMBDA)
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
// GUARDADO (SQL TRANSACCIONAL)
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
        estado: "EN_REVISION",
        usuarioId: clienteIdFinal,
        usuarioNombre: clienteNombreFinal,
        creadoPor: subidoPor
    };

    // 1. SUBIDA A S3
    try {
        if (typeof uploadFilesMulti !== 'function') {
            throw new Error("Falta script upload.js");
        }

        const baseFolder = `OPERACIONES/${nuevoLote.id}`;
        
        // Subida Facturas
        const facturasSubidas = await uploadFilesMulti('fileFacturas', `${baseFolder}/FACTURAS`, { maxMB: 20, hideButtonState: true });

        // Subida Retenciones (Opcional)
        const retencionesSubidas = document.getElementById('fileRet')?.files?.length
            ? await uploadFilesMulti('fileRet', `${baseFolder}/RETENCIONES`, { maxMB: 20, hideButtonState: true })
            : [];

        // Subida Guías (Opcional)
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

    // 2. GUARDADO EN BD (MySQL via Lambda)
    try {
        if (typeof API_URL === 'undefined') throw new Error("API_URL no definido.");

        // 2.1 Crear Operación
        const opRes = await fetch(`${API_URL}/operaciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: nuevoLote.id,
                cliente_id: clienteIdFinal,
                pagador_ruc: pagadorRuc,
                cantidad_docs: docsValidos,
                monto_total: sumaTotal,
                estado_operacion: "EN_REVISION",
                creado_por: subidoPor
            })
        });
        const opData = await opRes.json();
        if (!opRes.ok || !opData.success) {
            throw new Error(opData.message || "No se pudo crear la operación en BD.");
        }

        // 2.2 Mapear PDFs con Claves
        const claves = Array.from(rows).map(r => (r.querySelector('.key-cell')?.innerText || '').trim());
        const pdfs = (nuevoLote.documentos?.facturas || []);
        const pdfPorClave = {};
        
        // Intento de mapeo simple (orden) o por nombre
        if (pdfs.length === claves.length) {
            claves.forEach((k, i) => { pdfPorClave[k] = pdfs[i]?.publicUrl || null; });
        } else {
            for (const k of claves) {
                const found = pdfs.find(p => (p.fileName || '').includes(k));
                pdfPorClave[k] = found ? found.publicUrl : null;
            }
        }

        // 2.3 Preparar Detalle Facturas
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

        // 2.4 Guardar Batch Detalles
        const detRes = await fetch(`${API_URL}/operaciones/facturas/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operacion_id: nuevoLote.id, facturas: detalles })
        });
        
        if (!detRes.ok) throw new Error("No se pudo guardar detalle facturas.");

        // 2.5 Guardar Link Resumen (Primer PDF como referencia)
        if (pdfs[0]?.publicUrl) {
            await fetch(`${API_URL}/files/save-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tabla: 'Operaciones', id: nuevoLote.id, columna: 'doc_factura_pdf', url: pdfs[0].publicUrl })
            });
        }

    } catch (e) {
        console.error(e);
        // Fallback local en caso de error de BD
        const dbCartera = JSON.parse(localStorage.getItem('db_cartera_lotes')) || [];
        dbCartera.push(nuevoLote);
        localStorage.setItem('db_cartera_lotes', JSON.stringify(dbCartera));
        alert("⚠️ Se guardó en modo local (Error BD: " + e.message + ")");
        return;
    }

    alert(`✅ Operación ENVIADA A REVISIÓN.\nLote ${nuevoLote.id} creado.`);
    window.location.href = 'menu.html';
}

// ======================================================
// CONEXIÓN SRI (ACTUALIZADA: USA PROXY LAMBDA AWS)
// ======================================================

async function validarSRI_REAL(clave, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return; 

    // Nota: API_URL debe estar definido en config.js o al inicio.
    // Ejemplo: const API_URL = "https://tu-api.execute-api.us-east-1.amazonaws.com";

    try {
        console.log(`Consultando SRI para: ${clave}...`);

        // Usamos la nueva ruta /sri/validar creada en Lambda
        const response = await fetch(`${API_URL}/sri/validar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ clave_acceso: clave })
        });

        const data = await response.json();

        if (data.success && data.data) {
            const info = data.data;
            const estado = info.estado || "DESCONOCIDO";
            const emisor = (estado === 'RECHAZADA') ? (info.mensajeError || "Error SRI") : (info.razonSocial || "---");
            const monto = info.monto || "0.00"; 
            const tipoDoc = "FACTURA"; 

            updateRow(rowId, estado, emisor, monto, tipoDoc);
        } else {
            // Manejo de errores controlados
            console.error("SRI Error:", data.message);
            updateRow(rowId, "ERROR", data.message || "Error SRI", "0.00", "ERROR");
        }

    } catch (error) {
        console.error("Error de Red/Fetch:", error);
        updateRow(rowId, "ERROR_RED", "Fallo de conexión", "---", "ERROR");
    }
}

// Función auxiliar para actualizar la UI de la fila
function updateRow(rowId, estado, emisor, monto, tipoDoc) {
    const row = document.getElementById(rowId);
    if (!row) return; 

    const celdaInfo = row.querySelector('.col-info');
    const celdaMonto = row.querySelector('.col-monto');
    const celdaEstado = row.querySelector('.col-estado');

    let tipoBadge = "";
    if (tipoDoc === "FACTURA")      
        tipoBadge = `<span style="background:#0d6efd; color:#fff; padding:2px 5px; border-radius:3px; font-weight:700; font-size:10px; margin-right:6px;">FACTURA</span>`;
    
    // Actualizar Emisor
    if (celdaInfo) celdaInfo.innerHTML = `${tipoBadge}<span style="font-weight:600; color:#444;">${emisor}</span>`;
    
    // Actualizar Monto
    if (celdaMonto) {
        if(monto === "---") celdaMonto.textContent = "-";
        else celdaMonto.textContent = `$ ${monto}`;
    }
    
    // Actualizar Estado (Color badge)
    if (celdaEstado) {
        if (estado === "AUTORIZADO") {
            celdaEstado.innerHTML = `<span class="status-badge status-valid" style="background:#d1e7dd; color:#0f5132; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">AUTORIZADO</span>`;
        } else if (estado === "ERROR_RED") {
             celdaEstado.innerHTML = `<span class="status-badge" style="background:#fff3cd; color:#856404; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">OFFLINE</span>`;
        } else {
            celdaEstado.innerHTML = `<span class="status-badge status-err" style="background:#f8d7da; color:#842029; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700;">${estado}</span>`;
        }
    }
}