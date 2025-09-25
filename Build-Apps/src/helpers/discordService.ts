/**
 * Discord Rich Presence Service
 * Handles sending track updates to the Discord backend API
 */

export interface DiscordPresenceData {
  userId: string;
  details: string; // Track name
  state: string;   // Artist name
}

export class DiscordService {
  private static readonly API_BASE_URL = 'https://htmlplayer-backend.onrender.com';
  private static instance: DiscordService | null = null;

  private constructor() {}

  public static getInstance(): DiscordService {
    if (!DiscordService.instance) {
      DiscordService.instance = new DiscordService();
    }
    return DiscordService.instance;
  }

  /**
   * Log track update instead of sending to Discord backend
   */
  public async updatePresence(data: DiscordPresenceData): Promise<boolean> {
    console.log(`[DiscordService] Would POST to ${DiscordService.API_BASE_URL}/presence with:`, data);
    return true;
  }

  /**
   * Log clear presence instead of sending to Discord backend
   */
  public async clearPresence(userId: string): Promise<boolean> {
    console.log(`[DiscordService] Would clear presence for userId: ${userId}`);
    return true;
  }

  /**
   * Parse Discord user ID from OAuth callback URL
   * This would be called when the OAuth callback is handled
   */
  public static parseUserIdFromCallback(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      
      if (!code) {
        return null;
      }

      // In a real implementation, you would exchange the code for user info
      // For now, we'll need to handle this differently since the callback goes to the backend
      // The backend should provide the user ID somehow
      
      return null; // This will be handled by the OAuth callback flow
    } catch (error) {
      console.error('Error parsing Discord callback:', error);
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
