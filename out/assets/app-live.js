const root = document.querySelector("#app-root");
const client = window.supabase.createClient("https://zdwkjdbjwwxenwmdrzgq.supabase.co", "sb_publishable_JF2LRShpTvvTLv_0oZNTJA_lCqJFOub");
const app = { user: null, profile: null, organizations: [], organizationId: Number(localStorage.getItem("protek.activeOrganization") || 0), stages: [], customers: [], members: [], opportunities: [], quotes: [], view: "summary", authEmail: "", authStep: "email", notice: "", error: "", showOfferForm: false, quoteDetailId: null, customerEditorId: null, filters: { search: "", customerId: "", serviceMode: "" } };
const label = { workshop: "Servicio en taller", field: "Servicio en campo", parts: "Refaccionamiento", draft: "Borrador", pending_approval: "Por autorizar", sent: "Oferta enviada", negotiation: "Negociación", approved: "Autorizada", rejected: "Rechazada" };

function esc(value) { return String(value || "").replace(/[&<>"']/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]; }); }
function money(value, code) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: code || "MXN", maximumFractionDigits: 2 }).format(Number(value || 0)); }
function compact(value, code) { const prefix = code === "USD" ? "US$" : code === "EUR" ? "EUR " : "$"; return Number(value || 0) > 999999 ? prefix + (Number(value) / 1000000).toFixed(2) + "M" : Number(value || 0) > 999 ? prefix + Math.round(Number(value) / 1000) + "K" : money(value, code); }
function initials(value) { return String(value || "P").split(/\s+/).slice(0, 2).map(function (part) { return part[0]; }).join("").toUpperCase(); }
function setNotice(message) { app.notice = message; app.error = ""; }
function setError(error) { app.error = error && error.message ? error.message : "No fue posible completar la operación."; app.notice = ""; }
function currentOrganization() { return app.organizations.find(function (item) { return item.id === app.organizationId; }); }
function quoteStatus(stage) { return ({ new: "draft", diagnosis: "pending_approval", quoted: "sent", negotiation: "negotiation", won: "approved", lost: "rejected" })[stage] || "draft"; }
function openQuotes() { return app.quotes.filter(function (quote) { return !["approved", "rejected"].includes(quote.status); }); }
function filteredQuotes() {
  const text = app.filters.search.trim().toLowerCase();
  return app.quotes.filter(function (quote) {
    const searchable = [quote.title, quote.customerName, quote.quote_number, quote.stageName].join(" ").toLowerCase();
    return (!text || searchable.includes(text)) && (!app.filters.customerId || quote.customer_id === Number(app.filters.customerId)) && (!app.filters.serviceMode || quote.service_mode === app.filters.serviceMode);
  });
}
function notice() { return app.error ? '<p class="live-notice">' + esc(app.error) + '</p>' : app.notice ? '<p class="live-notice live-success">' + esc(app.notice) + '</p>' : ""; }

function renderAuth() {
  const code = app.authStep === "code";
  root.innerHTML = '<main class="auth-shell"><section class="auth-card"><div class="auth-brand"><i></i>protek</div><h1>' + (code ? "Confirma tu acceso." : "Entra a tu operación.") + '</h1><p>' + (code ? "Enviamos un código de seis dígitos a " + esc(app.authEmail) + "." : "Accede con un código de un solo uso enviado a tu correo de trabajo.") + '</p><form class="auth-form" id="auth-form">' + (code ? '<label>Código de acceso<input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></label>' : '<label>Nombre<input name="name" autocomplete="name" placeholder="Tu nombre"></label><label>Correo de trabajo<input name="email" type="email" autocomplete="email" placeholder="nombre@empresa.com" required></label>') + '<p class="auth-status ' + (app.error ? "error" : "") + '">' + esc(app.error || app.notice) + '</p><button class="live-primary" type="submit">' + (code ? "Verificar código" : "Enviar código") + '</button>' + (code ? '<button class="subtle-button" id="back-email" type="button">Usar otro correo</button>' : "") + '</form><p class="auth-note">El código vence según la política de seguridad configurada para tu organización.</p></section></main>';
  root.querySelector("#auth-form").addEventListener("submit", code ? verifyOtp : sendOtp);
  const back = root.querySelector("#back-email");
  if (back) back.addEventListener("click", function () { app.authStep = "email"; app.notice = ""; app.error = ""; renderAuth(); });
}

