export interface UserSettings {
  userId: string;
  /**
   * Redacted to boolean on the way out so the key itself never leaves
   * the server after save. See `redactSettings` in the service.
   */
  claudeApiKeySet: boolean;
  updatedAt: string;
}
