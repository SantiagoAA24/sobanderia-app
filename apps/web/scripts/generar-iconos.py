"""Genera los PNG de public/iconos desde la misma «S» crema sobre terracota del icono.svg.
Uso: python3 scripts/generar-iconos.py   (requiere Pillow; solo se corre al cambiar el ícono)."""
from PIL import Image, ImageDraw, ImageFont

TERRACOTA, CREMA = "#b4492a", "#fbf4ea"
FUENTE = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def icono(lado: int, redondeo: float, letra: float, destino: str) -> None:
    img = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, lado, lado), radius=int(lado * redondeo), fill=TERRACOTA)
    fuente = ImageFont.truetype(FUENTE, int(lado * letra))
    d.text((lado / 2, lado / 2), "S", font=fuente, fill=CREMA, anchor="mm")
    img.save(destino)


base = "public/iconos/"
icono(192, 0.22, 0.62, base + "icono-192.png")
icono(512, 0.22, 0.62, base + "icono-512.png")
icono(512, 0.0, 0.46, base + "icono-maskable-512.png")  # sin esquinas: el sistema recorta; letra dentro del 80 % central
icono(180, 0.0, 0.52, base + "apple-touch-icon.png")  # iOS redondea solo
