# 🖼️ Imágenes para Google Play (los 3 juegos)

Todas las imágenes que pide la **ficha de Play Store** ya están generadas, en
`<juego>/assets/store/` de cada juego. Esto es qué subir en cada campo de
**Play Console → Crecimiento → Presencia en Store → Ficha principal**.

| Campo en Play Console | Requisito | Archivo |
|-----------------------|-----------|---------|
| **Icono de la app** | 512 × 512 PNG (32-bit, con alfa) | `assets/store/icon-512.png` |
| **Gráfico destacado** | 1024 × 500 PNG/JPG | `assets/store/feature-graphic.png` |
| **Capturas de teléfono** (mín. 2, máx. 8) | 1080 × 1920 PNG | `assets/store/screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png` |

Rutas exactas por juego:

```
neon-zigzag/assets/store/   icon-512.png · feature-graphic.png · screenshot-1..3.png
stack-tower/assets/store/   icon-512.png · feature-graphic.png · screenshot-1..3.png
merge-2048/assets/store/    icon-512.png · feature-graphic.png · screenshot-1..3.png
```

## Notas
- **Icono 1024×1024** (`assets/icon-1024.png`) sirve para la App Store de Apple
  (ahí se pide 1024 sin alfa). Para Play usa el de **512**.
- Las **capturas** son gameplay real con un subtítulo. Puedes subir más estados
  si quieres; con 3 alcanza para publicar.
- **Tablet** (opcional): Play permite añadir capturas de 7" y 10". No son
  obligatorias; si las quieres, las genero a 1200×1920 / 1600×2560.
- El **gráfico destacado** se ve arriba de la ficha y en colecciones; es
  obligatorio en Play.

## Checklist rápido de la ficha (Play)
- [ ] Icono 512 subido.
- [ ] Gráfico destacado subido.
- [ ] 2-8 capturas de teléfono subidas.
- [ ] Título + descripción corta + descripción completa (ver `store/google-play.md`).
- [ ] Política de privacidad: `https://martinuzal.github.io/juegos/privacy-policy.html`
