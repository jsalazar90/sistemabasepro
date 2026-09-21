# 🚀 Guía de Despliegue en Producción - Vercel
## Halley ERP Pro (v1.3.0 - Polaris Core)

Esta guía detalla el procedimiento paso a paso para desplegar **Halley ERP Pro** en la red perimetral de **Vercel** con alta disponibilidad, seguridad HTTP blindada y funciones serverless sin costo de infraestructura fija.

---

## 🏛️ 1. Arquitectura de Despliegue

```
                              [ Cliente Web / Móvil PWA ]
                                           │
                                           ▼ (HTTPS / TLS 1.3)
                              [ Vercel Edge Network ]
                 (Enrutamiento SPA, Caché perimetral, Cabeceras de Seguridad)
                                           │
             ┌─────────────────────────────┴─────────────────────────────┐
             │                                                           │
             ▼                                                           ▼
    [ Frontend Estático ]                                    [ Serverless Functions ]
    - Assets Vite con Hash (1 año caché)                      - /api/health (Estado)
    - PWA Service Worker (Auto-update)                       - /api/bcv (Tasa oficial BCV)
    - Reescritura /:path -> index.html                        - Edge Cache (10 min)
             │                                                           │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
                                [ Supabase Cloud ]
                      - Base de datos PostgreSQL Multi-tenant
                      - Aislamiento de datos con Row Level Security (RLS)
                      - Transacciones Atómicas (RPC con FOR UPDATE)
                      - Pista de Auditoría en Tiempo Real
```

---

## 🛠️ 2. Opciones de Despliegue

### Opción A: Despliegue Automatizado con GitHub (Recomendado)
*Cada vez que hagas un `git push` a tu repositorio, Vercel compila y despliega automáticamente la nueva versión.*

1. **Sube tu proyecto a GitHub**:
   - Crea un repositorio privado en [GitHub](https://github.com/new) (ejemplo: `halley-erp-pro`).
   - Sube los archivos del proyecto.
2. **Importa el proyecto en Vercel**:
   - Inicia sesión en [Vercel](https://vercel.com).
   - Haz clic en **"Add New..."** ➔ **"Project"**.
   - Conecta tu cuenta de GitHub y selecciona el repositorio `halley-erp-pro`.
3. **Configura el Proyecto**:
   - **Framework Preset**: `Vite` (Vercel lo detectará automáticamente).
   - **Root Directory**: `./` (directorio raíz).
   - **Build Command**: `vite build` (o déjalo por defecto; `vercel.json` ya lo especifica).
   - **Output Directory**: `dist`.
4. **Agrega las Variables de Entorno** (ver Sección 3).
5. **Haz clic en "Deploy"**. ¡Listo! En menos de 60 segundos tu ERP estará en línea.

---

### Opción B: Despliegue Directo vía Vercel CLI (Sin Git)
*Ideal para desplegar inmediatamente desde tu terminal local.*

1. Abre tu terminal de PowerShell en la carpeta del proyecto:
   ```powershell
   npx vercel
   ```
2. Sigue las instrucciones interactivas:
   - *Set up and deploy?* ➔ `Y`
   - *Which scope?* ➔ Tu cuenta personal o de equipo.
   - *Link to existing project?* ➔ `N`
   - *What’s your project’s name?* ➔ `halley-erp-pro`
   - *In which directory is your code located?* ➔ `./`
3. Para compilar y desplegar directamente a producción:
   ```powershell
   npx vercel --prod
   ```

---

## 🔑 3. Configuración de Variables de Entorno

En el panel de control de Vercel:
Ve a **Settings** ➔ **Environment Variables** y agrega las siguientes variables para todos los entornos (**Production**, **Preview**, **Development**):

| Nombre de la Variable | Valor | Descripción |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://smmmascbafyposncncga.supabase.co` | URL de tu instancia de Supabase |
| `VITE_SUPABASE_ANON_KEY` | *(Tu Anon Public Key de Supabase)* | Token público para clientes web con RLS |

> [!TIP]
> Puedes copiar estos valores directamente desde tu archivo local `.env` o desde [`.env.example`](file:///.env.example).

---

## 🌐 4. Configuración de Dominio Personalizado

Para utilizar un dominio propio (por ejemplo, `erp.tuempresa.com` o `halleyerp.com`):

1. En el Dashboard del proyecto en Vercel, ve a **Settings** ➔ **Domains**.
2. Escribe tu dominio o subdominio (ej: `erp.miempresa.com`) y haz clic en **Add**.
3. Vercel te indicará los registros DNS que debes agregar en tu proveedor de dominio (GoDaddy, Namecheap, Cloudflare, etc.):
   - **Para un Subdominio (`erp.miempresa.com`)**:
     - Tipo: `CNAME`
     - Nombre / Host: `erp`
     - Valor / Destino: `cname.vercel-dns.com`
   - **Para un Dominio Raíz (`miempresa.com`)**:
     - Tipo: `A`
     - Nombre / Host: `@`
     - Valor: `76.76.21.21`
4. Vercel generará y renovará un certificado SSL/TLS de **Let's Encrypt de forma 100% gratuita y automática**.

---

## 🛡️ 5. Blindaje y Optimización Incluidos en `vercel.json`

El archivo [`vercel.json`](file:///vercel.json) ya configurado en el proyecto incluye:

1. **Cabeceras de Seguridad Perimetral**:
   - `Strict-Transport-Security`: Obliga a los navegadores a conectarse solo mediante HTTPS seguro por 2 años.
   - `X-Frame-Options: SAMEORIGIN`: Previene que el sistema sea incrustado en iframes de terceros (protección contra clickjacking).
   - `X-Content-Type-Options: nosniff`: Evita ejecución maliciosa de tipos MIME.
   - `Permissions-Policy`: Bloquea accesos no solicitados a cámaras, micrófonos o geolocalización.
2. **Caché Inteligente de Alta Velocidad**:
   - Todos los archivos en `/assets/` se sirven desde la CDN global con `max-age=31536000, immutable`.
   - Los archivos de control PWA (`sw.js`, `manifest.webmanifest`, `index.html`) tienen `max-age=0, must-revalidate` para que los usuarios reciban actualizaciones de código instantáneamente.
3. **Soporte Serverless Nativo**:
   - `/api/health`: Monitor de salud del backend serverless.
   - `/api/bcv`: Consulta automática de la tasa oficial del Banco Central de Venezuela con caché edge de 10 minutos y fallback a API espejo.
4. **Reescritura Limpia SPA**:
   - Todas las rutas (`/invoicing`, `/accounting`, `/contacts`, etc.) se reescriben a `/index.html` sin que el navegador reciba errores 404 al refrescar la página.

---

## ✅ 6. Checklist de Verificación en Producción

Una vez completado el despliegue:

- [ ] **Acceso Web Seguro**: Abrir la URL de Vercel (`https://halley-erp-pro.vercel.app`) y verificar que el candado SSL esté activo.
- [ ] **API de Salud**: Visitar `https://halley-erp-pro.vercel.app/api/health` ➔ Debe retornar `{"status":"ok", "version":"1.3.0", "platform":"Vercel Serverless"}`.
- [ ] **Tasa Oficial BCV**: Visitar `https://halley-erp-pro.vercel.app/api/bcv` ➔ Debe responder con la tasa oficial y fecha en formato JSON.
- [ ] **Inicio de Sesión**: Ingresar con `jhoansg@gmail.com` y comprobar que Supabase Auth valida la sesión correctamente.
- [ ] **Instalación PWA**: Probar el botón de instalación PWA en el navegador para verificar la experiencia de escritorio/móvil nativa.
