/**
 * Pure pending-state machine functions for Min SOC slider control.
 * Ported from public/app.js lines 729-751.
 * No side effects, no DOM, no signals -- pure compute for testability.
 */

/**
 * Create a pending state snapshot when the user submits a new Min SOC value.
 * @param {{ currentReadback: number, submittedValue: number, submittedAt?: number }} params
 * @returns {{ previousReadback: number, targetValue: number, submittedAt: number }}
 */
export function createPendingState({ currentReadback, submittedValue, submittedAt = Date.now() }) {
  return {
    previousReadback: currentReadback,
    targetValue: submittedValue,
    submittedAt
  };
}

/**
 * Resolve whether a pending write has been confirmed by the inverter readback.
 * @param {{ pendingState: object|null, readbackValue: number|null }} params
 * @returns {object|null} null if confirmed/cleared, pendingState if still waiting
 */
export function resolvePendingState({ pendingState, readbackValue }) {
  if (!pendingState) return null;
  if (readbackValue == null) return pendingState;
  if (readbackValue === pendingState.targetValue) return null;
  if (readbackValue !== pendingState.previousReadback) return null;
  return pendingState;
}

/**
 * Compute the render state (blink vs confirmed) from readback + pending state.
 * @param {{ readbackValue: number|null, pendingState: object|null }} params
 * @returns {{ pendingState: object|null, shouldBlink: boolean }}
 */
export function computeRenderState({ readbackValue, pendingState }) {
  const nextPendingState = resolvePendingState({ pendingState, readbackValue });
  return {
    pendingState: nextPendingState,
    shouldBlink: Boolean(nextPendingState)
  };
}
