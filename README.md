# Protek

**Protek es el sistema operativo AI-native para hacer más rentables a los talleres y empresas de reparación.** Este repositorio reúne la experiencia comercial, la aplicación de escritorio, la documentación de producto y una demo pública estática para las primeras conversaciones de venta.

## Contenido

- Landing comercial con flujos de taller, campo y refaccionamiento.
- Aplicación en `/app`, con Ventas como primer módulo funcional de referencia.
- Página `/product` que explica los trabajos que permite resolver cada módulo y sus integraciones.
- Demo pública estática en `out/`, pensada para navegar el producto antes de conectar un entorno productivo.
- [Plan de desarrollo de producto](docs/PRODUCT_DEVELOPMENT_PLAN.md), sistema de diseño y fundamento de datos multiempresa.

## Aplicación y Ventas

La implementación activa vive en `/app`. Incluye el submenú de Ventas (Resumen, Ofertas, Tablero y Clientes), cambio de empresa desde el selector debajo del logo y una alta de oferta integrada en la vista. La empresa activa delimita las lecturas y escrituras de Supabase. La ruta histórica `/sales` redirige a `/app` para conservar enlaces existentes.

La migración local de la base de datos está en `supabase/migrations/20260918014800_create_sales_foundation.sql`. Modela miembros multiempresa, permisos por módulo y nivel (`read`, `write`, `admin`) y los objetos comerciales con `organization_id`. Consulta `docs/SALES_MODULE.md` para la operación y despliegue de esta primera base.

`app.html` conserva el mockup de escritorio de referencia. Las reglas de implementación de interfaz se encuentran en `DESIGN_SYSTEM.md`. La secuencia para convertir los módulos de la demo en flujos de producción está en [PRODUCT_DEVELOPMENT_PLAN.md](docs/PRODUCT_DEVELOPMENT_PLAN.md).

## Ejecutar localmente

Instala dependencias y ejecuta la aplicación:

```bash
npm install
npm run dev -- --port 3001
```

Después visita `http://localhost:3001/app` y `http://localhost:3001/product`. La landing estática puede abrirse directamente desde `index.html`.

## Estructura

```text
protek-page/
├── assets/
│   └── protek-industrial-hero.png
├── src/
│   ├── app/
│   │   ├── app/
│   │   └── product/
│   └── features/sales/
├── supabase/migrations/
├── out/
│   ├── app/
│   └── product/
├── app.html
├── app.css
├── app.js
├── design-system.html
├── design-system.css
├── DESIGN_SYSTEM.md
├── index.html
├── script.js
└── styles.css
```

## App funcional en Sites

La ruta pública /app es una aplicación funcional de Ventas conectada a Supabase. Incluye registro e inicio de sesión separados, ambos solo con correo y código OTP, onboarding de empresa, permisos de propietario, clientes editables, ofertas persistentes y un tablero comercial que actualiza etapa, estatus e historial.

El primer usuario que entra crea su empresa. Ese registro inicializa su pipeline comercial y los permisos de propietario para los módulos.

### Configuración requerida para OTP

En Supabase Auth, configura **Magic Link** y **Confirm signup** para que ambos incluyan exactamente `{{ .Token }}`. Magic Link se usa al iniciar sesión y Confirm signup al crear una cuenta. El flujo de inicio de sesión usa `shouldCreateUser: false`; solo Crear cuenta permite el alta. La verificación usa `verifyOtp` con `type: "email"`.

La duración del OTP está configurada en 3600 segundos y su longitud en 6 dígitos, igual que el campo de la app. El Site URL de Auth debe ser la URL pública `/app/`; los enlaces de confirmación no deben apuntar a localhost. Si se cambia la longitud o la URL en Supabase, actualizar también la interfaz y verificar ambos correos con un código nuevo. Los códigos anteriores quedan invalidados al solicitar otro.

Para uso comercial, configura también un SMTP propio, el dominio remitente y los límites de entrega del proyecto.

## Despliegue

La aplicación conectada se despliega en Vercel y usa las variables de entorno de Supabase indicadas en `.env.example`. Las migraciones se aplican desde un entorno administrativo de Supabase; las claves de aplicación no administran el esquema.

La carpeta out/ contiene la landing y la aplicación estática servida por Sites. La ruta /app usa directamente la clave publicable de Supabase y RLS para persistir información de Ventas; no contiene claves secretas. Las migraciones de supabase/migrations/ deben aplicarse antes de habilitar nuevos entornos.

## Notas

Las tipografías y los iconos de la landing estática se cargan desde Google Fonts y Lucide mediante CDN. Antes de usar el formulario de la landing en producción, conéctalo al CRM, proveedor de formularios o API que gestione los leads.
