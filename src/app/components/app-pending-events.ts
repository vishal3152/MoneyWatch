const PENDING_START_EVENT = "pw:pending-start";
const PENDING_END_EVENT = "pw:pending-end";

let nextPendingId = 0;

export type PendingEventDetail = { id: string };

/** Starts the shared indicator for a client-side request that is not submitted through a form. */
export function startAppPending(): string {
  const id = `pw-pending-${nextPendingId++}`;
  window.dispatchEvent(new CustomEvent<PendingEventDetail>(PENDING_START_EVENT, { detail: { id } }));
  return id;
}

/** Stops a request started with startAppPending. */
export function finishAppPending(id: string) {
  window.dispatchEvent(new CustomEvent<PendingEventDetail>(PENDING_END_EVENT, { detail: { id } }));
}

export { PENDING_END_EVENT, PENDING_START_EVENT };
