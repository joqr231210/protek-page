"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Columns3,
  FileText,
  HardHat,
  LayoutDashboard,
  LineChart,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import type { Quote, SalesOverview, ServiceMode } from "./types";

type View = "offers" | "board" | "summary";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function compactCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return currency.format(value);
}

function serviceModeLabel(mode: ServiceMode) {
  return mode === "workshop" ? "Servicio en taller" : mode === "field" ? "Servicio en campo" : "Refaccionamiento";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    pending_approval: "Por autorizar",
    sent: "Enviada",
    negotiation: "Negociación",
    approved: "Autorizada",
    rejected: "Rechazada",
    expired: "Vencida",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function relativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const diff = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(date);
}

export function SalesWorkspace({ initialOverview }: { initialOverview: SalesOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [view, setView] = useState<View>("offers");
  const [selectedQuoteId, setSelectedQuoteId] = useState(initialOverview.quotes[0]?.id ?? 0);
  const [search, setSearch] = useState("");
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [toast, setToast] = useState("");

  const filteredQuotes = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es-MX");
    if (!normalized) return overview.quotes;
    return overview.quotes.filter((quote) =>
      [quote.customerName, quote.title, `q-${quote.quoteNumber}`, statusLabel(quote.status)]
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(normalized),
    );
  }, [overview.quotes, search]);

  const selectedQuote = overview.quotes.find((quote) => quote.id === selectedQuoteId) ?? filteredQuotes[0];
  const openQuotes = overview.quotes.filter((quote) => !["approved", "rejected", "cancelled", "expired"].includes(quote.status));
  const pipelineValue = overview.opportunities
    .filter((opportunity) => opportunity.stageKey !== "won" && opportunity.stageKey !== "lost")
    .reduce((sum, opportunity) => sum + opportunity.estimatedRevenue, 0);
  const averageMargin = openQuotes.length
    ? openQuotes.reduce((sum, quote) => sum + (quote.estimatedMarginPercent ?? 0), 0) / openQuotes.length
    : 0;
  const expiring = openQuotes.filter((quote) => quote.validUntil && new Date(`${quote.validUntil}T23:59:59`).getTime() - Date.now() < 7 * 86_400_000).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  async function createQuote(form: FormData) {
    const payload = {
      organizationId: overview.organizationId,
      customerName: String(form.get("customerName") ?? ""),
      title: String(form.get("title") ?? ""),
      serviceMode: String(form.get("serviceMode") ?? "workshop"),
      estimatedRevenue: Number(form.get("estimatedRevenue") ?? 0),
      estimatedCost: Number(form.get("estimatedCost") ?? 0),
      validUntil: String(form.get("validUntil") ?? ""),
    };
    const response = await fetch("/api/sales/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      notify(overview.isDemo ? "Conecta el entorno de Supabase para guardar esta oferta." : "No fue posible crear la oferta. Revisa los campos e inténtalo otra vez.");
      return;
    }

    const created = await response.json() as { id: number; quoteNumber: number };
    const newQuote: Quote = {
      id: created.id,
      quoteNumber: created.quoteNumber,
      customerName: payload.customerName,
      title: payload.title,
      serviceMode: payload.serviceMode as ServiceMode,
      totalAmount: payload.estimatedRevenue,
      estimatedMarginPercent: payload.estimatedRevenue > 0 ? ((payload.estimatedRevenue - payload.estimatedCost) / payload.estimatedRevenue) * 100 : null,
      status: "draft",
      stageKey: "new",
      stageName: "Nueva oportunidad",
      updatedAt: new Date().toISOString(),
      validUntil: payload.validUntil || null,
    };
    setOverview((current) => ({ ...current, quotes: [newQuote, ...current.quotes] }));
    setSelectedQuoteId(newQuote.id);
    setIsCreatingQuote(false);
    setView("offers");
    notify(`Oferta Q-${created.quoteNumber} creada.`);
  }

  async function selectOrganization(organizationId: number) {
    if (organizationId === overview.organizationId) {
      setShowCompanyMenu(false);
      return;
    }

    const selectedOrganization = overview.organizations.find((organization) => organization.id === organizationId);
    if (!selectedOrganization) return;

    if (overview.isDemo) {
      setOverview((current) => ({ ...current, organizationId, organizationName: selectedOrganization.name }));
      setShowCompanyMenu(false);
      setSelectedQuoteId(overview.quotes[0]?.id ?? 0);
      notify(`${selectedOrganization.name} es ahora la empresa activa.`);
      return;
    }

    const response = await fetch(`/api/sales/overview?organizationId=${organizationId}`, { cache: "no-store" });
    if (!response.ok) {
      notify("No fue posible cambiar de empresa. Inténtalo otra vez.");
      return;
    }

    const nextOverview = await response.json() as SalesOverview;
    setOverview(nextOverview);
    setSelectedQuoteId(nextOverview.quotes[0]?.id ?? 0);
    setSearch("");
    setIsCreatingQuote(false);
    setShowCompanyMenu(false);
    notify(`${nextOverview.organizationName} es ahora la empresa activa.`);
  }

  return (
    <div className="protek-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <a className="wordmark" href="/sales" aria-label="Protek Industrial"><span />protek</a>
        <div className="workspace-selector">
          <button className="workspace-switch" type="button" aria-haspopup="menu" aria-expanded={showCompanyMenu} onClick={() => setShowCompanyMenu((isOpen) => !isOpen)}><BriefcaseBusiness size={16} /><span>{overview.organizationName}</span><ChevronDown size={14} /></button>
          {showCompanyMenu && <div className="company-menu" role="menu" aria-label="Cambiar empresa">
            {overview.organizations.map((organization) => <button className={organization.id === overview.organizationId ? "is-active" : ""} key={organization.id} role="menuitem" type="button" onClick={() => void selectOrganization(organization.id)}><span>{organization.name}</span>{organization.id === overview.organizationId && <b>Activa</b>}</button>)}
          </div>}
        </div>
        <nav className="side-nav">
          <a href="#inicio"><LayoutDashboard size={16} />Inicio</a>
          <a href="#ordenes"><ClipboardList size={16} />Órdenes <b>12</b></a>
          <div className="nav-group">
            <a className="is-current" href="#ventas"><BriefcaseBusiness size={16} />Ventas <ChevronDown size={14} /></a>
            <div className="sales-submenu" aria-label="Secciones de Ventas">
              {([
                ["offers", FileText, "Ofertas"],
                ["board", Columns3, "Tablero"],
                ["summary", LineChart, "Resumen"],
              ] as const).map(([key, Icon, label]) => (
                <button className={view === key ? "is-active" : ""} key={key} type="button" onClick={() => setView(key)}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
          </div>
          <a href="#planeacion"><CalendarDays size={16} />Planeación</a>
          <a href="#recursos"><HardHat size={16} />Recursos</a>
          <a href="#almacen"><Package size={16} />Almacén</a>
          <a href="#compras"><ShoppingCart size={16} />Compras</a>
          <a href="#calidad"><ShieldCheck size={16} />Calidad</a>
          <a href="#ingenieria"><FileText size={16} />Ingeniería</a>
          <a href="#agente"><Bot size={16} />Agente IA <i /></a>
        </nav>
        <div className="sidebar-account"><span>MR</span><div><b>Mariana Ruiz</b><small>Dirección comercial</small></div></div>
      </aside>

      <main className="sales-main">
        <header className="topbar">
          <div className="breadcrumb"><span>Ventas</span><ChevronRight size={13} /><strong>{view === "offers" ? "Ofertas" : view === "board" ? "Tablero" : "Resumen"}</strong></div>
          <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Buscar"><Search size={17} /></button><button className="icon-button alert" type="button" aria-label="Notificaciones"><Bell size={17} /></button><button className="period-button" type="button"><CalendarDays size={14} />Septiembre 2026<ChevronDown size={12} /></button></div>
        </header>

        <div className="page-heading">
          <div><p className="eyebrow">MÓDULO / VENTAS</p><h1>{view === "offers" ? "Ofertas" : view === "board" ? "Tablero comercial" : "Resumen comercial"}</h1><p>{view === "offers" ? "Convierte oportunidades de servicio y refacciones en trabajo rentable." : view === "board" ? "Visibilidad del pipeline, sin separar los datos del trabajo que se cotiza." : "Resultados, conversión y margen para decidir el siguiente movimiento."}</p></div>
          <button className="primary-button" type="button" onClick={() => { setView("offers"); setIsCreatingQuote(true); }}><Plus size={16} />Nueva oferta</button>
        </div>

        {view === "offers" && <section className="view-section">
          <div className="metric-grid">
            <Metric label="OFERTAS ABIERTAS" value={String(openQuotes.length)} note="En seguimiento comercial" />
            <Metric label="VALOR EN PIPELINE" value={compactCurrency(pipelineValue)} note="Oportunidades no cerradas" />
            <Metric label="MARGEN ESTIMADO" value={`${averageMargin.toFixed(1)}%`} note="Sobre ofertas abiertas" neutral />
            <Metric label="POR VENCER" value={String(expiring)} note="Próximos 7 días" risk />
          </div>
          {isCreatingQuote && <InlineQuoteEditor onCancel={() => setIsCreatingQuote(false)} onSubmit={createQuote} />}
          <div className="offers-workspace">
            <div className="data-surface">
              <div className="surface-toolbar"><div className="filter-group"><button className="filter-button" type="button"><SlidersHorizontal size={14} />Todos los estados<ChevronDown size={12} /></button></div><label className="search-field"><Search size={15} /><span className="sr-only">Buscar ofertas</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar oferta" /></label></div>
              <div className="quote-table" role="table" aria-label="Ofertas">
                <div className="quote-row quote-heading" role="row"><span>OFERTA</span><span>CLIENTE</span><span>IMPORTE</span><span>MARGEN</span><span>ETAPA</span><span>ACTUALIZADA</span></div>
                {filteredQuotes.map((quote) => <button className={`quote-row ${selectedQuote?.id === quote.id ? "is-selected" : ""}`} key={quote.id} type="button" onClick={() => setSelectedQuoteId(quote.id)}>
                  <span><b>Q-{quote.quoteNumber}</b><small>{serviceModeLabel(quote.serviceMode)}</small></span><span>{quote.customerName}</span><span>{currency.format(quote.totalAmount)}</span><span className={quote.estimatedMarginPercent !== null && quote.estimatedMarginPercent < 28 ? "margin-risk" : "margin-good"}>{quote.estimatedMarginPercent?.toFixed(1) ?? "-"}%</span><span><em className={`status status-${quote.status}`}>{statusLabel(quote.status)}</em></span><span>{relativeDate(quote.updatedAt)}</span>
                </button>)}
              </div>
              <footer className="table-footer"><span>Mostrando {filteredQuotes.length} de {overview.quotes.length} ofertas</span><button type="button" onClick={() => setSearch("")}>Restablecer vista <ArrowRight size={13} /></button></footer>
            </div>
            {selectedQuote && <OfferInspector quote={selectedQuote} onOpen={() => notify(`Q-${selectedQuote.quoteNumber} está lista para edición detallada.`)} />}
          </div>
        </section>}

        {view === "board" && <section className="view-section">
          <div className="crm-head"><div><strong>{overview.opportunities.filter((opportunity) => opportunity.stageKey !== "won" && opportunity.stageKey !== "lost").length} oportunidades activas</strong><span>Actualizado desde el backend comercial</span></div><button className="filter-button" type="button"><SlidersHorizontal size={14} />Filtros</button></div>
          <div className="kanban">
            {overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => {
              const opportunities = overview.opportunities.filter((opportunity) => opportunity.stageId === stage.id);
              return <section className="kanban-column" key={stage.id}><header><span><i className={`stage-dot stage-${stage.key}`} />{stage.name}</span><b>{opportunities.length}</b></header><div className="kanban-value">{compactCurrency(opportunities.reduce((sum, item) => sum + item.estimatedRevenue, 0))}</div>{opportunities.map((opportunity) => <article className="deal-card" key={opportunity.id}><span>{serviceModeLabel(opportunity.serviceMode)}</span><h3>{opportunity.title}</h3><p>{opportunity.customerName}</p><footer><strong>{currency.format(opportunity.estimatedRevenue)}</strong><i>{initials(opportunity.customerName)}</i></footer></article>)}</section>;
            })}
          </div>
        </section>}

        {view === "summary" && <section className="view-section">
          <div className="summary-intro"><span>SEPTIEMBRE 2026</span><h2>El pipeline crece con margen visible.</h2></div>
          <div className="summary-kpis"><Kpi label="PIPELINE ACTIVO" value={compactCurrency(pipelineValue)} detail="Oportunidades no cerradas" /><Kpi label="CONVERSIÓN" value={`${Math.round((overview.opportunities.filter((item) => item.stageKey === "won").length / Math.max(overview.opportunities.length, 1)) * 100)}%`} detail="Oportunidad a ganada" /><Kpi label="MARGEN COTIZADO" value={`${averageMargin.toFixed(1)}%`} detail="Sobre ofertas abiertas" /><Kpi label="OFERTAS POR VENCER" value={String(expiring)} detail="Requieren seguimiento" risk /></div>
          <div className="summary-grid"><article className="dashboard-panel"><header><div><span>PIPELINE POR ETAPA</span><h3>{compactCurrency(pipelineValue)}</h3></div></header><div className="bar-chart">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => { const value = overview.opportunities.filter((item) => item.stageId === stage.id).reduce((sum, item) => sum + item.estimatedRevenue, 0); const max = Math.max(...overview.stages.map((item) => overview.opportunities.filter((opportunity) => opportunity.stageId === item.id).reduce((sum, opportunity) => sum + opportunity.estimatedRevenue, 0)), 1); return <div key={stage.id}><span>{stage.name}</span><i><b style={{ width: `${(value / max) * 100}%` }} /></i><strong>{compactCurrency(value)}</strong></div>; })}</div></article><article className="dashboard-panel"><header><div><span>EMBUDO COMERCIAL</span><h3>{overview.opportunities.length} oportunidades</h3></div></header><div className="funnel">{overview.stages.filter((stage) => stage.outcome !== "lost").map((stage) => <div key={stage.id} style={{ width: `${Math.max(42, 100 - stage.position * 0.9)}%` }}><b>{overview.opportunities.filter((item) => item.stageId === stage.id).length}</b><span>{stage.name}</span></div>)}</div></article></div>
        </section>}
      </main>

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status">{toast}</div>
    </div>
  );
}

