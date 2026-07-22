---
name: deploy
description: Despliega cambios del proyecto Hospedaje al VPS, a SANDBOX (SB, sandbox.lldmhospedaje.tech) o a PRODUCCIÓN (PROD, lldmhospedaje.tech). Úsala cuando el usuario pida subir, desplegar, publicar o "hacer deploy" de un archivo o cambio a SB/sandbox o a PROD/producción.
---

# Deploy de Hospedaje (SB / PROD)

Este proyecto vive en un único VPS (46.202.88.39) con dos entornos completamente separados. Nunca asumas cuál quiere el usuario si no lo dice explícitamente — "SB"/"sandbox" y "PROD"/"producción" son intercambiables, pero si el mensaje no lo deja claro, pregunta antes de tocar nada.

| | SANDBOX (SB) | PRODUCCIÓN (PROD) |
|---|---|---|
| URL | https://sandbox.lldmhospedaje.tech | https://lldmhospedaje.tech |
| Carpeta en el VPS | `~/hospedaje-sandbox` | `~/hospedaje` |
| Proceso PM2 | `hospedaje-api-sandbox` | `hospedaje-api` |
| Puerto backend | 3001 | 3000 |
| Base de datos | `pwa_templo_sandbox` | `pwa_templo` |
| Script de deploy local | `./deploy-sandbox.sh` | `./deploy.sh` |
| Riesgo | Bajo — es para probar, no le importa a nadie más | Alto — app real en uso durante el evento en curso |

Detalles completos del entorno (credenciales, cómo se montó, diferencias de `.env`) están en la memoria `reference_vps_pwa_templo` — consúltala si necesitas algo que no esté aquí.

## Antes de desplegar (cualquiera de los dos)

1. **Verifica sintaxis** de todo archivo `.js` tocado: `node --check <archivo>`. No hay suite de tests en este proyecto — este chequeo es la única red de seguridad automática antes de subir.
2. **Si tocaste algo en `frontend/`** (html/css/js), bump `CACHE_NAME` en `frontend/service-worker.js` (súmale 1 al número de versión, ej. `v87` → `v88`). Si ya lo bumpeaste en este mismo turno de trabajo, no lo hagas dos veces.
3. **Git**: agrega solo los archivos específicos que tocaste (nunca `git add -A` ni `.`), commitea con un mensaje que explique el porqué, y termina el mensaje con:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```
   Luego `git push origin main`. Ambos entornos jalan del mismo repo/rama — no hay una rama de sandbox separada, el aislamiento lo da la carpeta/proceso/BD distintos en el servidor, no git.

## Desplegar a SANDBOX

Sin fricción, no hace falta confirmar con el usuario — para eso existe el sandbox.

```bash
./deploy-sandbox.sh
```

Internamente hace SSH, `git pull` en `~/hospedaje-sandbox`, `npm install --omit=dev`, `pm2 restart hospedaje-api-sandbox`, y valida con `curl https://sandbox.lldmhospedaje.tech/api/health`.

## Desplegar a PRODUCCIÓN

Confirma con el usuario antes de la primera vez que despliegues a PROD en una sesión, o si el cambio es grande/riesgoso (afecta datos, lógica de negocio, o toca `schema.sql`). Para ajustes pequeños ya confirmados/esperados dentro de la misma sesión de trabajo, no hace falta re-preguntar cada vez — sigue el patrón que ya se haya establecido con el usuario en la conversación.

```bash
./deploy.sh
```

Internamente hace lo mismo que el de sandbox pero contra `~/hospedaje` y `pm2 restart hospedaje-api`, y valida con `curl https://lldmhospedaje.tech/api/health`.

## Si `backend/src/db/schema.sql` cambió

`deploy.sh` / `deploy-sandbox.sh` **NO aplican el esquema automáticamente** — solo hacen `git pull` + restart. Si el diff incluye cambios a `schema.sql`, después del deploy normal hay que aplicarlo a mano contra la base correspondiente (es idempotente, se puede re-correr sin romper nada):

1. Lee la contraseña de sudo de `bAdmin` desde `vps-credentials.json` (raíz del repo, gitignored — **nunca la escribas en un archivo que se vaya a commitear**).
2. Aplica contra la base del entorno que estés desplegando:
   ```bash
   ssh -i ~/.ssh/id_ed25519_pwa_templo bAdmin@46.202.88.39 \
     'echo "<sudo_password>" | sudo -S -u postgres psql -d <pwa_templo|pwa_templo_sandbox> -f /home/bAdmin/<hospedaje|hospedaje-sandbox>/backend/src/db/schema.sql'
   ```
3. Reinicia el proceso PM2 correspondiente otra vez para que la app recoja el esquema nuevo (`pm2 restart hospedaje-api` o `hospedaje-api-sandbox`).

Si el cambio de esquema aplica a ambos entornos (lo normal, ya que comparten código), aplícalo en los dos — no asumas que solo con PROD basta.

## Nota sobre el entry point

El backend arranca con `server.js` (raíz de `backend/`), **no** con `src/app.js` (ese solo exporta el factory de Express, sin `.listen()`). Si algún día hace falta recrear un proceso PM2 desde cero, usar `pm2 start server.js --name <nombre>` — arrancar `src/app.js` deja el proceso "online" en PM2 sin loguear nada ni abrir el puerto (error ya cometido una vez al montar el sandbox).

## Después de desplegar

Reporta al usuario: el health check (`{"status":"ok"}` esperado), el commit/hash desplegado, y a cuál de los dos entornos fue. Si el health check falla, no lo des por hecho ni lo minimices — revisa `pm2 logs <proceso> --lines 30 --nostream` en el VPS antes de reportar éxito.
