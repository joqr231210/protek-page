import type { SalesOverview } from "./types";

export const demoSalesOverview: SalesOverview = {
  organizationId: 1,
  organizationName: "Protek Demo MX",
  organizations: [
    { id: 1, name: "Protek Demo MX" },
    { id: 2, name: "Protek Industrial Norte" },
  ],
  isDemo: true,
  members: [
    { id: "mariana-ruiz", displayName: "Mariana Ruiz" },
    { id: "diego-castro", displayName: "Diego Castro" },
    { id: "sofia-ramirez", displayName: "Sofía Ramírez" },
  ],
  customers: [
    { id: 101, displayName: "Minera del Norte", legalName: "Minera del Norte, S.A. de C.V.", taxId: "MNO920415AB2", accountCode: "CL-001", status: "active" },
    { id: 102, displayName: "Grupo Hidalgo", legalName: "Grupo Hidalgo Industrial, S.A. de C.V.", taxId: "GHI881120KQ4", accountCode: "CL-002", status: "active" },
    { id: 103, displayName: "EnergiPlus", legalName: "Energía Plus México, S.A. de C.V.", taxId: "EPM020318KX3", accountCode: "CL-003", status: "prospect" },
    { id: 104, displayName: "Tractocentro Bajío", legalName: null, taxId: null, accountCode: "CL-004", status: "active" },
    { id: 105, displayName: "Acero Monterrey", legalName: "Acero Monterrey, S.A. de C.V.", taxId: "AMO790220HF1", accountCode: "CL-005", status: "active" },
    { id: 106, displayName: "Constructora Garza", legalName: null, taxId: null, accountCode: "CL-006", status: "prospect" },
    { id: 107, displayName: "Maquinaria Vértice", legalName: null, taxId: null, accountCode: "CL-007", status: "active" },
    { id: 108, displayName: "Transportes Sierra", legalName: null, taxId: null, accountCode: "CL-008", status: "active" },
  ],
  stages: [
    { id: 1, key: "new", name: "Nueva oportunidad", position: 10, probability: 10, isClosed: false, outcome: null },
    { id: 2, key: "diagnosis", name: "Diagnóstico", position: 20, probability: 25, isClosed: false, outcome: null },
    { id: 3, key: "quoted", name: "Oferta enviada", position: 30, probability: 60, isClosed: false, outcome: null },
    { id: 4, key: "negotiation", name: "Negociación", position: 40, probability: 75, isClosed: false, outcome: null },
    { id: 5, key: "won", name: "Ganada", position: 50, probability: 100, isClosed: true, outcome: "won" },
  ],
  quotes: [
    { id: 2098, quoteNumber: 2098, customerId: 101, customerName: "Minera del Norte", title: "Overhaul de cilindro hidráulico", responsibleId: "mariana-ruiz", responsibleName: "Mariana Ruiz", serviceMode: "workshop", currencyCode: "MXN", totalAmount: 486400, estimatedMarginPercent: 34.2, status: "sent", stageKey: "quoted", stageName: "Oferta enviada", updatedAt: "2026-09-17T16:42:00.000Z", validUntil: "2026-09-21" },
    { id: 2095, quoteNumber: 2095, customerId: 102, customerName: "Grupo Hidalgo", title: "Reparación de transmisión CAT 980", responsibleId: "diego-castro", responsibleName: "Diego Castro", serviceMode: "workshop", currencyCode: "MXN", totalAmount: 318920, estimatedMarginPercent: 29.6, status: "negotiation", stageKey: "negotiation", stageName: "Negociación", updatedAt: "2026-09-16T22:18:00.000Z", validUntil: "2026-09-23" },
    { id: 2101, quoteNumber: 2101, customerId: 103, customerName: "EnergiPlus", title: "Kit de refacciones para compresor", responsibleId: "sofia-ramirez", responsibleName: "Sofía Ramírez", serviceMode: "parts", currencyCode: "USD", totalAmount: 96800, estimatedMarginPercent: 38.1, status: "draft", stageKey: "new", stageName: "Nueva oportunidad", updatedAt: "2026-09-12T17:06:00.000Z", validUntil: null },
    { id: 2087, quoteNumber: 2087, customerId: 104, customerName: "Tractocentro Bajío", title: "Diagnóstico de bomba principal", responsibleId: "sofia-ramirez", responsibleName: "Sofía Ramírez", serviceMode: "field", currencyCode: "MXN", totalAmount: 142750, estimatedMarginPercent: 24.8, status: "pending_approval", stageKey: "diagnosis", stageName: "Diagnóstico", updatedAt: "2026-09-11T15:27:00.000Z", validUntil: "2026-09-18" },
    { id: 2076, quoteNumber: 2076, customerId: 105, customerName: "Acero Monterrey", title: "Mantenimiento de unidad de potencia", responsibleId: "mariana-ruiz", responsibleName: "Mariana Ruiz", serviceMode: "field", currencyCode: "MXN", totalAmount: 254600, estimatedMarginPercent: 32.4, status: "sent", stageKey: "quoted", stageName: "Oferta enviada", updatedAt: "2026-09-10T20:50:00.000Z", validUntil: "2026-09-20" },
  ],
  opportunities: [
    { id: 1, customerName: "Constructora Garza", title: "Diagnóstico de cargador frontal", serviceMode: "field", estimatedRevenue: 184500, stageId: 1, stageKey: "new", stageName: "Nueva oportunidad", expectedCloseAt: "2026-09-26" },
    { id: 2, customerName: "Maquinaria Vértice", title: "Kit de sellos y pistones", serviceMode: "parts", estimatedRevenue: 92700, stageId: 1, stageKey: "new", stageName: "Nueva oportunidad", expectedCloseAt: "2026-09-27" },
    { id: 3, customerName: "Transportes Sierra", title: "Overhaul de motor QSK19", serviceMode: "workshop", estimatedRevenue: 376000, stageId: 2, stageKey: "diagnosis", stageName: "Diagnóstico", expectedCloseAt: "2026-09-24" },
    { id: 4, customerName: "Metales del Centro", title: "Prueba de banco hidráulico", serviceMode: "workshop", estimatedRevenue: 142000, stageId: 2, stageKey: "diagnosis", stageName: "Diagnóstico", expectedCloseAt: "2026-09-29" },
    { id: 5, customerName: "Minera del Norte", title: "Overhaul de cilindro hidráulico", serviceMode: "workshop", estimatedRevenue: 486400, stageId: 3, stageKey: "quoted", stageName: "Oferta enviada", expectedCloseAt: "2026-09-21" },
    { id: 6, customerName: "Acero Monterrey", title: "Mantenimiento unidad de potencia", serviceMode: "field", estimatedRevenue: 254600, stageId: 3, stageKey: "quoted", stageName: "Oferta enviada", expectedCloseAt: "2026-09-20" },
    { id: 7, customerName: "Grupo Hidalgo", title: "Reparación transmisión CAT 980", serviceMode: "workshop", estimatedRevenue: 318920, stageId: 4, stageKey: "negotiation", stageName: "Negociación", expectedCloseAt: "2026-09-23" },
    { id: 8, customerName: "Canteras del Sol", title: "Bomba principal A10VO", serviceMode: "parts", estimatedRevenue: 441200, stageId: 4, stageKey: "negotiation", stageName: "Negociación", expectedCloseAt: "2026-09-22" },
    { id: 9, customerName: "Infraestructura MX", title: "Reparación de brazo articulado", serviceMode: "field", estimatedRevenue: 562000, stageId: 5, stageKey: "won", stageName: "Ganada", expectedCloseAt: "2026-09-15" },
    { id: 10, customerName: "Ingeniería Cima", title: "Reacondicionamiento de bomba", serviceMode: "workshop", estimatedRevenue: 218500, stageId: 5, stageKey: "won", stageName: "Ganada", expectedCloseAt: "2026-09-14" },
  ],
};
