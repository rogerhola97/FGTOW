# Implementación de FG TOW

## Qué incluye

- Inicio y catálogo adaptables a celular, tableta y computadora.
- Cotizador 2D para food trailers en `/cotizador`.
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

En el proyecto actual de FG TOW ya se aplicó la migración de `quotes`. Las políticas RLS permiten que un visitante registre una solicitud, pero no que consulte, modifique o elimine datos de otros clientes.

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
