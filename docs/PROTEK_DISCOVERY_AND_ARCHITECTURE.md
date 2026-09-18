# Protek Industrial: Discovery, Architecture, and Migration Plan

## Purpose

This document is the starting point for rebuilding Grupo Moller as Protek Industrial: an AI-native operating system for industrial repair businesses. It records the functional discovery performed on the Bubble v3 test environment and Buildprint, proposes the target Supabase data model, and defines a staged migration plan.

Scope: discovery and architecture only. The Bubble application remains read-only during this phase.

## Discovery Snapshot

### What exists today

The current application is organized around four operating areas:

- **Sales:** quotations and work orders.
- **Operations:** work-order execution.
- **Purchasing:** purchase orders, products, and suppliers.
- **Settings:** user administration.

Buildprint exposes a substantially broader data model than the current navigation. The notable live volumes are:

| Existing data type | Records | Protek destination |
| --- | ---: | --- |
| Users | 21 | `profiles`, `organization_members`, roles |
| Customers | 81 | `customers`, contacts, sites |
| Equipment | 410 | `assets` |
| Sales / quotations | 612 | opportunities, quotes, revisions, approvals |
| Work orders | 409 | `work_orders` and execution records |
| Process instances | 1,418 | work-order scopes and tasks |
| Products | 4,386 | catalog and supplier catalog |
| Suppliers | 444 | `suppliers` and supplier contacts |
| Purchase orders | 3,942 | purchase orders, lines, receipts |
| Purchase lines | 8,082 | `purchase_order_lines` |
| Photo records | 2,822 | files and entity attachments |
| Dimensional inspections | 304 | quality test runs / measurements |
| Electrical inspections | 181 | quality test runs / measurements |
| Mechanical inspections | 124 | quality test runs / measurements |
| Remissions | 302 | delivery notes / dispatches |

The current `OrdenesDeTrabajo` entity is a warning sign and a useful source of requirements: it contains core order data, equipment characteristics, diagnosis flags, inspection references, photos, process lists, purchase requisitions, PDFs, and customer/quotation links in one wide record. Protek should preserve the information while separating it into durable, queryable business concepts.

### Validated operating flows

#### 1. Quotation to repair order

1. Sales creates a quotation for a customer and equipment/service type.
2. The quotation is diagnosed and priced; scope, service type, commitment dates, and estimated value are captured.
3. It progresses through `Por cotizar -> Por autorizar -> Autorizada` or a termination path such as `Cancelada`.
4. An authorized quotation generates a work order. The relationship must remain traceable in both directions.

Observed quotation states also include `Proceso`, `Terminada`, `Entregada`, and `Garantía`; these should become state transitions and events rather than disconnected labels.

#### 2. Workshop or field execution

1. A work order is opened directly or from an approved quotation.
2. Initial intake / opening captures customer, asset, received condition, diagnosis, priority, requested completion date, photos, and technical attributes.
3. A scope template generates the work processes and tasks required for the specific repair.
4. Technicians execute tasks, log evidence, record material usage, and complete applicable inspections.
5. The repair passes technical/quality release, generates its final report, and moves through delivery or warranty.

Current order states are `Apertura`, `Diagnóstico`, `Proceso`, `Terminada`, `Entregada`, and `Archivada`. The application also exposes operational signals such as authorization, pre-authorization, and process generation.

#### 3. Procurement and material supply

1. A product is selected from the catalog or created.
2. A buyer creates a purchase order with a supplier and line items.
3. Purchased material is received, then allocated to a work order or placed into stock.
4. Material consumption is attached to the repair and included in its actual cost and margin.

The current system has a robust product, supplier, and purchasing history. The `Inventarios` data type currently has no live records, so the new inventory ledger must be introduced deliberately rather than inferred from old balances.

#### 4. Quality and technical evidence

The current app persists separate dimensional, electrical, and mechanical inspections, dynamic balance tests, temperature records, and a high number of photo records. This is the functional seed for **Protek Quality Engine**:

1. Select a versioned repair-specific test plan.
2. Capture structured measurements, pass/fail decisions, comments, and evidence.
3. Run semantic, mathematical, and visual AI checks against the test definition.
4. Require human review for alerts or non-conformances.
5. Release, rework, or reject the order with an immutable quality trail.

### Discovery items to validate in workshops

