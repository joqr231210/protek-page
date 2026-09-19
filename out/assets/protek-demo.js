const moduleJobs = {
  "Planeación": ["Carga y capacidad", "Hitos y ruta crítica", "Disparos operativos"],
  "Recursos": ["Técnicos y turnos", "Habilidades y certificaciones", "Equipos críticos"],
  "Almacén": ["Reservas por orden", "Surtido y consumo", "Movimientos trazables"],
  "Compras": ["Requisiciones", "Orden de compra", "Recepción y excepciones"],
  "Calidad": ["Plantillas de prueba", "Evidencia y hallazgos", "Liberación técnica"],
  "Ingeniería": ["Planos y especificaciones", "Versiones aprobadas", "Contexto para reparación"],
  "Agente IA": ["Búsqueda citada", "Análisis técnico", "Asistencia controlada"]
};

const moduleContext = {
  "Planeación": "Recibe órdenes confirmadas, disponibilidad de Recursos y restricciones de material; dispara acciones de Compras, Calidad e Ingeniería en los hitos correctos.",
  "Recursos": "Convierte las necesidades de Órdenes y Planeación en asignaciones factibles de personas, habilidades, estaciones y equipos críticos.",
  "Almacén": "Recibe reservas y consumos desde Órdenes; confirma existencias, movimientos y costo real para Compras y Ventas.",
  "Compras": "Recibe faltantes y especificaciones desde Almacén, Órdenes e Ingeniería; devuelve fechas, recepción y variación de costo a la operación.",
  "Calidad": "Recibe el alcance de Órdenes, plantillas propias e información de Ingeniería; libera, bloquea o devuelve re-trabajo con evidencia verificable.",
  "Ingeniería": "Publica planos, notas y especificaciones aprobadas para Órdenes, Compras y Calidad, siempre con la versión que corresponde a la reparación.",
  "Agente IA": "Consulta únicamente el contexto autorizado de Ventas, Órdenes, Calidad e Ingeniería y devuelve respuestas con las fuentes que las sustentan."
};

const engineOrders = [
  { id: "OT-4721", engine: "Cummins QSK19", work: "Overhaul mayor", client: "Canteras del Norte", asset: "Cargador CAT 966M", serial: "SN 79543218", status: "En armado", tone: "green", promise: "23 Sep", lead: "Sergio Ortega", progress: 68, bay: "Banco 02", blocker: "Sin bloqueo" },
  { id: "OT-4718", engine: "CAT C15 ACERT", work: "Diagnóstico por consumo de aceite", client: "Autotransportes del Bajío", asset: "Tractocamión Kenworth T800", serial: "SN NXS01382", status: "Diagnóstico", tone: "amber", promise: "20 Sep", lead: "Daniel Mejía", progress: 24, bay: "Bahía 04", blocker: "Autorización pendiente" },
  { id: "OT-4709", engine: "Detroit DD15", work: "Reparación de culata", client: "Logística Monterrey", asset: "Freightliner Cascadia", serial: "SN 472906S", status: "Esperando partes", tone: "gray", promise: "26 Sep", lead: "Julio Ramos", progress: 43, bay: "Banco 01", blocker: "Válvulas de admisión: 2 días" },
  { id: "OT-4704", engine: "MTU 12V 2000", work: "Rebuild programado", client: "Energía del Golfo", asset: "Planta de emergencia", serial: "SN 527104", status: "Prueba de banco", tone: "green", promise: "19 Sep", lead: "Rafael Torres", progress: 89, bay: "Banco de pruebas", blocker: "Sin bloqueo" }
];

let activeOrder = engineOrders[0];
let activeOrderTab = "proceso";

