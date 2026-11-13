import { RouterProvider } from "react-router-dom";

import { ProveedorApi } from "./api/proveedor";
import { router } from "./rutas";

export default function App() {
  return (
    <ProveedorApi
      alVencerSesion={() => void router.navigate("/sesion-vencida", { replace: true })}
      alVencerEnlace={() => void router.navigate("/enlace-vencido", { replace: true })}
    >
      <RouterProvider router={router} />
    </ProveedorApi>
  );
}