function Metric({ label, value, note, neutral, risk }: { label: string; value: string; note: string; neutral?: boolean; risk?: boolean }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small className={risk ? "risk" : neutral ? "neutral" : ""}>{note}</small></article>;
}

function Kpi({ label, value, detail, risk }: { label: string; value: string; detail: string; risk?: boolean }) {
  return <article className="kpi"><span>{label}</span><strong>{value}</strong><small className={risk ? "risk" : ""}>{detail}</small></article>;
}

function OfferInspector({ quote, onOpen }: { quote: Quote; onOpen: () => void }) {
  const progress = quote.stageKey === "new" ? 20 : quote.stageKey === "diagnosis" ? 40 : quote.stageKey === "quoted" ? 60 : quote.stageKey === "negotiation" ? 80 : 100;
  return <aside className="offer-inspector"><header><div><span>OFERTA SELECCIONADA</span><h2>Q-{quote.quoteNumber}</h2></div><Box size={17} /></header><div className="customer-block"><i>{initials(quote.customerName)}</i><div><b>{quote.customerName}</b><small>{quote.title}</small></div></div><div className="progress"><div><span>PROGRESO COMERCIAL</span><strong>{progress}%</strong></div><i><b style={{ width: `${progress}%` }} /></i><small><em>Diagnóstico</em><em>Propuesta</em><em>Enviada</em><em>Negociación</em><em>Cierre</em></small></div><dl><div><dt>Importe</dt><dd>{currency.format(quote.totalAmount)}</dd></div><div><dt>Margen estimado</dt><dd className={quote.estimatedMarginPercent !== null && quote.estimatedMarginPercent < 28 ? "margin-risk" : "margin-good"}>{quote.estimatedMarginPercent?.toFixed(1) ?? "-"}%</dd></div><div><dt>Etapa</dt><dd>{quote.stageName}</dd></div><div><dt>Vigencia</dt><dd>{quote.validUntil ?? "Sin definir"}</dd></div></dl><div className="inspector-actions"><button className="primary-button" type="button" onClick={onOpen}>Abrir oferta <ArrowRight size={14} /></button><button className="secondary-button" type="button">Registrar actividad</button></div><div className="activity"><span>ÚLTIMA ACTIVIDAD</span><p><b>Oferta actualizada</b><small>{relativeDate(quote.updatedAt)} · por Mariana Ruiz</small></p><p><b>Margen calculado desde partidas</b><small>Los importes se controlan en el backend</small></p></div></aside>;
}

function InlineQuoteEditor({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (form: FormData) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    await onSubmit(new FormData(event.currentTarget));
    setSaving(false);
  }
  return <form className="inline-quote-editor" onSubmit={submit}><header><div><span>NUEVA OFERTA</span><h2>Inicia una oportunidad</h2></div><p>El borrador queda vinculado a {" "}<b>la empresa activa</b>.</p></header><div className="form-grid"><label>Cliente<input name="customerName" required placeholder="Empresa cliente" /></label><label>Tipo de servicio<select name="serviceMode" defaultValue="workshop"><option value="workshop">Servicio en taller</option><option value="field">Servicio en campo</option><option value="parts">Refaccionamiento</option></select></label><label className="wide">Nombre de la oferta<input name="title" required placeholder="Ej. Overhaul de cilindro hidráulico" /></label><label>Venta estimada<input name="estimatedRevenue" required type="number" min="0" step="0.01" placeholder="0.00" /></label><label>Costo estimado<input name="estimatedCost" required type="number" min="0" step="0.01" placeholder="0.00" /></label><label className="wide">Vigencia<input name="validUntil" type="date" /></label></div><footer><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Creando..." : "Crear oferta"}<ArrowRight size={15} /></button></footer></form>;
}
