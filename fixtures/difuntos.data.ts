/**
 * Datos sintéticos para las pruebas de CRUD de difuntos.
 *
 * Los nombres deben ser únicos por corrida: la suite comparte un único usuario
 * (`storageState`) y las pruebas de escritura no deben interferir entre sí ni
 * dejar registros sin identificar al final de la corrida.
 */

let counter = 0;

export interface DifuntoData {
  /** Campo `jform[nombre]`. */
  nombre: string;
  /** Campo `jform[apellidos]`. */
  apellidos: string;
  /** `nombre + ' ' + apellidos`, tal como lo muestra el listado "Mis Difuntos". */
  nombreCompleto: string;
}

/** Genera un difunto de prueba con nombre y apellidos únicos. */
export function crearDifunto(): DifuntoData {
  counter += 1;
  const stamp = `${Date.now()}-${counter}`;
  const nombre = `E2E-Nombre-${stamp}`;
  const apellidos = `E2E-Apellidos-${stamp}`;

  return {
    nombre,
    apellidos,
    nombreCompleto: `${nombre} ${apellidos}`,
  };
}