async function sendOtp(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  app.authEmail = String(form.get("email") || "").trim().toLowerCase();
  const fullName = String(form.get("name") || "").trim();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  const result = await client.auth.signInWithOtp({ email: app.authEmail, options: { data: { full_name: fullName || app.authEmail.split("@")[0] } } });
  if (result.error) { setError(result.error); renderAuth(); return; }
  app.authStep = "code";
  setNotice("Código enviado. Revisa tu bandeja de entrada.");
  renderAuth();
}

async function verifyOtp(event) {
  event.preventDefault();
  const token = String(new FormData(event.currentTarget).get("token") || "").trim();
  const result = await client.auth.verifyOtp({ email: app.authEmail, token: token, type: "email" });
  if (result.error || !result.data.user) { setError(result.error || new Error("El código no es válido.")); renderAuth(); return; }
  app.user = result.data.user;
  setNotice("Acceso confirmado.");
  await loadWorkspace();
}

function renderOnboarding() {
  root.innerHTML = '<main class="auth-shell"><section class="auth-card"><div class="auth-brand"><i></i>protek</div><h1>Crea tu primera empresa.</h1><p>Esta empresa será el límite de datos, permisos y operación para tu equipo.</p><form class="auth-form" id="organization-form"><label>Nombre de la empresa<input name="name" placeholder="Ej. Taller Industrial del Norte" required minlength="2"></label><label>Identificador<input name="slug" placeholder="taller-industrial-norte" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required></label><p class="auth-status ' + (app.error ? "error" : "") + '">' + esc(app.error || app.notice) + '</p><button class="live-primary" type="submit">Crear empresa</button></form></section></main>';
  root.querySelector("#organization-form").addEventListener("submit", createOrganization);
}

async function createOrganization(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = await client.rpc("create_organization", { p_name: String(form.get("name") || "").trim(), p_slug: String(form.get("slug") || "").trim().toLowerCase() });
  if (result.error) { setError(result.error); renderOnboarding(); return; }
  app.organizationId = Number(result.data);
  localStorage.setItem("protek.activeOrganization", String(app.organizationId));
  setNotice("Empresa creada. El pipeline comercial está listo.");
  await loadWorkspace();
}

async function loadWorkspace() {
  root.innerHTML = '<div class="app-loading">Sincronizando tu operación...</div>';
  const results = await Promise.all([
    client.from("profiles").select("display_name").eq("id", app.user.id).maybeSingle(),
    client.from("organization_members").select("organization_id, role, organizations(id, name, slug)").eq("user_id", app.user.id).eq("status", "active").order("organization_id")
  ]);
  const profile = results[0], memberships = results[1];
  if (memberships.error) { setError(memberships.error); renderAuth(); return; }
  app.profile = profile.data || { display_name: app.user.email.split("@")[0] };
  app.organizations = (memberships.data || []).map(function (membership) {
    const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    return { id: Number(membership.organization_id), name: organization && organization.name || "Empresa sin nombre", slug: organization && organization.slug || "" };
  });
  if (!app.organizations.length) { renderOnboarding(); return; }
  if (!app.organizations.some(function (organization) { return organization.id === app.organizationId; })) app.organizationId = app.organizations[0].id;
  localStorage.setItem("protek.activeOrganization", String(app.organizationId));
  await loadSales();
}

