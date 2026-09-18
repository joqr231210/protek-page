# Protek Sales Module

The real Protek application now lives in `src/app/sales`. The previous static artifacts remain available as design references; they are not the runtime application.

## What is implemented

- A single **Ventas** parent entry with sidebar submenu views for Summary, Offers, Tablero, and Customers. Summary is the default entry and highlights offers pending an update for more than 30 days, plus the ten most recently updated offers with direct access to their detail.
- Offers open in a dedicated detail view. New Offer hides the offer table and metrics, groups commercial fields under **Información General**, and includes **Información técnica** for the operational handoff.
- Existing offers expose a color-coded status selector beside the responsible owner. Changing it updates the offer stage, status pill, table, and board in the current demo session.
- **Información General** keeps the business context together: offer name, notes, estimated amounts, currency immediately before validity, and related documents.
- **Información técnica** starts with the asset and a technical template selector. The starter `Ficha electromecánica estándar` renders serial number, brand, type, voltage, current, speed, weight, and color before the universal reported-condition field. Sales settings expose **Plantillas técnicas de oferta** as the configuration entry point.
- **Información General** includes related documents: each attachment has a business-facing name and file metadata, and removing an attachment always requires a confirmation dialog.
- The offer intake selects an existing customer through a searchable dropdown, requires a service type and currency, and displays monetary inputs with the selected currency prefix and format.
- A **Clientes** submenu provides inline create and edit flows for company-scoped customer records.
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

Attachment persistence is intentionally kept separate from the form interaction. The current detail experience manages attachments in the offer workspace; production persistence should use a company-scoped Supabase Storage bucket and a `quote_documents` record tied to the canonical quote once remote schema administration is available.

The starter technical template is currently a UI schema. Its multi-company definition, assignment, typed-value, and versioned-snapshot tables should be introduced together in the custom-field migration, rather than persisting an unvalidated JSON blob on `quotes`.

## Intentionally not duplicated

There is no `orders` table inside Sales. A quote is the commercial object; after approval it will create the canonical record in the future `Orders` module. Workshop, field, and parts are service modes on the opportunity and quote, not separate sales systems.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the project URL and publishable key. Do not add the secret key to any `NEXT_PUBLIC_` variable.
3. Install packages with `npm install`.
4. Run `npm run dev -- --port 3001` and visit `/sales`.

Without a signed-in organization member, the page presents safe visual demo data. API writes are refused until a real Supabase session is present.

## Applying the schema

The migration is [20260918014800_create_sales_foundation.sql](../supabase/migrations/20260918014800_create_sales_foundation.sql). It has not been applied to the remote project because API keys cannot administer schema changes.

Use a short-lived Supabase personal access token or database password, then run:

```bash
supabase link --project-ref zdwkjdbjwwxenwmdrzgq
supabase db push
supabase db advisors
```

After the first user signs in, call `public.create_organization(name, slug)` from the authenticated onboarding flow. It creates an owner membership and initializes the commercial pipeline.

## Verification after deployment

1. Confirm every `public` table has RLS enabled with `supabase db advisors`.
2. Create two organizations and users; verify a user from one cannot read or write the other through the Data API.
3. Create an offer and confirm the quote totals change only from its quote lines.
4. Confirm that the new opportunity, quote, activity event, and both history records have the same `organization_id`.
5. Add the same user to two companies and confirm switching companies cannot expose cross-company records.
6. Repeat the above with `read` sales permission and verify writes are denied; repeat with `write` and verify pipeline configuration still requires `admin`.
