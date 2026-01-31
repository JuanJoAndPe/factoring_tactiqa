document.addEventListener('DOMContentLoaded', () => {
    
    const btnSave = document.getElementById('btnSave');
    const docsForm = document.getElementById('docsForm');

    // Recuperar sesión para asociar los documentos al usuario (opcional)
    const session = (typeof getSession === 'function') ? getSession() : null;

    btnSave.addEventListener('click', () => {
        // 1. Validación básica de HTML5
        if (!docsForm.checkValidity()) {
            alert("⚠️ Por favor, cargue todos los documentos obligatorios marcados con asterisco (*).");
            docsForm.reportValidity(); 
            return;
        }

        // 2. Recopilar información de los inputs
        const filesData = {
            usuarioId: session ? session.id : 'anonimo', // Asociamos al usuario
            usuarioNombre: session ? session.name : 'Desconocido',
            documents: {
                bg: [
                    getFileInfo('file-bg-0'),
                    getFileInfo('file-bg-1'),
                    getFileInfo('file-bg-2')
                ],
                er: [
                    getFileInfo('file-er-0'),
                    getFileInfo('file-er-1'),
                    getFileInfo('file-er-2')
                ],
                legal: {
                    ruc: getFileInfo('file-ruc'),
                    cedula: getFileInfo('file-cedula'),
                    nombramiento: getFileInfo('file-nombramiento'),
                    interno: getFileInfo('file-interno'),
                    iva: getFileInfo('file-iva'),
                    cco_sri: getFileInfo('file-sri'),
                },
                tratamiento_datos: getFileInfo('file-autorizacion'),
                operativo: {
                    facturas: getFileInfo('file-facturas'),
                    retenciones: getFileInfo('file-retenciones'),
                    guia: getFileInfo('file-guia'),
                    pagador: getFileInfo('file-pagador')
                }
            },
            timestamp: new Date().toISOString(),
            status: "EN_REVISION"
        };

        // 3. Guardar en memoria (Simulación de Backend)
        try {
            // Guardamos en una llave que el perfil "ADMIN" o "OPERATIVO" podría leer después
            localStorage.setItem('db_documentos_cliente', JSON.stringify(filesData));
            console.log('Documentos guardados:', filesData);
            
            alert("✅ Información cargada exitosamente.");
            
            // 4. Redirección
            // Si hay sesión, volvemos al menú. Si no (caso raro), al login.
            if (session) {
                window.location.href = 'menu.html';
            } else {
                window.location.href = 'index.html';
            }
            
        } catch (e) {
            console.error('Error storage', e);
            alert("Hubo un error al guardar la información localmente.");
        }
    });

    // Helper para extraer metadata del archivo (ya que no podemos guardar el binario real en localStorage fácil)
    function getFileInfo(inputId) {
        const input = document.getElementById(inputId);
        if (input && input.files.length > 0) {
            return {
                name: input.files[0].name,
                size: (input.files[0].size / 1024).toFixed(2) + ' KB',
                type: input.files[0].type
            };
        }
        return null;
    }
});