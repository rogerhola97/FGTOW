# Implementación de FG TOW

## Qué incluye

- Inicio comercial adaptable a celular, tableta y computadora.
- Catálogo de siete configuraciones con precios de referencia.
- Formulario de cotización con validación, consentimiento y campo antispam.
- Almacenamiento duradero de prospectos en Cloudflare D1.
- Metadatos para buscadores y tarjeta social.

## Datos guardados

Cada solicitud conserva fecha, nombre, teléfono, correo, ciudad, tipo de proyecto, presupuesto, mensaje, consentimiento, origen y estado. No existe un panel público para consultar prospectos; la base sólo queda accesible desde la cuenta administradora del proyecto.

## Publicación

El proyecto está preparado para Sites/Cloudflare. La configuración de `.openai/hosting.json` solicita una base D1 con el nombre lógico `DB`; la migración en `drizzle/` crea la tabla `leads` al desplegar.

Para trabajar localmente:

1. Instalar dependencias con `npm install`.
2. Generar migraciones con `npm run db:generate` cuando cambie `db/schema.ts`.
3. Revisar con `npm run dev`.
4. Validar con `npm test`.

## Antes de abrir al público

Reemplazar o agregar datos oficiales de teléfono/WhatsApp/correo; validar precios y capacidades con costos e ingeniería; definir garantías, documentación, tiempos y políticas de pago; conectar notificaciones por correo o CRM si se desea respuesta inmediata. El formulario ya almacena solicitudes aunque no se integre un proveedor de correo.

## Siguiente fase recomendada

- Panel privado para revisar y actualizar prospectos.
- Notificación automática a correo/WhatsApp del vendedor.
- Fotografías reales de los primeros modelos y casos de entrega.
- Fichas descargables por modelo.
- Analítica de campañas y origen de prospectos.