function sales() {
  return `<section class="heading"><div><p class="eyebrow">MÓDULO / VENTAS</p><h1>Resumen comercial</h1><p>Resultados, conversión y seguimiento para decidir el siguiente movimiento.</p></div><button class="primary" onclick="showOffer()">+ Nueva oferta</button></section><section class="kpis"><article class="kpi"><span>PIPELINE ACTIVO</span><strong>$2.30M</strong><small>Oportunidades no cerradas</small></article><article class="kpi"><span>CONVERSIÓN</span><strong>20%</strong><small>Oportunidad a ganada</small></article><article class="kpi"><span>OFERTAS PENDIENTES</span><strong>0</strong><small class="risk">Sin actualización en 30 días</small></article><article class="kpi"><span>POR VENCER</span><strong>4</strong><small class="risk">Requieren seguimiento</small></article></section><section class="grid"><article class="panel"><span class="panel-label">PIPELINE POR ETAPA</span><h2>$2.30M</h2><div class="bars"><div class="bar"><span>Nueva oportunidad</span><i><b style="width:35%"></b></i><em>$277K</em></div><div class="bar"><span>Diagnóstico</span><i><b style="width:61%"></b></i><em>$518K</em></div><div class="bar"><span>Oferta enviada</span><i><b style="width:84%"></b></i><em>$741K</em></div><div class="bar"><span>Negociación</span><i><b style="width:89%"></b></i><em>$760K</em></div></div></article><article class="panel"><span class="panel-label">EMBUDO COMERCIAL</span><h2>10 oportunidades</h2><div class="funnel"><div style="width:100%">2 &nbsp; Nueva oportunidad</div><div style="width:90%">2 &nbsp; Diagnóstico</div><div style="width:80%">2 &nbsp; Oferta enviada</div><div style="width:69%">2 &nbsp; Negociación</div></div></article></section><section class="surface"><div class="surface-head"><b>Últimas ofertas actualizadas</b><span class="panel-label">10 MOVIMIENTOS MÁS RECIENTES</span></div><div class="table"><div class="tr head"><span>OFERTA</span><span>CLIENTE</span><span>IMPORTE</span><span>RESPONSABLE</span><span>ETAPA</span></div>${["Q-2098|Overhaul de cilindro hidráulico|Minera del Norte|$486,400.00|Mariana Ruiz|Oferta enviada|green", "Q-2095|Reparación de transmisión CAT 980|Grupo Hidalgo|$318,920.00|Diego Castro|Negociación|amber", "Q-2101|Kit de refacciones para compresor|EnergiPlus|USD 96,800.00|Sofía Ramírez|Nueva oportunidad|gray"].map((row) => { const [id, work, client, amount, lead, stage, tone] = row.split("|"); return `<button class="tr" onclick="showOffer('${id}')"><span><b>${id}</b><small>${work}</small></span><span>${client}</span><span>${amount}</span><span>${lead}</span><span class="pill ${tone}">${stage}</span></button>`; }).join("")}</div></section>`;
}

function orders() {
  return `<section class="heading orders-heading"><div><p class="eyebrow">MÓDULO / ÓRDENES</p><h1>Taller de motores</h1><p>Prioriza la reparación, protege la fecha prometida y conserva el historial técnico del motor.</p></div><button class="primary" onclick="showOrder('OT-4721')">Abrir orden activa</button></section><section class="kpis orders-kpis"><article class="kpi"><span>EN PRODUCCIÓN</span><strong>6</strong><small>4 motores en bahía o banco</small></article><article class="kpi"><span>BLOQUEADAS</span><strong>2</strong><small class="risk">Partes o autorización pendiente</small></article><article class="kpi"><span>PRUEBA HOY</span><strong>1</strong><small>MTU 12V 2000, 15:30</small></article><article class="kpi"><span>ENTREGA ESTA SEMANA</span><strong>4</strong><small>Fechas comprometidas al cliente</small></article></section><section class="engine-board"><article class="engine-queue"><div class="surface-head"><div><b>Cola de reparación</b><span class="panel-label">MOTORES ACTIVOS</span></div><div class="filters"><button>Todos</button><button>En riesgo</button></div></div><div class="engine-table"><div class="engine-row engine-row-head"><span>ORDEN / MOTOR</span><span>ACTIVO</span><span>RESPONSABLE</span><span>COMPROMISO</span><span>ESTADO</span></div>${engineOrders.map((order) => `<button class="engine-row" onclick="showOrder('${order.id}')"><span><b>${order.id}</b><small>${order.engine} · ${order.work}</small><em>${order.client}</em></span><span><b>${order.asset}</b><small>${order.bay}</small></span><span>${order.lead}</span><span><b>${order.promise}</b><small>${order.progress}% completado</small></span><span><i class="order-progress"><i style="width:${order.progress}%"></i></i><span class="pill ${order.tone}">${order.status}</span></span></button>`).join("")}</div></article><aside class="engine-status"><span class="panel-label">CAPACIDAD DE TALLER</span><h2>1 de 4 bancos disponible</h2><div class="bay-list"><div><span>Banco 01</span><b class="bay-busy">DD15 · Partes</b></div><div><span>Banco 02</span><b class="bay-live">QSK19 · Armado</b></div><div><span>Banco 03</span><b class="bay-free">Disponible</b></div><div><span>Banco de pruebas</span><b class="bay-live">MTU · 15:30</b></div></div><div class="engine-note"><span>PRÓXIMA DECISIÓN</span><p>Confirmar válvulas DD15 antes de comprometer OT-4709.</p><button onclick="showOrder('OT-4709')">Ver orden ↗</button></div></aside></section>`;
}

