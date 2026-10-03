# Pruebas del asistente de vendedores

`npm test` incluye las pruebas del componente en un navegador headless mediante Playwright, además de la suite existente y el build de vinext.

En Windows se utiliza Edge o Chrome instalado. En otros entornos instala Chromium de Playwright con `npx playwright install chromium`. También puedes indicar un ejecutable compatible mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Para ejecutar únicamente la interfaz:

```sh
node --experimental-strip-types --import ./tests/ts-resolve.mjs --test tests/vendor-ai-assistant.test.mjs
```

El componente se monta en una página local aislada con los estilos del proyecto. Todas las solicitudes a `/api/ai/sales` se interceptan y las conexiones externas se bloquean; no requiere sesión de vendedor ni realiza llamadas reales a OpenAI. Comprueba envíos, errores, Markdown seguro, copia, reinicio, teclado y tamaños de escritorio, tablet y móvil. Las capturas se guardan en `outputs/vendor-ai/`, ignorado por Git.

## Contexto de la interfaz

El historial existe únicamente en memoria del componente. Cerrar y volver a abrir conserva los mensajes; «Nueva conversación» los limpia y recargar la página también los descarta. Cada POST envía solo `{ message, quoteId: null }`: el backend actual no recibe ni recuerda los mensajes anteriores. La interfaz indica que cada consulta es independiente.
