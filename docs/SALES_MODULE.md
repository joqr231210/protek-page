# Protek Sales Module

The connected Sales application is published at the Sites `/app` route. It uses Supabase Auth, the public Data API, and RLS directly from the browser, so its static hosting does not require a server-held secret. The Next implementation in `src/app/app` remains the reference for a future Vercel deployment.

## What is implemented

- A single **Ventas** parent entry with sidebar submenu views for Summary, Offers, Tablero, and Customers. Summary is the default entry and highlights offers pending an update for more than 30 days, plus the ten most recently updated offers with direct access to their detail.
- Offers open in a dedicated detail view. New Offer hides the offer table and metrics, groups commercial fields under **Información General**, and includes **Información técnica** for the operational handoff.
- Existing offers expose a color-coded status selector beside the responsible owner. Changing it updates the offer stage, status pill, table, and board in the current demo session.
- **Información General** keeps the business context together: offer name, notes, estimated amounts, currency immediately before validity, and related documents.
- **Información técnica** starts with the asset and a technical template selector. The starter `Ficha electromecánica estándar` renders serial number, brand, type, voltage, current, speed, weight, and color before the universal reported-condition field. Sales settings expose **Plantillas técnicas de oferta** as the configuration entry point.
- **Información General** includes related documents: each attachment has a business-facing name and file metadata, and removing an attachment always requires a confirmation dialog.
- In the live Sites app, the offer intake searches customers by commercial name, legal name, RFC, or account code. The dropdown supports keyboard selection and an inline quick-registration form for a new prospect (name, optional legal name and RFC); the new customer is selected without clearing the unfinished offer.
- Offer amounts accept either `1,160.00` or `1.160,00`, display the selected currency prefix, and validate that the tax-inclusive total is not below the pre-tax value before calling the Sales RPC.
- A **Clientes** submenu provides inline create and edit flows for company-scoped customer records. Both this form and quick registration write through Supabase RLS using the active organization's sales permissions.
- The top-level **Ajustes** view exposes a tab for every main module, starting with its module-specific flow, catalog, permission, and automation settings.
- Quotes, opportunities, customers, contacts, and assets in a relational Supabase model.
- A customer-scoped sales pipeline with default stages created when an organization is onboarded.
- Quote lines with database-calculated subtotal, taxes, total, and estimated margin.
- Quote intake endpoint that creates a prospect customer when needed, an opportunity, quote, first line, status history, stage history, and an activity event.
- Authenticated server endpoints using the publishable key and user session. The secret/service key is not used by the application.
- A user can belong to one or more companies. The company switcher only lists active memberships, and every request is scoped to the selected company.
- RLS policies that isolate every business row by organization membership and module permission. `sales`, `purchases`, `orders`, `quality`, `agent_ai`, `warehouse`, `resources`, `planning`, and `engineering` use `read`, `write`, or `admin` access levels per company.
- Primary CRUD is inline in the work surface. Popups are reserved for confirmations, destructive operations, and exceptional decisions.
- The design system uses 12 px as its minimum text size. Supporting text, labels, table metadata, and controls do not fall below this baseline.
- The Sites app implements the first end-to-end functional slice: email OTP, company onboarding, company selection, inline customer CRUD, offer creation through the `create_sales_offer` database function, and drag-and-drop stage changes through `move_sales_offer_stage`.
- In the Sites app, the Offers and Tablero filters update only their results so typing keeps focus. Clientes has a search by commercial name, legal name, RFC, or account code.
- Sites Ajustes > Ventas lets Sales administrators rename or hide the five board stages for their company. The terminal `lost` stage stays internal; hiding a stage never deletes its offers. The board and Summary pipeline use the same visible-stage list, while Offers remains a complete list.

### Current Sites offer workflow

The same inline form creates and edits an offer. New offers default to a validity date 30 calendar days after the user's local date; the date input opens the native calendar from the entire control. Opening an existing offer preloads its customer, title, service mode, currency, validity, amounts, and notes. Saving edits calls `update_sales_offer` in one database transaction, updating the quote, its single quote line, and linked opportunity while preserving its stage and status. Offers with multiple lines are rejected by this editor until a line-item editor exists.

The Kanban board uses draggable offer cards, full-column drop targets, and a highlighted target during drag. Its stage move still uses `move_sales_offer_stage`. Settings follow `Ajustes > Ventas > Ofertas > Estatus de ofertas`; the last level owns the existing five-stage rename/visibility controls. Breadcrumb steps are clickable.

Attachment persistence is intentionally kept separate from the form interaction. The current detail experience manages attachments in the offer workspace; production persistence should use a company-scoped Supabase Storage bucket and a `quote_documents` record tied to the canonical quote once remote schema administration is available.

The starter technical template is currently a UI schema. Its multi-company definition, assignment, typed-value, and versioned-snapshot tables should be introduced together in the custom-field migration, rather than persisting an unvalidated JSON blob on `quotes`.

## Intentionally not duplicated

There is no `orders` table inside Sales. A quote is the commercial object; after approval it will create the canonical record in the future `Orders` module. Workshop, field, and parts are service modes on the opportunity and quote, not separate sales systems.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the project URL and publishable key. Do not add the secret key to any `NEXT_PUBLIC_` variable.
3. Install packages with `npm install`.
4. Run `npm run dev -- --port 3001` and visit `/app`.

Without a signed-in organization member, the Sites app only presents the OTP access screen. New users create their first company after verification; users with an active membership see only their companies and records.

## Applying the schema

The remote project has the foundation, workflow, and Sales RPC migrations applied: [20260918014800_create_sales_foundation.sql](../supabase/migrations/20260918014800_create_sales_foundation.sql), [20260918142146_add_offer_workflow_fields.sql](../supabase/migrations/20260918142146_add_offer_workflow_fields.sql), [20260922180903_add_sales_offer_rpc.sql](../supabase/migrations/20260922180903_add_sales_offer_rpc.sql), [20260922181012_add_sales_offer_stage_rpc.sql](../supabase/migrations/20260922181012_add_sales_offer_stage_rpc.sql), and [20260923140000_update_sales_offer_rpc.sql](../supabase/migrations/20260923140000_update_sales_offer_rpc.sql).

For a new environment, link the target project and apply the same migration sequence:

```bash
supabase link --project-ref zdwkjdbjwwxenwmdrzgq
supabase db push
supabase db advisors
```

After the first user signs in, the Sites onboarding calls `public.create_organization(name, slug)`. It creates an owner membership and initializes the commercial pipeline.

## OTP email setup

Configure Supabase Auth's Magic Link template to include `{{ .Token }}` so `signInWithOtp` sends a code that the user can enter in Protek. Set the public Sites origin as the project Site URL and configure an SMTP provider before inviting real customer teams.

## Verification after deployment

1. Confirm every `public` table has RLS enabled with `supabase db advisors`.
2. Create two organizations and users; verify a user from one cannot read or write the other through the Data API.
3. Create an offer and confirm the quote totals change only from its quote lines.
4. Confirm that the new opportunity, quote, activity event, and both history records have the same `organization_id`.
5. Add the same user to two companies and confirm switching companies cannot expose cross-company records.
6. Repeat the above with `read` sales permission and verify writes are denied; repeat with `write` and verify pipeline configuration still requires `admin`.
