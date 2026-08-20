// Cierra un modal al hacer clic en su backdrop, sin interferir con seleccionar texto de un
// input arrastrando el mouse hasta soltar fuera de él: si el mousedown empieza dentro del
// modal y el mouseup termina en el backdrop, el navegador sintetiza el evento "click" con
// target = ancestro común (el backdrop), lo que con solo "click" cierra el modal por error a
// mitad de una selección. Exigir que TANTO el mousedown como el click hayan sido directo
// sobre el backdrop evita ese falso positivo.
export function cerrarAlClicFuera(backdrop, cerrar) {
  let mousedownEnBackdrop = false;

  backdrop.addEventListener('mousedown', (event) => {
    mousedownEnBackdrop = event.target === event.currentTarget;
  });

  backdrop.addEventListener('click', (event) => {
    if (mousedownEnBackdrop && event.target === event.currentTarget) {
      cerrar();
    }
    mousedownEnBackdrop = false;
  });
}
