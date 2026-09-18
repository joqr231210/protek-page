# Protek Page

Landing page estática para **Protek**, el sistema AI-native para talleres y empresas de reparación. La página presenta el producto, sus flujos operativos, el Agente IA y el Protek Quality Engine.

También incluye la primera implementación Next.js del módulo de Ventas, un mockup estático de referencia y el sistema de diseño inicial para la aplicación.

## Contenido

- Propuesta de valor y llamada a solicitar una demo.
- Flujos para taller, servicios en campo y refacciones.
- Módulos de Órdenes, Recursos, Almacén, Compras, Ventas, Planeación, Calidad, Ingeniería y Agente IA.
- Protek Quality Engine con ejemplo de pruebas técnicas y análisis semántico, matemático y visual.
- Formulario de demo de interfaz. Aún no está conectado a un CRM o endpoint de captura.
- Mockup navegable del módulo de Ventas: ofertas, Tablero por etapas y resumen comercial.
- Sistema de diseño visual y documentación de sus fundamentos y patrones.

## App de Ventas

La implementación activa vive en `/sales`. Incluye el submenú de Ventas (Ofertas, Tablero y Resumen), cambio de empresa desde el selector debajo del logo y una alta de oferta integrada en la vista. La empresa activa delimita las lecturas y escrituras de Supabase.

La migración local de la base de datos está en `supabase/migrations/20260918014800_create_sales_foundation.sql`. Modela miembros multiempresa, permisos por módulo y nivel (`read`, `write`, `admin`) y los objetos comerciales con `organization_id`. Consulta `docs/SALES_MODULE.md` para la operación y despliegue de esta primera base.

`app.html` conserva el mockup de escritorio de referencia. Para inspeccionar el sistema de diseño visual, abre `design-system.html`. Las reglas de implementación se encuentran en `DESIGN_SYSTEM.md`.

## Ejecutar localmente

Instala dependencias y ejecuta la aplicación:

```bash
npm install
npm run dev -- --port 3001
```

Después visita `http://localhost:3001/sales`. La landing estática puede abrirse directamente desde `index.html`.

## Estructura

```text
protek-page/
├── assets/
│   └── protek-industrial-hero.png
├── src/
│   ├── app/
│   └── features/sales/
├── supabase/migrations/
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

## Despliegue

Despliega la aplicación Next.js en Vercel y configura las variables de entorno de Supabase indicadas en `.env.example`. Las migraciones se aplican desde un entorno administrativo de Supabase; las claves de aplicación no administran el esquema.

## Notas

Las tipografías y los iconos de la landing estática se cargan desde Google Fonts y Lucide mediante CDN. Antes de usar el formulario de la landing en producción, conéctalo al CRM, proveedor de formularios o API que gestione los leads.
