# DVhub PostgreSQL Schema Blueprint

**Date:** 2026-03-10

**Status:** Reference blueprint

**Purpose:** Provide a concrete PostgreSQL schema blueprint for the agreed DVhub architecture with `shared`, `dv`, `opt`, and `exec` schemas. This document is intended as the baseline for later SQL migration work and should be read together with the architecture masterlist and optimizer orchestration design.

## Related Documents

- `docs/plans/2026-03-10-dvhub-data-architecture-masterlist.md`
- `docs/plans/2026-03-10-dvhub-optimizer-orchestrator-design.md`
- `docs/plans/2026-03-10-dvhub-optimizer-orchestrator.md`

## Design Rules

- PostgreSQL is the primary system of record.
- Use `uuid` primary keys to avoid coupling to insertion order and to simplify external references.
- Use `timestamptz` for all timestamps.
- Use `bigint` for power and energy values in `W` and `Wh`.
- Use `numeric(12,5)` for prices and percentages that require exact reporting.
- Prefer typed columns for anything used in filtering, scoring, arbitration, reporting, or enforcement.
- Keep provider-specific payloads in `jsonb` alongside typed columns.
- Avoid PostgreSQL enum types for fast-changing business categories; use `text` plus `check` constraints instead.

## Recommended Extensions

```sql
create extension if not exists pgcrypto;
```

Optional later:

```sql
-- only if time-series scale requires it
-- create extension if not exists timescaledb;
```

## Schemas

```sql
create schema if not exists shared;
create schema if not exists dv;
create schema if not exists opt;
create schema if not exists exec;
```

## Shared Schema

### `shared.sites`

```sql
create table shared.sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  timezone text not null,
  currency text not null default 'EUR',
  operating_mode text not null default 'combined'
    check (operating_mode in ('dv_only', 'optimization_only', 'combined')),
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `shared.assets`

```sql
create table shared.assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  asset_type text not null
    check (asset_type in ('battery', 'inverter', 'pv_array', 'meter', 'evse', 'vehicle', 'gateway', 'controller')),
  code text not null,
  name text not null,
  manufacturer text,
  model text,
  serial_no text,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code)
);

create index assets_site_type_idx on shared.assets(site_id, asset_type);
```

### `shared.asset_bindings`

```sql
create table shared.asset_bindings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references shared.assets(id) on delete cascade,
  binding_type text not null
    check (binding_type in ('driver', 'external_system', 'mqtt_topic', 'modbus_map', 'rest_resource')),
  provider_code text not null,
  external_ref text not null,
  binding_status text not null default 'active'
    check (binding_status in ('active', 'disabled', 'error')),
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, binding_type, provider_code, external_ref)
);
```

### `shared.asset_constraints`

```sql
create table shared.asset_constraints (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references shared.assets(id) on delete cascade,
  valid_from timestamptz not null,
  valid_to timestamptz,
  min_soc_pct numeric(6,3),
  max_soc_pct numeric(6,3),
  max_charge_w bigint,
  max_discharge_w bigint,
  max_import_w bigint,
  max_export_w bigint,
  usable_capacity_wh bigint,
  charge_efficiency numeric(6,5),
  discharge_efficiency numeric(6,5),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (min_soc_pct is null or (min_soc_pct >= 0 and min_soc_pct <= 100)),
  check (max_soc_pct is null or (max_soc_pct >= 0 and max_soc_pct <= 100)),
  check (valid_to is null or valid_to > valid_from)
);

