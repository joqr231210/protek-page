"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bell, Bot, BriefcaseBusiness, CalendarDays, ChevronDown,
  ChevronRight, ClipboardList, Columns3, FileText, HardHat, LayoutDashboard,
  LineChart, Package, Pencil, Plus, Search, Settings2, ShieldCheck, ShoppingCart,
  SlidersHorizontal, Wrench,
} from "lucide-react";
import type { CurrencyCode, Customer, Quote, SalesOverview, ServiceMode } from "./types";

type View = "offers" | "board" | "summary" | "customers" | "settings";
type OfferDetail = { kind: "new" } | { kind: "existing"; quote: Quote } | null;
type CustomerDetail = { kind: "new" } | { kind: "existing"; customer: Customer } | null;
type OfferTab = "general" | "technical";

const currencyNames: Record<CurrencyCode, string> = { MXN: "Peso mexicano", USD: "Dólar estadounidense", EUR: "Euro" };

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
  const [view, setView] = useState<View>("offers");
  const [offerDetail, setOfferDetail] = useState<OfferDetail>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState(initialOverview.quotes[0]?.id ?? 0);
  const [search, setSearch] = useState("");
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [toast, setToast] = useState("");

  const filteredQuotes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es-MX");
    return needle ? overview.quotes.filter((quote) => [quote.customerName, quote.title, `q-${quote.quoteNumber}`, statusLabel(quote.status)].join(" ").toLocaleLowerCase("es-MX").includes(needle)) : overview.quotes;
  }, [overview.quotes, search]);
  const openQuotes = overview.quotes.filter((quote) => !["approved", "rejected", "cancelled", "expired"].includes(quote.status));
  const pipelineValue = overview.opportunities.filter((opportunity) => opportunity.stageKey !== "won" && opportunity.stageKey !== "lost").reduce((sum, opportunity) => sum + opportunity.estimatedRevenue, 0);
  const averageMargin = openQuotes.length ? openQuotes.reduce((sum, quote) => sum + (quote.estimatedMarginPercent ?? 0), 0) / openQuotes.length : 0;
  const expiring = openQuotes.filter((quote) => quote.validUntil && new Date(`${quote.validUntil}T23:59:59`).getTime() - Date.now() < 7 * 86_400_000).length;

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3200); }
  function resetSalesView(nextView: View) { setView(nextView); setOfferDetail(null); setCustomerDetail(null); }

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
    const payload = { organizationId: overview.organizationId, customerId: Number(form.get("customerId")), title: String(form.get("title") ?? ""), serviceMode: String(form.get("serviceMode") ?? "workshop"), currencyCode: String(form.get("currencyCode") ?? "MXN"), estimatedRevenue: parseMoney(form.get("estimatedRevenue")), estimatedCost: parseMoney(form.get("estimatedCost")), validUntil: String(form.get("validUntil") ?? "") };
    const customer = overview.customers.find((item) => item.id === payload.customerId);
    if (!customer) return notify("Selecciona un cliente registrado para continuar.");
    if (overview.isDemo) {
      const quoteNumber = Math.max(...overview.quotes.map((quote) => quote.quoteNumber), 2000) + 1;
      const quote: Quote = { id: quoteNumber, quoteNumber, customerId: customer.id, customerName: customer.displayName, title: payload.title, serviceMode: payload.serviceMode as ServiceMode, currencyCode: payload.currencyCode as CurrencyCode, totalAmount: payload.estimatedRevenue, estimatedMarginPercent: payload.estimatedRevenue > 0 ? ((payload.estimatedRevenue - payload.estimatedCost) / payload.estimatedRevenue) * 100 : null, status: "draft", stageKey: "new", stageName: "Nueva oportunidad", updatedAt: new Date().toISOString(), validUntil: payload.validUntil || null };
      setOverview((current) => ({ ...current, quotes: [quote, ...current.quotes] })); setSelectedQuoteId(quote.id); setOfferDetail(null);
      return notify(`Oferta Q-${quoteNumber} creada en la demostración.`);
    }
    const response = await fetch("/api/sales/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return notify("No fue posible crear la oferta. Revisa los campos e inténtalo otra vez.");
    const created = await response.json() as { id: number; quoteNumber: number };
    const quote: Quote = { id: created.id, quoteNumber: created.quoteNumber, customerId: customer.id, customerName: customer.displayName, title: payload.title, serviceMode: payload.serviceMode as ServiceMode, currencyCode: payload.currencyCode as CurrencyCode, totalAmount: payload.estimatedRevenue, estimatedMarginPercent: payload.estimatedRevenue > 0 ? ((payload.estimatedRevenue - payload.estimatedCost) / payload.estimatedRevenue) * 100 : null, status: "draft", stageKey: "new", stageName: "Nueva oportunidad", updatedAt: new Date().toISOString(), validUntil: payload.validUntil || null };
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
    <a className="wordmark" href="/sales" aria-label="Protek Industrial"><span />protek</a>
    <div className="workspace-selector"><button className="workspace-switch" type="button" aria-haspopup="menu" aria-expanded={showCompanyMenu} onClick={() => setShowCompanyMenu((open) => !open)}><BriefcaseBusiness size={16} /><span>{overview.organizationName}</span><ChevronDown size={14} /></button>{showCompanyMenu && <div className="company-menu" role="menu" aria-label="Cambiar empresa">{overview.organizations.map((organization) => <button className={organization.id === overview.organizationId ? "is-active" : ""} key={organization.id} role="menuitem" type="button" onClick={() => void selectOrganization(organization.id)}><span>{organization.name}</span>{organization.id === overview.organizationId && <b>Activa</b>}</button>)}</div>}</div>
    <nav className="side-nav"><a href="#inicio"><LayoutDashboard size={16} />Inicio</a><a href="#ordenes"><ClipboardList size={16} />Órdenes <b>12</b></a><div className="nav-group"><a className={view !== "settings" ? "is-current" : ""} href="#ventas" onClick={() => resetSalesView("offers")}><BriefcaseBusiness size={16} />Ventas <ChevronDown size={14} /></a><div className="sales-submenu" aria-label="Secciones de Ventas">{([ ["offers", FileText, "Ofertas"], ["board", Columns3, "Tablero"], ["summary", LineChart, "Resumen"], ["customers", BriefcaseBusiness, "Clientes"] ] as const).map(([key, Icon, label]) => <button className={view === key && !isDetail ? "is-active" : ""} key={key} type="button" onClick={() => resetSalesView(key)}><Icon size={13} />{label}</button>)}</div></div><a href="#planeacion"><CalendarDays size={16} />Planeación</a><a href="#recursos"><HardHat size={16} />Recursos</a><a href="#almacen"><Package size={16} />Almacén</a><a href="#compras"><ShoppingCart size={16} />Compras</a><a href="#calidad"><ShieldCheck size={16} />Calidad</a><a href="#ingenieria"><FileText size={16} />Ingeniería</a><a href="#agente"><Bot size={16} />Agente IA <i /></a><a className={view === "settings" ? "is-current" : ""} href="#ajustes" onClick={() => resetSalesView("settings")}><Settings2 size={16} />Ajustes</a></nav>
    <div className="sidebar-account"><span>MR</span><div><b>Mariana Ruiz</b><small>Dirección comercial</small></div></div>
  </aside><main className="sales-main"><header className="topbar"><div className="breadcrumb"><span>Ventas</span><ChevronRight size={13} /><strong>{location}</strong></div><div className="topbar-actions"><button className="icon-button" type="button" aria-label="Buscar"><Search size={17} /></button><button className="icon-button alert" type="button" aria-label="Notificaciones"><Bell size={17} /></button><button className="period-button" type="button"><CalendarDays size={14} />Septiembre 2026<ChevronDown size={12} /></button></div></header>
    {isDetail ? <OfferDetailView customers={overview.customers} initialQuote={offerDetail.kind === "existing" ? offerDetail.quote : undefined} onBack={() => setOfferDetail(null)} onSubmit={createQuote} /> : <><div className="page-heading"><div><p className="eyebrow">MÓDULO / {view === "settings" ? "AJUSTES" : "VENTAS"}</p><h1>{view === "offers" ? "Ofertas" : view === "board" ? "Tablero comercial" : view === "summary" ? "Resumen comercial" : view === "customers" ? "Clientes" : "Ajustes"}</h1><p>{view === "offers" ? "Convierte oportunidades de servicio y refacciones en trabajo rentable." : view === "board" ? "Visibilidad del pipeline, sin separar los datos del trabajo que se cotiza." : view === "summary" ? "Resultados, conversión y margen para decidir el siguiente movimiento." : view === "customers" ? "Empresas y contactos que concentran el historial comercial y operativo." : "Configura reglas, catálogos y automatizaciones para cada módulo."}</p></div>{view === "offers" ? <button className="primary-button" type="button" onClick={() => setOfferDetail({ kind: "new" })}><Plus size={16} />Nueva oferta</button> : view === "customers" ? <button className="primary-button" type="button" onClick={() => setCustomerDetail({ kind: "new" })}><Plus size={16} />Nuevo cliente</button> : null}</div>{view === "offers" && <OffersView quotes={filteredQuotes} allQuoteCount={overview.quotes.length} search={search} onSearch={setSearch} onReset={() => setSearch("")} selectedQuoteId={selectedQuoteId} onOpen={(quote) => { setSelectedQuoteId(quote.id); setOfferDetail({ kind: "existing", quote }); }} openQuotes={openQuotes.length} pipelineValue={pipelineValue} averageMargin={averageMargin} expiring={expiring} />}{view === "board" && <BoardView overview={overview} />}{view === "summary" && <SummaryView overview={overview} pipelineValue={pipelineValue} averageMargin={averageMargin} expiring={expiring} />}{view === "customers" && <CustomersView customers={overview.customers} detail={customerDetail} onCreate={() => setCustomerDetail({ kind: "new" })} onEdit={(customer) => setCustomerDetail({ kind: "existing", customer })} onCancel={() => setCustomerDetail(null)} onSave={saveCustomer} />}{view === "settings" && <SettingsView />}</>}
  </main><div className={`toast ${toast ? "is-visible" : ""}`} role="status">{toast}</div></div>;
}

