/**
 * Discord Rich Presence Service
 * Handles sending track updates to the Discord backend API
 */

export interface DiscordPresenceData {
  userId: string;
  details: string; // Track name
  state: string; // Artist name
}

export class DiscordService {
  private static readonly API_BASE_URL =
    "https://htmlplayer-backend.onrender.com";
  private static instance: DiscordService | null = null;

  private constructor() {}

  public static getInstance(): DiscordService {
    if (!DiscordService.instance) {
      DiscordService.instance = new DiscordService();
    }
    return DiscordService.instance;
  }

  /**
   * Send track update to Discord backend
   */
  public async updatePresence(data: DiscordPresenceData): Promise<boolean> {
    try {
      const response = await fetch(`${DiscordService.API_BASE_URL}/presence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.error(
          "Failed to update Discord presence:",
          response.status,
          response.statusText,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error updating Discord presence:", error);
      return false;
    }
  }

  /**
   * Clear Discord presence (when music stops)
   */
  public async clearPresence(userId: string): Promise<boolean> {
    try {
      // Send empty details and state to clear presence
      return await this.updatePresence({
        userId,
        details: "",
        state: "",
      });
    } catch (error) {
      console.error("Error clearing Discord presence:", error);
      return false;
    }
  }

  /**
   * Parse Discord user ID from OAuth callback URL
   * This would be called when the OAuth callback is handled
   */
  public static parseUserIdFromCallback(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get("code");

      if (!code) {
        return null;
      }

      // In a real implementation, you would exchange the code for user info
      // For now, we'll need to handle this differently since the callback goes to the backend
      // The backend should provide the user ID somehow

      return null; // This will be handled by the OAuth callback flow
    } catch (error) {
      console.error("Error parsing Discord callback:", error);
      return null;
    }
  }

  /**
   * Check if Discord integration is available and user is connected
   */
  public static isDiscordAvailable(userId?: string): boolean {
    return Boolean(userId && userId.length > 0);
  }
}

export default DiscordService;