async function loadSales() {
  const org = app.organizationId;
  const results = await Promise.all([
    client.from("pipeline_stages").select("id, stage_key, name, position, is_closed, outcome").eq("organization_id", org).order("position"),
    client.from("customers").select("id, display_name, legal_name, tax_id, account_code, status").eq("organization_id", org).is("archived_at", null).order("display_name"),
    client.from("organization_members").select("user_id, profiles(display_name)").eq("organization_id", org).eq("status", "active"),
    client.from("sales_opportunities").select("id, customer_id, title, service_mode, estimated_revenue, stage_id, owner_id, updated_at").eq("organization_id", org).is("archived_at", null).order("updated_at", { ascending: false }),
    client.from("quotes").select("id, quote_number, customer_id, opportunity_id, title, notes, service_mode, currency_code, subtotal, total_amount, status, updated_at, valid_until").eq("organization_id", org).is("archived_at", null).order("updated_at", { ascending: false })
  ]);
  const failed = results.find(function (result) { return result.error; });
  if (failed) { setError(failed.error); renderApp(); return; }
  app.stages = results[0].data || [];
  app.customers = results[1].data || [];
  app.members = (results[2].data || []).map(function (member) { const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles; return { id: member.user_id, name: profile && profile.display_name || "Usuario" }; });
  app.opportunities = results[3].data || [];
  const customerNames = new Map(app.customers.map(function (customer) { return [customer.id, customer.display_name]; }));
  const opportunities = new Map(app.opportunities.map(function (opportunity) { return [opportunity.id, opportunity]; }));
  const stages = new Map(app.stages.map(function (stage) { return [stage.id, stage]; }));
  const memberNames = new Map(app.members.map(function (member) { return [member.id, member.name]; }));
  app.quotes = (results[4].data || []).map(function (quote) {
    const opportunity = opportunities.get(quote.opportunity_id);
    const stage = stages.get(opportunity && opportunity.stage_id);
    return Object.assign({}, quote, { customerName: customerNames.get(quote.customer_id) || "Cliente sin nombre", stageId: stage && stage.id || null, stageKey: stage && stage.stage_key || "new", stageName: stage && stage.name || "Nueva oportunidad", responsibleName: opportunity && opportunity.owner_id ? memberNames.get(opportunity.owner_id) || "Usuario" : "Sin responsable" });
  });
  renderApp();
}

function renderApp() {
  const org = currentOrganization();
  if (!org) { renderOnboarding(); return; }
  const viewName = app.quoteDetailId ? "Oferta" : ({ summary: "Resumen", offers: "Ofertas", board: "Tablero", customers: "Clientes" })[app.view];
  root.innerHTML = '<div class="app-shell"><aside class="live-sidebar"><a class="brand" href="./"><i></i>protek</a><div class="workspace-switch"><select class="company-select" id="company-select" aria-label="Cambiar empresa">' + app.organizations.map(function (item) { return '<option value="' + item.id + '" ' + (item.id === app.organizationId ? "selected" : "") + '>' + esc(item.name) + '</option>'; }).join("") + '</select></div><nav class="live-nav" aria-label="Módulos"><button class="active" type="button" data-sales-home>Ventas</button>' + ["Órdenes", "Planeación", "Recursos", "Almacén", "Compras", "Calidad", "Ingeniería", "Agente IA"].map(function (module) { return '<button type="button" data-unavailable="' + esc(module) + '">' + esc(module) + '</button>'; }).join("") + '</nav><div class="live-account"><span class="profile-initials">' + esc(initials(app.profile && app.profile.display_name)) + '</span><div><b>' + esc(app.profile && app.profile.display_name || "Usuario") + '</b><small>' + esc(app.user.email) + '</small></div></div></aside><main class="live-main"><header class="live-topbar"><div class="live-breadcrumb">Protek / <b>Ventas / ' + viewName + '</b></div><button class="live-secondary" type="button" id="sign-out">Salir</button></header><div id="sales-workspace">' + renderWorkspace() + '</div></main></div>';
  bindEvents();
}

