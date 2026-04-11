import { QueueManager, WeightedRandomizer, ShuffleMode } from "../src/core/engine/queue";

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

  describe("Basic operations", () => {
    it("should start with empty queue", () => {
      expect(queue.getTracks()).toHaveLength(0);
      expect(queue.getCurrentTrack()).toBeNull();
      expect(queue.getCurrentIndex()).toBe(-1);
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
    });
  });

  describe("Playback order", () => {
    beforeEach(() => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.addTrack(createMockTrack("3"));
      queue.setCurrentIndex(0);
    });

    it("should get next track", () => {
      const next = queue.getNextTrack(false);
      expect(next?.id).toBe("2");
    });

    it("should get previous track", () => {
      queue.setCurrentIndex(1);
      const prev = queue.getPreviousTrack(false);
      expect(prev?.id).toBe("1");
    });

    it("should wrap around at end", () => {
      queue.setCurrentIndex(2);
      const next = queue.getNextTrack(false);
      expect(next?.id).toBe("1");
    });

    it("should wrap around at start for previous", () => {
      queue.setCurrentIndex(0);
      const prev = queue.getPreviousTrack(false);
      expect(prev?.id).toBe("3");
    });
  });

  describe("Shuffle", () => {
    beforeEach(() => {
      queue.addTrack(createMockTrack("1"));
      queue.addTrack(createMockTrack("2"));
      queue.addTrack(createMockTrack("3"));
      queue.addTrack(createMockTrack("4"));
      queue.setCurrentIndex(0);
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
      queue.setCurrentIndex(1);
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
      queue.setCurrentIndex(0);
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