function OffersView({ quotes, allQuoteCount, search, onSearch, onReset, selectedQuoteId, onOpen, openQuotes, pipelineValue, averageMargin, expiring }: { quotes: Quote[]; allQuoteCount: number; search: string; onSearch: (value: string) => void; onReset: () => void; selectedQuoteId: number; onOpen: (quote: Quote) => void; openQuotes: number; pipelineValue: number; averageMargin: number; expiring: number }) {
  return <section className="view-section"><div className="metric-grid"><Metric label="OFERTAS ABIERTAS" value={String(openQuotes)} note="En seguimiento comercial" /><Metric label="VALOR EN PIPELINE" value={compactMoney(pipelineValue)} note="Oportunidades no cerradas" /><Metric label="MARGEN ESTIMADO" value={`${averageMargin.toFixed(1)}%`} note="Sobre ofertas abiertas" neutral /><Metric label="POR VENCER" value={String(expiring)} note="Próximos 7 días" risk /></div><div className="offers-workspace offers-workspace-single"><div className="data-surface"><div className="surface-toolbar"><div className="filter-group"><button className="filter-button" type="button"><SlidersHorizontal size={14} />Todos los estados<ChevronDown size={12} /></button></div><label className="search-field"><Search size={15} /><span className="sr-only">Buscar ofertas</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar oferta" /></label></div><div className="quote-table" role="table" aria-label="Ofertas"><div className="quote-row quote-heading" role="row"><span>OFERTA</span><span>CLIENTE</span><span>IMPORTE</span><span>MARGEN</span><span>ETAPA</span><span>ACTUALIZADA</span></div>{quotes.map((quote) => <button className={`quote-row ${selectedQuoteId === quote.id ? "is-selected" : ""}`} key={quote.id} type="button" onClick={() => onOpen(quote)}><span><b>Q-{quote.quoteNumber}</b><small>{serviceLabel(quote.serviceMode)}</small></span><span>{quote.customerName}</span><span>{money(quote.totalAmount, quote.currencyCode)}</span><span className={quote.estimatedMarginPercent !== null && quote.estimatedMarginPercent < 28 ? "margin-risk" : "margin-good"}>{quote.estimatedMarginPercent?.toFixed(1) ?? "-"}%</span><span><em className={`status status-${quote.status}`}>{statusLabel(quote.status)}</em></span><span>{relativeDate(quote.updatedAt)}</span></button>)}</div><footer className="table-footer"><span>Mostrando {quotes.length} de {allQuoteCount} ofertas</span><button type="button" onClick={onReset}>Restablecer vista <ArrowRight size={13} /></button></footer></div></div></section>;
}

