/**
 * Forecast Broker -- Extracts PV and load forecasts from optimizer plan results.
 *
 * Forecasts are published via RxJS BehaviorSubject for synchronous reads
 * and observable subscriptions. Includes staleness detection to prevent
 * showing outdated forecasts on the dashboard.
 */

import { BehaviorSubject } from 'rxjs';

/**
 * Create a forecast broker that extracts and publishes forecasts from optimizer plans.
 * @param {object} [options]
 * @param {object} [options.log] - Pino-compatible logger
 * @param {number} [options.maxStaleMs=21600000] - Max forecast age in ms before considered stale (default 6h)
 * @returns {{ ingestFromPlan, getPvForecast, getPvForecast$, getLoadForecast, getLoadForecast$, isForecastStale, destroy }}
 */
export function createForecastBroker({ log, maxStaleMs = 21600000 } = {}) {
  const pvForecast$ = new BehaviorSubject(null);
  const loadForecast$ = new BehaviorSubject(null);

  /**
   * Ingest forecast data from an optimizer plan result.
   * Only updates the respective forecast if the plan carries a non-empty array.
   * @param {object} plan - Canonical plan object with optional meta.pvForecastWh / meta.loadForecastWh
   */
  function ingestFromPlan(plan) {
    const hasPv = Array.isArray(plan.meta?.pvForecastWh) && plan.meta.pvForecastWh.length > 0;
    const hasLoad = Array.isArray(plan.meta?.loadForecastWh) && plan.meta.loadForecastWh.length > 0;

    if (hasPv) {
      pvForecast$.next({
        source: plan.optimizer,
        slots: plan.meta.pvForecastWh,
        createdAt: plan.createdAt || new Date().toISOString()
      });
    }

    if (hasLoad) {
      loadForecast$.next({
        source: plan.optimizer,
        slots: plan.meta.loadForecastWh,
        createdAt: plan.createdAt || new Date().toISOString()
      });
    }

    log?.debug(
      { optimizer: plan.optimizer, hasPv, hasLoad },
      'Forecast broker ingested plan'
    );
  }

  /**
   * Check if a forecast object is stale (older than maxStaleMs).
   * @param {object|null} forecast - Forecast object with createdAt field
   * @returns {boolean} true if forecast is null or older than maxStaleMs
   */
  function isForecastStale(forecast) {
    if (!forecast) return true;
    return Date.now() - new Date(forecast.createdAt).getTime() > maxStaleMs;
  }

  return {
    ingestFromPlan,
    getPvForecast: () => pvForecast$.getValue(),
    getPvForecast$: () => pvForecast$.asObservable(),
    getLoadForecast: () => loadForecast$.getValue(),
    getLoadForecast$: () => loadForecast$.asObservable(),
    isForecastStale,
    destroy() {
      pvForecast$.complete();
      loadForecast$.complete();
    }
  };
}
