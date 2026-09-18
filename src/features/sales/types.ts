export type ServiceMode = "workshop" | "field" | "parts";
export type CurrencyCode = "MXN" | "USD" | "EUR";

export type Customer = {
  id: number;
  displayName: string;
  legalName: string | null;
  taxId: string | null;
  accountCode: string | null;
  status: "active" | "inactive" | "prospect";
};

export type Stage = {
  id: number;
  key: string;
  name: string;
  position: number;
  probability: number;
  isClosed: boolean;
  outcome: "won" | "lost" | null;
};

export type Quote = {
  id: number;
  quoteNumber: number;
  customerId: number;
  customerName: string;
  title: string;
  serviceMode: ServiceMode;
  currencyCode: CurrencyCode;
  totalAmount: number;
  estimatedMarginPercent: number | null;
  status: string;
  stageKey: string;
  stageName: string;
  updatedAt: string;
  validUntil: string | null;
};

export type Opportunity = {
  id: number;
  customerName: string;
  title: string;
  serviceMode: ServiceMode;
  estimatedRevenue: number;
  stageId: number;
  stageKey: string;
  stageName: string;
  expectedCloseAt: string | null;
};

export type SalesOverview = {
  organizationId: number;
  organizationName: string;
  organizations: Array<{ id: number; name: string }>;
  isDemo: boolean;
  customers: Customer[];
  stages: Stage[];
  quotes: Quote[];
  opportunities: Opportunity[];
};
