import { BaseIntegration } from "./base";
import type { Track } from "../../core/engine/types";
import { DiscordService } from "./discordService";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("discord");

export class DiscordIntegration extends BaseIntegration {
  name = "Discord RPC";
  private currentTrack: Track | null = null;
  private service: DiscordService;

  constructor() {
    super();
    this.service = DiscordService.getInstance();
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
  }

  dispose(): void {
    this.disposed = true;
    this.clearPresence();
  }

  async updatePresence(
    track: Track | null,
    _isPlaying: boolean,
  ): Promise<void> {
    this.currentTrack = track;
    if (!track || !this.isAvailable()) return;

    try {
      await this.service.updatePresence({
        userId: "anonymous",
        details: track.title,
        state: track.artist,
      });
    } catch (error) {
      logger.error("Failed to update Discord presence:", { error: String(error) });
    }
  }

  clearPresence(): void {
    this.currentTrack = null;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}

export function createDiscordIntegration(): DiscordIntegration {
  return new DiscordIntegration();
}