function OfferDetailView({ customers, initialQuote, onBack, onSubmit }: { customers: Customer[]; initialQuote?: Quote; onBack: () => void; onSubmit: (form: FormData) => Promise<void> }) {
  const [tab, setTab] = useState<OfferTab>("general"); const [saving, setSaving] = useState(false); const isNew = !initialQuote;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!isNew) return; setSaving(true); await onSubmit(new FormData(event.currentTarget)); setSaving(false); }
  return <section className="offer-detail-view"><div className="detail-heading"><button className="back-button" type="button" onClick={onBack}><ArrowLeft size={15} />Volver a ofertas</button><div><p className="eyebrow">VENTAS / {isNew ? "NUEVA OFERTA" : `OFERTA Q-${initialQuote.quoteNumber}`}</p><h1>{isNew ? "Nueva Oferta" : `Oferta Q-${initialQuote.quoteNumber}`}</h1><p>{isNew ? "Define el contexto comercial antes de preparar alcance, costos y condiciones." : "Revisa la información comercial y técnica vinculada a esta oferta."}</p></div></div><div className="detail-tabs" role="tablist" aria-label="Secciones de la oferta"><button className={tab === "general" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "general"} onClick={() => setTab("general")}><FileText size={14} />Información General</button><button className={tab === "technical" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "technical"} onClick={() => setTab("technical")}><Wrench size={14} />Información técnica</button></div><form className="detail-surface" onSubmit={submit}>{tab === "general" ? <OfferGeneralForm customers={customers} initialQuote={initialQuote} /> : <TechnicalInformation />}{isNew && <footer><button className="secondary-button" type="button" onClick={onBack}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Creando..." : "Crear oferta"}<ArrowRight size={15} /></button></footer>}</form></section>;
}

