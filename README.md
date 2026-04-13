# API Proxy Debugger

Proxy HTTP transparente con logging detallado. Recibe requests, las loguea, las reenvía a la API destino (conservando autenticación y todos los headers), loguea la respuesta y la devuelve al origen. Cada request recibe un `request_id` UUID único que aparece en todos los logs y en el header `x-request-id` de la respuesta.

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y edítalo:

```bash
cp .env.example .env
```

| Variable              | Obligatoria | Default | Descripción                                   |
|-----------------------|-------------|---------|-----------------------------------------------|
| `TARGET_URL`          | Sí          | —       | URL base de la API destino                    |
| `PORT`                | No          | `3000`  | Puerto en el que escucha el proxy             |
| `REQUEST_TIMEOUT_MS`  | No          | `30000` | Timeout en ms para requests al destino        |

## Uso

```bash
npm start
```

Con auto-restart en cambios (Node.js >= 18):

```bash
npm run dev
```

## Qué se loguea

Cada evento tiene el mismo `request_id` para poder cruzar logs:

| Evento      | Color        | Descripción                                                  |
|-------------|--------------|--------------------------------------------------------------|
| `[REQ] →`   | Azul         | Request entrante: método, path, headers, body                |
| `[RES] ←`   | Verde        | Respuesta del destino: status, headers, body, tiempo         |
| `TIMEOUT`   | Rojo (bgRed) | El destino no respondió en `REQUEST_TIMEOUT_MS` → `504`      |
| `NET ERROR` | Amarillo     | Error de red (ECONNREFUSED, ENOTFOUND, etc.) → `502`         |

## Comportamiento del proxy

- Reenvía todos los métodos HTTP (GET, POST, PUT, PATCH, DELETE, OPTIONS…)
- El header `Authorization` se reenvía sin modificar al destino
- Se añade `x-request-id` a la request forward y a la respuesta al origen
- Errores 4xx/5xx del destino se reenvían tal cual (el proxy no los enmascara)
- El body se trunca en consola a 4000 chars para no saturar; la request/respuesta real no se modifica
