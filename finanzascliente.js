document.addEventListener('DOMContentLoaded', () => {
    
    const btnSave = document.getElementById('btnSave');
    const docsForm = document.getElementById('docsForm');

    btnSave.addEventListener('click', () => {
        // 1. Validación básica de HTML5
        if (!docsForm.checkValidity()) {
            alert("Por favor, cargue todos los documentos obligatorios marcados con asterisco (*).");
            docsForm.reportValidity(); // Muestra los mensajes de error nativos del navegador
            return;
        }

        // 2. Recopilar información de archivos (Simulación de guardado)
        // Nota: Por seguridad, JS no puede guardar el archivo físico en disco local directamente sin interacción del usuario.
        // Aquí guardaremos los nombres de los archivos en LocalStorage para simular la persistencia de estado.
        
        const filesData = {
            years: {
                year1: document.getElementById('year1').value,
                year2: document.getElementById('year2').value,
                year3: document.getElementById('year3').value
            },
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
                    iva: getFileInfo('file-iva')
                }
            },
            timestamp: new Date().toISOString()
        };

        // 3. Guardar "Localmente" (LocalStorage)
        try {
            localStorage.setItem('finanzasPro_DocsTemp', JSON.stringify(filesData));
            console.log('Datos guardados localmente:', filesData);
            
            // Feedback al usuario
            alert("Documentos guardados localmente con éxito. Listo para la siguiente etapa.");
            
            // Aquí podrías redirigir a la siguiente pantalla
            // window.location.href = 'siguiente-paso.html';
            
        } catch (e) {
            console.error('Error al guardar en local storage', e);
            alert("Hubo un error al guardar la información localmente.");
        }
    });

    /**
     * Función auxiliar para obtener nombre y tamaño del archivo
     */
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