- The exact status transition rules, owners, and authorization thresholds.
- Whether a work order can contain several assets or only one.
- Field-service scheduling, travel, site safety, and signature requirements.
- Receiving, returns, stock locations, serial/lot tracking, and costing rules.
- CFDI/invoicing, remissions, customer communication, and PDF/email integrations.
- Required historical depth: all records versus active data plus archived read-only history.
- Multi-entity structure: the current data has seven issuers; confirm legal entity, branch, and tax-document rules.
- Whether Protek will launch as a Grupo Moller-only implementation or a multi-tenant SaaS from day one.

## Product Domain Map

```text
Tenant / organization
  ├── Members, roles, branches, warehouses
  ├── Customers ── Contacts ── Sites ── Assets
  ├── Sales opportunities ── Quotes ── Approvals
  │                                  └── Work orders
  ├── Work orders ── Scopes ── Tasks ── Technician time
  │       ├── Material requirements / consumption
  │       ├── Quality test runs / evidence / release
  │       ├── Documents / photos / service reports
  │       └── Delivery / warranty
  ├── Suppliers ── Purchase orders ── Receipts
  │                                  └── Inventory transactions
  └── Activity, notifications, AI runs, audit log
```

The three service modes should use one core work-order domain with different required checkpoints:

| Mode | Required checkpoints |
| --- | --- |
| Workshop service | intake, asset identification, opening evidence, scope, process, QA release, delivery |
| Field service | dispatch, technician assignment, site access/safety, onsite evidence, customer signature, closeout |
| Parts / materials | stock or purchase source, reservation, pick/pack, dispatch/remission, billing handoff |

## Target Data Architecture: Supabase

### Core principles

- Postgres is the system of record. `public` holds tenant business data; `private` holds non-API helpers and internal orchestration.
- Every tenant-scoped table has `organization_id`, timestamps, and creator/updater fields. Keep soft archival where historical traceability matters.
- Use normalized tables for operational facts. Use `jsonb` only for variable form answers, source payload snapshots, and AI metadata, not for relationships or primary reporting dimensions.
- Use `numeric(14,2)` for money and `numeric(14,4)` for quantities; all dates are `timestamptz`; use ISO currency and unit codes.
- Use UUIDv7-style identifiers for externally exposed, distributed records; index all foreign keys and tenant/status/date access paths.
- Preserve source IDs in a dedicated `legacy_record_map` rather than using Bubble IDs as primary keys.

### Identity and tenancy

| Table group | Responsibility |
| --- | --- |
| `profiles` | application profile keyed to `auth.users.id` |
| `organizations` | Protek tenant/company |
| `organization_members` | membership, status, and branch context; one user can have one row in each company they can access |
| `organization_member_module_permissions` | per-company module access for `sales`, `purchases`, `orders`, `quality`, `agent_ai`, `warehouse`, `resources`, `planning`, and `engineering`; levels are `read`, `write`, and `admin` |
| `branches`, `organization_locations` | offices, workshop sites, legal/operational context |

An `organization_members` row is the access boundary. A user can be active in several companies, but the application always operates with one explicit active company selected below the Protek logo. Every tenant table, including orders, warehouses, customers, purchase orders, products, engineering files, and quality records, carries `organization_id`. RLS first verifies active membership and then the relevant module level (`read`, `write`, or `admin`). Owners and company administrators receive administrative access across modules. The service-role key remains server-only for migration, scheduled administration, and tightly audited privileged operations.

### Customers and assets

| Table group | Key relationships |
| --- | --- |
| `customers`, `customer_contacts`, `customer_sites` | customer has many contacts/sites |
| `asset_types`, `asset_models`, `assets` | asset belongs to customer and may be at a customer site or in workshop |
| `asset_identifiers`, `asset_specifications` | serial numbers and variable technical characteristics |
| `asset_service_history` | queryable history derived from closed work orders |

The asset must be its own durable identity. Values currently stored directly on work orders such as brand, model, RPM, power, frame, voltage, and weight become asset specifications or an immutable snapshot on the work order when historical accuracy requires it.

### CRM and sales

| Table group | Key relationships |
| --- | --- |
| `sales_pipelines`, `pipeline_stages` | configurable sales stage definitions |
| `opportunities`, `opportunity_stage_history` | CRM and revenue pipeline |
| `quotes`, `quote_revisions`, `quote_lines` | commercial offer and immutable revisions |
| `quote_approvals`, `approval_requests` | customer/internal authorization trail |
| `price_lists`, `tax_rates` | reusable pricing reference data |

`quotes` can create one or more `work_orders`, but a work order can also be created without a quote. Quote line snapshots must not mutate when catalog prices change.

### Work execution

