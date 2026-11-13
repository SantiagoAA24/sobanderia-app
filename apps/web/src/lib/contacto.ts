/** Llamar y escribir por WhatsApp a un celular en formato E.164. El número solo va en el enlace, nunca en registros. */

export const enlaceLlamar = (e164: string) => `tel:${e164}`;
export const enlaceWhatsapp = (e164: string) => `https://wa.me/${e164.replace(/\D/g, "")}`;

export const llamar = (e164: string) => window.location.assign(enlaceLlamar(e164));
export const abrirWhatsapp = (e164: string) => void window.open(enlaceWhatsapp(e164), "_blank", "noopener,noreferrer");
