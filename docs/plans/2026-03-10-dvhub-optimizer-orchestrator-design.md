# DVhub Optimizer Orchestrator Design

**Date:** 2026-03-10

**Status:** Approved for planning

## Goal

DVhub shall evolve from a Direktvermarkter interface plus dashboard into the central energy and market orchestration layer for a Victron-based site. It remains the DV hub, but also becomes the system that collects all relevant market, forecast, asset, and mobility data, forwards normalized inputs to pluggable optimizers such as EOS and EMHASS, receives their plans, evaluates them automatically, and executes the best plan through Victron, EVCC, and DV-related controls.

## Product Intent

The target system shall support price-aware and forecast-driven operation across:

- direct marketing export decisions per slot
- grid import when market prices are favorable
- controlled battery emptying before expected PV peaks
- optional gray-power charging under future Pauschaloption rules
- battery cycling across up to two economically justified cycles per day
- home consumption optimization
- EV charging coordination through EVCC

DVhub is the stable center. EOS, EMHASS, and later solvers are replaceable optimization engines behind it.

## Primary Principles

- DVhub is the single source of truth for live state, forecasts, market data, constraints, plans, scores, and execution logs.
- Optimizers are pluggable. No optimizer-specific internal state should leak into the DVhub core model.
- All forecasts and plans must be normalized to a common slot grid, preferably 15-minute slots.
- Plan selection runs automatically.
- Every selected and rejected plan is logged and backtested.
- A future blend mode is allowed, but only after enough evidence exists to justify slot- or segment-level mixing.

## System Architecture

The target architecture consists of six layers:

1. **Data Core**
   Stores live telemetry, historical telemetry, asset configuration, market prices, tariff windows, EVCC state, forecast inputs, plans, scores, and execution logs.
2. **Forecast Broker**
   Accepts PV, load, EV, and market forecast inputs from multiple providers and normalizes them into a canonical slot-aligned representation.
3. **Optimizer Adapters**
   Exposes canonical optimizer inputs and translates canonical optimizer outputs for EOS, EMHASS, and future systems.
4. **Canonical Plan Engine**
   Holds the internal plan format. All solver outputs are converted into this shared representation before evaluation or execution.
5. **Evaluation Engine**
   Checks feasibility, scores candidate plans, runs rolling backtests, tracks optimizer performance, and decides whether one plan wins or whether a blend is justified.
6. **Execution Layer**
   Activates the winning plan and distributes resulting control targets to Victron, EVCC, and DV-specific logic.

## Canonical Data Model

The internal data model must cover these classes:

### 1. Asset Configuration

- battery usable capacity in kWh
- max charge and discharge power
- charge and discharge efficiency
- minimum and maximum SOC
- inverter and grid limits
- EVCC loadpoints and vehicle constraints
- DV export restrictions and market-specific hard limits

### 2. Live State

- timestamp
- battery SOC and battery power
- grid import and export
- PV generation
- house load
- Victron setpoints and min SOC
- EV connected state, EV SOC, charging power, and active target
- active restrictions, overrides, or forced-off states

### 3. Market Data

- day-ahead market prices
- gross import tariff
- export remuneration
- section 14a or Pauschaloption windows
- negative-price and DV-related control signals

### 4. Forecast Input

- PV forecast by slot
- load forecast by slot
- EV charging demand and departure targets
- optional weather metadata and confidence
- source and version metadata for every forecast stream

### 5. Optimizer Run

- optimizer name
- run id
- timestamp and horizon
- normalized input snapshot reference
- solver status
- runtime and error details
- raw payload for traceability

### 6. Plan Slots

Each plan slot should contain at least:

- slot start and end
- grid import target
- grid export target
- battery charge from grid
- battery charge from PV
- battery discharge to load
- battery discharge to export
- EV charging target
- target SOC
- expected cost and revenue contribution
- originating optimizer

### 7. Execution Log

- activated plan id
- applied setpoints
- execution timestamp
- target system such as Victron or EVCC
- actual write result
- deviation or override reason

### 8. Plan Score

- feasibility score
- economic score
- SOC accuracy score
- forecast accuracy score
- violations
- realized profit and cost deltas
- final total score

### 9. Blend Score

For later use only:

- segment-level comparison metadata
- slot family or time-of-day strength markers
- optimizer contribution markers for mixed plans

## Data Flow

The runtime flow should be:

1. DVhub collects live site data, market prices, EVCC state, and forecast streams.
2. DVhub normalizes all inputs into one canonical snapshot for a defined slot horizon.
3. DVhub sends parallel input snapshots to EOS and EMHASS through optimizer adapters.
4. Each optimizer returns a candidate plan.
5. DVhub converts both plans into one canonical internal plan format.
6. DVhub validates both plans against physical, tariff, EV, and DV constraints.
7. DVhub scores both plans and activates the best plan automatically.
8. DVhub writes resulting control actions to Victron and EVCC.
9. DVhub logs plan outcome versus reality for rolling backtests.
10. DVhub updates optimizer performance history and optional blend readiness signals.