| Table group | Key relationships |
| --- | --- |
| `work_orders`, `work_order_assets`, `work_order_status_history` | commercial and operational repair record |
| `scope_templates`, `scope_template_steps` | versioned reusable process definitions |
| `work_order_scopes`, `work_order_tasks` | instantiated, editable execution plan |
| `work_order_assignments`, `time_entries` | technician allocation and actual labor |
| `work_order_material_requirements`, `work_order_material_usage` | planned and actual material cost |
| `service_visits`, `field_service_checklists` | field-specific dispatch and completion |
| `service_reports`, `delivery_notes`, `warranty_claims` | closeout, delivery, and warranty |

State changes should be executed by explicit database functions or server actions that validate transitions and append `work_order_status_history`; no screen should write status text freely.

### Catalog, purchasing, and inventory

| Table group | Key relationships |
| --- | --- |
| `product_categories`, `products`, `product_supplier_catalog` | master catalog and supplier price/lead time |
| `warehouses`, `stock_locations` | physical storage model |
| `purchase_requisitions`, `purchase_requisition_lines` | demand from a work order or stock plan |
| `purchase_orders`, `purchase_order_lines` | supplier commitment and commercial snapshot |
| `goods_receipts`, `goods_receipt_lines` | actual receiving and exceptions |
| `inventory_transactions` | append-only movement ledger |
| `inventory_balances` | derived/cached balance per product and location |

`inventory_transactions` is the source of truth; a balance is never hand-edited. Each transaction has a reason, source document, unit cost, quantity delta, and optional lot/serial number.

### Protek Quality Engine

| Table group | Key relationships |
| --- | --- |
| `quality_test_templates`, `quality_test_template_versions` | organization-specific test design and versioning |
| `quality_test_sections`, `quality_test_criteria` | prompts, thresholds, formulas, expected evidence |
| `quality_test_runs`, `quality_measurements` | test instance and typed results |
| `quality_evidence`, `quality_findings`, `corrective_actions` | photographs/files, exceptions, rework |
| `quality_releases` | signed human release / rework / rejection decision |
| `ai_analysis_runs`, `ai_analysis_findings`, `ai_citations` | model output, evidence references, reviewer result |

Quality templates are versioned and copied into the test run so an old repair is reproducible after a template changes. AI findings are advisory by default; an accountable human records the final release decision.

### Documents, activity, and AI

| Table group | Responsibility |
| --- | --- |
| `files`, `file_links`, `document_versions` | Supabase Storage metadata and polymorphic attachment links |
| `activity_events`, `audit_events` | append-only operational timeline and compliance audit |
| `notifications` | in-app notification delivery state |
| `ai_conversations`, `ai_messages` | Protek Agent IA chat history |
| `document_chunks` | tenant-scoped retrieval chunks / `pgvector` embeddings |
| `workflow_outbox`, `workflow_runs` | durable handoff and traceability for asynchronous work |
| `legacy_record_map`, `migration_batches`, `migration_errors` | migration trace and reconciliation |

Use typed attachment links (`entity_type`, `entity_id`, `file_id`) with database constraints or a per-domain join table where integrity is critical. Storage object paths include `organization_id` and use Storage RLS policies aligned with database membership.

### Security and performance baseline

- Enable RLS and explicit grants on every table/view exposed through the Data API. Policies must scope access to the active organization.
- Keep private helper functions in `private`, use a fixed empty `search_path`, and grant execution only where required.
- Index every foreign key. The expected list views need composite indexes such as `(organization_id, status, updated_at desc)` and partial indexes for active work.
- Create separate RLS tests for select/insert/update/delete and tenant-isolation tests for every domain table.
- Use an outbox event written in the same transaction as a business change. A worker consumes it idempotently; external side effects never precede the source-of-truth transaction.

## Application and Deployment Architecture

```text
Next.js on Vercel
  ├── Server components / route handlers / server actions
  ├── Supabase Auth + Postgres + Storage + Realtime
  ├── Vercel Workflows for durable, asynchronous orchestration
  └── Observability: Vercel logs, Sentry, Supabase logs, audit events
```

### Responsibility split

| Layer | Responsibility |
| --- | --- |
| Next.js / Vercel | Protek UI, BFF endpoints, authenticated server actions, PDF screens, feature flags, previews |
| Supabase | transactional database, Auth, RLS, Storage, Realtime, SQL migrations, reporting views with secure access |
| Vercel Workflows | document extraction, photo/AI evaluation, generated reports, import batches, notifications, scheduled reconciliation, durable Agent IA tasks |

