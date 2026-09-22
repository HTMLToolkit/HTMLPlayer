import { QueueManager, WeightedRandomizer } from "../src/core/engine/queue";

class MockRandomizer implements WeightedRandomizer {
  private trackOrder: string[] = [];
  private index = 0;

  constructor(order: string[]) {
    this.trackOrder = order;
  }

  getWeightedRandomTrack(trackIds: string[]): string | null {
    const result = this.trackOrder[this.index % this.trackOrder.length];
    this.index++;
    return result;
  }
}

function createMockTrack(id: string) {
  return {
    id,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    duration: 180,
    url: `file:///${id}.mp3`,
  };
}

describe("QueueManager", () => {
  let queue: QueueManager;

  beforeEach(() => {
    queue = new QueueManager();
  });

  describe("Cursor", () => {
    it("should start with empty queue and empty cursor", () => {
      expect(queue.getTracks()).toHaveLength(0);
      expect(queue.getCurrentTrack()).toBeNull();
      expect(queue.getCurrentIndex()).toBeNull();
      expect(queue.getCursor()).toEqual({ kind: "empty" });
    });

    it("should set an active cursor", () => {
      queue.setPlaylist({ id: "p1", name: "Tracks", songs: [
        createMockTrack("1"),
        createMockTrack("2"),
      ] });
      queue.setCursor({ kind: "active", index: 1 });
      expect(queue.getCurrentIndex()).toBe(1);
      expect(queue.getCurrentTrack()?.id).toBe("2");
    });

    it("should collapse out-of-bounds active cursor to empty", () => {
      queue.setPlaylist({ id: "p1", name: "Tracks", songs: [
        createMockTrack("1"),
      ] });
      queue.setCursor({ kind: "active", index: 5 });
      expect(queue.getCursor()).toEqual({ kind: "empty" });
      expect(queue.getCurrentIndex()).toBeNull();
    });

    it("should collapse negative active cursor to empty", () => {
      queue.setPlaylist({ id: "p1", name: "Tracks", songs: [
        createMockTrack("1"),
      ] });
      queue.setCursor({ kind: "active", index: -1 });
      expect(queue.getCursor()).toEqual({ kind: "empty" });
      expect(queue.getCurrentIndex()).toBeNull();
    });

    it("should collapse jump to null to empty", () => {
      queue.setPlaylist({ id: "p1", name: "Tracks", songs: [
        createMockTrack("1"),
        createMockTrack("2"),
      ] });
      queue.jumpToIndex(0);
      expect(queue.getCurrentIndex()).toBe(0);
      queue.jumpToIndex(null);
      expect(queue.getCursor()).toEqual({ kind: "empty" });
    });

    it("should never represent an invalid index through jumpToIndex", () => {
      queue.jumpToIndex(-1);
      expect(queue.getCursor()).toEqual({ kind: "empty" });
      expect(() => queue.getCurrentTrack()).not.toThrow();
    });
  });

  describe("Basic operations", () => {
    it("should start with empty queue", () => {
      expect(queue.getTracks()).toHaveLength(0);
      expect(queue.getCurrentIndex()).toBeNull();
    });

    it("should add tracks", () => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      expect(queue.getTracks()).toHaveLength(2);
    });

    it("should remove tracks", () => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.removeTrack("1");
      expect(queue.getTracks()).toHaveLength(1);
      expect(queue.getTracks()[0].id).toBe("2");
    });

    it("should clear queue", () => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.clear();
      expect(queue.getTracks()).toHaveLength(0);
      expect(queue.getCursor()).toEqual({ kind: "empty" });
    });
  });

  describe("Playback order", () => {
    beforeEach(() => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.addTrack(createMockTrack("3"));
      queue.jumpToIndex(0);
    });

    it("should get next track", () => {
      const next = queue.getNextTrack(false);
      expect(next?.id).toBe("2");
    });

    it("should get previous track", () => {
      queue.jumpToIndex(1);
      const prev = queue.getPreviousTrack(false);
      expect(prev?.id).toBe("1");
    });

    it("should wrap around at end", () => {
      queue.jumpToIndex(2);
      const next = queue.getNextTrack(false);
      expect(next?.id).toBe("1");
    });

    it("should wrap around at start for previous", () => {
      queue.jumpToIndex(0);
      const prev = queue.getPreviousTrack(false);
      expect(prev?.id).toBe("3");
    });

    it("should peek from empty to first/last", () => {
      queue.clear();
      expect(queue.peekNextCursor(false)).toEqual({ kind: "empty" });
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      expect(queue.peekNextCursor(false)).toEqual({ kind: "active", index: 0 });
      expect(queue.peekPreviousCursor(false)).toEqual({ kind: "active", index: 1 });
    });
  });

  describe("Remove track cursor adjustment", () => {
    beforeEach(() => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.addTrack(createMockTrack("3"));
    });

    it("should decrement cursor when removing a track before it", () => {
      queue.jumpToIndex(2);
      queue.removeTrack("1");
      expect(queue.getCurrentIndex()).toBe(1);
      expect(queue.getCurrentTrack()?.id).toBe("3");
    });

    it("should empty cursor when removing the last active track", () => {
      queue.jumpToIndex(2);
      queue.removeTrack("3");
      expect(queue.getCursor()).toEqual({ kind: "empty" });
      expect(queue.getCurrentTrack()).toBeNull();
    });

    it("should keep cursor when removing a track after it", () => {
      queue.jumpToIndex(0);
      queue.removeTrack("3");
      expect(queue.getCurrentIndex()).toBe(0);
      expect(queue.getCurrentTrack()?.id).toBe("1");
    });

    it("should move cursor to the slot owner when removing the active track", () => {
      queue.jumpToIndex(1);
      queue.removeTrack("2");
      expect(queue.getCurrentIndex()).toBe(1);
      expect(queue.getCurrentTrack()?.id).toBe("3");
    });
  });

  describe("Shuffle", () => {
    beforeEach(() => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.addTrack(createMockTrack("3"));
      queue.addTrack(createMockTrack("4"));
      queue.jumpToIndex(0);
    });

    it("should enable shuffle", () => {
      queue.shuffle(true);
      expect(queue.isShuffled()).toBe(true);
    });

    it("should disable shuffle", () => {
      queue.shuffle(true);
      queue.unshuffle();
      expect(queue.isShuffled()).toBe(false);
    });

    it("should preserve current track in shuffle", () => {
      queue.jumpToIndex(1);
      queue.shuffle(true);
      const order = queue.getPlayOrder();
      expect(order[0]).toBe(1);
    });
  });

  describe("Smart shuffle", () => {
    beforeEach(() => {
      queue.addTrack(createMockTrack("a"));
      queue.addTrack(createMockTrack("b"));
      queue.addTrack(createMockTrack("c"));
      queue.addTrack(createMockTrack("d"));
      queue.jumpToIndex(0);
    });

    it("should set weighted randomizer", () => {
      const randomizer = new MockRandomizer(["b", "c", "d", "a"]);
      queue.setWeightedRandomizer(randomizer);
      queue.setShuffleMode("smart");
      queue.shuffle(true);
      expect(queue.getShuffleMode()).toBe("smart");
    });

    it("should use smart shuffle when mode is set", () => {
      const randomizer = new MockRandomizer(["b", "c", "d", "a"]);
      queue.setWeightedRandomizer(randomizer);
      queue.setShuffleMode("smart");
      queue.shuffle(true);
      expect(queue.isShuffled()).toBe(true);
    });

    it("should fall back to random shuffle without randomizer", () => {
      queue.setShuffleMode("smart");
      queue.shuffle(true);
      expect(queue.isShuffled()).toBe(true);
    });
  });

  describe("History tracking", () => {
    it("should track play history", () => {
      queue.addTrack(createMockTrack("1"));
      queue.updateHistory("1");
      const history = queue.getPlayHistory("1");
      expect(history).toBeDefined();
      expect(history?.playCount).toBe(1);
    });

    it("should increment play count", () => {
      queue.addTrack(createMockTrack("1"));
      queue.updateHistory("1");
      queue.updateHistory("1");
      const history = queue.getPlayHistory("1");
      expect(history?.playCount).toBe(2);
    });

    it("should get all history", () => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.updateHistory("1");
      queue.updateHistory("2");
      const allHistory = queue.getAllHistory();
      expect(allHistory.size).toBe(2);
    });
  });
});