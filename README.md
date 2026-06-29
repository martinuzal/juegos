# 🕹️ Game Studio — colección de juegos móviles

Tres juegos **hiper-casual** independientes, cada uno en su propia carpeta,
pensados para ser **adictivos**, publicables en Google Play / App Store y
**monetizables con anuncios** (AdMob ya integrado).

Cada carpeta es un proyecto **autónomo**: su propio juego, su `ads.js`, su
`capacitor.config.json` y su `package.json`. Puedes publicarlos por separado.

| Juego | Carpeta | Mecánica | Input | Tema |
|-------|---------|----------|-------|------|
| 🔷 **Neon Zigzag** | [`neon-zigzag/`](neon-zigzag/) | Sigue la pista en zigzag sin caerte | 1 toque (cambia dirección) | Cyan / magenta |
| 🟧 **Stack Tower** | [`stack-tower/`](stack-tower/) | Apila bloques con timing perfecto | 1 toque (soltar) | Naranja / rosa |
| 🟩 **Merge 2048** | [`merge-2048/`](merge-2048/) | Une números iguales hasta 2048 | Swipe / flechas | Verde / teal |
| 🪐 **Orbit** | [`orbit/`](orbit/) | Salta de órbita en órbita con gravedad real | 1 toque (soltar) | Espacio / cian-violeta |

Todos comparten la misma base técnica: **HTML5 Canvas + JavaScript puro**
(sin dependencias), con "juice" para enganchar (partículas, screen-shake,
sonido sintetizado, récords guardados) y los mismos hooks de monetización
(intersticial al perder + recompensado para "continuar").

---

## ▶️ Probar cualquiera ahora (navegador)

```bash
# Neon Zigzag
cd neon-zigzag && npx --yes serve www -l 5000

# Stack Tower
cd stack-tower && npx --yes serve www -l 5001

# Merge 2048
cd merge-2048 && npx --yes serve www -l 5002
```

O con Python: `cd <juego>/www && py -m http.server 5000`. Abre la URL en el
navegador. En web los anuncios se muestran **simulados** (recuadro negro) para
probar el flujo sin el SDK nativo.

**Controles**
- Neon Zigzag / Stack Tower: clic / toque / barra espaciadora.
- Merge 2048: desliza con el dedo o usa las flechas / WASD.

---

## 📦 Publicar en las tiendas

Cada juego se empaqueta igual, con [Capacitor](https://capacitorjs.com):

```bash
cd <juego>
npm install
npx cap add android && npx cap sync android && npx cap open android   # Android Studio
# macOS, para iOS:
npx cap add ios && npx cap sync ios && npx cap open ios               # Xcode
```

Los detalles completos (configurar tus IDs reales de **AdMob**, checklist de
Google Play y App Store, ajustes de dificultad) están en el **README de cada
juego**, por ejemplo [`neon-zigzag/README.md`](neon-zigzag/README.md).

---

## 💰 Monetización (resumen)

Todos traen el plugin `@capacitor-community/admob` con los **IDs de prueba de
Google** (seguros mientras desarrollas). Para producción, en `www/ads.js` de
cada juego:

1. Pon tus IDs reales en `CONFIG.prod` (intersticial y recompensado).
2. Cambia `useTestAds` a `false`.
3. Pon tu App ID de AdMob en `capacitor.config.json`.

> ⚠️ Nunca hagas clic en tus propios anuncios reales (AdMob banea por clics
> inválidos). Usa siempre los IDs de prueba en desarrollo.

---

## 📁 Estructura

```
TestGoal/
├─ neon-zigzag/      # Juego 1 (pista zigzag, 1 toque)
│  ├─ www/           # index.html, styles.css, game.js, ads.js, icon.svg
│  ├─ assets/        # icon.svg + icon-1024.png
│  ├─ capacitor.config.json
│  ├─ package.json
│  └─ README.md      # guía de publicación detallada
├─ stack-tower/      # Juego 2 (apilar bloques)
│  ├─ www/
│  ├─ capacitor.config.json
│  └─ package.json
├─ merge-2048/       # Juego 3 (puzzle 2048)
│  ├─ www/
│  ├─ capacitor.config.json
│  └─ package.json
└─ README.md         # este índice
```

Todos probados en navegador headless: cargan sin errores, se juegan, registran
puntuación/récord y disparan el flujo de anuncios. ¡A publicar! 🚀
