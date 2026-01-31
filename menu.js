// Función helper para navegación
function go(url){ window.location.href = url; }

// Inicialización de navegación para cajas con atributo data-go
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll("[data-go]").forEach(box => {
      // Evento Click
      box.addEventListener("click", (e) => {
        // Evita doble disparo si hacen click en un botón dentro del box que ya tenga su propio onclick
        if (e.target.tagName === 'BUTTON' && e.target.hasAttribute('onclick')) return;
        
        const url = box.getAttribute("data-go");
        if(url) go(url);
      });

      // Accesibilidad con Teclado (Enter o Espacio)
      box.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          const url = box.getAttribute("data-go");
          if(url) go(url);
        }
      });
    });
});