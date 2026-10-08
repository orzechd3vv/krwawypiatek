/**
 * React 19 checks for Node's experimental `console.createTask` API.
 * Workerd currently exposes a placeholder that throws when called, so make
 * the capability test truthful before React is evaluated in the worker.
 */
try {
  Object.defineProperty(console, "createTask", {
    configurable: true,
    value: undefined,
    writable: true,
  });
} catch {
  // Older runtimes do not expose the property and need no compatibility shim.
}
