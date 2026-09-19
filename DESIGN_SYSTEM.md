# Protek Orbit Design System

## Principio

Protek es un sistema de trabajo para equipos que toman decisiones sobre activos, servicio, calidad y margen. **Protek Orbit** toma una referencia de software creativo contemporáneo: negro profundo, superficies claras, bordes suaves, ritmo editorial y una jerarquía que hace que la siguiente decisión sea evidente. No busca imitar un ERP tradicional ni esconder el trabajo real detrás de decoración.

## Fundamentos

| Elemento | Uso |
| --- | --- |
| `#0B0B0C` Carbon | Navegación, superficies de consola y contexto de sistema. |
| `#FF3B30` Signal red | Acción primaria, atención, selección y estados que requieren seguimiento. |
| `#D4FF4F` Signal lime | Confirmación, cumplimiento y métricas positivas verificadas. |
| `#F3F2EF` Paper | Fondo principal de trabajo. |
| Manrope | Interfaz, titulares y datos legibles. |
| DM Mono | Etiquetas, identificadores, cifras y estados de precisión. |

La escala de espacio base usa múltiplos de 8 px: 8, 16, 24, 32 y 48. El radio se usa de forma deliberada: 10 px para controles compactos, 16 px para paneles y 22 px para superficies de contexto. Los elementos operativos no deben convertirse en cápsulas sin motivo.

## Componentes

- **Acción primaria:** fondo rojo, texto blanco y radio de 10 px; solo una por superficie.
- **Acción secundaria:** borde sutil, fondo blanco o transparente y radio de 10 px; para acciones complementarias.
- **Estados:** verde ácido para éxito, ámbar para seguimiento, rojo suave para riesgo y gris para borrador. Los estados aparecen como pills redondeadas con texto, nunca solo como color.
- **Tablas:** cabeceras en DM Mono, etiquetas de estado visibles, filas aireadas y una selección con contorno o barra roja.
- **Paneles:** borde de 1 px, radio de 16 px, sombra corta y jerarquía de texto compacta. Se permite una superficie oscura para contexto de sistema, IA o calidad.
- **Inputs:** fondo blanco, borde suave, radio de 10 px y placeholder de bajo contraste. Ningún placeholder debe competir con el valor introducido.

## Patrones de ventas

1. **Ofertas:** tabla para exploración, panel lateral para decidir y dar seguimiento.
2. **Tablero:** columnas por etapa, valor agregado de cada etapa y tarjetas con importe, cliente y responsable.
3. **Resumen:** métricas primero; después pipeline, embudo, margen y desempeño del equipo.

## Composición de producto

- El sidebar presenta todos los módulos en un solo grupo. Las jerarquías de navegación aparecen dentro del módulo, no como categorías decorativas.
- Las pantallas de detalle reservan una cabecera para identidad, estado, responsable y la acción principal; el resto se organiza en tabs de tarea.
- Las páginas de módulo comienzan con la decisión operativa: qué está pendiente, qué cambió y qué debe avanzar hoy.
- Los fondos no usan efectos visuales para sustituir información. El contraste, el espacio y la tipografía cargan la jerarquía.

## Patrones de interacción

- Los CRUD principales se resuelven dentro de la vista de trabajo: alta de una oferta, edición de datos y cambios de estado se muestran en línea, conservando el contexto de la tabla o tablero.
- Los modales emergentes se reservan principalmente para confirmar acciones destructivas, irreversibles o que afecten registros relacionados. No se usan como el camino habitual para capturar datos.
- El selector debajo del logotipo establece la empresa activa. Toda lista, alta y acción se limita a esa empresa y a los permisos del usuario en ella.
- El cuerpo de la interfaz no usa texto menor a 12 px. La escala recomendada es 12, 13, 14, 16, 20, 28 y 40 px.

## Accesibilidad

- El rojo no es el único indicador de estado; siempre va acompañado de texto o icono.
- Los controles de vista usan `role="tab"` y teclado con flechas.
- Los botones con solo icono incluyen un nombre accesible.