function orderProcess() {
  const steps = [["Recepción", "done", "Motor registrado y fotografías iniciales"], ["Diagnóstico", "done", "Holguras, presión de aceite y dictamen"], ["Desarmado", "done", "Componentes identificados y limpieza"], ["Maquinado", "done", "Block y cigüeñal liberados"], ["Armado", "current", "Torque y calibraciones en ejecución"], ["Prueba de banco", "next", "Programada al concluir armado"], ["Calidad", "next", "Prueba técnica y evidencia"], ["Entrega", "next", "Informe final y garantía"]];
  return `<div class="order-process"><section class="process-card"><div class="detail-section-head"><div><span class="panel-label">RUTA DE REPARACIÓN</span><h2>${activeOrder.progress}% ejecutado</h2></div><span class="pill ${activeOrder.tone}">${activeOrder.status}</span></div><div class="process-track">${steps.map(([title, state, detail], index) => `<article class="process-step ${state}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${title}</b><small>${detail}</small></div></article>`).join("")}</div></section><aside class="decision-card"><span class="panel-label">SIGUIENTE ACCIÓN</span><h3>Completar torque de bancada.</h3><p>Responsable: Sergio Ortega. La orden puede pasar a prueba de banco cuando Calidad valide el checklist de armado.</p><div><span>FECHA COMPROMISO</span><b>23 Sep, 2026</b></div><button class="primary">Registrar avance</button></aside></div>`;
}

function orderMaterials() {
  return `<section class="materials-card"><div class="detail-section-head"><div><span class="panel-label">MATERIALES Y REFACCIONES</span><h2>Consumo ligado a OT-4721</h2></div><button class="link-button">Abrir Almacén ↗</button></div><div class="materials-table"><div class="materials-row materials-head"><span>CONCEPTO</span><span>REQUERIDO</span><span>DISPONIBLE</span><span>ORIGEN</span><span>ESTADO</span></div><div class="materials-row"><span><b>Kit de empaques QSK19</b><small>PT-1048</small></span><span>1 kit</span><span>1 kit</span><span>Almacén central</span><span class="pill green">Reservado</span></div><div class="materials-row"><span><b>Metales de bancada 0.25</b><small>PT-3892</small></span><span>1 juego</span><span>1 juego</span><span>Almacén central</span><span class="pill green">Surtido</span></div><div class="materials-row"><span><b>Inyectores calibrados</b><small>SV-221</small></span><span>6 piezas</span><span>6 piezas</span><span>Proveedor autorizado</span><span class="pill amber">En recepción</span></div></div><p class="materials-foot">La recepción de inyectores actualiza costo real, fecha de prueba de banco y margen de la oferta relacionada.</p></section>`;
}

function orderQuality() {
  return `<section class="quality-layout"><article class="quality-card"><span class="panel-label">QUALITY ENGINE / MOTOR DIÉSEL</span><h2>Pruebas requeridas antes de liberar</h2><div class="quality-check"><div><b>Torque de culata y bancada</b><span class="pill green">Evidencia validada</span></div><small>Checklist de armado · Sergio Ortega · 18 Sep, 11:42</small></div><div class="quality-check"><div><b>Presión de aceite en banco</b><span class="pill gray">Pendiente</span></div><small>Se habilita al cerrar armado y conectar sensores.</small></div><div class="quality-check"><div><b>Temperatura, RPM y humo</b><span class="pill gray">Pendiente</span></div><small>Prueba de banco dinámica con registro de curva.</small></div></article><aside class="quality-ai"><span>ANÁLISIS ASISTIDO</span><h3>Sin desviaciones detectadas en el torque registrado.</h3><p>El Agente IA comparó los valores capturados con la especificación QSK19 aprobada para esta empresa.</p><button>Consultar evidencia ↗</button></aside></section>`;
}

function showOrder(id) { activeOrder = engineOrders.find((order) => order.id === id) || engineOrders[0]; activeOrderTab = "proceso"; renderOrderDetail(); }
function setOrderTab(tab) { activeOrderTab = tab; renderOrderDetail(); }

