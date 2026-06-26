# 🏪 Guía de publicación — App Store + Google Play

Esta guía aplica a los 3 juegos. El **texto exacto para copiar/pegar** de cada
ficha está en `store/` dentro de cada juego:

- [`neon-zigzag/store/`](neon-zigzag/store/)
- [`stack-tower/store/`](stack-tower/store/)
- [`merge-2048/store/`](merge-2048/store/)

Cada carpeta `store/` tiene:
- `app-store.md` — campos de App Store Connect (ES + EN).
- `google-play.md` — campos de Google Play Console (ES + EN).
- `privacy-policy.html` — política de privacidad lista para subir a una web.

---

## 0. Lo que necesitas antes de empezar

| Requisito | Google Play | App Store |
|-----------|-------------|-----------|
| Cuenta de desarrollador | Play Console — **25 USD** pago único | Apple Developer — **99 USD/año** |
| Equipo para compilar | Android Studio (Win/Mac/Linux) | Xcode (**solo macOS**) |
| Binario | **AAB** firmado | **IPA** subido vía Xcode/Transporter |
| Cuenta de anuncios | AdMob (gratis) | AdMob (gratis) |
| Política de privacidad | URL pública obligatoria | URL pública obligatoria |

> La política de privacidad es **obligatoria** porque los juegos usan AdMob
> (identificador de publicidad). Sube el `privacy-policy.html` de cada juego a
> cualquier hosting gratis (GitHub Pages, Netlify, Vercel) y usa esa URL.

---

## 1. Compilar el binario

Desde la carpeta del juego (ver el README de cada uno):

```bash
npm install
npx cap add android && npx cap sync android && npx cap open android   # -> Generate Signed Bundle (AAB)
npx cap add ios && npx cap sync ios && npx cap open ios               # -> Archive -> Distribute (solo Mac)
```

Antes de compilar para producción, en `www/ads.js` pon tus IDs reales de AdMob
y cambia `useTestAds` a `false`.

---

## 2. Recursos gráficos necesarios

| Recurso | Google Play | App Store |
|---------|-------------|-----------|
| Ícono | 512×512 PNG (32-bit) | 1024×1024 PNG (sin alpha) |
| Capturas teléfono | mín. 2 (hasta 8), 16:9 o 9:16 | mín. 3 por tamaño (6.7" y 5.5") |
| Gráfico destacado | 1024×500 PNG (obligatorio) | — |
| Vídeo (opcional) | enlace YouTube | hasta 3 app previews |

Ya tienes el **ícono 1024×1024** en `assets/icon-1024.png` de cada juego (para
Play, reescálalo a 512×512). Para las capturas: abre el juego, juega y haz
capturas en un teléfono o en el navegador con DevTools en modo móvil
(390×844). Recomendado: 1080×1920 px.

> El ícono de Apple **no debe tener transparencia ni esquinas redondeadas**
> (iOS las pone solas). Si tu PNG tiene alpha, pégalo sobre un fondo sólido.

---

## 3. Clasificación de contenido

Todos son aptos para **todos los públicos** (sin violencia, sin contenido
sensible). Respuestas típicas al cuestionario:

- Violencia / sangre / lenguaje / sustancias / sexo: **No** a todo.
- ¿Muestra anuncios? **Sí**.
- ¿Compras dentro de la app? **No** (salvo que agregues "quitar anuncios").
- Edad sugerida: Google **PEGI 3 / Everyone**, Apple **4+**.

### Google Play — "Data safety" (resumen)
- Recopila datos: **Sí** (a través del SDK de anuncios).
- Tipo: identificadores del dispositivo / publicidad (AdMob).
- ¿Se comparten? Sí, con Google AdMob para publicidad.
- Cifrado en tránsito: **Sí**. ¿Se pueden eliminar? indica tu email de contacto.

### Apple — "App Privacy"
- Datos usados para rastreo: **Identificador de publicidad (IDFA)** vía AdMob.
- Debes mostrar el prompt de **App Tracking Transparency** (el plugin ya lo
  pide) y añadir `NSUserTrackingUsageDescription` en `Info.plist`, p. ej.:
  *"Se usa para mostrarte anuncios más relevantes."*

---

## 4. Checklist de envío

**Google Play**
- [ ] App creada en Play Console + ficha (usa `google-play.md`).
- [ ] AAB firmado subido a producción (o pruebas internas primero).
- [ ] Ícono 512, 2+ capturas, gráfico destacado 1024×500.
- [ ] URL de política de privacidad.
- [ ] Cuestionario de contenido + Data safety + público objetivo.
- [ ] Países y precio (Gratis).

**App Store**
- [ ] App creada en App Store Connect + ficha (usa `app-store.md`).
- [ ] Build subido con Xcode y seleccionado en la versión.
- [ ] Ícono 1024, 3+ capturas por tamaño requerido.
- [ ] URL de política de privacidad + App Privacy + texto de ATT.
- [ ] Clasificación de edad + precio (Gratis).
- [ ] Enviar a revisión.

---

## 5. Consejos de ASO (para que te encuentren)

- El **título** es lo que más pesa: incluye 1–2 palabras clave (ya hecho).
- Pon las palabras importantes en los **primeros 1–2 renglones** de la
  descripción (es lo que se ve sin "leer más").
- Pide **valoraciones** dentro del juego tras varias partidas (mejora ranking).
- Publica en **inglés + español** como mínimo (las fichas ya traen ambos).
- Itera el ícono y la primera captura: son los que más mueven la conversión.
