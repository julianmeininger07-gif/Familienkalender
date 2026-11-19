import "server-only";
import type { CurrentUser } from "./auth";

/** Benachrichtigt neu eingeladene Personen. Push-Versand kommt mit Meilenstein 5. */
export async function notifyInvited(_eventId: string, _userIds: string[], _by: CurrentUser): Promise<void> {}

/** Benachrichtigt den Ersteller über eine Zu- oder Absage. Push-Versand kommt mit Meilenstein 5. */
export async function notifyResponse(
  _eventId: string,
  _by: CurrentUser,
  _response: "accepted" | "declined",
): Promise<void> {}
