# Protek Design System

## Principio

Protek es un sistema de trabajo para equipos que toman decisiones sobre activos, servicio y margen. La interfaz debe priorizar estado, riesgo y siguiente acción sin adoptar la densidad visual de un ERP genérico.

## Fundamentos

| Elemento | Uso |
| --- | --- |
| `#121212` Carbon | Navegación, superficies de consola y contexto de sistema. |
| `#F02828` Signal red | Acción primaria, atención, selección y estados que requieren seguimiento. |
| `#C8F952` Success lime | Confirmación, cumplimiento y métricas positivas verificadas. |
| `#F5F5F2` Paper | Fondo principal de trabajo. |
| Manrope | Interfaz, titulares y datos legibles. |
| DM Mono | Etiquetas, identificadores, cifras y estados de precisión. |

La escala de espacio base usa múltiplos de 8 px: 8, 16, 24, 32 y 48.

## Componentes

- **Acción primaria:** fondo rojo, texto blanco; solo una por superficie.
- **Acción secundaria:** borde gris, fondo blanco; para acciones complementarias.
- **Estados:** verde ácido para éxito, ámbar para seguimiento, rojo suave para riesgo y gris para borrador.
- **Tablas:** cabeceras en DM Mono, etiquetas de estado visibles y una fila seleccionada con línea roja al lado izquierdo.
- **Paneles:** bordes de 1 px, sin esquinas excesivamente redondeadas y con una jerarquía de texto compacta.

## Patrones de ventas

1. **Ofertas:** tabla para exploración, panel lateral para decidir y dar seguimiento.
2. **CRM:** columnas por etapa, valor agregado de cada etapa y tarjetas con importe, cliente y responsable.
3. **Resumen:** métricas primero; después pipeline, embudo, margen y desempeño del equipo.

## Accesibilidad

- El rojo no es el único indicador de estado; siempre va acompañado de texto o icono.
- Los controles de vista usan `role="tab"` y teclado con flechas.
- Los botones con solo icono incluyen un nombre accesible.