create index asset_constraints_asset_from_idx on shared.asset_constraints(asset_id, valid_from desc);
```

### `shared.meter_devices`

```sql
create table shared.meter_devices (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  asset_id uuid references shared.assets(id) on delete set null,
  meter_role text not null
    check (meter_role in ('grid_interconnection', 'pv', 'battery', 'load', 'submeter')),
  source_type text not null
    check (source_type in ('modbus', 'mqtt', 'rest', 'driver', 'derived')),
  driver_key text not null,
  is_primary_grid_meter boolean not null default false,
  poll_interval_ms integer not null default 1000,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meter_devices_site_role_idx on shared.meter_devices(site_id, meter_role);
```

### `shared.meter_channels`

```sql
create table shared.meter_channels (
  id uuid primary key default gen_random_uuid(),
  meter_device_id uuid not null references shared.meter_devices(id) on delete cascade,
  channel_key text not null,
  unit text not null,
  phase text
    check (phase is null or phase in ('l1', 'l2', 'l3', 'all')),
  direction text
    check (direction is null or direction in ('import', 'export', 'bidirectional')),
  register_ref text,
  topic_ref text,
  scaling numeric(14,6) not null default 1,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (meter_device_id, channel_key, coalesce(phase, 'all'))
);
```

### `shared.telemetry_samples_raw`

```sql
create table shared.telemetry_samples_raw (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  meter_device_id uuid references shared.meter_devices(id) on delete set null,
  channel_id uuid references shared.meter_channels(id) on delete set null,
  ts timestamptz not null,
  value_num numeric(18,6) not null,
  quality text not null default 'raw'
    check (quality in ('raw', 'estimated', 'backfilled', 'invalid')),
  stale boolean not null default false,
  source text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index telemetry_samples_raw_site_ts_idx on shared.telemetry_samples_raw(site_id, ts desc);
create index telemetry_samples_raw_channel_ts_idx on shared.telemetry_samples_raw(channel_id, ts desc);
```

### `shared.live_snapshots`

```sql
create table shared.live_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  captured_at timestamptz not null,
  grid_import_w bigint not null default 0,
  grid_export_w bigint not null default 0,
  grid_l1_w bigint,
  grid_l2_w bigint,
  grid_l3_w bigint,
  pv_power_w bigint,
  load_power_w bigint,
  battery_power_w bigint,
  soc_pct numeric(6,3),
  ev_charge_w bigint,
  grid_setpoint_w bigint,
  min_soc_pct numeric(6,3),
  data_quality text not null default 'ok'
    check (data_quality in ('ok', 'stale', 'partial', 'invalid')),
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index live_snapshots_site_captured_idx on shared.live_snapshots(site_id, captured_at desc);
```

### `shared.market_price_runs`

```sql
create table shared.market_price_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  provider_code text not null,
  market_type text not null
    check (market_type in ('day_ahead', 'import_tariff', 'export_tariff', 'balancing', 'custom')),
  version text,
  fetched_at timestamptz not null,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index market_price_runs_site_fetched_idx on shared.market_price_runs(site_id, fetched_at desc);
```

### `shared.market_price_slots`

```sql
create table shared.market_price_slots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references shared.market_price_runs(id) on delete cascade,
  site_id uuid not null references shared.sites(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  resolution_seconds integer not null,
  price_kind text not null
    check (price_kind in ('market', 'gross_import', 'export', 'opportunity')),
  price_ct_kwh numeric(12,5),
  price_eur_mwh numeric(12,5),
  confidence numeric(6,5),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (slot_end > slot_start),
  unique (run_id, price_kind, slot_start)
);

create index market_price_slots_site_start_idx on shared.market_price_slots(site_id, slot_start);
```

### `shared.tariff_sets`

```sql
create table shared.tariff_sets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  code text not null,
  tariff_type text not null
    check (tariff_type in ('import', 'export', 'network', 'module3', 'custom')),
  valid_from timestamptz not null,
  valid_to timestamptz,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code, valid_from)
);
```

### `shared.event_log`

```sql
create table shared.event_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references shared.sites(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index event_log_site_created_idx on shared.event_log(site_id, created_at desc);
```

### `shared.audit_log`

```sql
create table shared.audit_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references shared.sites(id) on delete cascade,
  actor_type text not null
    check (actor_type in ('user', 'system', 'optimizer', 'dv')),
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_site_created_idx on shared.audit_log(site_id, created_at desc);
```

## DV Schema

### `dv.providers`

```sql
create table dv.providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### `dv.provider_connections`

```sql
create table dv.provider_connections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  provider_id uuid not null references dv.providers(id) on delete restrict,
  endpoint text,
  tunnel_type text
    check (tunnel_type is null or tunnel_type in ('openvpn', 'wireguard', 'plain_tcp', 'custom')),
  status text not null default 'configured'
    check (status in ('configured', 'connected', 'degraded', 'error', 'disabled')),
  last_seen_at timestamptz,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, provider_id)
);
```

### `dv.rules`

```sql
create table dv.rules (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  rule_key text not null,
  priority integer not null default 100,
  enabled boolean not null default true,
  hard_constraint boolean not null default true,
  valid_from timestamptz not null,
  valid_to timestamptz,
  condition_json jsonb not null default '{}'::jsonb,
  action_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, rule_key, valid_from)
);

create index dv_rules_site_priority_idx on dv.rules(site_id, priority, valid_from desc);
```

### `dv.operating_state`

```sql
create table dv.operating_state (
  site_id uuid primary key references shared.sites(id) on delete cascade,
  provider_id uuid references dv.providers(id) on delete set null,
  updated_at timestamptz not null,
  dv_mode text not null default 'active'
    check (dv_mode in ('active', 'passive', 'standby', 'error')),
  control_value integer
    check (control_value is null or control_value in (0, 1)),
  export_allowed boolean not null default true,
  export_limit_w bigint,
  forced_curtailment boolean not null default false,
  reason text,
  stale boolean not null default false,
  details_json jsonb not null default '{}'::jsonb
);
```

### `dv.decisions`

```sql
create table dv.decisions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  provider_id uuid references dv.providers(id) on delete set null,
  ts timestamptz not null,
  slot_start timestamptz,
  slot_end timestamptz,
  decision_type text not null
    check (decision_type in ('allow_export', 'limit_export', 'force_curtailment', 'allow_runtime', 'block_export')),
  export_allowed boolean not null,
  effective_export_limit_w bigint,
  reason text,
  source_rule_id uuid references dv.rules(id) on delete set null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (slot_end is null or slot_start is not null)
);

create index dv_decisions_site_ts_idx on dv.decisions(site_id, ts desc);
create index dv_decisions_site_slot_idx on dv.decisions(site_id, slot_start);
```

### `dv.actions`

```sql
create table dv.actions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  decision_id uuid references dv.decisions(id) on delete set null,
  target_system text not null
    check (target_system in ('victron', 'inverter', 'gateway', 'custom')),
  target_key text not null,
  requested_value numeric(18,6),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped', 'failed', 'completed')),
  created_at timestamptz not null default now()
);

create index dv_actions_site_created_idx on dv.actions(site_id, created_at desc);
```

### `dv.action_results`

```sql
create table dv.action_results (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references dv.actions(id) on delete cascade,
  executed_at timestamptz not null,
  success boolean not null,
  effective_value numeric(18,6),
  error_text text,
  readback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### `dv.measurement_exports`

```sql
create table dv.measurement_exports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  provider_id uuid references dv.providers(id) on delete set null,
  ts timestamptz not null,
  grid_import_w bigint not null default 0,
  grid_export_w bigint not null default 0,
  grid_l1_w bigint,
  grid_l2_w bigint,
  grid_l3_w bigint,
  quality text not null default 'ok'
    check (quality in ('ok', 'stale', 'partial', 'invalid')),
  published_to_provider boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index dv_measurement_exports_site_ts_idx on dv.measurement_exports(site_id, ts desc);
```

## Optimization Schema

### `opt.forecast_providers`

```sql
create table opt.forecast_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  forecast_type text not null
    check (forecast_type in ('pv', 'load', 'ev', 'weather', 'price')),
  endpoint text,
  active boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### `opt.forecast_runs`

```sql
create table opt.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  provider_id uuid references opt.forecast_providers(id) on delete set null,
  forecast_type text not null
    check (forecast_type in ('pv', 'load', 'ev', 'weather', 'price')),
  model_version text,
  created_at timestamptz not null default now(),
  horizon_start timestamptz not null,
  horizon_end timestamptz not null,
  raw_json jsonb not null default '{}'::jsonb,
  check (horizon_end > horizon_start)
);

create index forecast_runs_site_created_idx on opt.forecast_runs(site_id, created_at desc);
```

### `opt.forecast_slots`

```sql
create table opt.forecast_slots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references opt.forecast_runs(id) on delete cascade,
  site_id uuid not null references shared.sites(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  resolution_seconds integer not null,
  forecast_type text not null
    check (forecast_type in ('pv', 'load', 'ev', 'weather', 'price')),
  value_num numeric(18,6) not null,
  unit text not null,
  confidence numeric(6,5),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, forecast_type, slot_start)
);

create index forecast_slots_site_start_idx on opt.forecast_slots(site_id, slot_start);
```

### `opt.input_snapshots`

```sql
create table opt.input_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  horizon_start timestamptz not null,
  horizon_end timestamptz not null,
  resolution_seconds integer not null,
  snapshot_hash text not null,
  payload_json jsonb not null,
  unique (site_id, snapshot_hash)
);

create index input_snapshots_site_created_idx on opt.input_snapshots(site_id, created_at desc);
```

### `opt.optimizer_providers`

```sql
create table opt.optimizer_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### `opt.optimizer_runs`

```sql
create table opt.optimizer_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  optimizer_provider_id uuid not null references opt.optimizer_providers(id) on delete restrict,
  input_snapshot_id uuid not null references opt.input_snapshots(id) on delete restrict,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null
    check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  runtime_ms integer,
  error_text text,
  raw_result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index optimizer_runs_site_started_idx on opt.optimizer_runs(site_id, started_at desc);
```

### `opt.plans`

```sql
create table opt.plans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  optimizer_run_id uuid not null references opt.optimizer_runs(id) on delete cascade,
  plan_kind text not null default 'candidate'
    check (plan_kind in ('candidate', 'winner', 'fallback', 'blend')),
  horizon_start timestamptz not null,
  horizon_end timestamptz not null,
  feasible boolean not null default false,
  selected boolean not null default false,
  selection_reason text,
  created_at timestamptz not null default now(),
  check (horizon_end > horizon_start)
);