function renderWorkspace() {
  if (app.quoteDetailId) return renderDetail();
  const heading = { summary: ["Resumen comercial", "Resultados, conversión y seguimiento para decidir el siguiente movimiento."], offers: ["Ofertas", "Convierte oportunidades de servicio y refacciones en trabajo rentable."], board: ["Tablero comercial", "Mueve ofertas entre etapas sin separar el dato comercial de la operación."], customers: ["Clientes", "Empresas y contactos que concentran historial comercial y operativo."] }[app.view];
  const action = app.view === "offers" ? '<button class="live-primary" type="button" data-show-offer>+ Nueva oferta</button>' : app.view === "customers" ? '<button class="live-primary" type="button" data-new-customer>+ Nuevo cliente</button>' : "";
  return notice() + '<section class="live-heading"><div><p class="eyebrow">MÓDULO / VENTAS</p><h1>' + heading[0] + '</h1><p>' + heading[1] + '</p></div><div class="live-heading-actions">' + action + '</div></section><nav class="live-tabs" aria-label="Secciones de Ventas">' + [["summary", "Resumen"], ["offers", "Ofertas"], ["board", "Tablero"], ["customers", "Clientes"]].map(function (item) { return '<button type="button" data-view="' + item[0] + '" class="' + (app.view === item[0] ? "active" : "") + '">' + item[1] + '</button>'; }).join("") + '</nav>' + (app.view === "summary" ? renderSummary() : app.view === "offers" ? renderOffers() : app.view === "board" ? renderBoard() : renderCustomers());
}

function renderSummary() {
  const open = openQuotes();
  const pipeline = app.opportunities.filter(function (item) { const stage = app.stages.find(function (row) { return row.id === item.stage_id; }); return stage && !["won", "lost"].includes(stage.stage_key); }).reduce(function (sum, item) { return sum + Number(item.estimated_revenue || 0); }, 0);
  const stale = open.filter(function (quote) { return Date.now() - new Date(quote.updated_at).getTime() > 30 * 86400000; }).length;
  const expiring = open.filter(function (quote) { return quote.valid_until && new Date(quote.valid_until + "T23:59:59").getTime() - Date.now() < 7 * 86400000; }).length;
  const totals = app.stages.filter(function (stage) { return stage.outcome !== "lost"; }).map(function (stage) { return { stage: stage, total: app.quotes.filter(function (quote) { return quote.stageId === stage.id; }).reduce(function (sum, quote) { return sum + Number(quote.total_amount || 0); }, 0) }; });
  const max = Math.max.apply(Math, totals.map(function (item) { return item.total; }).concat([1]));
  return '<section class="live-kpis"><article class="live-kpi"><span>PIPELINE ACTIVO</span><strong>' + compact(pipeline) + '</strong><small>Oportunidades no cerradas</small></article><article class="live-kpi"><span>OFERTAS ABIERTAS</span><strong>' + open.length + '</strong><small>En seguimiento comercial</small></article><article class="live-kpi"><span>OFERTAS PENDIENTES</span><strong>' + stale + '</strong><small>Sin actualización en 30 días</small></article><article class="live-kpi"><span>POR VENCER</span><strong>' + expiring + '</strong><small>Requieren seguimiento</small></article></section><section class="live-grid"><article class="live-panel"><span class="live-label">PIPELINE POR ETAPA</span><h2>' + compact(pipeline) + '</h2><div class="live-bars">' + totals.map(function (item) { return '<div class="live-bar"><span>' + esc(item.stage.name) + '</span><i><b style="width:' + Math.max(2, item.total / max * 100) + '%"></b></i><em>' + compact(item.total) + '</em></div>'; }).join("") + '</div></article><article class="live-panel"><span class="live-label">SIGUIENTE PASO</span><h2>' + (open.length ? "Da seguimiento a una oferta abierta." : "Crea tu primera oferta.") + '</h2><p style="color:var(--muted);line-height:1.55">El tablero, los clientes y las ofertas se guardan en la empresa activa.</p></article></section>' + renderTable(app.quotes.slice(0, 10), "Últimas ofertas actualizadas");
}