function OfferGeneralForm({ customers, initialQuote }: { customers: Customer[]; initialQuote?: Quote }) {
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(initialQuote?.currencyCode ?? "MXN");
  return <div className="detail-form-grid"><CustomerSelect customers={customers} defaultCustomerId={initialQuote?.customerId} /><label>Tipo de oferta<select name="serviceMode" defaultValue={initialQuote?.serviceMode ?? "workshop"} disabled={Boolean(initialQuote)}><option value="workshop">Servicio en taller</option><option value="field">Servicio en campo</option><option value="parts">Refaccionamiento</option></select></label><label className="wide">Nombre de la oferta<input name="title" required defaultValue={initialQuote?.title ?? ""} disabled={Boolean(initialQuote)} placeholder="Ej. Overhaul de cilindro hidráulico" /></label><label>Moneda<select name="currencyCode" value={currencyCode} disabled={Boolean(initialQuote)} onChange={(event) => setCurrencyCode(event.target.value as CurrencyCode)}>{(Object.keys(currencyNames) as CurrencyCode[]).map((code) => <option key={code} value={code}>{code} · {currencyNames[code]}</option>)}</select></label><div className="form-spacer" /><CurrencyInput name="estimatedRevenue" label="Venta estimada" currencyCode={currencyCode} initialValue={initialQuote?.totalAmount} disabled={Boolean(initialQuote)} /><CurrencyInput name="estimatedCost" label="Costo estimado" currencyCode={currencyCode} disabled={Boolean(initialQuote)} /><label>Vigencia<input name="validUntil" type="date" defaultValue={initialQuote?.validUntil ?? ""} disabled={Boolean(initialQuote)} /></label></div>;
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

function TechnicalInformation() { return <div className="technical-panel"><div><span>ACTIVO Y ALCANCE</span><h2>Contexto técnico de la oferta</h2><p>Documenta equipo, condición reportada y la información que deberá llegar a Órdenes, Calidad e Ingeniería al autorizarse.</p></div><div className="technical-grid"><label>Activo o equipo<input placeholder="Seleccionar activo del cliente" /></label><label>Referencia técnica<input placeholder="Modelo, serie o identificador" /></label><label className="wide">Condición reportada<textarea placeholder="Falla, síntoma, alcance solicitado y restricciones operativas." /></label><label className="wide">Entregables técnicos<textarea placeholder="Pruebas, reporte, planos, fotografías o documentación requerida." /></label></div><div className="technical-flow"><span><Wrench size={14} />Órdenes</span><ArrowRight size={14} /><span><ShieldCheck size={14} />Calidad</span><ArrowRight size={14} /><span><FileText size={14} />Ingeniería</span></div></div>; }

function CustomersView({ customers, detail, onCreate, onEdit, onCancel, onSave }: { customers: Customer[]; detail: CustomerDetail; onCreate: () => void; onEdit: (customer: Customer) => void; onCancel: () => void; onSave: (form: FormData, existing?: Customer) => Promise<void> }) {
  if (detail) return <CustomerEditor existingCustomer={detail.kind === "existing" ? detail.customer : undefined} onCancel={onCancel} onSave={onSave} />;
  return <section className="view-section"><div className="data-surface customer-surface"><div className="surface-toolbar"><strong>{customers.length} clientes registrados</strong><button className="secondary-button" type="button" onClick={onCreate}><Plus size={14} />Nuevo cliente</button></div><div className="customer-table"><div className="customer-row customer-heading"><span>CLIENTE</span><span>RAZÓN SOCIAL</span><span>CÓDIGO</span><span>ESTADO</span><span /></div>{customers.map((customer) => <div className="customer-row" key={customer.id}><span><b>{customer.displayName}</b><small>{customer.taxId ?? "RFC pendiente"}</small></span><span>{customer.legalName ?? "Sin razón social"}</span><span>{customer.accountCode ?? "-"}</span><span><em className={`status status-${customer.status}`}>{customer.status === "active" ? "Activo" : customer.status === "prospect" ? "Prospecto" : "Inactivo"}</em></span><button className="icon-button" type="button" aria-label={`Editar ${customer.displayName}`} onClick={() => onEdit(customer)}><Pencil size={15} /></button></div>)}</div></div></section>;
}

function CustomerEditor({ existingCustomer, onCancel, onSave }: { existingCustomer?: Customer; onCancel: () => void; onSave: (form: FormData, existing?: Customer) => Promise<void> }) {
  const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); await onSave(new FormData(event.currentTarget), existingCustomer); setSaving(false); }
  return <section className="customer-editor"><button className="back-button" type="button" onClick={onCancel}><ArrowLeft size={15} />Volver a clientes</button><div className="detail-heading compact"><div><p className="eyebrow">VENTAS / CLIENTES</p><h1>{existingCustomer ? "Editar cliente" : "Nuevo cliente"}</h1><p>La información comercial queda disponible para ofertas, órdenes y servicio.</p></div></div><form className="detail-surface" onSubmit={submit}><div className="detail-form-grid"><label>Nombre comercial<input name="displayName" required defaultValue={existingCustomer?.displayName ?? ""} placeholder="Nombre con el que opera" /></label><label>Estado<select name="status" defaultValue={existingCustomer?.status ?? "prospect"}><option value="prospect">Prospecto</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label><label className="wide">Razón social<input name="legalName" defaultValue={existingCustomer?.legalName ?? ""} placeholder="Razón social o nombre fiscal" /></label><label>RFC<input name="taxId" defaultValue={existingCustomer?.taxId ?? ""} placeholder="RFC" /></label><label>Código de cliente<input name="accountCode" defaultValue={existingCustomer?.accountCode ?? ""} placeholder="Ej. CL-001" /></label></div><footer><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Guardando..." : "Guardar cliente"}<ArrowRight size={15} /></button></footer></form></section>;
}

