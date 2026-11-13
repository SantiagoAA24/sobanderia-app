/** Error devuelto por la API: `{ codigo, mensaje, ...extras }` con un código estable. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  /** Campos extra del cuerpo, por ejemplo `alternativas` en `hora_ocupada`. */
  readonly extra: Record<string, unknown>;

  constructor(estado: number, codigo: string, mensaje: string, extra: Record<string, unknown> = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
    this.extra = extra;
  }
}

/** No hubo respuesta: sin internet o servidor caído. Las pantallas muestran «Sin conexión». */
export class ErrorRed extends Error {
  constructor() {
    super("No hay conexión con el servidor.");
    this.name = "ErrorRed";
  }
}

export const esErrorDeRed = (e: unknown): e is ErrorRed => e instanceof ErrorRed;
export const esErrorApi = (e: unknown, codigo?: string): e is ErrorApi =>
  e instanceof ErrorApi && (codigo === undefined || e.codigo === codigo);
/** 409 al crear o cambiar una cita: la hora se ocupó. Las pantallas muestran «Hora ocupada». */
export const esHoraOcupada = (e: unknown): e is ErrorApi => esErrorApi(e, "hora_ocupada");