function renderFilters() {
  return '<div class="live-filters"><input class="offer-filter" id="quote-search" value="' + esc(app.filters.search) + '" placeholder="Buscar oferta o cliente"><select class="offer-filter" id="quote-customer"><option value="">Todos los clientes</option>' + app.customers.map(function (customer) { return '<option value="' + customer.id + '" ' + (String(customer.id) === app.filters.customerId ? "selected" : "") + '>' + esc(customer.display_name) + '</option>'; }).join("") + '</select><select class="offer-filter" id="quote-service"><option value="">Todos los tipos</option><option value="workshop" ' + (app.filters.serviceMode === "workshop" ? "selected" : "") + '>Servicio en taller</option><option value="field" ' + (app.filters.serviceMode === "field" ? "selected" : "") + '>Servicio en campo</option><option value="parts" ' + (app.filters.serviceMode === "parts" ? "selected" : "") + '>Refaccionamiento</option></select><button class="live-secondary" type="button" id="clear-filters">Limpiar</button></div>';
}
function renderTable(quotes, title) {
  return '<section class="live-surface"><div class="live-surface-head"><b>' + title + '</b><span class="live-label">' + quotes.length + ' REGISTROS</span></div><div class="live-table"><div class="live-row head"><span>OFERTA</span><span>CLIENTE</span><span>IMPORTE</span><span>ETAPA</span></div>' + (quotes.length ? quotes.map(function (quote) { return '<button class="live-row" type="button" data-quote-id="' + quote.id + '"><span><b>Q-' + quote.quote_number + '</b><small>' + esc(quote.title) + '</small></span><span>' + esc(quote.customerName) + '</span><span>' + money(quote.total_amount, quote.currency_code) + '</span><span><em class="live-status ' + quote.status + '">' + esc(quote.stageName) + '</em></span></button>'; }).join("") : '<div class="empty-state">No hay ofertas con estos filtros.</div>') + '</div></section>';
}
function renderOfferForm() {
  return '<section class="live-form-wrap"><h2>Nueva oferta</h2><p>La oferta crea una oportunidad y conserva el historial comercial desde el primer registro.</p><form class="live-form" id="offer-form"><label class="wide">Nombre de la oferta<input name="title" required minlength="3" placeholder="Ej. Overhaul de motor Cummins QSK19"></label><label>Cliente<select name="customerId" required><option value="">Selecciona un cliente</option>' + app.customers.map(function (customer) { return '<option value="' + customer.id + '">' + esc(customer.display_name) + '</option>'; }).join("") + '</select></label><label>Tipo de oferta<select name="serviceMode"><option value="workshop">Servicio en taller</option><option value="field">Servicio en campo</option><option value="parts">Refaccionamiento</option></select></label><label>Moneda<select name="currencyCode"><option value="MXN">MXN · Peso mexicano</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option></select></label><label>Vigencia<input name="validUntil" type="date"></label><label>Valor antes de impuestos<input name="subtotal" inputmode="decimal" placeholder="0.00" required></label><label>Valor total con impuestos<input name="totalAmount" inputmode="decimal" placeholder="0.00" required></label><label class="wide">Notas<input name="notes" placeholder="Alcance, condición reportada o consideraciones"></label><div class="live-form-actions"><button class="live-secondary" type="button" data-hide-offer>Cancelar</button><button class="live-primary" type="submit">Crear oferta</button></div></form></section>';
}
function renderOffers() { return (app.showOfferForm ? renderOfferForm() : "") + renderFilters() + renderTable(filteredQuotes(), "Ofertas"); }
function renderBoard() {
  const quotes = filteredQuotes();
  return renderFilters() + '<section class="live-surface"><div class="live-surface-head"><b>Pipeline comercial</b><span class="live-label">ARRASTRA PARA ACTUALIZAR ETAPA</span></div><div class="live-board">' + app.stages.filter(function (stage) { return stage.outcome !== "lost"; }).map(function (stage) { const rows = quotes.filter(function (quote) { return quote.stageId === stage.id; }); return '<section class="live-column" data-stage-id="' + stage.id + '"><header><span>' + esc(stage.name) + '</span><b>' + rows.length + '</b></header><div class="live-column-value">' + compact(rows.reduce(function (sum, quote) { return sum + Number(quote.total_amount || 0); }, 0)) + '</div>' + rows.map(function (quote) { return '<button class="live-deal" draggable="true" data-drag-quote="' + quote.id + '" data-quote-id="' + quote.id + '" type="button"><span>' + label[quote.service_mode] + '</span><h3>' + esc(quote.title) + '</h3><p>' + esc(quote.customerName) + '</p><footer><strong>' + compact(quote.total_amount, quote.currency_code) + '</strong><i>' + esc(initials(quote.responsibleName)) + '</i></footer></button>'; }).join("") + '</section>'; }).join("") + '</div></section>';
}
function renderCustomers() {
  const existing = app.customerEditorId ? app.customers.find(function (customer) { return customer.id === app.customerEditorId; }) : null;
  const form = app.customerEditorId !== null ? '<section class="live-form-wrap"><h2>' + (existing ? "Editar cliente" : "Nuevo cliente") + '</h2><p>Este registro queda disponible para ofertas, órdenes y servicio.</p><form class="live-form" id="customer-form"><input name="id" type="hidden" value="' + (existing && existing.id || "") + '"><label>Nombre comercial<input name="displayName" value="' + esc(existing && existing.display_name) + '" required minlength="2"></label><label>Estado<select name="status"><option value="prospect" ' + (existing && existing.status === "prospect" ? "selected" : "") + '>Prospecto</option><option value="active" ' + (existing && existing.status === "active" ? "selected" : "") + '>Activo</option><option value="inactive" ' + (existing && existing.status === "inactive" ? "selected" : "") + '>Inactivo</option></select></label><label class="wide">Razón social<input name="legalName" value="' + esc(existing && existing.legal_name) + '"></label><label>RFC<input name="taxId" value="' + esc(existing && existing.tax_id) + '"></label><label>Código de cliente<input name="accountCode" value="' + esc(existing && existing.account_code) + '"></label><div class="live-form-actions"><button class="live-secondary" data-cancel-customer type="button">Cancelar</button><button class="live-primary" type="submit">Guardar cliente</button></div></form></section>' : "";
  return form + '<section class="live-surface"><div class="live-surface-head"><b>Clientes registrados</b><span class="live-label">' + app.customers.length + ' REGISTROS</span></div><div class="live-table"><div class="live-row head"><span>CLIENTE</span><span>RAZÓN SOCIAL</span><span>ESTADO</span><span>ACCIÓN</span></div>' + (app.customers.length ? app.customers.map(function (customer) { return '<div class="live-row"><span><b>' + esc(customer.display_name) + '</b><small>' + esc(customer.account_code || "Sin código") + '</small></span><span>' + esc(customer.legal_name || "Sin razón social") + '</span><span><em class="live-status">' + esc(customer.status) + '</em></span><span><button class="live-secondary" type="button" data-edit-customer="' + customer.id + '">Editar</button></span></div>'; }).join("") : '<div class="empty-state">Registra el primer cliente para crear una oferta.</div>') + '</div></section>';
}
function renderDetail() {
  const quote = app.quotes.find(function (item) { return item.id === app.quoteDetailId; });
  if (!quote) { app.quoteDetailId = null; return renderWorkspace(); }
  return notice() + '<section class="live-heading"><div><p class="eyebrow">VENTAS / Q-' + quote.quote_number + '</p><h1>' + esc(quote.title) + '</h1><p>' + esc(quote.customerName) + ' · ' + label[quote.service_mode] + '</p></div><div class="live-heading-actions"><button class="live-secondary" type="button" data-close-detail>Volver a ofertas</button></div></section><section class="live-grid"><article class="live-panel"><span class="live-label">INFORMACIÓN GENERAL</span><h2>' + money(quote.total_amount, quote.currency_code) + '</h2><div class="live-bars"><div class="live-bar"><span>Cliente</span><b>' + esc(quote.customerName) + '</b><em></em></div><div class="live-bar"><span>Vigencia</span><b>' + esc(quote.valid_until || "Sin vigencia") + '</b><em></em></div><div class="live-bar"><span>Etapa</span><b>' + esc(quote.stageName) + '</b><em></em></div></div></article><article class="live-panel"><span class="live-label">NOTAS</span><h2>' + esc(quote.notes || "Sin notas registradas.") + '</h2><p style="color:var(--muted);line-height:1.55">Esta oferta está vinculada a su oportunidad, etapa comercial e historial de actividad.</p></article></section>';
}

