# Protek Industrial: Plan de desarrollo de producto

## Norte de producto

Protek es el sistema AI-native para volver más rentables los talleres y empresas que reparan maquinaria e infraestructura industrial. Un registro comercial autorizado se convierte en una orden ejecutable; la orden coordina personas, materiales, especificaciones y pruebas; la liberación alimenta una memoria operacional recuperable por el Agente IA.

## Principios de construcción

1. Una entidad operacional tiene una fuente de verdad. Una oferta no es una orden y una orden no vive dentro de Ventas.
2. Toda operación se delimita por empresa activa y por permiso de módulo, con Supabase RLS como capa de seguridad.
3. Los eventos son trazables: cambios de estado, aprobaciones, evidencias, costos y decisiones AI generan historial auditable.
4. El CRUD cotidiano ocurre en contexto. Los modales se reservan para confirmaciones destructivas o decisiones excepcionales.
5. Las automatizaciones se disparan después de la transacción por outbox y Vercel Workflows, nunca antes de registrar la verdad operacional.

## Entrega base: fundación transversal

| Entregable | Alcance verificable | Dependencias |
| --- | --- | --- |
| Tenancy y acceso | empresas, sucursales, membresías, empresa activa y permisos `read`/`write`/`admin` por módulo | Supabase Auth, RLS |
| Catálogos compartidos | clientes, contactos, sitios, activos, productos, proveedores, unidades y monedas | tenancy |
| Actividad y archivos | timeline, auditoría, enlaces de archivo y Storage con paths por empresa | Storage, RLS |
| Diseño de flujos | estados versionados, transiciones autorizadas y notificaciones | actividad, permisos |
| Automatización durable | `workflow_outbox`, idempotencia, observabilidad y reintentos | Vercel Workflows |

## Módulos y definición de terminado

### 1. Ventas

**Jobs:** registrar una oportunidad, construir una oferta, solicitar aprobación, seguir actividad y convertir una oferta autorizada en trabajo.

**Primer release:** CRM, tablero con arrastre controlado, ofertas con clientes, responsable, estado, moneda, líneas, adjuntos, revisiones, aprobación y actividad. El resumen prioriza inactividad, vencimientos y pipeline.

**Integraciones:** crea o relaciona cliente, activo y oportunidad; una aprobación genera el comando para crear una Orden. Nunca crea una orden mediante una copia manual de campos.

**Done cuando:** el usuario puede explicar el valor, alcance, responsable, vigencia y siguiente acción de cada oferta; la autorización deja una revisión inmutable y el enlace con la orden es bidireccional.

### 2. Órdenes

**Jobs:** recibir un activo, diagnosticarlo, definir alcance, ejecutar tareas, registrar tiempos y cerrar la reparación.

**Primer release:** creación desde oferta o directa, un activo principal, modo taller/campo/refaccionamiento, intake, estados validados, alcance versionado, tareas, asignaciones, evidencia y timeline.

**Integraciones:** consume clientes, activos, Recursos, Planeación, Almacén, Compras, Ingeniería y Quality Engine. Genera costos y señales para Ventas.

**Done cuando:** una orden puede avanzar sin información duplicada desde apertura hasta lista para liberar, y cada transición tiene responsable, fecha y evidencia.

### 3. Planeación

**Jobs:** comprometer fecha, secuenciar trabajo, identificar bloqueos y disparar acciones operativas.

**Primer release:** calendario de órdenes, carga por recurso, hitos, dependencias, diagrama tipo Gantt y reglas de disparo para compras, calidad e ingeniería.

**Integraciones:** lee tareas de Órdenes y disponibilidad de Recursos; produce requerimientos de compra, solicitudes de prueba y tareas de ingeniería.

**Done cuando:** el plan revela capacidad, ruta crítica y bloqueo por orden, y las acciones se generan una vez de forma idempotente.

### 4. Recursos

**Jobs:** saber quién o qué puede realizar una tarea, con qué habilidad, disponibilidad y certificación.

**Primer release:** personas, turnos, habilidades, certificaciones, estaciones, herramientas y equipos críticos; disponibilidad para Planeación.

**Integraciones:** asignación de Órdenes, carga de Planeación y requisitos de calidad o seguridad.

**Done cuando:** no se puede asignar una tarea crítica a un recurso no habilitado sin una excepción documentada.

### 5. Almacén

**Jobs:** reservar, surtir, consumir, transferir y contar material de manera trazable.

**Primer release:** almacenes, ubicaciones, catálogo, reservas por orden, pick list, movimientos append-only, consumos y existencias derivadas.

**Integraciones:** recibe requerimientos de Órdenes, compras recibidas y entregas de Refaccionamiento.

