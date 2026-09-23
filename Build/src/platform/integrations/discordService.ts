// WIP WARNING
import { createLogger } from "../../helpers/logger";

const logger = createLogger("discord");

export interface DiscordPresenceData {
  userId: string;
  details: string;
  state: string;
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
   * Log track update instead of sending to Discord backend
   */
  public async updatePresence(data: DiscordPresenceData): Promise<boolean> {
    logger.info(`Would POST to ${DiscordService.API_BASE_URL}/presence with:`, {
      state: data,
    });
    return true;
  }

  /**
   * Log clear presence instead of sending to Discord backend
   */
  public async clearPresence(userId: string): Promise<boolean> {
    logger.info(`Would clear presence for userId: ${userId}`);
    return true;
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

      return null;
    } catch (error) {
      logger.error("Error parsing Discord callback:", { error: String(error) });
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