function bindEvents() {
  const signOut = root.querySelector("#sign-out");
  if (signOut) signOut.addEventListener("click", async function () { await client.auth.signOut(); app.user = null; app.notice = ""; app.error = ""; app.authStep = "email"; renderAuth(); });
  const companies = root.querySelector("#company-select");
  if (companies) companies.addEventListener("change", async function (event) { app.organizationId = Number(event.target.value); localStorage.setItem("protek.activeOrganization", String(app.organizationId)); app.quoteDetailId = null; app.customerEditorId = null; setNotice("Empresa activa actualizada."); await loadSales(); });
  root.querySelectorAll("[data-view]").forEach(function (button) { button.addEventListener("click", function () { app.view = button.dataset.view; app.quoteDetailId = null; app.customerEditorId = null; app.showOfferForm = false; app.error = ""; app.notice = ""; renderApp(); }); });
  const salesHome = root.querySelector("[data-sales-home]");
  if (salesHome) salesHome.addEventListener("click", function () { app.view = "summary"; app.quoteDetailId = null; renderApp(); });
  root.querySelectorAll("[data-unavailable]").forEach(function (button) { button.addEventListener("click", function () { setNotice(button.dataset.unavailable + " continúa en preparación. Ventas es el primer módulo conectado."); renderApp(); }); });
  const showOffer = root.querySelector("[data-show-offer]");
  if (showOffer) showOffer.addEventListener("click", function () { app.showOfferForm = true; renderApp(); });
  const hideOffer = root.querySelector("[data-hide-offer]");
  if (hideOffer) hideOffer.addEventListener("click", function () { app.showOfferForm = false; renderApp(); });
  const offerForm = root.querySelector("#offer-form");
  if (offerForm) offerForm.addEventListener("submit", saveOffer);
  const search = root.querySelector("#quote-search");
  if (search) search.addEventListener("input", function (event) { app.filters.search = event.target.value; renderApp(); });
  const customer = root.querySelector("#quote-customer");
  if (customer) customer.addEventListener("change", function (event) { app.filters.customerId = event.target.value; renderApp(); });
  const service = root.querySelector("#quote-service");
  if (service) service.addEventListener("change", function (event) { app.filters.serviceMode = event.target.value; renderApp(); });
  const clear = root.querySelector("#clear-filters");
  if (clear) clear.addEventListener("click", function () { app.filters = { search: "", customerId: "", serviceMode: "" }; renderApp(); });
  root.querySelectorAll("[data-quote-id]").forEach(function (button) { button.addEventListener("click", function () { app.quoteDetailId = Number(button.dataset.quoteId); renderApp(); }); });
  const closeDetail = root.querySelector("[data-close-detail]");
  if (closeDetail) closeDetail.addEventListener("click", function () { app.quoteDetailId = null; app.view = "offers"; renderApp(); });
  const newCustomer = root.querySelector("[data-new-customer]");
  if (newCustomer) newCustomer.addEventListener("click", function () { app.customerEditorId = 0; renderApp(); });
  const cancelCustomer = root.querySelector("[data-cancel-customer]");
  if (cancelCustomer) cancelCustomer.addEventListener("click", function () { app.customerEditorId = null; renderApp(); });
  root.querySelectorAll("[data-edit-customer]").forEach(function (button) { button.addEventListener("click", function () { app.customerEditorId = Number(button.dataset.editCustomer); renderApp(); }); });
  const customerForm = root.querySelector("#customer-form");
  if (customerForm) customerForm.addEventListener("submit", saveCustomer);
  root.querySelectorAll("[data-drag-quote]").forEach(function (card) { card.addEventListener("dragstart", function (event) { event.dataTransfer.setData("text/plain", card.dataset.dragQuote); }); });
  root.querySelectorAll("[data-stage-id]").forEach(function (column) { column.addEventListener("dragover", function (event) { event.preventDefault(); }); column.addEventListener("drop", function (event) { moveOffer(event, Number(column.dataset.stageId)); }); });
}

