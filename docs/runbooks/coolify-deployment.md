# Reconcile en Coolify

Configuración de despliegue del MVP existente: web, API y worker separados, PostgreSQL, Redis y almacenamiento S3 privado. Reutiliza el Dockerfile actual. No cambia React, los casos de uso, las reglas financieras ni las migraciones existentes. La preparación y su verificación no acreditan que el servidor del usuario ya esté desplegado.

## Pantalla Build pipeline

Conectar `https://github.com/juanmpnz/reconcile`, rama `main`. En General → Build pipeline:

| Campo                                 | Valor                                   |
| ------------------------------------- | --------------------------------------- |
| Build strategy                        | Compose                                 |
| Base directory                        | `/`                                     |
| Docker compose location               | `/infra/docker/compose.production.yaml` |
| Preserve repository during deployment | Desmarcado                              |
| Custom build command                  | Vacío, valor predeterminado             |
| Custom start command                  | Vacío, valor predeterminado             |

Guardar y cargar de nuevo la definición desde Git. El editor Docker compose content debe mostrar los servicios; no pegar allí el Compose de desarrollo. No habilitar Raw Compose ni conectar a una red predefinida para este stack autocontenido.

## Variables

Coolify genera y conserva las credenciales referenciadas mediante `SERVICE_*`. Mantener sus valores al editar las variables: reemplazar todo el contenido de Developer view puede eliminar entradas existentes. No regenerar contraseñas de una base con datos ni el secreto de sesiones durante un despliegue rutinario.

Completar los valores de aplicación y correo en Environment Variables. Los nombres definitivos y valores obligatorios se obtienen del Compose cargado. `APP_URL` es el origen HTTPS público, sin barra final, ruta ni puerto interno; el manifest lo comparte entre `AUTH_BASE_URL` y `WEB_ORIGIN`.

```dotenv
APP_URL=https://tu-dominio-publico
SMTP_HOST=HOST_DE_TU_PROVEEDOR
SMTP_USER=USUARIO_SMTP
SMTP_PASSWORD=PASSWORD_SMTP
MAIL_FROM=REMITENTE_VERIFICADO
```

El despliegue usa SMTP autenticado con TLS directo en el puerto 465. Hace falta un proveedor real y un remitente autorizado; Mailpit y el modo capture son solo para desarrollo/pruebas. No compartir contraseñas en el chat ni incluirlas en Git. Las conexiones internas a base, Redis y S3 las configura el manifest; no usar localhost ni copiar las credenciales locales. Los secretos son de ejecución, no variables VITE ni argumentos de build.

## Dominio

En Domains, asignar el dominio únicamente a `web`, puerto interno **8080**. Si Coolify pide una URL con puerto, introducir `https://tu-dominio-publico:8080`: ese sufijo selecciona el puerto del contenedor; el navegador seguirá usando HTTPS normal. `APP_URL` conserva `https://tu-dominio-publico`, sin `:8080`.

API, worker, PostgreSQL, Redis y storage no reciben dominio público ni puertos publicados. La web reenvía `/api` al servicio interno `api:3000`.

## Despliegue y comprobación

Desplegar y revisar los logs. La API aplica `prisma migrate deploy` antes de escuchar; un fallo detiene su arranque. Worker y web esperan que esté preparada. PostgreSQL, Redis y archivos persisten en volúmenes; un redeploy no es una restauración ni un backup. No borrar los volúmenes para corregir un fallo de conexión.

Comprobar el certificado HTTPS, registro, llegada real del correo de verificación, login y organizaciones. Después probar los cuatro PDFs demo: carga, extracción, comparación, revisión y reclamo. Verificar que los originales siguen privados y que un reinicio conserva documentos, decisiones e historial. Una compilación o un healthcheck no reemplaza este recorrido.

Antes de usar documentos reales quedan pendientes los controles del plan: backups cifrados fuera del servidor, restauración comprobada, monitorización y alertas, capacidad del host y validación de acceso/retención. Esta guía no presenta un servidor único como alta disponibilidad.

Fuentes oficiales consultadas: [Docker Compose en Coolify](https://coolify.io/docs/applications/builds/docker-compose) y [variables de entorno](https://coolify.io/docs/applications/configuration/environment-variables).
