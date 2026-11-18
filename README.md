# 🛒 La compra

Lista de la compra compartida para toda la familia. Funciona en el móvil como una app (se instala desde el navegador) y también sin cobertura dentro del súper.

## Qué hace

- **Lista compartida en tiempo real.** Lo que apunta uno lo ven los demás al momento. Se ordena sola por pasillos del súper.
- **«En el carro».** Al coger algo lo tocas y se tacha. Al salir pulsas *Terminar compra*: lo cogido pasa al historial y lo que no había se queda apuntado.
- **«¿Os falta algo de esto?»** La app aprende cada cuánto compráis cada cosa y os pregunta cuando toca. Con un toque se apunta.
- **Despensa con nivel de consumo.** Estima cuándo se acaba cada producto según cuántos sois en casa.
- **Fechas de caducidad (opcional, cada persona decide).** Al meter un producto en el carro, dices la fecha en voz alta, por ejemplo «20 11 26», y se guarda sola. La despensa ordena los productos por fecha y, al abrir la app, sale un aviso con lo que caduca hoy.
- **Repaso de despensa** antes de ir al súper, dictado de productos, notas, cantidades, urgentes, historial de compras.

---

## 1. Ponerla en marcha en GitHub (10 minutos)

1. Entra en [github.com](https://github.com) e inicia sesión (o crea una cuenta gratis).
2. Pulsa **New repository** (botón verde o el «+» de arriba a la derecha).
   - Nombre: `lista-compra`
   - Marca **Public**.
   - Pulsa **Create repository**.
3. En la página del repositorio vacío, pulsa **uploading an existing file**.
4. Descomprime el ZIP en tu ordenador y **arrastra todo el contenido de la carpeta** (no la carpeta en sí: `index.html`, `app.js`, la carpeta `icons`, etc.). Pulsa **Commit changes**.
5. Ve a **Settings › Pages**. En *Branch* elige `main` y carpeta `/ (root)`. Pulsa **Save**.
6. Espera uno o dos minutos. Tu app estará en:
   `https://TU-USUARIO.github.io/lista-compra/`

Ya funciona, pero en **modo local**: la lista solo se guarda en el móvil donde la abres. Para compartirla con la familia, sigue el paso 2.

## 2. Compartir la lista con la familia (Firebase, gratis)

La sincronización entre móviles usa Firebase, de Google. El plan gratuito sobra para una familia.

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google y pulsa **Crear un proyecto**. Ponle un nombre (por ejemplo `mi-compra`). Puedes desactivar Google Analytics.
2. **Base de datos:** en el menú, *Compilación › Firestore Database › Crear base de datos*.
   - Ubicación: `europe-southwest1 (Madrid)` o la que te quede más cerca.
   - Elige **modo de producción**.
   - Ve a la pestaña **Reglas**, borra lo que haya, pega el contenido del archivo `firestore.rules` de este proyecto y pulsa **Publicar**.
3. **Acceso:** *Compilación › Authentication › Comenzar › Método de acceso* → activa **Anónimo** y guarda.
4. **Dominio autorizado:** en *Authentication › Configuración › Dominios autorizados*, pulsa **Agregar dominio** y escribe `TU-USUARIO.github.io`.
5. **Datos de conexión:** pulsa la rueda ⚙️ › *Configuración del proyecto*. Abajo, en *Tus apps*, pulsa el icono web `</>`, ponle un nombre y pulsa **Registrar app**. Te mostrará un bloque `firebaseConfig = { apiKey: ..., ... }`.
6. En GitHub abre el archivo `config.js`, pulsa el lápiz ✏️ para editarlo y sustituye `firebase: null` por tus datos, así:

   ```js
   window.APP_CONFIG = {
     firebase: {
       apiKey: "AIza...",
       authDomain: "mi-compra.firebaseapp.com",
       projectId: "mi-compra",
       storageBucket: "mi-compra.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abc123"
     }
   };
   ```

   Pulsa **Commit changes**. En un par de minutos la web se actualiza.

> La `apiKey` de Firebase no es una contraseña: es normal que esté en una web pública. Lo que protege vuestra lista son las reglas del paso 2 y el código secreto de tu casa.

## 3. Instalarla en el móvil

- **Android (Chrome):** abre la dirección de tu app, menú ⋮ › **Instalar aplicación** o **Añadir a pantalla de inicio**.
- **iPhone (Safari):** abre la dirección, botón Compartir › **Añadir a pantalla de inicio**.

## 4. Invitar a la familia

La primera vez que abras la app con Firebase configurado, pulsa **Crear la lista de mi casa**. Después ve a **Ajustes ⚙️ › Invitar a la familia** y manda el enlace por WhatsApp. Quien lo abra entra directamente en vuestra lista.

El enlace contiene el código secreto de vuestra casa: **cualquiera que lo tenga puede ver y editar la lista**, así que no lo publiques en abierto.

## 5. Fechas de caducidad por voz

Cada persona lo activa en su móvil en **Ajustes › Controlar fechas de caducidad** (a quien no le interese, no le molesta).

- Al tocar un producto para meterlo en el carro, se abre el micrófono. Di la fecha: «20 11 26», «veinte del once del veintiséis», «20 de noviembre»… También entiende «noviembre 2026» (lo guarda como fin de mes), «mañana» o «hoy».
- Si no hay micrófono o hay mucho ruido, puedes escribirla (`201126` vale) o elegirla en el calendario.
- No pregunta en fruta, limpieza, higiene ni mascotas. En cualquier producto puedes pulsar *No preguntar más por este producto*.
- Al terminar la compra, los productos con fecha pasan a **Despensa › Por fecha de caducidad**. Desde ahí marcas *Ya lo hemos gastado* o *Se ha tirado*.
- Al abrir la app sale un aviso con lo que caduca hoy, lo ya caducado y lo de mañana.

**Compatibilidad de la voz:** funciona mejor en Chrome para Android y en Chrome o Edge de ordenador. En iPhone depende de la versión de iOS y puede no estar disponible con la app instalada en la pantalla de inicio. En ese caso se puede escribir la fecha con el teclado numérico.

---

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño (modo claro y oscuro) |
| `app.js` | Toda la lógica de la app |
| `dateparse.js` | Entiende las fechas dichas o escritas |
| `config.js` | Tus datos de Firebase |
| `sw.js` | Permite abrir la app sin conexión |
| `manifest.webmanifest`, `icons/` | Para instalarla como app |
| `firestore.rules` | Reglas de seguridad para pegar en Firebase |

Si cambias algo del código, sube también el número de `CACHE` en `sw.js` (por ejemplo `la-compra-v1.0.1`) para que los móviles descarguen la versión nueva.
