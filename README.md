# Protek Page

Landing page estática para **Protek**, el sistema AI-native para talleres y empresas de reparación. La página presenta el producto, sus flujos operativos, el Agente IA y el Protek Quality Engine.

## Contenido

- Propuesta de valor y llamada a solicitar una demo.
- Flujos para taller, servicios en campo y refacciones.
- Módulos de Órdenes, Técnicos, Almacén, Compras, Ventas, Calidad, Ingeniería y Agente IA.
- Protek Quality Engine con ejemplo de pruebas técnicas y análisis semántico, matemático y visual.
- Formulario de demo de interfaz. Aún no está conectado a un CRM o endpoint de captura.

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
├── index.html
├── script.js
└── styles.css
```

## Publicación

El sitio puede desplegarse en GitHub Pages, Netlify, Vercel o cualquier hosting de archivos estáticos. Para GitHub Pages, selecciona la rama `main` y la carpeta raíz como fuente de publicación.

## Notas

Las tipografías y los iconos se cargan desde Google Fonts y Lucide mediante CDN. Antes de usar el formulario en producción, conéctalo al CRM, proveedor de formularios o API que gestione los leads.
