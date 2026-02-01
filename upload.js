/**
 * GESTOR DE CARGA DE ARCHIVOS A AWS S3
 * Se encarga de:
 * 1. Pedir permiso a Lambda (Link firmado)
 * 2. Subir el archivo directo a S3
 * 3. (Opcional) Guardar el link público en la Base de Datos
 *
 * Requisitos:
 * - Debe existir API_URL (normalmente lo define auth.js)
 *
 * NOTA:
 * - Si tu bucket es privado, publicUrl NO será descargable directamente.
 *   En ese caso guarda el "key" y genera presigned GET para descargar.
 */

const TQ_UPLOAD_DEFAULT_MAX_MB = 20;

async function _tq_getPresignedUrl({ fileName, folder, contentType }) {
    const resUrl = await fetch(`${API_URL}/files/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName,
            folder,
            // backend actual espera fileType; igual soportamos "contentType" por robustez
            fileType: contentType,
            contentType
        })
    });

    const dataUrl = await resUrl.json();
    if (!dataUrl.success) {
        const msg = dataUrl.message || "No se pudo generar el enlace de subida.";
        throw new Error(msg);
    }
    return dataUrl; // { uploadUrl, publicUrl, key, ... }
}

async function _tq_putToS3({ uploadUrl, file, contentType }) {
    const resS3 = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || "application/octet-stream" },
        body: file
    });

    if (!resS3.ok) {
        throw new Error("Falló la subida a S3.");
    }
}

async function _tq_saveLinkToDB({ tabla, id, columna, url }) {
    const resSave = await fetch(`${API_URL}/files/save-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabla, id, columna, url })
    });

    const dataSave = await resSave.json();
    if (!dataSave.success) {
        const msg = dataSave.message || "Se subió el archivo pero no se guardó en la base de datos.";
        throw new Error(msg);
    }
    return dataSave;
}


/**
 * Guarda en BD usando /files/save-link.
 * - payload puede ser modo UPDATE o modo INSERT (tabla="Documentos")
 */
async function saveLink(payload) {
    const resSave = await fetch(`${API_URL}/files/save-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const dataSave = await resSave.json();
    if (!dataSave.success) {
        const msg = dataSave.message || "No se pudo guardar en base de datos.";
        throw new Error(msg);
    }
    return dataSave;
}

/** Atajo: inserta en tabla Documentos (según tablas.csv) */
async function saveDocumento({ cliente_id, tipo_documento, nombre_archivo, url_s3 }) {
    return saveLink({ tabla: 'Documentos', cliente_id, tipo_documento, nombre_archivo, url_s3 });
}

/**
 * Sube 1 archivo (el primero) desde un <input type="file">.
 * - Si dbTable/dbId/dbColumn están definidos, guarda la URL en BD.
 * - Retorna { publicUrl, key, fileName, size, type }
 */
async function uploadFile(fileInputId, folderName, dbTable, dbId, dbColumn, options = {}) {
    const input = document.getElementById(fileInputId);
    const file = input?.files?.[0];

    if (!file) {
        alert("⚠️ Por favor selecciona un archivo primero.");
        return null;
    }

    const maxMB = options.maxMB ?? TQ_UPLOAD_DEFAULT_MAX_MB;

    // Validar tamaño
    if (file.size > maxMB * 1024 * 1024) {
        alert(`⚠️ El archivo es muy pesado. Máximo ${maxMB}MB.`);
        return null;
    }

    // Referencia al botón para efectos visuales
    const btnId = `btn_${fileInputId}`;
    const btn = document.getElementById(btnId);
    const originalText = btn ? btn.innerText : "Subir";

    try {
        if (btn && !options.hideButtonState) {
            btn.innerText = "⏳ Subiendo...";
            btn.disabled = true;
        }

        const contentType = file.type || "application/octet-stream";
        const dataUrl = await _tq_getPresignedUrl({
            fileName: file.name,
            folder: folderName,
            contentType
        });

        await _tq_putToS3({
            uploadUrl: dataUrl.uploadUrl,
            file,
            contentType
        });

        // Guardado opcional en BD
        if (dbTable && dbId && dbColumn) {
            await _tq_saveLinkToDB({
                tabla: dbTable,
                id: dbId,
                columna: dbColumn,
                url: dataUrl.publicUrl
            });
        }

        if (btn && !options.hideButtonState) {
            btn.innerText = "✅ Listo";
            btn.className = "btn ok small";
        }

        return {
            publicUrl: dataUrl.publicUrl,
            key: dataUrl.key,
            fileName: file.name,
            size: file.size,
            type: contentType
        };

    } catch (error) {
        console.error(error);
        alert("❌ Error: " + error.message);
        if (btn && !options.hideButtonState) {
            btn.innerText = "Reintentar";
            btn.disabled = false;
        }
        return null;

    } finally {
        if (btn && !options.hideButtonState && btn.disabled && btn.innerText === "⏳ Subiendo...") {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

/**
 * Sube TODOS los archivos seleccionados en un input (multiple).
 * - NO guarda en BD (a menos que pases dbTable/dbId/dbColumn y se usará SOLO para el primero).
 * - Retorna un array de resultados [{publicUrl,key,fileName,...}, ...]
 */
async function uploadFilesMulti(fileInputId, folderName, options = {}) {
    const input = document.getElementById(fileInputId);
    const files = input?.files ? Array.from(input.files) : [];
    if (!files.length) {
        alert("⚠️ Por favor selecciona al menos un archivo.");
        return [];
    }

    const maxMB = options.maxMB ?? TQ_UPLOAD_DEFAULT_MAX_MB;

    // Si existe un botón asociado, lo usamos como estado general
    const btnId = `btn_${fileInputId}`;
    const btn = document.getElementById(btnId);
    const originalText = btn ? btn.innerText : "Subir";

    try {
        if (btn && !options.hideButtonState) {
            btn.innerText = "⏳ Subiendo...";
            btn.disabled = true;
        }

        const results = [];
        for (const file of files) {
            if (file.size > maxMB * 1024 * 1024) {
                throw new Error(`El archivo "${file.name}" supera el máximo de ${maxMB}MB.`);
            }

            const contentType = file.type || "application/octet-stream";
            const dataUrl = await _tq_getPresignedUrl({
                fileName: file.name,
                folder: folderName,
                contentType
            });

            await _tq_putToS3({ uploadUrl: dataUrl.uploadUrl, file, contentType });

            results.push({
                publicUrl: dataUrl.publicUrl,
                key: dataUrl.key,
                fileName: file.name,
                size: file.size,
                type: contentType
            });
        }

        if (btn && !options.hideButtonState) {
            btn.innerText = "✅ Listo";
            btn.className = "btn ok small";
        }

        return results;

    } catch (error) {
        console.error(error);
        alert("❌ Error: " + error.message);
        if (btn && !options.hideButtonState) {
            btn.innerText = "Reintentar";
            btn.disabled = false;
        }
        return [];

    } finally {
        if (btn && !options.hideButtonState && btn.disabled && btn.innerText === "⏳ Subiendo...") {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}
