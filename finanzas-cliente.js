document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btnSave');
    const docsForm = document.getElementById('docsForm');

    // Recuperar sesión para asociar los documentos al usuario
    const session = (typeof getSession === 'function') ? getSession() : null;

    // Helpers
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    async function uploadSingle(inputId, folder) {
        // sube 1 archivo del input
        const res = await uploadFile(inputId, folder, null, null, null, { maxMB: 20, hideButtonState: true });
        return res; // {publicUrl,key,fileName,...} o null
    }
    async function saveUpdate(tabla, id, columna, url) {
        if (!url) return;
        if (typeof saveLink === 'function') {
            await saveLink({ tabla, id, columna, url });
            return;
        }
        // fallback
        const res = await fetch(`${API_URL}/files/save-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabla, id, columna, url })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "No se pudo guardar el link en BD.");
    }

    async function saveAsDocumento(cliente_id, tipo_documento, nombre_archivo, url_s3) {
        if (!url_s3) return;
        if (typeof saveDocumento === 'function') {
            await saveDocumento({ cliente_id, tipo_documento, nombre_archivo, url_s3 });
            return;
        }
        await saveLink({ tabla: 'Documentos', cliente_id, tipo_documento, nombre_archivo, url_s3 });
    }


    btnSave.addEventListener('click', async () => {
        // 1. Validación básica de HTML5
        if (!docsForm.checkValidity()) {
            alert("⚠️ Por favor, cargue todos los documentos obligatorios marcados con asterisco (*).");
            docsForm.reportValidity();
            return;
        }

        if (typeof uploadFile !== 'function') {
            alert("❌ Falta upload.js. Incluye <script src=\"upload.js\"></script> antes de finanzas-cliente.js");
            return;
        }

        // 2. Construimos carpeta base en S3
        const userId = session ? session.id : 'anonimo';
        const baseFolder = `CLIENTES/${userId}/FINANZAS_CLIENTE/${Date.now()}`;

        // 3. Subimos archivos (secuencial para evitar saturar)
        btnSave.disabled = true;
        const originalText = btnSave.innerText;
        btnSave.innerText = "⏳ Subiendo documentos...";

        try {
            const uploads = {
                bg: [],
                er: [],
                legal: {},
                tratamiento_datos: null,
                operativo: {}
            };

            // Balance General (3 últimos)
            uploads.bg.push(await uploadSingle('file-bg-0', `${baseFolder}/BG`));
            uploads.bg.push(await uploadSingle('file-bg-1', `${baseFolder}/BG`));
            uploads.bg.push(await uploadSingle('file-bg-2', `${baseFolder}/BG`));

            // Estado de Resultados (3 últimos)
            uploads.er.push(await uploadSingle('file-er-0', `${baseFolder}/ER`));
            uploads.er.push(await uploadSingle('file-er-1', `${baseFolder}/ER`));
            uploads.er.push(await uploadSingle('file-er-2', `${baseFolder}/ER`));

            // Documentos legales / soporte
            uploads.legal.ruc = await uploadSingle('file-ruc', `${baseFolder}/LEGAL`);
            uploads.legal.cedula = await uploadSingle('file-cedula', `${baseFolder}/LEGAL`);
            uploads.legal.nombramiento = await uploadSingle('file-nombramiento', `${baseFolder}/LEGAL`);
            uploads.legal.interno = await uploadSingle('file-interno', `${baseFolder}/LEGAL`);
            uploads.legal.iva = await uploadSingle('file-iva', `${baseFolder}/LEGAL`);
            uploads.legal.cco_sri = await uploadSingle('file-sri', `${baseFolder}/LEGAL`);

            // Autorización
            uploads.tratamiento_datos = await uploadSingle('file-autorizacion', `${baseFolder}/AUTORIZACION`);

            // Operativo
            uploads.operativo.facturas = await uploadSingle('file-facturas', `${baseFolder}/OPERATIVO`);
            uploads.operativo.retenciones = await uploadSingle('file-retenciones', `${baseFolder}/OPERATIVO`);
            uploads.operativo.guia = await uploadSingle('file-guia', `${baseFolder}/OPERATIVO`);
            uploads.operativo.pagador = await uploadSingle('file-pagador', `${baseFolder}/OPERATIVO`);

            // Validación final: si algo requerido no subió, aborta
            const flat = [
                ...uploads.bg, ...uploads.er,
                uploads.legal.ruc, uploads.legal.cedula, uploads.legal.nombramiento,
                uploads.legal.interno, uploads.legal.iva, uploads.legal.cco_sri,
                uploads.tratamiento_datos,
                uploads.operativo.facturas, uploads.operativo.retenciones, uploads.operativo.guia, uploads.operativo.pagador
            ];
            if (flat.some(x => !x)) {
                throw new Error("Uno o más documentos no se pudieron subir. Revisa tu conexión o permisos del bucket.");
            }

            // 4. Guardamos metadata + URLs (y keys) para auditoría / vista administrativa
            const filesData = {
                usuarioId: userId,
                usuarioNombre: session ? session.name : 'Desconocido',
                uploads,
                timestamp: new Date().toISOString(),
                status: "EN_REVISION"
            };

            
            // 4.b Guardar links en MySQL según tablas.csv
            // - Columnas directas en Clientes
            await saveUpdate('Clientes', userId, 'doc_ruc', uploads.legal.ruc.publicUrl);
            await saveUpdate('Clientes', userId, 'doc_nombramiento', uploads.legal.nombramiento.publicUrl);
            await saveUpdate('Clientes', userId, 'doc_balance_2025', uploads.bg[0].publicUrl);
            await saveUpdate('Clientes', userId, 'doc_balance_2024', uploads.bg[1].publicUrl);

            // - Documentos extra (tabla Documentos) para múltiple/otros tipos
            await saveAsDocumento(userId, 'balance_2023', uploads.bg[2].fileName, uploads.bg[2].publicUrl);

            await saveAsDocumento(userId, 'estado_resultados_2025', uploads.er[0].fileName, uploads.er[0].publicUrl);
            await saveAsDocumento(userId, 'estado_resultados_2024', uploads.er[1].fileName, uploads.er[1].publicUrl);
            await saveAsDocumento(userId, 'estado_resultados_2023', uploads.er[2].fileName, uploads.er[2].publicUrl);

            await saveAsDocumento(userId, 'cedula_representante', uploads.legal.cedula.fileName, uploads.legal.cedula.publicUrl);
            await saveAsDocumento(userId, 'historial_interno', uploads.legal.interno.fileName, uploads.legal.interno.publicUrl);
            await saveAsDocumento(userId, 'declaracion_iva', uploads.legal.iva.fileName, uploads.legal.iva.publicUrl);
            await saveAsDocumento(userId, 'cco_sri', uploads.legal.cco_sri.fileName, uploads.legal.cco_sri.publicUrl);

            await saveAsDocumento(userId, 'autorizacion_tratamiento', uploads.tratamiento_datos.fileName, uploads.tratamiento_datos.publicUrl);

            await saveAsDocumento(userId, 'operativo_facturas', uploads.operativo.facturas.fileName, uploads.operativo.facturas.publicUrl);
            await saveAsDocumento(userId, 'operativo_retenciones', uploads.operativo.retenciones.fileName, uploads.operativo.retenciones.publicUrl);
            await saveAsDocumento(userId, 'operativo_guia', uploads.operativo.guia.fileName, uploads.operativo.guia.publicUrl);
            await saveAsDocumento(userId, 'operativo_pagador', uploads.operativo.pagador.fileName, uploads.operativo.pagador.publicUrl);

            localStorage.setItem('db_documentos_cliente', JSON.stringify(filesData));
            console.log('Documentos guardados (S3):', filesData);

            alert("✅ Documentos subidos a S3 y registrados correctamente.");

            // 5. Redirección
            if (session) window.location.href = 'menu.html';
            else window.location.href = 'index.html';

        } catch (e) {
            console.error(e);
            alert("Algunos documentos no se pudieron subir el asesor se comunicará con usted, será redirigido para iniciar sesión nuevamente.");

        } finally {
            btnSave.disabled = false;
            btnSave.innerText = originalText;

            // REDIRECCIÓN FORZADA SIEMPRE
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }
    });
});
