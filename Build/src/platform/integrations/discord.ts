import { BaseIntegration } from "./base";
import type { Track } from "../../core/engine/types";
import { DiscordService } from "./discordService";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("discord");

export class DiscordIntegration extends BaseIntegration {
  name = "Discord RPC";
  private currentTrack: Track | null = null;
  private service: DiscordService;
  private userId: string | null = null;

  constructor() {
    super();
    this.service = DiscordService.getInstance();
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
  }

  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  dispose(): void {
    this.disposed = true;
    const userId = this.userId;
    void this.service.clearPresence(userId).catch((error: unknown) => {
      logger.error("Failed to clear presence on dispose:", {
        error: String(error),
      });
    });
  }

  async updatePresence(
    track: Track | null,
    _isPlaying: boolean,
  ): Promise<void> {
    this.currentTrack = track;

    const userId = this.userId;
    if (!track || !userId || !this.isAvailable()) return;
    if (!DiscordService.isDiscordAvailable(userId)) return;

    try {
      const updated = await this.service.updatePresence({
        userId,
        details: track.title,
        state: track.artist,
      });
      if (!updated) {
        logger.warn("Discord presence update reported failure");
      }
    } catch (error) {
      logger.error("Failed to update Discord presence:", {
        error: String(error),
      });
    }
  }

  clearPresence(): Promise<boolean> {
    this.currentTrack = null;
    return this.service.clearPresence(this.userId);
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}

export function createDiscordIntegration(): DiscordIntegration {
  return new DiscordIntegration();
}
