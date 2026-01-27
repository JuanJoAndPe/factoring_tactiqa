function go(url){ window.location.href = url; }

    // Click en toda la caja y accesibilidad con teclado
    document.querySelectorAll("[data-go]").forEach(box => {
      box.addEventListener("click", (e) => {
        // si hacen click al botón o dentro del box igual navega
        const url = box.getAttribute("data-go");
        go(url);
      });
      box.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          go(box.getAttribute("data-go"));
        }
      });
    });
