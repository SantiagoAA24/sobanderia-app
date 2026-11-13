import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Cargable } from "../cliente/Disposicion";
import { BackHeader, Button, EmptyState, OptionRow, StatusNote } from "../componentes/ui";
import { textoDeError } from "../panel/errores";
import { citasTexto } from "../panel/formato";
import { useDarDeBaja, useSobandero, type QueHacerConLasCitas, type SobanderoAdmin } from "./consultas";
import { PantallaAdmin } from "./Disposicion";
import { useIdSobandero } from "./FichaSobandero";

/** Pantalla `Admin-Baja` del lienzo: el administrador elige qué pasa con las citas próximas. */
export function BajaSobandero() {
  const consulta = useSobandero(useIdSobandero());
  return (
    <Cargable consulta={consulta} texto="Buscando al sobandero…">
      {(s) => <Baja sobandero={s} />}
    </Cargable>
  );
}

function Baja({ sobandero: s }: { sobandero: SobanderoAdmin }) {
  const navigate = useNavigate();
  const baja = useDarDeBaja(s.id);
  const [citas, setCitas] = useState<QueHacerConLasCitas>("dejar");
  const [error, setError] = useState<string | null>(null);
  const ficha = `/admin/sobanderos/${s.id}`;
  const n = s.citas_proximas;

  if (!s.activo) {
    return (
      <PantallaAdmin cabecera={<BackHeader onBack={() => navigate("/admin/sobanderos")} />}>
        <h1 className="display-lg">{s.nombre}</h1>
        <EmptyState title="Ya está dado de baja" text="Su historial se conserva." />
      </PantallaAdmin>
    );
  }

  const confirmar = () => {
    setError(null);
    baja.mutate(citas, {
      onSuccess: (r) =>
        navigate("/admin/sobanderos", { replace: true, state: { aviso: avisoFinal(s.nombre, citas, r.citas_canceladas, r.sobandero) } }),
      onError: (e) => setError(textoDeError(e)),
    });
  };

  return (
    <PantallaAdmin
      cabecera={<BackHeader onBack={() => navigate(ficha)} />}
      pie={
        <>
          <Button icon="check" onClick={() => navigate(ficha)} block>
            No, mantenerlo
          </Button>
          <Button variant="outline" icon="x" onClick={confirmar} disabled={baja.isPending} block>
            Sí, dar de baja
          </Button>
        </>
      }
    >
      <h1 className="display-lg">¿Dar de baja a {s.nombre}?</h1>
      {n === 0 ? (
        <EmptyState title="No tiene citas próximas" text="Su cuenta se cerrará al instante. Su historial se conserva." />
      ) : (
        <>
          <EmptyState title={n === 1 ? "Tiene 1 cita próxima" : `Tiene ${n} citas próximas`} text="Elija qué pasa con ellas. Su historial se conserva." />
          <OptionRow title="Dejarlas como están" caption="Las atiende y luego deja de recibir citas" trailing="radio" selected={citas === "dejar"} onClick={() => setCitas("dejar")} />
          <OptionRow
            title="Cancelarlas y avisar"
            caption="Les escribimos por WhatsApp para ofrecer otra hora"
            trailing="radio"
            selected={citas === "cancelar"}
            onClick={() => setCitas("cancelar")}
          />
          {citas === "cancelar" ? (
            <StatusNote icon="x">{n === 1 ? "Se cancelará 1 cita y su cliente recibirá un WhatsApp." : `Se cancelarán ${n} citas y sus clientes recibirán un WhatsApp.`}</StatusNote>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaAdmin>
  );
}

function avisoFinal(nombre: string, elegido: QueHacerConLasCitas, canceladas: number, despues: SobanderoAdmin): string {
  if (elegido === "cancelar" && canceladas > 0) {
    return `${nombre} quedó dado de baja. Cancelamos ${citasTexto(canceladas)} y avisamos a los clientes.`;
  }
  if (despues.activo) {
    return `${nombre} ya no recibe citas nuevas. Su cuenta se cerrará al terminar ${despues.citas_proximas === 1 ? "la cita" : `las ${despues.citas_proximas} citas`} que le quedan.`;
  }
  return `${nombre} quedó dado de baja.`;
}
