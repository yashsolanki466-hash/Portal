const STORAGE_KEY = "secure_file_hub_session_id";

export function getSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSessionId(sessionId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    // ignore
  }
}

export function clearSessionId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
