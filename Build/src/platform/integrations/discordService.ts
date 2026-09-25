import { createLogger } from "../../helpers/logger";

const logger = createLogger("discord");

export interface DiscordPresenceData {
  userId: string;
  details: string;
  state: string;
}

interface PresenceResponse {
  ok?: boolean;
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

  public async updatePresence(data: DiscordPresenceData): Promise<boolean> {
    try {
      const response = await fetch(`${DiscordService.API_BASE_URL}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        logger.warn("Presence update rejected by backend:", {
          status: response.status,
        });
        return false;
      }

      const payload = (await response.json().catch(() => null)) as
        | PresenceResponse
        | null;
      return payload?.ok !== false;
    } catch (error) {
      logger.info("Presence update couldn't reach backend:", {
        error: String(error),
      });
      return false;
    }
  }

  public async clearPresence(userId: string | null): Promise<boolean> {
    try {
      const response = await fetch(
        `${DiscordService.API_BASE_URL}/presence/clear`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );
      return response.ok;
    } catch (error) {
      logger.info("Presence clear couldn't reach backend:", {
        error: String(error),
      });
      return false;
    }
  }

  public static parseUserIdFromCallback(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("userId");
    } catch (error) {
      logger.error("Error parsing Discord callback:", { error: String(error) });
      return null;
    }
  }

  public static isDiscordAvailable(userId?: string): boolean {
    return Boolean(userId && userId.length > 0);
  }
}

export default DiscordService;