async function saveOffer(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const parseNumber = function (name) { return Number(String(form.get(name) || "0").replace(/[^0-9.-]/g, "")); };
  const result = await client.rpc("create_sales_offer", { p_organization_id: app.organizationId, p_customer_id: Number(form.get("customerId")), p_title: String(form.get("title") || "").trim(), p_service_mode: String(form.get("serviceMode") || "workshop"), p_currency_code: String(form.get("currencyCode") || "MXN"), p_subtotal: parseNumber("subtotal"), p_total_amount: parseNumber("totalAmount"), p_valid_until: String(form.get("validUntil") || "") || null, p_notes: String(form.get("notes") || "").trim() || null });
  if (result.error) { setError(result.error); renderApp(); return; }
  app.showOfferForm = false;
  setNotice("Oferta Q-" + (result.data && result.data[0] && result.data[0].quote_number || "") + " creada.");
  await loadSales();
}
async function saveCustomer(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = Number(form.get("id") || 0);
  const payload = { organization_id: app.organizationId, display_name: String(form.get("displayName") || "").trim(), legal_name: String(form.get("legalName") || "").trim() || null, tax_id: String(form.get("taxId") || "").trim() || null, account_code: String(form.get("accountCode") || "").trim() || null, status: String(form.get("status") || "prospect") };
  const result = id ? await client.from("customers").update(payload).eq("id", id).eq("organization_id", app.organizationId) : await client.from("customers").insert(payload);
  if (result.error) { setError(result.error); renderApp(); return; }
  app.customerEditorId = null;
  setNotice(id ? "Cliente actualizado." : "Cliente creado.");
  await loadSales();
}
async function moveOffer(event, stageId) {
  event.preventDefault();
  const quoteId = Number(event.dataTransfer.getData("text/plain"));
  const quote = app.quotes.find(function (item) { return item.id === quoteId; });
  if (!quote || quote.stageId === stageId) return;
  const result = await client.rpc("move_sales_offer_stage", { p_organization_id: app.organizationId, p_quote_id: quoteId, p_stage_id: stageId });
  if (result.error) { setError(result.error); renderApp(); return; }
  const stage = app.stages.find(function (item) { return item.id === stageId; });
  setNotice("Oferta movida a " + (stage && stage.name || "la nueva etapa") + ".");
  await loadSales();
}
async function boot() {
  const result = await client.auth.getUser();
  app.user = result.data.user;
  if (!app.user) { renderAuth(); return; }
  await loadWorkspace();
}
client.auth.onAuthStateChange(function (_event, session) { if (!session || !session.user) { app.user = null; renderAuth(); } });
boot();
