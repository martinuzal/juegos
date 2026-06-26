# 📲 Configurar AdMob (los 3 juegos)

> **Importante:** las apps y los bloques de anuncios de AdMob solo puedes
> crearlos tú desde [admob.google.com](https://admob.google.com) con tu cuenta
> de Google (requiere tu login y verificación). No existe una forma de que un
> tercero los genere por ti. Lo bueno: el código ya está listo y solo tienes que
> **pegar 9 IDs** siguiendo la tabla de abajo. Tardas ~10 min.

Cada juego necesita en AdMob:
- **1 App** (Android) y, si publicas en iOS, **1 App** (iOS) → cada una da un **App ID** (`ca-app-pub-XXXX~XXXX`, con `~`).
- **2 bloques de anuncios** por plataforma: **Intersticial** y **Recompensado** → cada uno da un **Ad Unit ID** (`ca-app-pub-XXXX/XXXX`, con `/`).

---

## Paso a paso (repite para cada juego)

1. Entra en [AdMob](https://admob.google.com) → **Apps** → **Agregar app**.
2. ¿Está publicada? **No** (aún). Plataforma: **Android**. Nombre: p. ej. "Neon Zigzag".
   - Te genera el **App ID** de Android. Cópialo.
3. Dentro de la app → **Bloques de anuncios** → **Agregar bloque**:
   - Tipo **Intersticial** → nombre "Interstitial" → copia su **Ad Unit ID**.
   - Tipo **Recompensado** → nombre "Rewarded" → copia su **Ad Unit ID**.
4. (Opcional iOS) Repite "Agregar app" eligiendo **iOS** y crea sus 2 bloques.
5. Pega los IDs en la tabla y luego en el código (siguiente sección).

> Mientras tu cuenta/app está en revisión, **deja `useTestAds: true`** en
> `ads.js`. Así muestras los anuncios de prueba oficiales de Google sin riesgo de
> baneo. Cuando todo esté aprobado, pon tus IDs y cambia a `false`.

---

## Tabla para rellenar

Anota aquí tus IDs reales y luego cópialos al código:

### Neon Zigzag  (`neon-zigzag/`)
| Dato | Android | iOS |
|------|---------|-----|
| App ID (`~`) | `ca-app-pub-________~________` | `ca-app-pub-________~________` |
| Intersticial (`/`) | `ca-app-pub-________/________` | `ca-app-pub-________/________` |
| Recompensado (`/`) | `ca-app-pub-________/________` | `ca-app-pub-________/________` |

### Stack Tower  (`stack-tower/`)
| Dato | Android | iOS |
|------|---------|-----|
| App ID (`~`) | `ca-app-pub-________~________` | `ca-app-pub-________~________` |
| Intersticial (`/`) | `ca-app-pub-________/________` | `ca-app-pub-________/________` |
| Recompensado (`/`) | `ca-app-pub-________/________` | `ca-app-pub-________/________` |

### Merge 2048  (`merge-2048/`)
| Dato | Android | iOS |
|------|---------|-----|
| App ID (`~`) | `ca-app-pub-________~________` | `ca-app-pub-________~________` |
| Intersticial (`/`) | `ca-app-pub-________/________` | `ca-app-pub-________/________` |
| Recompensado (`/`) | `ca-app-pub-________/________` | `ca-app-pub-________/________` |

---

## Dónde se pegan (por cada juego)

### 1) `www/ads.js` → objeto `CONFIG`
```js
var CONFIG = {
  useTestAds: false,                       // <-- cambia a false para producción
  appId: {
    android: 'TU_APP_ID_ANDROID',          // el de ~  (Neon Zigzag Android)
    ios:     'TU_APP_ID_IOS'
  },
  prod: {
    interstitial: { android: 'TU_INTERSTICIAL_ANDROID', ios: 'TU_INTERSTICIAL_IOS' },
    rewarded:     { android: 'TU_REWARDED_ANDROID',     ios: 'TU_REWARDED_IOS' }
  }
};
```

### 2) `capacitor.config.json` → `plugins.AdMob.appId`
```json
"AdMob": {
  "appId": {
    "android": "TU_APP_ID_ANDROID",
    "ios": "TU_APP_ID_IOS"
  }
}
```

### 3) Android — `AndroidManifest.xml`
El plugin suele inyectarlo, pero verifica que exista dentro de `<application>`:
```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="TU_APP_ID_ANDROID"/>
```

### 4) iOS — `Info.plist`
```xml
<key>GADApplicationIdentifier</key>
<string>TU_APP_ID_IOS</string>
<key>NSUserTrackingUsageDescription</key>
<string>Se usa para mostrarte anuncios más relevantes.</string>
```

---

## Checklist final antes de publicar
- [ ] 9 IDs reales pegados en cada `ads.js` (`CONFIG.prod` + `CONFIG.appId`).
- [ ] `useTestAds: false` en los 3 juegos.
- [ ] App ID en `capacitor.config.json` + Manifest/Info.plist.
- [ ] `npx cap sync` tras los cambios.
- [ ] Probar en un dispositivo real que los anuncios cargan.
- [ ] En AdMob, vincular cada app con su ficha de Play/App Store cuando esté publicada (mejora el llenado de anuncios).

> ⚠️ Nunca toques tus propios anuncios reales (AdMob banea por "clics
> inválidos"). Para probar, usa siempre los IDs de prueba (`useTestAds: true`).