The user-facing transaction stays synchronous and short: save the work order, test result, or purchase receipt in Postgres first, then enqueue an idempotent outbox event. Vercel Workflows handles the slow or retriable work after the commit. Workflow input/output should be compact IDs and typed result summaries; durable business state and audit history remain in Supabase.

Initial workflow candidates:

1. **Quality analysis:** evidence uploaded -> extract/OCR/vision analysis -> calculate thresholds -> persist findings -> notify reviewer.
2. **Protek Agent IA:** retrieve tenant-authorized documents and repair history -> generate a cited answer -> persist sources and reviewer actions.
3. **Report generation:** release approved -> generate report/PDF -> attach it -> notify the customer only after an authorized human trigger.
4. **Migration pipeline:** import a chunk -> transform -> validate relationships -> write a reconciliation result -> retry safely.
5. **Operational follow-up:** deadline alerts, purchase-order exceptions, overdue quality releases, and scheduled KPI materialization.

## Delivery Plan

### Phase 0: Discovery and data contract

**Outcome:** signed functional map and migration specification.

- Run role-based workshops with sales, workshop operations, quality, purchasing, and administration.
- Produce a field-level Bubble-to-Protek mapping, including status dictionaries, source relationships, data owners, and archival rules.
- Record actual happy paths and exception paths with sample orders.
- Decide tenant strategy, branch/issuer design, and migration cutover policy.

### Phase 1: Platform foundation

**Outcome:** a secure deployable skeleton.

- Create the Next.js monorepo, Protek design system, Supabase projects, environments, migrations, seed data, and CI.
- Implement Auth, membership, RBAC, RLS tests, audit events, Storage conventions, and observability.
- Ship an internal navigation shell with organizations, customers, assets, and search.

### Phase 2: Operational parity thin slice

**Outcome:** one repair can travel from quote to delivered work order in Protek.

- Customers, contacts, assets, catalog, quotations, approvals, and work-order creation.
- Intake, scope template instantiation, task execution, technician assignments, time, attachments, and order history.
- Data migration rehearsal for the P0 entities below.

### Phase 3: Procurement and execution completeness

**Outcome:** repair cost and material flow are accurate.

- Suppliers, requisitions, purchase orders, receiving, allocation, consumption, remissions, and inventory ledger.
- Field-service visits, service reports, and closeout controls.
- Reconcile historical purchases, products, and open orders.

### Phase 4: Quality Engine and Agent IA

**Outcome:** quality is a controlled operational system, not a collection of files.

- Versioned test builder, technical checks, evidence capture, release workflow, non-conformances, and corrective actions.
- AI analysis with source citations, human review, permissions, and auditability.
- Protek Agent IA grounded only in the tenant’s authorized records.

### Phase 5: Parallel run and cutover

**Outcome:** new system becomes authoritative without a blind migration.

- Execute imports into staging, validate counts and relationships, and reconcile against Bubble.
- Migrate static history first; migrate active orders and recent deltas during parallel run.
- Run user acceptance by role, train users, freeze writes at cutover, run final delta import, and retain Bubble read-only for the agreed retention period.

### Phase 6: Product expansion

**Outcome:** the broader Protek SaaS model is ready.

- Tablero comercial and profitability dashboard.
- Planning projects with dates, dependencies, and actions that can create purchasing, quality, and engineering work.
- Resources for people and key operating machinery/equipment, plus Engineering plans, notes, and controlled files.
- Advanced inventory, customer portal, mobile technician workflows, integrations, and tenant self-service.
- Usage analytics, billing, onboarding, and multi-tenant operations once core data isolation is proven.

### Functional parity priority

| Priority | Included capabilities |
| --- | --- |
| P0 | users/roles, customers, equipment, quotations, work orders, scopes/processes, products, suppliers, purchase orders, attachments, remissions |
| P1 | inspections, dynamic balance, temperature logs, incidents, comments, reports, warranties, task time and material consumption |
| P2 | CRM, configurable dashboards, deeper inventory controls, customer portal, advanced AI and external accounting/invoicing integrations |

## Definition of Ready for Implementation

Start implementation when the following are agreed:

1. The status transition diagram and approvals for quote, work order, purchasing, quality, delivery, and warranty.
2. The multi-tenant and issuer/branch model.
3. A field-level data dictionary and migration acceptance rules.
4. The Phase 2 thin-slice acceptance criteria and named business testers.
5. The target environment/security setup for Vercel and Supabase.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Vercel Workflows](https://vercel.com/workflows)
- [Vercel Workflow SDK](https://vercel.com/kb/workflow-sdk)
