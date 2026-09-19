"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Archive, ArrowLeft, ArrowRight, Bell, Bot, BriefcaseBusiness, CalendarDays, ChevronDown,
  ChevronRight, ClipboardList, Columns3, FileText, HardHat, LayoutDashboard,
  LineChart, Package, Pencil, Plus, Search, Settings2, ShieldCheck,
  ShoppingCart, SlidersHorizontal, Trash2, Wrench,
} from "lucide-react";
import type { CurrencyCode, Customer, Quote, SalesOverview, ServiceMode, Stage } from "./types";

type View = "offers" | "board" | "summary" | "customers" | "settings";
type OfferDetail = { kind: "new" } | { kind: "existing"; quote: Quote } | null;
type CustomerDetail = { kind: "new" } | { kind: "existing"; customer: Customer } | null;
type OfferTab = "general" | "technical";
type AttachedDocument = { id: string; name: string; fileName: string; fileSize: string };
type TechnicalField = { key: string; label: string; inputMode?: "decimal" | "numeric" };
type TechnicalTemplate = { id: string; name: string; fields: TechnicalField[] };
type SalesFilters = { customerId: string; responsibleId: string; serviceMode: string };

const technicalTemplates: TechnicalTemplate[] = [{
  id: "electromechanical-standard",
  name: "Ficha electromecánica estándar",
  fields: [
    { key: "serialNumber", label: "Número de serie" },
    { key: "brand", label: "Marca" },
    { key: "type", label: "Tipo" },
    { key: "voltage", label: "Voltaje", inputMode: "decimal" },
    { key: "current", label: "Corriente", inputMode: "decimal" },
    { key: "speed", label: "Velocidad", inputMode: "numeric" },
    { key: "weight", label: "Peso", inputMode: "decimal" },
    { key: "color", label: "Color" },
  ],
}];

const currencyNames: Record<CurrencyCode, string> = { MXN: "Peso mexicano", USD: "Dólar estadounidense", EUR: "Euro" };
const offerTypeOptions: Array<{ value: ServiceMode; label: string }> = [
  { value: "workshop", label: "Servicio en taller" },
  { value: "field", label: "Servicio en campo" },
  { value: "parts", label: "Refaccionamiento" },
];

