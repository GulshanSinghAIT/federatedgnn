# Frontend - FedFairGNN dashboard

React 18 + TypeScript + Vite + Tailwind v4 SPA for the Federated FairGNN project.
Talks to the FastAPI backend at `:8000` (Vite proxies `/api` and `/ws` - see `vite.config.ts`).

Run: `npm run dev` (proxy handles the backend). `npm run build` runs `tsc && vite build`.

## Golden rules (read before editing)
- **Path alias `@/` → `src/`** is configured in BOTH `tsconfig.json` and `vite.config.ts`. Use `@/components/ui/button` etc.
- **`cn` already exists** at `@/lib/utils` (clsx + tailwind-merge). Don't reinvent it.
- **`src/components/ui/` is a full shadcn-style library** (Button, Badge, Table, Select, Tabs/TabsSubtle, Tooltip, Slider, Switch, Dialog, Dropdown, Accordion, InputGroup/InputField, Textarea, …). Prefer these over native `<button>`/`<select>`/`<input>`/`<textarea>` - the app has been migrated to them. Note: there is **no bare `Input`** (use `InputField` inside `InputGroup`); `Textarea` was added locally (`ui/textarea.tsx`). Prefer these over hand-rolled controls. They depend on `@/lib/shape-context` + `surface-context` + `icon-context`, which all have **safe defaults** (no provider required).
- **Two theming systems are both wired in `src/index.css`:**
  1. Legacy `--color-*` vars (e.g. `var(--color-bg-primary)`, `var(--color-accent-blue)`, `var(--color-node-disease)`) used by all the dashboard components via inline Tailwind arbitrary values. Keep using these in dashboards - they're remapped onto the brand.
  2. shadcn semantic tokens consumed by `components/ui/*`: Tailwind classes (`bg-foreground`, `bg-accent`, `border-border`, …) need `--color-foreground` etc., AND a few components read **raw** `var(--accent)`/`var(--foreground)`/`var(--background)`/`var(--muted-foreground)` inline. Both sets are defined in `index.css`. If a ui component renders unstyled, a token is missing there.
  3. **Elevation scale** `--color-surface-1..8` + `--shadow-surface-1..8` (also in `index.css`): `Elevated` and any portal popover (Select/Dropdown/Dialog) render `bg-surface-N shadow-surface-N` via `lib/surface-*`. If a dropdown/popover has no background, these are missing. Light theme: surfaces stay near-white, depth = shadow.
- **Brand = light "Clinical Signal" palette** (see `brand.html`): paper `#F6F7F9`, ink `#15181E`, cobalt `#2840C9` (primary), entities disease `#D6336C` / symptom `#C77A04` / treatment `#0C8F77`. Fonts: Space Grotesk (display) / IBM Plex (body/mono) with Geist fallback (brand fonts not yet installed - add `@fontsource/space-grotesk` + `@fontsource/ibm-plex-*` to complete).
- **Do NOT import these 4 ui files** - they have pre-existing TS errors (use a `render=` prop the installed radix doesn't support): `accordion.tsx`, `checkbox-group.tsx`, `dialog.tsx`, `switch.tsx`. The rest typecheck clean. (These errors predate this work; `npm run build`'s tsc step fails on them - `npm run dev` is unaffected.)

## Layout
```
src/
  App.tsx                routes + sidebar nav (BrandGlyph node-logo)
  api/client.ts          ★ all REST calls (axios, baseURL /api)
  store/
    federationStore.ts   ★ zustand: isRunning, round, dataset, engine, history[], hospitalMetrics, globalMetrics
    patientStore.ts       patients, currentPatient, currentHospitalId
  hooks/useWebSocket.ts  /ws/federation → store updates
  pages/                 HospitalDashboard, FederationDashboard, MetricsDashboard
  components/
    ui/                  shadcn-style library (see rules)
    federation/          HospitalNetwork, HospitalNode, AggregatorNode, MetricsFeed, TrainingCharts (ReactFlow + Recharts)
    metrics/             ModelComparison (dataset selector + live/benchmark), DemographicHeatmap
    graph/               KnowledgeGraph, PatientSubgraph (D3 force layouts)
    ehr/                 PatientList, PatientForm, PatientDetail, SymptomSelector
    decision/            DiagnosisPanel, TreatmentPanel, FairnessAudit
  lib/                   utils(cn), shape/surface/icon-context, icon-map, springs
  index.css              ★ theme: brand tokens + legacy --color-* remap + shadcn tokens
```

## Data shapes (must match backend - see ../backend/CLAUDE.md)
- **RoundMetric** (store + WS): `{model_name, round_num, hospital_id, dataset?, accuracy, f1_score, auc?, loss?, sp_difference, eo_difference, nodes_trained?, timestamp}`.
- **Model comparison row** (`/api/metrics/compare?dataset=`): `{model, dataset, accuracy, f1_score, auc, sp_difference, eo_difference, privacy, comm_cost, is_proposed, source:'live'|'benchmark'}`.
- **Dataset** (`/api/metrics/datasets`): `{id, name, description, sensitive_attribute, citation, is_live}`. Three: MedGraph-S (default/live), Hetionet, DiseaseNet.
- **Patient / Prediction**: see `patientStore.ts` and `PatientDetail.tsx` (diagnoses, treatments keyed by disease_id, fairness_check).

## Dataset + engine flow
`federationStore.dataset` (default `MedGraph-S`) and `.engine` (`sim`|`real`) are selected in `FederationDashboard`'s control bar and sent in `startFederation({model,rounds,hospitals,dataset,engine})`. `ModelComparison` has its own dataset selector and shows the paper Table-1 benchmark until that (model,dataset) has live results this session, then switches to live (`source` field; a Badge shows which).

## WebSocket events handled (`useWebSocket.ts`)
`model_training_start`, `hospital_round_complete`, `global_aggregation_complete`, `model_training_complete`, `federation_complete`. Backend also emits `engine_fallback{round,reason}` when real→sim fallback happens (not yet surfaced in the feed - add to the hook if you want it shown).

## Categorical colors (hospitals/models)
H1/cobalt `#2840C9`, H2/teal `#0C8F77`, H3/amber `#C77A04` - via `--color-hospital-h1..h3`. Some graph/chart components still hold hardcoded hex (`#38bdf8`, `#334155`, dark tooltips) from the old dark theme; migrate to brand tokens when you touch them.