function BoardView({ overview }: { overview: SalesOverview }) { return <section className="view-section"><div className="crm-head"><div><strong>{overview.opportunities.filter((opportunity) => opportunity.stageKey !== "won" && opportunity.stageKey !== "lost").length} oportunidades activas</strong><span>Actualizado desde el backend comercial</span></div><button className="filter-button" type="button"><SlidersHorizontal size={14} />Filtros</button></div><div className="kanban">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => { const opportunities = overview.opportunities.filter((opportunity) => opportunity.stageId === stage.id); return <section className="kanban-column" key={stage.id}><header><span><i className={`stage-dot stage-${stage.key}`} />{stage.name}</span><b>{opportunities.length}</b></header><div className="kanban-value">{compactMoney(opportunities.reduce((sum, item) => sum + item.estimatedRevenue, 0))}</div>{opportunities.map((opportunity) => <article className="deal-card" key={opportunity.id}><span>{serviceLabel(opportunity.serviceMode)}</span><h3>{opportunity.title}</h3><p>{opportunity.customerName}</p><footer><strong>{compactMoney(opportunity.estimatedRevenue)}</strong><i>{opportunity.customerName.slice(0, 2).toUpperCase()}</i></footer></article>)}</section>; })}</div></section>; }

function SummaryView({ overview, pipelineValue, averageMargin, expiring }: { overview: SalesOverview; pipelineValue: number; averageMargin: number; expiring: number }) { return <section className="view-section"><div className="summary-intro"><span>SEPTIEMBRE 2026</span><h2>El pipeline crece con margen visible.</h2></div><div className="summary-kpis"><Kpi label="PIPELINE ACTIVO" value={compactMoney(pipelineValue)} detail="Oportunidades no cerradas" /><Kpi label="CONVERSIÓN" value={`${Math.round((overview.opportunities.filter((item) => item.stageKey === "won").length / Math.max(overview.opportunities.length, 1)) * 100)}%`} detail="Oportunidad a ganada" /><Kpi label="MARGEN COTIZADO" value={`${averageMargin.toFixed(1)}%`} detail="Sobre ofertas abiertas" /><Kpi label="OFERTAS POR VENCER" value={String(expiring)} detail="Requieren seguimiento" risk /></div><div className="summary-grid"><article className="dashboard-panel"><header><div><span>PIPELINE POR ETAPA</span><h3>{compactMoney(pipelineValue)}</h3></div></header><div className="bar-chart">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => { const value = overview.opportunities.filter((item) => item.stageId === stage.id).reduce((sum, item) => sum + item.estimatedRevenue, 0); const max = Math.max(...overview.stages.map((item) => overview.opportunities.filter((opportunity) => opportunity.stageId === item.id).reduce((sum, opportunity) => sum + opportunity.estimatedRevenue, 0)), 1); return <div key={stage.id}><span>{stage.name}</span><i><b style={{ width: `${(value / max) * 100}%` }} /></i><strong>{compactMoney(value)}</strong></div>; })}</div></article><article className="dashboard-panel"><header><div><span>EMBUDO COMERCIAL</span><h3>{overview.opportunities.length} oportunidades</h3></div></header><div className="funnel">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => <div key={stage.id} style={{ width: `${Math.max(42, 100 - stage.position * 0.9)}%` }}><b>{overview.opportunities.filter((item) => item.stageId === stage.id).length}</b><span>{stage.name}</span></div>)}</div></article></div></section>; }

