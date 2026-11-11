export const SESSION_ENDED_EVENT = "sinfreno:session-ended";

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_info");
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}