function renderOrderDetail() {
  const content = activeOrderTab === "proceso" ? orderProcess() : activeOrderTab === "materiales" ? orderMaterials() : orderQuality();
  document.querySelector("#workspace").innerHTML = `<section class="heading order-detail-heading"><div><p class="eyebrow">ÓRDENES / ${activeOrder.id}</p><h1>${activeOrder.engine}</h1><p>${activeOrder.work} · ${activeOrder.client}</p></div><div class="detail-actions"><span class="pill ${activeOrder.tone}">${activeOrder.status}</span><button class="link-button" onclick="render('Órdenes')">Volver a órdenes</button></div></section><section class="order-identity"><article><span class="panel-label">ACTIVO</span><b>${activeOrder.asset}</b><small>${activeOrder.serial}</small></article><article><span class="panel-label">RESPONSABLE</span><b>${activeOrder.lead}</b><small>${activeOrder.bay}</small></article><article><span class="panel-label">COMPROMISO</span><b>${activeOrder.promise}, 2026</b><small>${activeOrder.progress}% de avance</small></article><article><span class="panel-label">BLOQUEO</span><b>${activeOrder.blocker}</b><small>Última actualización hoy, 11:42</small></article></section><nav class="order-tabs" aria-label="Secciones de la orden"><button class="${activeOrderTab === "proceso" ? "active" : ""}" onclick="setOrderTab('proceso')">Proceso</button><button class="${activeOrderTab === "materiales" ? "active" : ""}" onclick="setOrderTab('materiales')">Materiales</button><button class="${activeOrderTab === "calidad" ? "active" : ""}" onclick="setOrderTab('calidad')">Calidad y pruebas</button></nav>${content}`;
}

function modulePage(name) {
  const jobs = moduleJobs[name];
  return `<section class="heading"><div><p class="eyebrow">MÓDULO / ${name.toUpperCase()}</p><h1>${name}</h1><p>${name === "Agente IA" ? "Consulta el contexto autorizado de cada reparación con fuentes visibles." : "Un espacio de trabajo conectado al flujo real de reparación."}</p></div><button class="primary">Nueva acción</button></section><section class="module-view"><span class="panel-label">PRÓXIMO RELEASE</span><h2>${name} listo para operar en el mismo contexto.</h2><p>${moduleContext[name]}</p><div class="module-jobs">${jobs.map((job, index) => `<div><span class="panel-label">0${index + 1}</span><strong>${job}</strong><p>Configuración y evidencia vinculadas a la empresa activa.</p></div>`).join("")}</div></section>`;
}

function render(name = "Ventas") {
  document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.module === name));
  document.querySelector(".crumb").innerHTML = `Protek / <b>${name}</b>`;
  document.querySelector("#workspace").innerHTML = name === "Ventas" ? sales() : name === "Órdenes" ? orders() : modulePage(name);
}

function showOffer(id = "Nueva oferta") {
  document.querySelector("#workspace").innerHTML = `<section class="heading"><div><p class="eyebrow">VENTAS / ${id}</p><h1>${id}</h1><p>Información comercial y técnica vinculada a la operación.</p></div><button class="link-button" onclick="render('Ventas')">Volver a Ventas</button></section><section class="module-view"><span class="panel-label">INFORMACIÓN GENERAL</span><h2>${id === "Nueva oferta" ? "Preparar una oferta trazable." : "Overhaul de cilindro hidráulico"}</h2><div class="module-jobs"><div><span class="panel-label">CLIENTE</span><strong>Minera del Norte</strong><p>Activo: cilindro hidráulico.</p></div><div><span class="panel-label">RESPONSABLE</span><strong>Mariana Ruiz</strong><p>Estado: <span class="pill green">Oferta enviada</span></p></div><div><span class="panel-label">VALOR TOTAL</span><strong>$486,400.00 MXN</strong><p>Vigencia hasta 21 Sep 2026.</p></div></div></section>`;
}

function setMobileNavigation(open) {
  const sidebar = document.querySelector(".side");
  const toggle = document.querySelector(".mobile-menu-toggle");
  const scrim = document.querySelector(".mobile-nav-scrim");
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  sidebar.classList.toggle("is-open", open);
  scrim.classList.toggle("is-visible", open);
  sidebar.setAttribute("aria-hidden", String(isMobile && !open));
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Cerrar navegación" : "Abrir navegación");
  document.body.classList.toggle("nav-open", open);
}

document.querySelector(".mobile-menu-toggle").addEventListener("click", () => {
  setMobileNavigation(!document.querySelector(".side").classList.contains("is-open"));
});
document.querySelector(".mobile-nav-scrim").addEventListener("click", () => setMobileNavigation(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMobileNavigation(false);
});
window.addEventListener("resize", () => setMobileNavigation(false));
document.querySelectorAll(".nav button").forEach((button) => button.addEventListener("click", () => {
  render(button.dataset.module);
  setMobileNavigation(false);
}));
setMobileNavigation(false);
render();
