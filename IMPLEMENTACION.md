# Implementación de FG TOW

## Backend del asistente de ventas (sin interfaz)

`POST /api/ai/sales` acepta exclusivamente `{ "message": "...", "quoteId": null }`.
`quoteId` puede omitirse o ser un entero positivo / su representación decimal canónica.
El mensaje tiene entre 2 y 4000 caracteres después de trim; el cuerpo se limita a 20,000 bytes,
incluidos envíos sin Content-Length. Se exige application/json, sesión de vendedor y cuenta activa.
Cuando se recibe Origin se compara con el origen de la URL pública del request del Worker;
se rechaza también Sec-Fetch-Site cross-site. No se confía en Host ni X-Forwarded-Host.
Requests sin Origin siguen requiriendo sesión. Verificar esta comparación con los dominios y
previews reales antes de publicar, especialmente si un proxy reescribe la URL del request.

La única integración externa de IA utiliza fetch a Responses API con gpt-6-luna, razonamiento
low, store:false, 1500 tokens máximos de salida y timeout de 30 segundos POR llamada.
No hay reintentos automáticos. Se permiten hasta cuatro rondas de herramientas, ocho llamadas
a herramientas por ronda como límite defensivo y como máximo cinco requests a OpenAI por POST
(el quinto puede terminar con texto o provocar error de límite sin ejecutar más herramientas).
Cada petición es independiente: no hay historial de conversación persistido.

Solo se exponen calculate_trailer_price, get_quote, get_quote_summary, get_trailer_catalog y
get_accessories. Los schemas son strict, sin propiedades adicionales; los opcionales se expresan
con null. El backend valida además estructura y reglas existentes antes de ejecutar el switch.
Se conservan los output items y razonamiento cifrado entre requests stateless, y los resultados
se devuelven como function_call_output con su call_id. Los datos de herramientas nunca se
promueven a instrucciones. No se envían registros completos ni datos fiscales, bancarios, firmas
o URLs de archivos. El modelo puede recibir solamente el mensaje, quoteId y proyecciones
comerciales necesarias; el vendedor debe evitar incluir información sensible en el texto libre.

OPENAI_API_KEY se lee en servidor mediante readEnv; no se imprime ni devuelve. Los errores
upstream se convierten en mensajes fijos y no se registran bodies, prompts o credenciales.
El request id se captura internamente si está disponible y no se envía al navegador.
La respuesta incluye exclusivamente ok, message y usage agregado; los errores usan ok:false
y error:{code,message}. Se responde Cache-Control:no-store.

**Pendiente obligatorio antes de apertura amplia:** rate limit y cuotas de gasto persistentes.
Los límites anteriores no sustituyen un control de frecuencia entre solicitudes. No se ha
añadido un Map en memoria, tablas ni bindings nuevos para simular esa protección.
También deben comprobarse acceso al modelo, binding del secret, permisos reales de Supabase,
tiempos del Worker y evaluaciones de prompt injection e importes en el entorno objetivo.
Las instrucciones del modelo no garantizan por sí solas que reproduzca correctamente todos los
importes: la futura interfaz debe presentar el resultado numérico autorizado del backend.

La prueba real inicial, cuando exista una variable segura configurada manualmente en un
entorno autorizado, debe limitarse a UNA petición sin tools con “Responde únicamente: FG TOW IA OK”.
Nunca extraer el secret de Cloudflare, imprimirlo o guardarlo en código para hacer esa prueba.

## Qué incluye

- Inicio y catálogo adaptables a celular, tableta y computadora.
- Cotizador 2D para food trucks en `/cotizador`.
- Nueve medidas permitidas, desde 1.80 × 2.00 m hasta 2.20 × 6.00 m.
- Biblioteca de planchas, baño María, freidora, quemadores, tarja, mesas, campana, repisas y otros componentes.
- Arrastre, giro y ajuste de medidas dentro del plano.
- Detección de equipos cruzados o fuera de límites.
- Precio aproximado en tiempo real, con IVA opcional.
- Formato formal FG TOW listo para imprimir o guardar como PDF.
- Registro de contactos y configuraciones en Supabase.
- Envío automático de la configuración a `contacto@fgtow.com` mediante Resend.

## Cómo se calculan los precios

Los importes se basan en la hoja interna `PRESUPUESTO DE REMOLQUE.xlsx`, los proyectos 2 × 3, 2.20 × 5 y 2.20 × 6 proporcionados, y la tabla comercial de referencia. El sistema usa un precio base por medida y suma los extras visibles. Los modelos compactos incluyen hasta 2 equipos principales y los demás hasta 5.

La cifra siempre se presenta como **estimación preliminar**. Antes de fabricar se deben validar ingeniería, peso, capacidad, vehículo de arrastre, instalaciones, acabados, impuestos y disponibilidad.

## Supabase

Las tablas necesarias están definidas en:

- `supabase/leads.sql`: formulario general.
- `supabase/quotes.sql`: cotizador 2D.
- `supabase/quotes-vendor-panel.sql`: **pendiente de ejecutar** — agrega la columna `state`
  que faltaba en `quotes` y `leads` (por eso ninguna cotización ni solicitud se estaba
  guardando) y las columnas que usa `/vendedor/clientes` (modelo, versión, quién de ventas
  editó). Corre este archivo una sola vez en Supabase > SQL Editor antes de usar esa sección.

