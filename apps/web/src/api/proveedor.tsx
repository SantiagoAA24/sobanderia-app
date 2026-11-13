import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { crearClienteDeConsultas } from "./consultas";

export interface ProveedorApiProps {
  children: ReactNode;
  /** Lo reciben las pruebas; en la app se crea uno con los manejadores globales. */
  cliente?: QueryClient;
  alVencerSesion: () => void;
  alVencerEnlace: () => void;
}

export function ProveedorApi({ children, cliente, alVencerSesion, alVencerEnlace }: ProveedorApiProps) {
  const [creado] = useState(() => cliente ?? crearClienteDeConsultas({ alVencerSesion, alVencerEnlace }));
  return <QueryClientProvider client={creado}>{children}</QueryClientProvider>;
}