create index plans_site_selected_idx on opt.plans(site_id, selected, horizon_start desc);
```

### `opt.plan_slots`

```sql
create table opt.plan_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references opt.plans(id) on delete cascade,
  site_id uuid not null references shared.sites(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  resolution_seconds integer not null,
  grid_import_wh bigint not null default 0,
  grid_export_wh bigint not null default 0,
  battery_charge_grid_wh bigint not null default 0,
  battery_charge_pv_wh bigint not null default 0,
  battery_discharge_load_wh bigint not null default 0,
  battery_discharge_export_wh bigint not null default 0,
  ev_charge_wh bigint not null default 0,
  target_soc_pct numeric(6,3),
  expected_profit_eur numeric(12,5),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, slot_start)
);

create index plan_slots_site_start_idx on opt.plan_slots(site_id, slot_start);
```

### `opt.plan_scores`

```sql
create table opt.plan_scores (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references opt.plans(id) on delete cascade,
  site_id uuid not null references shared.sites(id) on delete cascade,
  feasibility_score numeric(12,5) not null default 0,
  economic_score numeric(12,5) not null default 0,
  soc_score numeric(12,5) not null default 0,
  forecast_score numeric(12,5) not null default 0,
  dv_compliance_score numeric(12,5) not null default 0,
  total_score numeric(12,5) not null default 0,
  winner boolean not null default false,
  scored_at timestamptz not null default now(),
  details_json jsonb not null default '{}'::jsonb
);

