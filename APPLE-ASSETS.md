# 🍎 Imágenes para App Store (los 4 juegos)

Generadas en `<juego>/assets/store/apple/` de cada juego.

## Qué pide Apple y qué archivo subir

| Recurso | Requisito Apple | Archivo |
|---------|-----------------|---------|
| **Ícono de la app** | **1024 × 1024** PNG, **sin transparencia y sin esquinas redondeadas** (Apple las redondea) | `apple/icon-1024.png` |
| **Capturas iPhone 6.7"/6.9"** (obligatorias) | **1290 × 2796** PNG | `apple/iphone-1.png`, `-2`, `-3` |
| **Capturas iPad 12.9"** (si soportas iPad) | **2048 × 2732** PNG | `apple/ipad-1.png`, `-2`, `-3` |

> El ícono de Apple es **distinto** al de Play: Play usa 512×512 (con alfa OK);
> Apple exige 1024×1024 **opaco y cuadrado**. Por eso `apple/icon-1024.png` es una
> versión sin bordes redondeados ni transparencia.

## Notas
- Las capturas son gameplay real con subtítulo, a las dimensiones **exactas** que
  Apple valida (rechaza otras medidas).
- En App Store Connect subís un set de **6.7"/6.9"** (iPhone) y, si la app corre en
  iPad, un set de **12.9"**. Los tamaños menores Apple los puede derivar.
- **Capabilities**: este tipo de juego **no necesita ninguna** capability especial
  en Xcode. AdMob solo requiere claves en `Info.plist` (GADApplicationIdentifier,
  NSUserTrackingUsageDescription, SKAdNetworkItems), no una capability.

## Rutas
```
neon-zigzag/assets/store/apple/   icon-1024.png · iphone-1..3.png · ipad-1..3.png
stack-tower/assets/store/apple/   icon-1024.png · iphone-1..3.png · ipad-1..3.png
merge-2048/assets/store/apple/    icon-1024.png · iphone-1..3.png · ipad-1..3.png
orbit/assets/store/apple/         icon-1024.png · iphone-1..3.png · ipad-1..3.png
```