**Done cuando:** cada saldo se explica por movimientos, costo y documento fuente; nunca por una edición manual de existencia.

### 6. Compras

**Jobs:** solicitar, comparar, comprar, recibir y asignar el material o servicio externo necesario.

**Primer release:** requisiciones desde orden/planeación, proveedores, cotizaciones, orden de compra, aprobación, recepción parcial y excepción de costo o fecha.

**Integraciones:** actualiza Almacén al recibir y costo real de Orden; notifica a Planeación si una fecha comprometida cambia.

**Done cuando:** el comprador puede rastrear un requerimiento hasta proveedor, recepción, lote/serie cuando aplique, y consumo final.

### 7. Quality Engine

**Jobs:** diseñar pruebas propias, capturar mediciones, validar evidencia y liberar una reparación con criterio reproducible.

**Primer release:** plantillas versionadas, criterios de texto/número/fórmula/imagen, corridas de prueba, evidencia, no conformidades, re-trabajo y firma de liberación.

**IA:** análisis semántico de observaciones, cálculo y detección de umbrales, revisión visual de evidencia. Todo hallazgo cita el criterio y evidencia; la decisión de liberar permanece humana.

**Integraciones:** Órdenes solicita un plan, Ingeniería aporta especificaciones y Planeación agrega hitos de liberación.

**Done cuando:** una prueba histórica puede reproducirse con la versión exacta de criterio, medición, evidencia, hallazgo AI y decisión humana.

### 8. Ingeniería

**Jobs:** guardar, versionar, revisar y entregar el conocimiento técnico que determina cómo se repara un activo.

**Primer release:** documentos, planos, especificaciones, notas, versiones, revisión y enlace a activo, oferta u orden.

**Integraciones:** entrega contexto a Calidad y Órdenes; sus versiones se fijan como snapshot cuando influyen una reparación.

**Done cuando:** un técnico puede encontrar la versión aprobada aplicable a su orden y Calidad puede referenciarla desde la prueba.

### 9. Agente IA

**Jobs:** preguntar sobre el contexto autorizado, localizar evidencia y ayudar a decidir sin ocultar sus fuentes.

**Primer release:** conversaciones por empresa, búsqueda híbrida de documentos e historial, respuestas con citas navegables, permisos heredados y feedback humano.

**Integraciones:** consulta documentos de Ingeniería, pruebas de Calidad, órdenes, actividad, activos y catálogo; ejecuta tareas lentas mediante Workflow.

**Done cuando:** cada respuesta factual incluye citas; el agente no puede recuperar información de otra empresa ni ejecutar cambios sin confirmación explícita.

### 10. Ajustes

**Jobs:** gobernar catálogos, permisos, plantillas, transiciones y automatizaciones sin modificar código.

**Primer release:** tabs por módulo, configuración con control de permisos, versiones y auditoría.

**Done cuando:** un administrador puede cambiar una plantilla de oferta o calidad, una etapa o una regla operativa y saber exactamente desde cuándo aplica.

## Secuencia de implementación

1. **Fundación:** tenancy, RLS, perfiles, catálogo común, archivos, actividad y diseño system.
2. **Ciclo de ingreso:** Ventas, activos y conversión aprobada de oferta a Orden.
3. **Ciclo de ejecución:** Órdenes, Recursos y Planeación con tareas, tiempos y evidencia.
4. **Ciclo de costo:** Almacén y Compras con ledger, requisición, recepción y consumo.
5. **Ciclo de confianza:** Quality Engine e Ingeniería, con liberación y versionado.
6. **Inteligencia y escala:** Agente IA, Workflows, reporting, migración de Bubble y observabilidad.

## Criterios para la primera demo comercial

- Se puede crear una oferta, asignar responsable, cambiar su estado y aprobarla.
- La aprobación produce una Orden con cliente, activo, alcance y evidencia enlazados.
- La Orden muestra tareas, técnico, material reservado y una prueba de calidad requerida.
- Una prueba completada libera o devuelve la orden a re-trabajo.
- La vista de resumen muestra pipeline, órdenes en riesgo, material pendiente y pruebas sin liberar.
- El Agente IA responde una pregunta sobre una orden usando al menos una fuente visible.

## Riesgos que no se deben posponer

- Contrato de estados y autorizaciones antes de construir pantallas masivas.
- Modelo de costos e inventario como ledger, no como saldo editable.
- Plantillas de campos personalizados versionadas, no JSON libre sin validación.
- RLS y pruebas de aislamiento multiempresa antes de cargar datos de clientes.
- Migración incremental con conciliación entre Bubble y Supabase, manteniendo IDs legados fuera de las claves principales.