create index plan_scores_site_scored_idx on opt.plan_scores(site_id, scored_at desc);
create index plan_scores_site_total_idx on opt.plan_scores(site_id, total_score desc);
```

## Execution Schema

### `exec.control_intents`

```sql
create table exec.control_intents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  source_module text not null
    check (source_module in ('dv', 'optimization', 'manual', 'safety')),
  source_ref_id uuid,
  priority integer not null,
  intent_type text not null
    check (intent_type in ('curtailment', 'export_limit', 'battery_schedule', 'ev_schedule', 'setpoint', 'fallback')),
  status text not null default 'active'
    check (status in ('active', 'superseded', 'cancelled', 'expired')),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index control_intents_site_created_idx on exec.control_intents(site_id, created_at desc);
create index control_intents_site_priority_idx on exec.control_intents(site_id, priority desc, created_at desc);
```

### `exec.intent_slots`

```sql
create table exec.intent_slots (
  id uuid primary key default gen_random_uuid(),
  control_intent_id uuid not null references exec.control_intents(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  target_key text not null,
  target_value_num numeric(18,6),
  unit text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (control_intent_id, slot_start, target_key)
);
```

### `exec.arbitration_runs`

```sql
create table exec.arbitration_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null
    check (status in ('running', 'completed', 'failed', 'skipped')),
  active_dv_decision_id uuid references dv.decisions(id) on delete set null,
  active_opt_plan_id uuid references opt.plans(id) on delete set null,
  reason text,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index arbitration_runs_site_started_idx on exec.arbitration_runs(site_id, started_at desc);
```

### `exec.effective_plans`

```sql
create table exec.effective_plans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  arbitration_run_id uuid not null references exec.arbitration_runs(id) on delete cascade,
  plan_mode text not null
    check (plan_mode in ('dv_only', 'optimization_only', 'combined', 'fallback')),
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'superseded')),
  created_at timestamptz not null default now(),
  check (valid_to > valid_from)
);

