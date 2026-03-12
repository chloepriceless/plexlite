# DVhub Small Market Automation Design

**Context:** DVhub already supports manual market-window scheduling, EPEX day-ahead price display, and persistent schedule rules. The new requirement is a daily-running `kleine Börsenautomatik` that scans a configurable window from the afternoon into the next morning, finds the most profitable free market slots, and creates temporary feed-in rules that discharge the battery into the grid while respecting thermal pacing, SOC protection, and existing manual rules.

**Scope:** Add a toggleable daily automation that generates and replaces its own temporary schedule rules, marks those rules visually in yellow, and plans discharge windows from EPEX prices, user-defined slot limits, discharge rule chains, and a dynamic overnight SOC allowance derived from sunrise and sunset for the configured installation location.

**Goals**

- Let the user activate or deactivate the `kleine Börsenautomatik`.
- Let the user configure a search window, slot budget, global maximum discharge power, automation-specific minimum SOC, and optional advanced rule chains.
- Recalculate and replace automation-managed rules automatically each day while the feature is active.
- Only use free slots that are not already occupied by manual rules.
- Mark automation-generated rules clearly in yellow inside the rule list.
- Remove previous automation-generated rules automatically before creating new ones.
- Allow dynamic overnight relaxation from automation minimum SOC toward the global minimum SOC based on cached sunrise/sunset times.
- Allow discharge down to the global minimum SOC when the market price is at least `20%` above the configured grid import price.

**Non-Goals**

- No overwriting or reshaping of user-created manual schedule rules.
- No live dependency on sunrise/sunset APIs during normal daily planning.
- No DC-coupled MPPT control logic.
- No external optimizer dependency for the first version.
- No continuous intraday re-optimization on every telemetry tick.

**Problem Summary**

- Afternoon and evening price peaks are currently visible in DVhub, but turning them into profitable battery discharge rules is still manual work.
- A simple “pick top N slots” heuristic is insufficient because discharge chains can include cool-down phases and may be more profitable as connected or separated slot groups.
- A static SOC floor is too conservative for slots close to sunrise, where lower residual SOC may still be acceptable.
- The automation must never fight with manually placed rules or leave stale generated rules behind.

**Chosen Approach**

- Introduce a dedicated `kleine Börsenautomatik` configuration under the schedule domain.
- Build a pure planning engine that scores candidate slot sequences using the configured discharge chain, hard discharge caps, free-slot availability, and SOC rules.
- Persist generated rules as one-shot, automation-managed schedule entries with metadata such as `source`, `autoManaged`, and a yellow display tone.
- Maintain a local annual sunrise/sunset cache for the configured installation location and use that cache for the dynamic overnight SOC allowance.
- Trigger planning once per day and on relevant input changes while the automation is enabled.

**Rejected Alternatives**

- Extending the existing EOS or EMHASS optimizer path:
  - the new rule chain semantics and manual-rule exclusion model are too domain-specific for a clean first implementation.
- A fixed top-price slot picker with appended cool-down slots:
  - simpler, but fails the “maximize expected revenue” requirement for connected versus separated slot groups.
- Using only a static automation SOC floor:
  - too restrictive late at night and not aligned with the desired sunrise-aware behavior.

**Target Behavior**

- The user enables the automation once; DVhub then manages it daily until disabled.
- The user defines a search window such as `14:00` to `09:00`, a maximum number of target slots, a hard maximum discharge power, an automation minimum SOC, and optional rule-chain stages.
- Each rule-chain stage defines a stronger discharge phase and an optional lower-power cool-down phase with slot counts.
- DVhub scans the configured search window, ignores occupied slots, evaluates candidate sequences, and generates the most profitable valid temporary rules.
- Generated rules are shown in yellow and labeled as `kleine Börsenautomatik`.
- On the next planning run, the old yellow rules are removed and replaced with new ones.
- After their dated window expires, those rules disappear automatically.

**Planning Logic**

- Candidate sequences may be contiguous or split across time if that yields a higher projected return.
- Each slot contributes expected export energy as `abs(powerW) * 0.25h / 1000`.
- Expected return is export energy multiplied by the market value of the slot.
- The global automation maximum discharge is always a hard upper bound.
- Advanced rule stages may only reduce that maximum, never exceed it.
- Planning stops once the configured slot budget is consumed or no profitable free candidate remains.

**SOC Rules**

- The global DVhub minimum SOC remains the absolute lower bound at all times.
- The automation-specific minimum SOC is the normal nightly planning floor.
- Between cached sunset and the next cached sunrise, DVhub computes a linear allowance from automation minimum SOC down toward the global minimum SOC.
- If the market price of a slot is at least `20%` above the configured import price, the automation may discharge below the automation minimum SOC down to the global minimum SOC.
- Morning slots closer to sunrise therefore gain more allowed SOC headroom than evening slots.

**Sunrise/Sunset Handling**

- The user configures an installation location in settings.
- DVhub fetches up to one year of sunrise and sunset times for that location and stores them locally.
- Normal daily automation runs use only the local cache.
- The cache is refreshed when the location changes or when the yearly cache is missing or stale.
- If the cache is unavailable, DVhub skips rule generation and reports the reason clearly.

**UI Notes**

- Settings should expose the automation toggle, search window, slot count, global discharge cap, automation minimum SOC, price-premium threshold, location, and advanced rule-chain editor.
- The dashboard rule list should visually separate manual rules from yellow automation rules.
- The automation should expose a lightweight status such as active/inactive, last planning run, and last planning outcome.
- Existing manual schedule editing must remain usable without understanding the automation internals.

**Technical Approach**

- Extend the schedule configuration model with a `smallMarketAutomation` subtree and its validation rules.
- Add a dedicated planning module for slot scoring, rule-chain expansion, and dated rule generation.
- Add a dedicated sunrise/sunset cache module backed by local storage on disk.
- Extend the runtime scheduler so it can refresh automation-managed rules daily and on relevant config/data changes.
- Extend dashboard loading/rendering so automation-managed rules retain their yellow state and labels.

**Testing Impact**

- Config normalization tests for the new automation settings and rule-chain schema.
- Pure planning tests for free-slot filtering, revenue scoring, rule-chain expansion, and dynamic SOC thresholds.
- Sunrise/sunset cache tests for annual storage and stale-cache handling.
- Server/runtime tests for replacing only automation-managed rules and respecting manual-rule collisions.
- Dashboard tests for yellow rendering and grouped rule hydration of automation metadata.

**Acceptance Criteria**

- The small market automation can be enabled and disabled from configuration.
- While enabled, DVhub replans daily and replaces only its own generated rules.
- Generated rules use only free slots and never overwrite manual rules.
- The automation can evaluate separated and contiguous slot sequences.
- Global maximum discharge and global minimum SOC remain hard upper/lower bounds.
- The automation-specific minimum SOC is relaxed overnight toward the global minimum SOC using cached sunset/sunrise times.
- Slots with at least `20%` price premium over the configured import price may discharge down to the global minimum SOC.
- Generated rules are clearly marked in yellow and disappear automatically after their dated window expires.
