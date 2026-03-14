/**
 * Forecast API Route Handlers
 *
 * Provides:
 * - GET /api/forecast/pv    (PV generation forecast with staleness)
 * - GET /api/forecast/load  (load consumption forecast with staleness)
 */

/**
 * Creates a route registration function for forecast endpoints.
 * @param {object} opts
 * @param {object} opts.forecastBroker - Forecast broker service instance
 * @returns {function} Route registration function (fastify) => void
 */
export function createForecastRoutes({ forecastBroker }) {
  return function registerRoutes(fastify) {
    const authHook = fastify.authenticate
      ? { preHandler: [fastify.authenticate] }
      : {};

    // GET /api/forecast/pv -- PV generation forecast
    fastify.get('/api/forecast/pv', authHook, async () => {
      const forecast = forecastBroker.getPvForecast();
      return { forecast, stale: forecastBroker.isForecastStale(forecast) };
    });

    // GET /api/forecast/load -- load consumption forecast
    fastify.get('/api/forecast/load', authHook, async () => {
      const forecast = forecastBroker.getLoadForecast();
      return { forecast, stale: forecastBroker.isForecastStale(forecast) };
    });
  };
}
