document.addEventListener('DOMContentLoaded', () => {
    
    const btnSave = document.getElementById('btnSave');
    const docsForm = document.getElementById('docsForm');

    btnSave.addEventListener('click', () => {
        // 1. Validación básica
        if (!docsForm.checkValidity()) {
            alert("Por favor, cargue todos los documentos obligatorios marcados con asterisco (*).");
            docsForm.reportValidity(); 
            return;
        }

        // 2. Recopilar información
        const filesData = {
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
            timestamp: new Date().toISOString()
        };

        // 3. Guardar y Redirigir
        try {
            localStorage.setItem('finanzasPro_DocsTemp', JSON.stringify(filesData));
            console.log('Datos guardados localmente:', filesData);
            
            alert("Información cargada exitosamente. Por favor, inicie sesión.");
            
            // REDIRECCIÓN AL LOGIN
            window.location.href = 'index.html'; 
            
        } catch (e) {
            console.error('Error al guardar en local storage', e);
            alert("Hubo un error al guardar la información localmente.");
        }
    });

    function getFileInfo(inputId) {
        const input = document.getElementById(inputId);
        if (input && input.files.length > 0) {
            return {
                name: input.files[0].name,
                size: input.files[0].size,
                type: input.files[0].type
            };
        }
        return null;
    }
});