function SettingsView() { const [active, setActive] = useState("Ventas"); const modules = ["Ventas", "Órdenes", "Planeación", "Recursos", "Almacén", "Compras", "Calidad", "Ingeniería", "Agente IA"]; return <section className="settings-view"><div className="settings-tabs" role="tablist" aria-label="Ajustes por módulo">{modules.map((module) => <button className={active === module ? "is-active" : ""} key={module} type="button" role="tab" aria-selected={active === module} onClick={() => setActive(module)}>{module}</button>)}</div><article className="settings-surface"><div><span>AJUSTES / {active.toUpperCase()}</span><h2>Configuración de {active}</h2><p>Define catálogos, reglas, autorizaciones y automatizaciones que aplican a este módulo.</p></div><div className="settings-options"><button type="button"><b>Flujos y estados</b><small>Etapas, transiciones y responsables.</small><ChevronRight size={15} /></button><button type="button"><b>Campos y catálogos</b><small>Información obligatoria y listas operativas.</small><ChevronRight size={15} /></button><button type="button"><b>Permisos del módulo</b><small>Acceso por empresa, nivel y equipo.</small><ChevronRight size={15} /></button><button type="button"><b>Automatizaciones</b><small>Acciones y notificaciones disparadas por eventos.</small><ChevronRight size={15} /></button></div></article></section>; }

function Metric({ label, value, note, neutral, risk }: { label: string; value: string; note: string; neutral?: boolean; risk?: boolean }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small className={risk ? "risk" : neutral ? "neutral" : ""}>{note}</small></article>; }
function Kpi({ label, value, detail, risk }: { label: string; value: string; detail: string; risk?: boolean }) { return <article className="kpi"><span>{label}</span><strong>{value}</strong><small className={risk ? "risk" : ""}>{detail}</small></article>; }
