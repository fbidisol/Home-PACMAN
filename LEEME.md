# IDISOL · El último bocado — versión 1.2

Juego de veinte segundos con el logo original. La O devora las letras y después el reloj para revelar el siguiente color.

## Cambios de esta versión

- Se eliminaron todos los textos visibles del pie en todos los estados. Las instrucciones accesibles permanecen disponibles para lectores de pantalla.
- El reloj ahora usa dígitos de siete segmentos, sin trama de puntos. Ocupa una caja fija de 94 × 80 unidades y está colocado en (1274, 300), cerca de la L y alineado con la parte superior del logo. Su altura equivale aproximadamente al 40% de la O.
- El hover usa velocidad suavizada y arrastre sin la onda oscilatoria anterior. La estela utiliza exclusivamente el tercer color del frame, con opacidad máxima del 40%. Los dispositivos sin WebGL conservan el juego mediante Canvas 2D; el efecto de shader se omite.
- El audio usa un único reproductor persistente en el documento y archivos MP3 HTTP del mismo sitio. El mismo gesto de inicio desbloquea una vía de recuperación mediante Web Audio. Si la reproducción nativa se rechaza o se detiene, puede recuperarse sin detener el juego.
- El contador sigue siendo independiente del audio: una restricción de reproducción no bloquea el control táctil.

## Jugar

Haz clic, o toca y suelta la O. Mueve el mouse o arrastra el dedo para comer I, D, I, S y L. Cuando no quedan letras, come el reloj antes de cero. También puedes enfocar el inicio con Tab, pulsar Enter y usar las flechas o WASD.

Si ganas, los segmentos del reloj se absorben y una expansión de 2,15 segundos revela el siguiente frame completo. Si pierdes, se reconstruye el logo del mismo color y puedes reintentar. Escape cancela. Al ocultar la pestaña, juego y sonido se pausan; pulsa Continuar al volver.

El botón superior activa o silencia el sonido. Si el navegador impide reproducirlo, muestra «Activar sonido». No hay mensajes visibles en el pie.

## Wix

**Opción URL:** aloja la carpeta `web/` del paquete en un sitio HTTPS público y usa «Incrustar un sitio» en Wix. `index.html` y la carpeta `audio/` deben conservar su estructura. También puedes usar la URL pública del juego si su configuración permite incrustación.

**Opción HTML:** copia el contenido completo de `IDISOL_Wix.html` a un elemento «Incrustar HTML» de Wix. Esa versión usa los MP3 públicos del juego como vía principal e incluye los audios codificados para la recuperación mediante Web Audio. No requiere archivos de imagen externos ni bibliotecas CDN.

La referencia de escritorio sigue siendo 1900 × 800 px. El juego ocupa el 100% del contenedor. Revisa el alto del elemento en el diseño móvil; 420 px es un punto de partida útil.

El sonido se activa por interacción del visitante. Debe probarse en la página publicada de Wix, además de su editor.

## Recursos y colores

| Fondo | Logo | Reloj y estela | Música |
|---|---|---|---|
| Blanco | Rojo | Negro | V3 |
| Rojo | Negro | Blanco | V4 |
| Negro | Blanco | Rojo | V5 |

El rojo original es #ED4133. Las pistas se ajustaron conservando el tono y se verificaron decodificadas a 20,000 segundos. Los contornos de letras y O proceden del PNG original. El reloj muestra 01–20 y 00 al perder.

## Código

- `engine.mjs`: reglas, colisiones y estados.
- `app.mjs`: dibujo, controles y shader.
- `visuals.mjs`: geometría de siete segmentos y suavizado del hover.
- `audio.mjs`: reproductor persistente, activación por gesto y recuperación.
- `shell.html`: estructura y estilos.
- `art.json`: contornos, puntos de colisión y audios de respaldo.
- `audio/`: las tres pistas MP3 de veinte segundos.
- `build.py`: genera la versión web y el HTML para Wix, usando Python 3 estándar.

Ejecuta `python3 build.py` desde `codigo/` para generar `dist/`.

Pruebas: `node --test engine.test.mjs runtime.test.mjs touch.test.mjs visuals.test.mjs audio.test.mjs`.

## Verificación y límites

Dieciséis pruebas comprueban las reglas, el ciclo de colores, la recuperación de audio, los controles táctiles, la pausa, los números y el suavizado del hover. Los adaptadores de DOM/media simulan bloqueos y no sustituyen un iPhone real.

En el navegador de prueba se comprobó la interfaz sin footer, la nueva proporción del contador y el MP3 cargado, reproduciéndose y avanzando hasta veinte segundos. WebGL no estaba disponible en ese navegador; el shader se revisó en código y su suavizado se comprobó mediante pruebas. Falta confirmar el sonido y el hover en el dispositivo y navegador del usuario.
