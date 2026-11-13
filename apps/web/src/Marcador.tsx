import { ScreenHeader } from "./componentes/ui";

/**
 * Pantalla provisional de las áreas que se construyen en las Fases 5 a 7.
 * Cada una se reemplaza por su pantalla del lienzo; el nombre es el del archivo en `design/lienzo/`.
 */
export function Marcador({ nombre }: { nombre: string }) {
  return (
    <div className="sb-pantalla">
      <ScreenHeader date="Próximamente" title={nombre} />
    </div>
  );
}
