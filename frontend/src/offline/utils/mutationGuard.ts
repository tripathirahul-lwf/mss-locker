/**
 * Centralized guard preventing critical mutations while offline
 */
export function isOnlineForMutation(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function requireOnlineForMutation(actionName = 'this action'): boolean {
  if (!isOnlineForMutation()) {
    alert(
      `Offline Mode: Internet connection is required for ${actionName}. Critical data mutations are disabled while offline to prevent synchronization conflicts.`
    );
    return false;
  }
  return true;
}