create index effective_plans_site_valid_idx on exec.effective_plans(site_id, valid_from desc);
```

### `exec.effective_plan_slots`

```sql
create table exec.effective_plan_slots (
  id uuid primary key default gen_random_uuid(),
  effective_plan_id uuid not null references exec.effective_plans(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  target_key text not null,
  requested_value numeric(18,6),
  effective_value numeric(18,6),
  limited_by_dv boolean not null default false,
  limited_by_safety boolean not null default false,
  limited_by_manual boolean not null default false,
  reason_codes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (effective_plan_id, slot_start, target_key)
);

create index effective_plan_slots_plan_start_idx on exec.effective_plan_slots(effective_plan_id, slot_start);
```

### `exec.command_events`

```sql
create table exec.command_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  effective_plan_slot_id uuid references exec.effective_plan_slots(id) on delete set null,
  target_system text not null
    check (target_system in ('victron', 'evcc', 'inverter', 'gateway', 'custom')),
  target_key text not null,
  sent_at timestamptz not null,
  requested_value numeric(18,6),
  effective_value numeric(18,6),
  success boolean not null,
  error_text text,
  readback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index command_events_site_sent_idx on exec.command_events(site_id, sent_at desc);
```

### `exec.manual_overrides`

```sql
create table exec.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references shared.sites(id) on delete cascade,
  target_key text not null,
  value_num numeric(18,6),
  valid_until timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  created_by text
);

create index manual_overrides_site_created_idx on exec.manual_overrides(site_id, created_at desc);
```

## Phase 2 Tables

These should be added when backtesting and richer observability become operational requirements:

- `shared.live_point_values`
- `shared.telemetry_slots`
- `shared.tariff_slots`
- `dv.signal_runs`
- `dv.signal_slots`
- `dv.rule_assignments`
- `dv.export_policies`
- `dv.manufacturer_profiles`
- `dv.control_capabilities`
- `opt.forecast_quality`
- `opt.optimizer_configs`
- `opt.optimizer_artifacts`
- `opt.plan_score_slots`
- `opt.plan_backtests`
- `opt.statistics_daily`
- `exec.command_batches`
- `exec.feedback_events`
- `exec.failures`
- `exec.active_state`

## Partitioning Guidance

Recommended first partition candidates:

- `shared.telemetry_samples_raw` by month on `ts`
- `shared.live_snapshots` by month on `captured_at`
- `shared.market_price_slots` by month on `slot_start`
- `opt.forecast_slots` by month on `slot_start`
- `opt.plan_slots` by month on `slot_start`
- `exec.command_events` by month on `sent_at`

Start without partitioning if necessary, but keep timestamp-driven indexes in place so later partitioning stays possible.

## Retention Guidance

- keep `shared.telemetry_samples_raw` short-lived unless detailed forensic replay is required
- keep `shared.live_snapshots` medium-term
- keep scores, plans, audits, DV decisions, and command events long-term
- archive rather than delete optimizer comparison history whenever possible

## Migration Guidance

- implement schemas and tables in the order `shared`, `dv`, `opt`, `exec`
- add `updated_at` triggers centrally instead of per migration if desired
- keep provider-specific data in `jsonb` until a field proves broadly queryable
- do not merge DV and optimization control paths into the same source table; preserve intent separation

## Final Recommendation

Use this blueprint as the baseline for the first PostgreSQL migration set. The MVP should begin with the tables defined explicitly in this document, then extend into Phase 2 only after the first end-to-end path exists:

- live meter ingestion
- DV state and decisioning
- forecast ingestion
- optimizer runs and candidate plans
- arbitration
- effective command execution