Las políticas RLS permiten que un visitante registre una solicitud, pero no que consulte, modifique o elimine datos de otros clientes. El panel de vendedor (`/vendedor/clientes`) lee y escribe con la Service Role key desde el servidor, protegido por la sesión de vendedor — nunca desde el navegador.

Variables necesarias:

```env
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REEMPLAZA_ESTA_CLAVE
```

No publiques una clave `Secret` o `service_role`. Esta implementación sólo necesita la clave Publishable protegida por RLS.

## Activar el correo a contacto@fgtow.com

El sitio usa la API de Resend porque un Worker de Cloudflare no debe conectarse directamente al SMTP de Zoho.

1. Crea una cuenta en Resend y agrega el dominio `fgtow.com`.
2. Copia en Cloudflare DNS exactamente los registros SPF, DKIM y MX que Resend muestre. Déjalos como **Solo DNS**. No borres ni cambies los registros MX/TXT/DKIM de Zoho; los de Resend utilizan nombres propios como `send` y no reemplazan el correo normal del dominio.
3. Espera a que Resend marque el dominio como **Verified**.
4. Crea una API Key con permiso de envío para ese dominio.
5. En Cloudflare abre el Worker del sitio, entra a **Settings > Variables and Secrets** y agrega:

```env
RESEND_API_KEY=re_TU_CLAVE_PRIVADA
QUOTE_TO_EMAIL=contacto@fgtow.com
QUOTE_FROM_EMAIL=FG TOW Cotizaciones <cotizaciones@fgtow.com>
```

`RESEND_API_KEY` debe guardarse como secreto. No la subas a GitHub. Las otras dos pueden ser variables normales.

Si la clave todavía no está configurada, la cotización se conserva en Supabase con estado `email_pending`; el sitio lo indica al terminar. Después de activar Resend, las nuevas cotizaciones se enviarán automáticamente.

## Panel de vendedor · clientes y cotizaciones

`/vendedor/clientes` (enlazado desde `/vendedor/panel`) muestra todas las cotizaciones que los
clientes mandan desde el sitio público, con búsqueda por nombre, correo o teléfono. Al abrir una
(`/vendedor/clientes/[id]`) se precarga el mismo configurador con plano, datos del cliente y
herramientas de vendedor (aditamento especial) que ya usan `/vendedor/cotizador/*`, con dos
acciones:

- **Guardar cambios** — actualiza esa misma cotización (mismo folio) con los precios recalculados.
- **Guardar como nueva cotización** — crea un folio nuevo enlazado como la siguiente versión de
  esa cotización, sin tocar la original; queda listada junto a las demás versiones del mismo
  cliente en esa misma página.

Ninguna de las dos acciones manda correo — el correo a `contacto@fgtow.com` solo se dispara
cuando el cliente envía su cotización desde `/cotizador/*`.

Cada fila de `/vendedor/clientes` (y la propia página de detalle) tiene un botón **Eliminar** que
pide confirmación antes de borrar la cotización de Supabase de forma permanente.

## Captcha del cotizador público (Cloudflare Turnstile)

`/cotizador/food`, `/cotizador/rzr` y `/cotizador/cargo` pueden mostrar un captcha de
[Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) justo antes del botón
de enviar, para frenar envíos automatizados (bots) al formulario público. El cotizador interno del
vendedor (`/vendedor/cotizador/*`) nunca lo muestra ni lo necesita: una sesión de vendedor ya
autenticada se salta la verificación.

1. En el dashboard de Cloudflare, crea un **Widget** de Turnstile para el dominio `fgtow.com`
   (modo *Managed* es suficiente).
2. Copia el **Site Key** y el **Secret Key** que te da.
3. En el Worker del sitio, agrega estas variables:

```env
TURNSTILE_SITE_KEY=0x...      # pública, no requiere ser secreto
TURNSTILE_SECRET_KEY=0x...    # debe guardarse como secreto
```

Si estas variables no están configuradas, el formulario sigue funcionando exactamente igual que
antes (sin captcha) — el sitio nunca se rompe por faltar esta protección, pero tampoco queda
protegido hasta que se configure.

## Probar localmente

```powershell
cd "C:\Users\roger\OneDrive\Documentos\FGTOW\SITIO WEB\fg-tow-site"
npm install
npm run dev
```

Abre `http://localhost:3000/cotizador`, mueve los equipos, completa los datos y envía una prueba. Después confirma:

1. El registro aparece en **Supabase > Table Editor > quotes**.
2. `email_to` contiene `contacto@fgtow.com`.
3. `email_sent` es `true` cuando Resend está activo.
4. El correo llega con el desglose y el plano SVG adjunto.

Para guardar el formato, usa **Guardar cotización en PDF** y elige **Guardar como PDF** en la ventana de impresión.

## Publicación

Después de cada cambio:

```powershell
git add .
git commit -m "Actualiza el cotizador FG TOW"
git push origin main
```

Cloudflare volverá a construir el sitio desde GitHub. Antes de publicar, valida el proyecto con:

```powershell
npm test
```
