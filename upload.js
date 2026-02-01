/**
 * GESTOR DE CARGA DE ARCHIVOS A AWS S3
 * Se encarga de:
 * 1. Pedir permiso a Lambda (Link firmado)
 * 2. Subir el archivo directo a S3
 * 3. Guardar el link público en la Base de Datos
 */

async function uploadFile(fileInputId, folderName, dbTable, dbId, dbColumn) {
    const input = document.getElementById(fileInputId);
    const file = input.files[0];

    if (!file) {
        alert("⚠️ Por favor selecciona un archivo primero.");
        return;
    }

    // Validar tamaño (Max 5MB por ejemplo)
    if (file.size > 5 * 1024 * 1024) {
        alert("⚠️ El archivo es muy pesado. Máximo 5MB.");
        return;
    }

    // Referencia al botón para efectos visuales
    const btnId = `btn_${fileInputId}`;
    const btn = document.getElementById(btnId);
    const originalText = btn ? btn.innerText : "Subir";
    
    try {
        if(btn) {
            btn.innerText = "⏳ Subiendo...";
            btn.disabled = true;
        }

        console.log(`1. Solicitando permiso para: ${file.name}`);

        // 1. PEDIR URL PRE-FIRMADA AL BACKEND
        const resUrl = await fetch(`${API_URL}/files/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                folder: folderName, // Ej: "PAGADORES/17900..."
                fileType: file.type
            })
        });

        const dataUrl = await resUrl.json();
        if (!dataUrl.success) throw new Error("No se pudo generar el enlace de subida.");

        console.log("2. Subiendo a S3...");

        // 2. SUBIR EL ARCHIVO FÍSICO A S3 (Usando el link temporal)
        const resS3 = await fetch(dataUrl.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });

        if (!resS3.ok) throw new Error("Falló la subida a S3.");

        console.log("3. Guardando referencia en BD...");

        // 3. GUARDAR EL LINK PÚBLICO EN TU MYSQL
        const resSave = await fetch(`${API_URL}/files/save-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tabla: dbTable,   // Ej: 'Pagadores'
                id: dbId,         // Ej: 'PAY-001'
                columna: dbColumn,// Ej: 'doc_ruc'
                url: dataUrl.publicUrl
            })
        });

        const dataSave = await resSave.json();
        if (!dataSave.success) throw new Error("Se subió el archivo pero no se guardó en la base de datos.");

        // ÉXITO
        alert("✅ Documento cargado correctamente.");
        if(btn) {
            btn.innerText = "✅ Listo";
            btn.className = "btn ok small"; // Cambia a verde si tienes esa clase
        }

    } catch (error) {
        console.error(error);
        alert("❌ Error: " + error.message);
        if(btn) {
            btn.innerText = "Reintentar";
            btn.disabled = false;
        }
    }
}