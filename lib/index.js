/**
 * Katya Steps host half.
 *
 * This row exists so the package is a Loader entry: the browser half is
 * discovered from entries whose package declares `dsh.client`, so a client
 * bundle without a host row never reaches the start graph. The component
 * itself is pure browser code with no host service of its own.
 */

/** Loader identity used by diagnostics and by the browser-half scan. */
export const name = 'katya-steps'

/** No host service is injected: mounting only puts the package in the graph. */
export function apply() {}
