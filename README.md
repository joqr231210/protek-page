# Protek Page

Landing page estática para **Protek**, el sistema AI-native para talleres y empresas de reparación. La página presenta el producto, sus flujos operativos, el Agente IA y el Protek Quality Engine.

También incluye un mockup de escritorio para el módulo de Ventas y un sistema de diseño inicial para la aplicación.

## Contenido

- Propuesta de valor y llamada a solicitar una demo.
- Flujos para taller, servicios en campo y refacciones.
- Módulos de Órdenes, Técnicos, Almacén, Compras, Ventas, Calidad, Ingeniería y Agente IA.
- Protek Quality Engine con ejemplo de pruebas técnicas y análisis semántico, matemático y visual.
- Formulario de demo de interfaz. Aún no está conectado a un CRM o endpoint de captura.
- Mockup navegable del módulo de Ventas: ofertas, CRM por etapas y resumen comercial.
- Sistema de diseño visual y documentación de sus fundamentos y patrones.

## Mockup de la app

Abre `app.html` para consultar el mockup del módulo de Ventas. Las pestañas permiten alternar entre la lista de ofertas, el CRM y el resumen de indicadores; también puedes seleccionar ofertas para actualizar el panel de detalle.

Para inspeccionar el sistema de diseño visual, abre `design-system.html`. Las reglas de implementación se encuentran en `DESIGN_SYSTEM.md`.

## Ejecutar localmente

No requiere instalación ni dependencias. Abre `index.html` directamente en un navegador, o sirve la carpeta con un servidor estático:

```bash
python3 -m http.server 8000
```

Después visita `http://localhost:8000`.

## Estructura

```text
protek-page/
├── assets/
│   └── protek-industrial-hero.png
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

## Publicación

El sitio puede desplegarse en GitHub Pages, Netlify, Vercel o cualquier hosting de archivos estáticos. Para GitHub Pages, selecciona la rama `main` y la carpeta raíz como fuente de publicación.

## Notas

Las tipografías y los iconos se cargan desde Google Fonts y Lucide mediante CDN. Antes de usar el formulario en producción, conéctalo al CRM, proveedor de formularios o API que gestione los leads.