## External Integration Roles

### Victron

- primary live-state provider
- primary battery execution target
- source for SOC, power flows, and plant control points

### EVCC

- provider for EV and loadpoint state
- execution target for EV charging actions
- mobility constraint source, not the central optimizer

### EOS

- pluggable optimizer and forecast-capable solver
- receives normalized site, price, and forecast data
- returns candidate plan

### EMHASS

- second pluggable optimizer
- receives same canonical problem view as EOS
- returns alternative candidate plan

### Forecast Providers

- PV forecast is mandatory
- load forecast is mandatory for high-quality arbitrage
- EV forecast is required when EV charging is part of optimization
- weather context is optional but useful for confidence scoring

## API Direction

The existing integration endpoints are a good starting point, but the target model needs a clearer split:

- input endpoints for forecasts and market data
- canonical optimizer input endpoints
- canonical optimizer output endpoints
- evaluation and leaderboard endpoints
- active plan and execution endpoints

Recommended endpoint groups:

- `GET /api/state/live`
- `GET /api/state/assets`
- `GET /api/state/market`
- `GET /api/state/forecast/latest`
- `POST /api/import/forecast/pv`
- `POST /api/import/forecast/load`
- `POST /api/import/forecast/ev`
- `POST /api/import/market/prices`
- `GET /api/optimizer/input?optimizer=eos`
- `GET /api/optimizer/input?optimizer=emhass`
- `POST /api/optimizer/runs`
- `POST /api/optimizer/runs/:runId/plan`
- `GET /api/optimizer/scores`
- `GET /api/optimizer/leaderboard`
- `GET /api/execution/active-plan`
- `POST /api/execution/activate/:planId`

## Plan Evaluation

Plan evaluation must happen in two phases:

### Ex Ante

Before activation:

- verify physical constraints
- verify tariff and DV compliance
- verify EV feasibility
- verify plausible SOC progression
- compare against a simple baseline

### Ex Post

After slot or day completion:

- compare planned versus actual import
- compare planned versus actual export
- compare planned versus actual SOC
- compare planned versus actual PV and load impact
- compare expected versus realized economics

Primary metrics:

- cost error
- revenue error
- realized profit delta
- SOC error
- import and export error
- missed arbitrage
- curtailment loss
- rule violations

## Automatic Winner Logic

Initial operation should use winner-takes-all at plan level:

- both plans are computed
- both plans are normalized and scored
- the better plan is activated automatically
- the rejected plan is still stored for backtesting

Blend mode is a future stage and should activate only after enough evidence exists that one optimizer is repeatedly better for specific slot categories or time windows.

## User Interface

DVhub should become the operator console for optimization, not just for DV status.

The UI should expose these top-level areas:

- live and market overview
- forecasts with accuracy tracking
- optimizer comparison view
- active and candidate plan views
- backtesting and optimizer leaderboard
- configuration for assets, tariffs, integrations, and scoring

The most important operational view is a slot-based timeline for the next 24 to 48 hours showing:

- market price
- PV forecast
- load forecast
- planned import
- planned export
- battery charge and discharge
- EV charge target
- expected SOC
- selected optimizer
- difference between optimizer plans

## Error Handling

The system must degrade safely:

- if one optimizer fails, the other can still run
- if both optimizers fail, DVhub falls back to safe baseline behavior
- if forecast streams are stale, scoring must reflect reduced confidence
- if EVCC is unavailable, EV-specific constraints are removed or marked degraded
- if execution writes fail, the active plan is marked degraded and operator-visible logs are updated

## Testing Strategy

The first implementation phase must be heavily test-driven.

Required test areas:

- canonical snapshot creation
- forecast normalization into slot grid
- optimizer adapter translation for EOS and EMHASS
- canonical plan validation
- winner selection and fallback logic
- rolling score calculation
- execution dispatch to Victron and EVCC
- UI rendering for comparison and plan inspection

## Delivery Priorities

### Phase 1

- canonical optimizer input model
- forecast ingestion for PV and load
- normalized plan storage
- parallel EOS and EMHASS run handling
- automatic winner selection

### Phase 2

- EVCC data ingestion and execution
- richer scoring and leaderboard views
- backtest analytics in UI

### Phase 3

- blend mode
- segment-level optimizer mixing
- adaptive confidence weighting by context

## Open Implementation Assumptions

- 15-minute slots are the default planning resolution
- DVhub remains the only execution authority
- EOS and EMHASS are external and pluggable
- PV forecast is mandatory for production-grade optimization
- EVCC integration is required when EV charging should influence plan quality