function money(value: number, code: CurrencyCode) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function compactMoney(value: number, code: CurrencyCode = "MXN") {
  const prefix = code === "USD" ? "US$" : code === "EUR" ? "EUR" : "$";
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${prefix}${Math.round(value / 1_000)}K`;
  return money(value, code);
}

function serviceLabel(mode: ServiceMode) {
  return mode === "workshop" ? "Servicio en taller" : mode === "field" ? "Servicio en campo" : "Refaccionamiento";
}

function statusLabel(status: string) {
  return ({ draft: "Borrador", pending_approval: "Por autorizar", sent: "Enviada", negotiation: "Negociación", approved: "Autorizada", rejected: "Rechazada", expired: "Vencida", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status;
}

function statusForStage(stageKey: string) {
  return ({ new: "draft", diagnosis: "pending_approval", quoted: "sent", negotiation: "negotiation", won: "approved", lost: "rejected" } as Record<string, string>)[stageKey] ?? "draft";
}

function stageKeyForStatus(status: string) {
  return ({ draft: "new", pending_approval: "diagnosis", sent: "quoted", negotiation: "negotiation", approved: "won", rejected: "lost", expired: "quoted", cancelled: "lost" } as Record<string, string>)[status] ?? "new";
}

function relativeDate(value: string) {
  const difference = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (difference <= 0) return "Hoy";
  if (difference === 1) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(value));
}

function parseMoney(value: FormDataEntryValue | null) {
  return Number(String(value ?? "0").replace(/[^0-9.-]/g, "")) || 0;
}

export function SalesWorkspace({ initialOverview }: { initialOverview: SalesOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [view, setView] = useState<View>("summary");
  const [offerDetail, setOfferDetail] = useState<OfferDetail>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState(initialOverview.quotes[0]?.id ?? 0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<SalesFilters>({ customerId: "all", responsibleId: "all", serviceMode: "all" });
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [toast, setToast] = useState("");

  const filteredQuotes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es-MX");
    return overview.quotes.filter((quote) => {
      const matchesSearch = !needle || [quote.customerName, quote.title, `q-${quote.quoteNumber}`, statusLabel(quote.status)].join(" ").toLocaleLowerCase("es-MX").includes(needle);
      const matchesResponsible = filters.responsibleId === "all" || (filters.responsibleId === "unassigned" ? !quote.responsibleId : quote.responsibleId === filters.responsibleId);
      return matchesSearch && (filters.customerId === "all" || quote.customerId === Number(filters.customerId)) && matchesResponsible && (filters.serviceMode === "all" || quote.serviceMode === filters.serviceMode);
    });
  }, [filters, overview.quotes, search]);
  const openQuotes = overview.quotes.filter((quote) => !["approved", "rejected", "cancelled", "expired"].includes(quote.status));
  const pipelineValue = overview.opportunities.filter((opportunity) => opportunity.stageKey !== "won" && opportunity.stageKey !== "lost").reduce((sum, opportunity) => sum + opportunity.estimatedRevenue, 0);
  const averageMargin = openQuotes.length ? openQuotes.reduce((sum, quote) => sum + (quote.estimatedMarginPercent ?? 0), 0) / openQuotes.length : 0;
  const expiring = openQuotes.filter((quote) => quote.validUntil && new Date(`${quote.validUntil}T23:59:59`).getTime() - Date.now() < 7 * 86_400_000).length;
  const pendingOffers = openQuotes.filter((quote) => new Date(quote.updatedAt).getTime() < Date.now() - 30 * 86_400_000).length;

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3200); }
  function resetSalesView(nextView: View) { setView(nextView); setOfferDetail(null); setCustomerDetail(null); }
  function resetFilters() { setSearch(""); setFilters({ customerId: "all", responsibleId: "all", serviceMode: "all" }); }
  function moveQuoteToStage(quoteId: number, stageId: number) {
    const stage = overview.stages.find((item) => item.id === stageId);
    if (!stage) return;
    setOverview((current) => ({ ...current, quotes: current.quotes.map((quote) => quote.id === quoteId ? { ...quote, stageKey: stage.key, stageName: stage.name, status: statusForStage(stage.key), updatedAt: new Date().toISOString() } : quote) }));
    notify(`Oferta movida a ${stage.name}.`);
  }
  function updateQuoteResponsible(quoteId: number, responsibleId: string) {
    const member = overview.members.find((item) => item.id === responsibleId);
    setOverview((current) => ({ ...current, quotes: current.quotes.map((quote) => quote.id === quoteId ? { ...quote, responsibleId: member?.id ?? null, responsibleName: member?.displayName ?? null, updatedAt: new Date().toISOString() } : quote) }));
    notify(member ? `${member.displayName} es ahora responsable de la oferta.` : "Oferta sin responsable asignado.");
  }
  function updateQuoteStatus(quoteId: number, status: string) {
    const stage = overview.stages.find((item) => item.key === stageKeyForStatus(status));
    setOverview((current) => ({ ...current, quotes: current.quotes.map((quote) => quote.id === quoteId ? { ...quote, status, stageKey: stage?.key ?? quote.stageKey, stageName: stage?.name ?? statusLabel(status), updatedAt: new Date().toISOString() } : quote) }));
    notify(`Estatus actualizado a ${statusLabel(status)}.`);
  }
  function archiveQuote(quoteId: number) {
    setOverview((current) => ({ ...current, quotes: current.quotes.filter((quote) => quote.id !== quoteId) }));
    setOfferDetail(null); notify("Oferta archivada. Su historial se conserva.");
  }

  async function selectOrganization(organizationId: number) {
    if (organizationId === overview.organizationId) return setShowCompanyMenu(false);
    const selected = overview.organizations.find((organization) => organization.id === organizationId);
    if (!selected) return;
    if (overview.isDemo) {
      setOverview((current) => ({ ...current, organizationId, organizationName: selected.name }));
      setShowCompanyMenu(false); setOfferDetail(null); setCustomerDetail(null);
      return notify(`${selected.name} es ahora la empresa activa.`);
    }
    const response = await fetch(`/api/sales/overview?organizationId=${organizationId}`, { cache: "no-store" });
    if (!response.ok) return notify("No fue posible cambiar de empresa. Inténtalo otra vez.");
    const next = await response.json() as SalesOverview;
    setOverview(next); setSelectedQuoteId(next.quotes[0]?.id ?? 0); setSearch(""); setOfferDetail(null); setCustomerDetail(null); setShowCompanyMenu(false);
    notify(`${next.organizationName} es ahora la empresa activa.`);
  }

  async function createQuote(form: FormData) {
    const payload = { organizationId: overview.organizationId, customerId: Number(form.get("customerId")), title: String(form.get("title") ?? ""), notes: String(form.get("notes") ?? "").trim(), responsibleId: String(form.get("responsibleId") ?? ""), serviceMode: String(form.get("serviceMode") ?? "workshop"), currencyCode: String(form.get("currencyCode") ?? "MXN"), amountBeforeTax: parseMoney(form.get("amountBeforeTax")), totalWithTax: parseMoney(form.get("totalWithTax")), validUntil: String(form.get("validUntil") ?? "") };
    const customer = overview.customers.find((item) => item.id === payload.customerId);
    if (!customer) return notify("Selecciona un cliente registrado para continuar.");
    if (overview.isDemo) {
      const quoteNumber = Math.max(...overview.quotes.map((quote) => quote.quoteNumber), 2000) + 1;
      const responsible = overview.members.find((member) => member.id === payload.responsibleId);
      const quote: Quote = { id: quoteNumber, quoteNumber, customerId: customer.id, customerName: customer.displayName, title: payload.title, notes: payload.notes || null, responsibleId: responsible?.id ?? null, responsibleName: responsible?.displayName ?? null, serviceMode: payload.serviceMode as ServiceMode, currencyCode: payload.currencyCode as CurrencyCode, totalAmount: payload.totalWithTax, estimatedMarginPercent: null, status: "draft", stageKey: "new", stageName: "Nueva oportunidad", updatedAt: new Date().toISOString(), validUntil: payload.validUntil || null };
      setOverview((current) => ({ ...current, quotes: [quote, ...current.quotes] })); setSelectedQuoteId(quote.id); setOfferDetail(null);
      return notify(`Oferta Q-${quoteNumber} creada en la demostración.`);
    }
    const response = await fetch("/api/sales/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return notify("No fue posible crear la oferta. Revisa los campos e inténtalo otra vez.");
    const created = await response.json() as { id: number; quoteNumber: number };
    const responsible = overview.members.find((member) => member.id === payload.responsibleId);
    const quote: Quote = { id: created.id, quoteNumber: created.quoteNumber, customerId: customer.id, customerName: customer.displayName, title: payload.title, notes: payload.notes || null, responsibleId: responsible?.id ?? null, responsibleName: responsible?.displayName ?? null, serviceMode: payload.serviceMode as ServiceMode, currencyCode: payload.currencyCode as CurrencyCode, totalAmount: payload.totalWithTax, estimatedMarginPercent: null, status: "draft", stageKey: "new", stageName: "Nueva oportunidad", updatedAt: new Date().toISOString(), validUntil: payload.validUntil || null };
    setOverview((current) => ({ ...current, quotes: [quote, ...current.quotes] })); setSelectedQuoteId(quote.id); setOfferDetail(null); notify(`Oferta Q-${created.quoteNumber} creada.`);
  }

  async function saveCustomer(form: FormData, existing?: Customer) {
    const payload = { organizationId: overview.organizationId, id: existing?.id, displayName: String(form.get("displayName") ?? ""), legalName: String(form.get("legalName") ?? ""), taxId: String(form.get("taxId") ?? ""), accountCode: String(form.get("accountCode") ?? ""), status: String(form.get("status") ?? "prospect") };
    if (overview.isDemo) {
      const saved: Customer = { id: existing?.id ?? Math.max(...overview.customers.map((customer) => customer.id), 100) + 1, displayName: payload.displayName, legalName: payload.legalName || null, taxId: payload.taxId || null, accountCode: payload.accountCode || null, status: payload.status as Customer["status"] };
      setOverview((current) => ({ ...current, customers: existing ? current.customers.map((customer) => customer.id === saved.id ? saved : customer) : [saved, ...current.customers] }));
      setCustomerDetail(null); return notify(existing ? "Cliente actualizado en la demostración." : "Cliente creado en la demostración.");
    }
    const response = await fetch("/api/sales/customers", { method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return notify("No fue posible guardar el cliente. Revisa los campos e inténtalo otra vez.");
    const saved = await response.json() as Customer;
    setOverview((current) => ({ ...current, customers: existing ? current.customers.map((customer) => customer.id === saved.id ? saved : customer) : [saved, ...current.customers] }));
    setCustomerDetail(null); notify(existing ? "Cliente actualizado." : "Cliente creado.");
  }

  const isDetail = offerDetail !== null;
  const location = isDetail ? offerDetail.kind === "new" ? "Nueva oferta" : `Oferta Q-${offerDetail.quote.quoteNumber}` : view === "offers" ? "Ofertas" : view === "board" ? "Tablero" : view === "summary" ? "Resumen" : view === "customers" ? "Clientes" : "Ajustes";

  return <div className="protek-shell"><aside className="sidebar" aria-label="Navegación principal">
    <a className="wordmark" href="/app" aria-label="Protek Industrial"><span />protek</a>
    <div className="workspace-selector"><button className="workspace-switch" type="button" aria-haspopup="menu" aria-expanded={showCompanyMenu} onClick={() => setShowCompanyMenu((open) => !open)}><BriefcaseBusiness size={16} /><span>{overview.organizationName}</span><ChevronDown size={14} /></button>{showCompanyMenu && <div className="company-menu" role="menu" aria-label="Cambiar empresa">{overview.organizations.map((organization) => <button className={organization.id === overview.organizationId ? "is-active" : ""} key={organization.id} role="menuitem" type="button" onClick={() => void selectOrganization(organization.id)}><span>{organization.name}</span>{organization.id === overview.organizationId && <b>Activa</b>}</button>)}</div>}</div>
    <nav className="side-nav"><a href="#inicio"><LayoutDashboard size={16} />Inicio</a><a href="#ordenes"><ClipboardList size={16} />Órdenes <b>12</b></a><div className="nav-group"><a className={view !== "settings" ? "is-current" : ""} href="#ventas" onClick={() => resetSalesView("summary")}><BriefcaseBusiness size={16} />Ventas <ChevronDown size={14} /></a><div className="sales-submenu" aria-label="Secciones de Ventas">{([ ["summary", LineChart, "Resumen"], ["offers", FileText, "Ofertas"], ["board", Columns3, "Tablero"], ["customers", BriefcaseBusiness, "Clientes"] ] as const).map(([key, Icon, label]) => <button className={view === key && !isDetail ? "is-active" : ""} key={key} type="button" onClick={() => resetSalesView(key)}><Icon size={13} />{label}</button>)}</div></div><a href="#planeacion"><CalendarDays size={16} />Planeación</a><a href="#recursos"><HardHat size={16} />Recursos</a><a href="#almacen"><Package size={16} />Almacén</a><a href="#compras"><ShoppingCart size={16} />Compras</a><a href="#calidad"><ShieldCheck size={16} />Calidad</a><a href="#ingenieria"><FileText size={16} />Ingeniería</a><a href="#agente"><Bot size={16} />Agente IA <i /></a><a className={view === "settings" ? "is-current" : ""} href="#ajustes" onClick={() => resetSalesView("settings")}><Settings2 size={16} />Ajustes</a></nav>
    <div className="sidebar-account"><span>MR</span><div><b>Mariana Ruiz</b><small>Dirección comercial</small></div></div>
  </aside><main className="sales-main"><header className="topbar"><div className="breadcrumb"><span>Ventas</span><ChevronRight size={13} /><strong>{location}</strong></div><div className="topbar-actions"><button className="icon-button" type="button" aria-label="Buscar"><Search size={17} /></button><button className="icon-button alert" type="button" aria-label="Notificaciones"><Bell size={17} /></button><button className="period-button" type="button"><CalendarDays size={14} />Septiembre 2026<ChevronDown size={12} /></button></div></header>
    {isDetail ? <OfferDetailView customers={overview.customers} members={overview.members} initialQuote={offerDetail.kind === "existing" ? offerDetail.quote : undefined} onBack={() => setOfferDetail(null)} onSubmit={createQuote} onResponsibleChange={updateQuoteResponsible} onStatusChange={updateQuoteStatus} onArchive={archiveQuote} /> : <><div className="page-heading"><div><p className="eyebrow">MÓDULO / {view === "settings" ? "AJUSTES" : "VENTAS"}</p><h1>{view === "offers" ? "Ofertas" : view === "board" ? "Tablero comercial" : view === "summary" ? "Resumen comercial" : view === "customers" ? "Clientes" : "Ajustes"}</h1><p>{view === "offers" ? "Convierte oportunidades de servicio y refacciones en trabajo rentable." : view === "board" ? "Visibilidad del pipeline, sin separar los datos del trabajo que se cotiza." : view === "summary" ? "Resultados, conversión y seguimiento para decidir el siguiente movimiento." : view === "customers" ? "Empresas y contactos que concentran el historial comercial y operativo." : "Configura reglas, catálogos y automatizaciones para cada módulo."}</p></div>{view === "offers" ? <button className="primary-button" type="button" onClick={() => setOfferDetail({ kind: "new" })}><Plus size={16} />Nueva oferta</button> : view === "customers" ? <button className="primary-button" type="button" onClick={() => setCustomerDetail({ kind: "new" })}><Plus size={16} />Nuevo cliente</button> : null}</div>{view === "offers" && <OffersView quotes={filteredQuotes} allQuoteCount={overview.quotes.length} search={search} onSearch={setSearch} filters={filters} customers={overview.customers} members={overview.members} onFiltersChange={setFilters} onReset={resetFilters} selectedQuoteId={selectedQuoteId} onOpen={(quote) => { setSelectedQuoteId(quote.id); setOfferDetail({ kind: "existing", quote }); }} openQuotes={openQuotes.length} pipelineValue={pipelineValue} averageMargin={averageMargin} expiring={expiring} />}{view === "board" && <BoardView quotes={filteredQuotes} stages={overview.stages} customers={overview.customers} members={overview.members} filters={filters} onFiltersChange={setFilters} onReset={resetFilters} onMove={moveQuoteToStage} onOpen={(quote) => { setSelectedQuoteId(quote.id); setOfferDetail({ kind: "existing", quote }); }} />}{view === "summary" && <SummaryView overview={overview} pipelineValue={pipelineValue} pendingOffers={pendingOffers} expiring={expiring} onOpen={(quote) => { setSelectedQuoteId(quote.id); setOfferDetail({ kind: "existing", quote }); }} />}{view === "customers" && <CustomersView customers={overview.customers} detail={customerDetail} onCreate={() => setCustomerDetail({ kind: "new" })} onEdit={(customer) => setCustomerDetail({ kind: "existing", customer })} onCancel={() => setCustomerDetail(null)} onSave={saveCustomer} />}{view === "settings" && <SettingsView />}</>}
  </main><div className={`toast ${toast ? "is-visible" : ""}`} role="status">{toast}</div></div>;
}

function SalesFilters({ filters, customers, members, onChange, onReset }: { filters: SalesFilters; customers: Customer[]; members: Array<{ id: string; displayName: string }>; onChange: (filters: SalesFilters) => void; onReset: () => void }) {
  return <div className="sales-filters"><select aria-label="Filtrar por cliente" value={filters.customerId} onChange={(event) => onChange({ ...filters, customerId: event.target.value })}><option value="all">Todos los clientes</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}</select><select aria-label="Filtrar por responsable" value={filters.responsibleId} onChange={(event) => onChange({ ...filters, responsibleId: event.target.value })}><option value="all">Todos los responsables</option><option value="unassigned">Sin responsable</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select><select aria-label="Filtrar por tipo de oferta" value={filters.serviceMode} onChange={(event) => onChange({ ...filters, serviceMode: event.target.value })}><option value="all">Todos los tipos</option>{offerTypeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><button className="filter-reset" type="button" onClick={onReset}>Limpiar</button></div>;
}

function OffersView({ quotes, allQuoteCount, search, onSearch, filters, customers, members, onFiltersChange, onReset, selectedQuoteId, onOpen, openQuotes, pipelineValue, averageMargin, expiring }: { quotes: Quote[]; allQuoteCount: number; search: string; onSearch: (value: string) => void; filters: SalesFilters; customers: Customer[]; members: Array<{ id: string; displayName: string }>; onFiltersChange: (filters: SalesFilters) => void; onReset: () => void; selectedQuoteId: number; onOpen: (quote: Quote) => void; openQuotes: number; pipelineValue: number; averageMargin: number; expiring: number }) {
  return <section className="view-section"><div className="metric-grid"><Metric label="OFERTAS ABIERTAS" value={String(openQuotes)} note="En seguimiento comercial" /><Metric label="VALOR EN PIPELINE" value={compactMoney(pipelineValue)} note="Oportunidades no cerradas" /><Metric label="MARGEN ESTIMADO" value={`${averageMargin.toFixed(1)}%`} note="Sobre ofertas abiertas" neutral /><Metric label="POR VENCER" value={String(expiring)} note="Próximos 7 días" risk /></div><div className="offers-workspace offers-workspace-single"><div className="data-surface"><div className="surface-toolbar sales-toolbar"><SalesFilters filters={filters} customers={customers} members={members} onChange={onFiltersChange} onReset={onReset} /><label className="search-field"><Search size={15} /><span className="sr-only">Buscar ofertas</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar oferta" /></label></div><div className="quote-table" role="table" aria-label="Ofertas"><div className="quote-row quote-heading" role="row"><span>OFERTA</span><span>CLIENTE</span><span>IMPORTE</span><span>MARGEN</span><span>ETAPA</span><span>ACTUALIZADA</span></div>{quotes.map((quote) => <button className={`quote-row ${selectedQuoteId === quote.id ? "is-selected" : ""}`} key={quote.id} type="button" onClick={() => onOpen(quote)}><span><b>Q-{quote.quoteNumber}</b><small>{serviceLabel(quote.serviceMode)}</small></span><span>{quote.customerName}</span><span>{money(quote.totalAmount, quote.currencyCode)}</span><span className={quote.estimatedMarginPercent !== null && quote.estimatedMarginPercent < 28 ? "margin-risk" : "margin-good"}>{quote.estimatedMarginPercent?.toFixed(1) ?? "-"}%</span><span><em className={`status status-${quote.status}`}>{quote.stageName}</em></span><span>{relativeDate(quote.updatedAt)}</span></button>)}</div><footer className="table-footer"><span>Mostrando {quotes.length} de {allQuoteCount} ofertas</span><button type="button" onClick={onReset}>Restablecer vista <ArrowRight size={13} /></button></footer></div></div></section>;
}

function OfferDetailView({ customers, members, initialQuote, onBack, onSubmit, onResponsibleChange, onStatusChange, onArchive }: { customers: Customer[]; members: Array<{ id: string; displayName: string }>; initialQuote?: Quote; onBack: () => void; onSubmit: (form: FormData) => Promise<void>; onResponsibleChange: (quoteId: number, responsibleId: string) => void; onStatusChange: (quoteId: number, status: string) => void; onArchive: (quoteId: number) => void }) {
  const [tab, setTab] = useState<OfferTab>("general"); const [saving, setSaving] = useState(false); const [documentToDelete, setDocumentToDelete] = useState<AttachedDocument | null>(null); const [archiveConfirmation, setArchiveConfirmation] = useState(false); const [documents, setDocuments] = useState<AttachedDocument[]>(initialQuote ? [{ id: "scope", name: "Alcance técnico", fileName: `Alcance-Q-${initialQuote.quoteNumber}.pdf`, fileSize: "1.8 MB" }] : []); const [offerStatus, setOfferStatus] = useState(initialQuote?.status ?? "draft"); const isNew = !initialQuote;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!isNew) return; setSaving(true); await onSubmit(new FormData(event.currentTarget)); setSaving(false); }
  return <section className="offer-detail-view"><div className="detail-heading"><button className="back-button" type="button" onClick={onBack}><ArrowLeft size={15} />Volver a ofertas</button><div className="detail-title-row"><div><p className="eyebrow">VENTAS / {isNew ? "NUEVA OFERTA" : `OFERTA Q-${initialQuote.quoteNumber}`}</p><h1>{isNew ? "Nueva Oferta" : `Oferta Q-${initialQuote.quoteNumber}`}</h1><p>{isNew ? "Define el contexto comercial antes de preparar alcance, costos y condiciones." : "Revisa la información comercial y técnica vinculada a esta oferta."}</p></div>{!isNew && <div className="detail-actions"><em className={`status status-${offerStatus}`}>{statusLabel(offerStatus)}</em><button className="archive-button" type="button" onClick={() => setArchiveConfirmation(true)}><Archive size={14} />Archivar oferta</button></div>}</div></div><div className="detail-tabs" role="tablist" aria-label="Secciones de la oferta"><button className={tab === "general" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "general"} onClick={() => setTab("general")}><FileText size={14} />Información General</button><button className={tab === "technical" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "technical"} onClick={() => setTab("technical")}><Wrench size={14} />Información técnica</button></div><form className="detail-surface" onSubmit={submit}>{tab === "general" ? <OfferGeneralForm customers={customers} members={members} initialQuote={initialQuote} offerStatus={offerStatus} onStatusChange={(status) => { setOfferStatus(status); if (initialQuote) onStatusChange(initialQuote.id, status); }} documents={documents} onResponsibleChange={onResponsibleChange} onAttach={(document) => setDocuments((current) => [...current, document])} onRequestRemove={setDocumentToDelete} /> : <TechnicalInformation />}{isNew && <footer><button className="secondary-button" type="button" onClick={onBack}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Creando..." : "Crear oferta"}<ArrowRight size={15} /></button></footer>}</form>{documentToDelete && <ConfirmDocumentRemoval document={documentToDelete} onCancel={() => setDocumentToDelete(null)} onConfirm={() => { setDocuments((current) => current.filter((document) => document.id !== documentToDelete.id)); setDocumentToDelete(null); }} />}{archiveConfirmation && initialQuote && <ConfirmOfferArchive quote={initialQuote} onCancel={() => setArchiveConfirmation(false)} onConfirm={() => onArchive(initialQuote.id)} />}</section>;
}

function OfferGeneralForm({ customers, members, initialQuote, offerStatus, documents, onResponsibleChange, onStatusChange, onAttach, onRequestRemove }: { customers: Customer[]; members: Array<{ id: string; displayName: string }>; initialQuote?: Quote; offerStatus: string; documents: AttachedDocument[]; onResponsibleChange: (quoteId: number, responsibleId: string) => void; onStatusChange: (status: string) => void; onAttach: (document: AttachedDocument) => void; onRequestRemove: (document: AttachedDocument) => void }) {
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(initialQuote?.currencyCode ?? "MXN");
  return <div className="detail-form-grid"><div className="form-section-heading wide"><span>CONTEXTO COMERCIAL</span><small>Cliente, tipo y alcance de la oportunidad.</small></div><CustomerSelect customers={customers} defaultCustomerId={initialQuote?.customerId} /><label>Tipo de oferta<select name="serviceMode" defaultValue={initialQuote?.serviceMode ?? "workshop"} disabled={Boolean(initialQuote)}>{offerTypeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="wide">Nombre de la oferta<input name="title" required defaultValue={initialQuote?.title ?? ""} disabled={Boolean(initialQuote)} placeholder="Ej. Overhaul de cilindro hidráulico" /></label><label className="wide">Notas<textarea name="notes" defaultValue={initialQuote?.notes ?? ""} disabled={Boolean(initialQuote)} placeholder="Contexto comercial, alcance acordado o consideraciones para esta oferta." /></label><div className="form-section-heading wide"><span>SEGUIMIENTO</span><small>Propiedad y estado actual de la oferta.</small></div><label>Responsable<select name="responsibleId" defaultValue={initialQuote?.responsibleId ?? ""} onChange={(event) => initialQuote && onResponsibleChange(initialQuote.id, event.target.value)}><option value="">Sin responsable</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><OfferStatusField status={offerStatus} disabled={!initialQuote} onChange={onStatusChange} /><div className="form-section-heading wide"><span>CONDICIONES ECONÓMICAS</span><small>Valores, moneda y vigencia para la decisión comercial.</small></div><CurrencyInput name="amountBeforeTax" label="Valor antes de impuestos" currencyCode={currencyCode} initialValue={initialQuote?.totalAmount} disabled={Boolean(initialQuote)} /><CurrencyInput name="totalWithTax" label="Valor total con impuestos" currencyCode={currencyCode} initialValue={initialQuote?.totalAmount} disabled={Boolean(initialQuote)} /><label>Moneda<select name="currencyCode" value={currencyCode} disabled={Boolean(initialQuote)} onChange={(event) => setCurrencyCode(event.target.value as CurrencyCode)}>{(Object.keys(currencyNames) as CurrencyCode[]).map((code) => <option key={code} value={code}>{code} · {currencyNames[code]}</option>)}</select></label><label>Vigencia<input name="validUntil" type="date" defaultValue={initialQuote?.validUntil ?? ""} disabled={Boolean(initialQuote)} /></label><OfferDocuments documents={documents} onAttach={onAttach} onRequestRemove={onRequestRemove} /></div>;
}

function OfferStatusField({ status, disabled, onChange }: { status: string; disabled: boolean; onChange: (status: string) => void }) {
  const selectableStatuses = ["draft", "pending_approval", "sent", "negotiation", "approved", "rejected"];
  return <label className="status-field">Estatus de la oferta<div className={`status-picker status-${status}`}><select aria-label="Estatus de la oferta" value={status} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{selectableStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select><ChevronDown size={14} /></div></label>;
}

function OfferDocuments({ documents, onAttach, onRequestRemove }: { documents: AttachedDocument[]; onAttach: (document: AttachedDocument) => void; onRequestRemove: (document: AttachedDocument) => void }) {
  const [name, setName] = useState(""); const [file, setFile] = useState<File | null>(null);
  function attach() {
    if (!name.trim() || !file) return;
    onAttach({ id: `${file.name}-${file.lastModified}`, name: name.trim(), fileName: file.name, fileSize: `${Math.max(file.size / 1_000_000, 0.1).toFixed(1)} MB` });
    setName(""); setFile(null);
  }
  return <section className="offer-documents wide"><div className="document-intake"><label>Nombre del documento<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Propuesta técnica" /></label><label>Archivo<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button className="secondary-button" type="button" disabled={!name.trim() || !file} onClick={attach}><Plus size={14} />Adjuntar</button></div>{documents.length > 0 ? <div className="document-list">{documents.map((document) => <div className="document-row" key={document.id}><FileText size={17} /><div><b>{document.name}</b><small>{document.fileName} · {document.fileSize}</small></div><button className="icon-button danger-button" type="button" aria-label={`Eliminar ${document.name}`} onClick={() => onRequestRemove(document)}><Trash2 size={15} /></button></div>)}</div> : <div className="empty-documents">Aún no hay documentos relacionados.</div>}</section>;
}

function ConfirmDocumentRemoval({ document, onCancel, onConfirm }: { document: AttachedDocument; onCancel: () => void; onConfirm: () => void }) {
  return <div className="confirm-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-document-title"><span>CONFIRMAR ELIMINACIÓN</span><h2 id="remove-document-title">¿Eliminar este documento?</h2><p><b>{document.name}</b> dejará de estar asociado a esta oferta. Esta acción no se puede deshacer.</p><footer><button className="secondary-button" type="button" onClick={onCancel}>Conservar documento</button><button className="danger-action" type="button" onClick={onConfirm}>Eliminar documento <Trash2 size={14} /></button></footer></section></div>;
}

function ConfirmOfferArchive({ quote, onCancel, onConfirm }: { quote: Quote; onCancel: () => void; onConfirm: () => void }) {
  return <div className="confirm-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-offer-title"><span>ARCHIVAR OFERTA</span><h2 id="archive-offer-title">¿Archivar la oferta Q-{quote.quoteNumber}?</h2><p>Dejará de aparecer en las vistas operativas, pero su historial comercial se conservará.</p><footer><button className="secondary-button" type="button" onClick={onCancel}>Conservar oferta</button><button className="danger-action" type="button" onClick={onConfirm}>Archivar oferta <Archive size={14} /></button></footer></section></div>;
}

function CustomerSelect({ customers, defaultCustomerId }: { customers: Customer[]; defaultCustomerId?: number }) {
  const [query, setQuery] = useState(""); const [selectedId, setSelectedId] = useState(defaultCustomerId ?? 0); const [isOpen, setIsOpen] = useState(false);
  const selected = customers.find((customer) => customer.id === selectedId); const visible = customers.filter((customer) => customer.status !== "inactive" && customer.displayName.toLocaleLowerCase("es-MX").includes(query.toLocaleLowerCase("es-MX")));
  return <label className="customer-select">Cliente<input type="hidden" name="customerId" value={selectedId} /><button className="customer-trigger" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} disabled={Boolean(defaultCustomerId)}><span>{selected?.displayName ?? "Selecciona un cliente"}</span><ChevronDown size={14} /></button>{isOpen && <div className="customer-options"><label className="customer-search"><Search size={13} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente" /></label><div>{visible.length ? visible.map((customer) => <button key={customer.id} type="button" onClick={() => { setSelectedId(customer.id); setIsOpen(false); setQuery(""); }}><span>{customer.displayName}</span><small>{customer.accountCode ?? "Sin código"}</small></button>) : <p>Sin coincidencias.</p>}</div></div>}</label>;
}

function CurrencyInput({ name, label, currencyCode, initialValue, disabled }: { name: string; label: string; currencyCode: CurrencyCode; initialValue?: number; disabled?: boolean }) {
  const [value, setValue] = useState(initialValue ?? 0);
  return <label className="currency-input">{label}<span><b>{currencyCode}</b><input name={name} inputMode="decimal" value={value ? money(value, currencyCode) : ""} disabled={disabled} onChange={(event) => setValue(Number(event.target.value.replace(/[^0-9.-]/g, "")) || 0)} placeholder={money(0, currencyCode)} /></span></label>;
}

function TechnicalInformation() {
  const [templateId, setTemplateId] = useState(technicalTemplates[0]?.id ?? "");
  const selectedTemplate = technicalTemplates.find((template) => template.id === templateId) ?? technicalTemplates[0];
  return <div className="technical-panel"><div className="technical-grid"><label>Activo o equipo<input placeholder="Seleccionar activo del cliente" /></label><label>Plantilla<select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{technicalTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>{selectedTemplate.fields.map((field) => <label key={field.key}>{field.label}<input inputMode={field.inputMode} placeholder={field.label} /></label>)}<label className="wide">Condición reportada<textarea placeholder="Falla, síntoma, alcance solicitado y restricciones operativas." /></label></div><div className="technical-flow"><span><Wrench size={14} />Órdenes</span><ArrowRight size={14} /><span><ShieldCheck size={14} />Calidad</span><ArrowRight size={14} /><span><FileText size={14} />Ingeniería</span></div></div>;
}

function CustomersView({ customers, detail, onCreate, onEdit, onCancel, onSave }: { customers: Customer[]; detail: CustomerDetail; onCreate: () => void; onEdit: (customer: Customer) => void; onCancel: () => void; onSave: (form: FormData, existing?: Customer) => Promise<void> }) {
  if (detail) return <CustomerEditor existingCustomer={detail.kind === "existing" ? detail.customer : undefined} onCancel={onCancel} onSave={onSave} />;
  return <section className="view-section"><div className="data-surface customer-surface"><div className="surface-toolbar"><strong>{customers.length} clientes registrados</strong><button className="secondary-button" type="button" onClick={onCreate}><Plus size={14} />Nuevo cliente</button></div><div className="customer-table"><div className="customer-row customer-heading"><span>CLIENTE</span><span>RAZÓN SOCIAL</span><span>CÓDIGO</span><span>ESTADO</span><span /></div>{customers.map((customer) => <div className="customer-row" key={customer.id}><span><b>{customer.displayName}</b><small>{customer.taxId ?? "RFC pendiente"}</small></span><span>{customer.legalName ?? "Sin razón social"}</span><span>{customer.accountCode ?? "-"}</span><span><em className={`status status-${customer.status}`}>{customer.status === "active" ? "Activo" : customer.status === "prospect" ? "Prospecto" : "Inactivo"}</em></span><button className="icon-button" type="button" aria-label={`Editar ${customer.displayName}`} onClick={() => onEdit(customer)}><Pencil size={15} /></button></div>)}</div></div></section>;
}

function CustomerEditor({ existingCustomer, onCancel, onSave }: { existingCustomer?: Customer; onCancel: () => void; onSave: (form: FormData, existing?: Customer) => Promise<void> }) {
  const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); await onSave(new FormData(event.currentTarget), existingCustomer); setSaving(false); }
  return <section className="customer-editor"><button className="back-button" type="button" onClick={onCancel}><ArrowLeft size={15} />Volver a clientes</button><div className="detail-heading compact"><div><p className="eyebrow">VENTAS / CLIENTES</p><h1>{existingCustomer ? "Editar cliente" : "Nuevo cliente"}</h1><p>La información comercial queda disponible para ofertas, órdenes y servicio.</p></div></div><form className="detail-surface" onSubmit={submit}><div className="detail-form-grid"><label>Nombre comercial<input name="displayName" required defaultValue={existingCustomer?.displayName ?? ""} placeholder="Nombre con el que opera" /></label><label>Estado<select name="status" defaultValue={existingCustomer?.status ?? "prospect"}><option value="prospect">Prospecto</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label><label className="wide">Razón social<input name="legalName" defaultValue={existingCustomer?.legalName ?? ""} placeholder="Razón social o nombre fiscal" /></label><label>RFC<input name="taxId" defaultValue={existingCustomer?.taxId ?? ""} placeholder="RFC" /></label><label>Código de cliente<input name="accountCode" defaultValue={existingCustomer?.accountCode ?? ""} placeholder="Ej. CL-001" /></label></div><footer><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Guardando..." : "Guardar cliente"}<ArrowRight size={15} /></button></footer></form></section>;
}

function BoardView({ quotes, stages, customers, members, filters, onFiltersChange, onReset, onMove, onOpen }: { quotes: Quote[]; stages: Stage[]; customers: Customer[]; members: Array<{ id: string; displayName: string }>; filters: SalesFilters; onFiltersChange: (filters: SalesFilters) => void; onReset: () => void; onMove: (quoteId: number, stageId: number) => void; onOpen: (quote: Quote) => void }) {
  return <section className="view-section"><div className="crm-head"><div><strong>{quotes.length} ofertas visibles</strong><span>Arrastra una oferta entre etapas para actualizar su estatus.</span></div></div><SalesFilters filters={filters} customers={customers} members={members} onChange={onFiltersChange} onReset={onReset} /><div className="kanban">{stages.filter((stage) => stage.outcome !== "lost").map((stage) => { const stageQuotes = quotes.filter((quote) => quote.stageKey === stage.key); return <section className="kanban-column drop-target" key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const quoteId = Number(event.dataTransfer.getData("text/plain")); if (Number.isSafeInteger(quoteId)) onMove(quoteId, stage.id); }}><header><span><i className={`stage-dot stage-${stage.key}`} />{stage.name}</span><b>{stageQuotes.length}</b></header><div className="kanban-value">{compactMoney(stageQuotes.reduce((sum, item) => sum + item.totalAmount, 0))}</div>{stageQuotes.map((quote) => <article className="deal-card" draggable key={quote.id} onDragStart={(event) => event.dataTransfer.setData("text/plain", String(quote.id))} onClick={() => onOpen(quote)}><span>{serviceLabel(quote.serviceMode)}</span><h3>{quote.title}</h3><p>{quote.customerName}</p><footer><strong>{compactMoney(quote.totalAmount, quote.currencyCode)}</strong><i>{quote.responsibleName ? quote.responsibleName.slice(0, 2).toUpperCase() : "--"}</i></footer></article>)}</section>; })}</div></section>;
}

function SummaryView({ overview, pipelineValue, pendingOffers, expiring, onOpen }: { overview: SalesOverview; pipelineValue: number; pendingOffers: number; expiring: number; onOpen: (quote: Quote) => void }) {
  const recentQuotes = [...overview.quotes].sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()).slice(0, 10);
  const conversion = Math.round((overview.opportunities.filter((item) => item.stageKey === "won").length / Math.max(overview.opportunities.length, 1)) * 100);

  return <section className="view-section">
    <div className="summary-intro"><span>SEPTIEMBRE 2026</span><h2>Seguimiento comercial con prioridad visible.</h2></div>
    <div className="summary-kpis">
      <Kpi label="PIPELINE ACTIVO" value={compactMoney(pipelineValue)} detail="Oportunidades no cerradas" />
      <Kpi label="CONVERSIÓN" value={`${conversion}%`} detail="Oportunidad a ganada" />
      <Kpi label="OFERTAS PENDIENTES" value={String(pendingOffers)} detail="Sin actualización en 30 días" risk />
      <Kpi label="OFERTAS POR VENCER" value={String(expiring)} detail="Requieren seguimiento" risk />
    </div>
    <div className="summary-grid">
      <article className="dashboard-panel"><header><div><span>PIPELINE POR ETAPA</span><h3>{compactMoney(pipelineValue)}</h3></div></header><div className="bar-chart">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => { const value = overview.opportunities.filter((item) => item.stageId === stage.id).reduce((sum, item) => sum + item.estimatedRevenue, 0); const max = Math.max(...overview.stages.map((item) => overview.opportunities.filter((opportunity) => opportunity.stageId === item.id).reduce((sum, opportunity) => sum + opportunity.estimatedRevenue, 0)), 1); return <div key={stage.id}><span>{stage.name}</span><i><b style={{ width: `${(value / max) * 100}%` }} /></i><strong>{compactMoney(value)}</strong></div>; })}</div></article>
      <article className="dashboard-panel"><header><div><span>EMBUDO COMERCIAL</span><h3>{overview.opportunities.length} oportunidades</h3></div></header><div className="funnel">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => <div key={stage.id} style={{ width: `${Math.max(42, 100 - stage.position * 0.9)}%` }}><b>{overview.opportunities.filter((item) => item.stageId === stage.id).length}</b><span>{stage.name}</span></div>)}</div></article>
    </div>
    <div className="data-surface summary-recent-offers">
      <div className="surface-toolbar"><strong>Últimas ofertas actualizadas</strong><span>10 movimientos más recientes</span></div>
      <div className="quote-table" role="table" aria-label="Últimas ofertas actualizadas">
        <div className="quote-row quote-heading" role="row"><span>OFERTA</span><span>CLIENTE</span><span>IMPORTE</span><span>MARGEN</span><span>ETAPA</span><span>ACTUALIZADA</span></div>
        {recentQuotes.map((quote) => <button className="quote-row" key={quote.id} type="button" onClick={() => onOpen(quote)}><span><b>Q-{quote.quoteNumber}</b><small>{serviceLabel(quote.serviceMode)}</small></span><span>{quote.customerName}</span><span>{money(quote.totalAmount, quote.currencyCode)}</span><span className={quote.estimatedMarginPercent !== null && quote.estimatedMarginPercent < 28 ? "margin-risk" : "margin-good"}>{quote.estimatedMarginPercent?.toFixed(1) ?? "-"}%</span><span><em className={`status status-${quote.status}`}>{quote.stageName}</em></span><span>{relativeDate(quote.updatedAt)}</span></button>)}
      </div>
      <footer className="table-footer"><span>Mostrando {recentQuotes.length} de {overview.quotes.length} ofertas</span></footer>
    </div>
  </section>;
}

function SettingsView() { const [active, setActive] = useState("Ventas"); const modules = ["Ventas", "Órdenes", "Planeación", "Recursos", "Almacén", "Compras", "Calidad", "Ingeniería", "Agente IA"]; return <section className="settings-view"><div className="settings-tabs" role="tablist" aria-label="Ajustes por módulo">{modules.map((module) => <button className={active === module ? "is-active" : ""} key={module} type="button" role="tab" aria-selected={active === module} onClick={() => setActive(module)}>{module}</button>)}</div><article className="settings-surface"><div><span>AJUSTES / {active.toUpperCase()}</span><h2>Configuración de {active}</h2><p>Define catálogos, reglas, autorizaciones y automatizaciones que aplican a este módulo.</p></div><div className="settings-options">{active === "Ventas" && <button type="button"><b>Plantillas técnicas de oferta</b><small>Crea y ajusta campos personalizados para Información técnica.</small><ChevronRight size={15} /></button>}<button type="button"><b>Flujos y estados</b><small>Etapas, transiciones y responsables.</small><ChevronRight size={15} /></button><button type="button"><b>Campos y catálogos</b><small>Información obligatoria y listas operativas.</small><ChevronRight size={15} /></button><button type="button"><b>Permisos del módulo</b><small>Acceso por empresa, nivel y equipo.</small><ChevronRight size={15} /></button><button type="button"><b>Automatizaciones</b><small>Acciones y notificaciones disparadas por eventos.</small><ChevronRight size={15} /></button></div></article></section>; }

function Metric({ label, value, note, neutral, risk }: { label: string; value: string; note: string; neutral?: boolean; risk?: boolean }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small className={risk ? "risk" : neutral ? "neutral" : ""}>{note}</small></article>; }
function Kpi({ label, value, detail, risk }: { label: string; value: string; detail: string; risk?: boolean }) { return <article className="kpi"><span>{label}</span><strong>{value}</strong><small className={risk ? "risk" : ""}>{detail}</small></article>; }
