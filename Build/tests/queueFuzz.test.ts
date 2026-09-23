import { QueueManager } from "../src/core/engine/queue";
import { isQueueState } from "../src/core/engine/validators";
import { createMockTrack, mulberry32, randomInt } from "./helpers";

interface FuzzOp {
  name: string;
  details?: string;
}

function boxFailure(error: unknown, step: number, op: FuzzOp, applied: string[]): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(
    `step ${step}: ${JSON.stringify(op)}\nrecent history:\n${applied
      .slice(-10)
      .join("\n")}\n${message}`,
  );
}

function expectQueueInvariants(queue: QueueManager): void {
  const state = queue.getState();
  if (!isQueueState(state)) {
    throw new Error(`QueueState invariant violated: wrong shape`);
  }

  const cursor = state.cursor;
  if (cursor.kind === "active") {
    const track = queue.getCurrentTrack();
    const slotTrack = state.tracks[cursor.index];
    if (track === null || slotTrack === undefined || track.id !== slotTrack.id) {
      throw new Error(
        "active cursor must resolve to the track at its index",
      );
    }
    if (queue.getCurrentIndex() !== cursor.index) {
      throw new Error("active cursor index mismatch on getCurrentIndex");
    }
  } else {
    if (queue.getCurrentIndex() !== null || queue.getCurrentTrack() !== null) {
      throw new Error("empty cursor must resolve to no current track");
    }
  }

  const order = queue.getPlayOrder();
  if (state.tracks.length === 0) {
    if (order.length !== 0) {
      throw new Error("empty queue must yield an empty play order");
    }
    if (
      queue.peekNextCursor(false).kind !== "empty" ||
      queue.peekPreviousCursor(false).kind !== "empty"
    ) {
      throw new Error("empty queue must yield empty peek cursors");
    }
  } else {
    if (order.length !== state.tracks.length) {
      throw new Error("play order length must equal track count");
    }
    for (const idx of order) {
      if (
        !Number.isInteger(idx) ||
        idx < 0 ||
        idx >= state.tracks.length
      ) {
        throw new Error(`out-of-bounds play order index: ${idx}`);
      }
    }
    if (state.shuffled) {
      const seen = new Set<number>();
      for (const idx of order) {
        if (seen.has(idx)) {
          throw new Error(`duplicate index ${idx} in shuffle order`);
        }
        seen.add(idx);
      }
    } else if (order.some((idx, i) => idx !== i)) {
      throw new Error("unshuffled play order must be sequential");
    }
    if (
      queue.peekNextCursor(false).kind !== "active" ||
      queue.peekPreviousCursor(false).kind !== "active"
    ) {
      throw new Error("non-empty queue must yield active peek cursors");
    }
  }
}

function applyOp(
  queue: QueueManager,
  rand: () => number,
  poolSize: number,
): FuzzOp {
  const roll = rand();
  const tracks = queue.getTracks();

  if (roll < 0.1) {
    const id = String(randomInt(rand, 1, poolSize));
    queue.addTrack(createMockTrack(id));
    return { name: "addTrack", details: id };
  }

  if (roll < 0.2) {
    const id =
      tracks.length > 0
        ? tracks[randomInt(rand, 0, tracks.length - 1)]?.id ??
          String(randomInt(rand, 1, poolSize))
        : String(randomInt(rand, 1, poolSize));
    queue.removeTrack(id);
    return { name: "removeTrack", details: id };
  }

  if (roll < 0.3) {
    if (rand() < 0.3) {
      queue.jumpToIndex(null);
      return { name: "jumpToIndex", details: "null" };
    }
    const idx = randomInt(rand, -2, poolSize + 2);
    queue.jumpToIndex(idx);
    return { name: "jumpToIndex", details: `index ${idx}` };
  }

  if (roll < 0.4) {
    if (rand() < 0.4) {
      queue.setCursor({ kind: "empty" });
      return { name: "setCursor", details: "empty" };
    }
    const idx = randomInt(rand, -3, poolSize + 3);
    queue.setCursor({ kind: "active", index: idx });
    return { name: "setCursor", details: `index ${idx}` };
  }

  if (roll < 0.5) {
    queue.shuffle(true);
    return { name: "shuffle" };
  }

  if (roll < 0.58) {
    queue.unshuffle();
    return { name: "unshuffle" };
  }

  if (roll < 0.68) {
    const count = randomInt(rand, 0, poolSize);
    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      ids.add(String(randomInt(rand, 1, poolSize)));
    }
    const songs = Array.from(ids).map(createMockTrack);
    queue.setPlaylist({ id: "p", name: "P", songs });
    return { name: "setPlaylist", details: `${songs.length} songs` };
  }

  if (roll < 0.76) {
    queue.setState(queue.getState());
    return { name: "stateRoundTrip" };
  }

  if (roll < 0.86) {
    const next = queue.peekNextCursor(false);
    if (next.kind === "active") {
      queue.jumpToIndex(next.index);
    }
    return { name: "advance", details: next.kind };
  }

  queue.clear();
  return { name: "clear" };
}

describe("QueueManager fuzz invariants", () => {
  const seeds = [7, 42, 1337, 20260222, 31415];
  const stepsPerSeed = 2000;

  for (const seed of seeds) {
    it(`keeps invariants over ${stepsPerSeed} random ops (seed ${seed})`, () => {
      const queue = new QueueManager();
      const rand = mulberry32(seed);
      const originalRandom = Math.random;
      Math.random = rand;
      try {
        const applied: string[] = [];
        for (let step = 1; step <= stepsPerSeed; step++) {
          const op = applyOp(queue, rand, 8);
          try {
            expectQueueInvariants(queue);
          } catch (error) {
            boxFailure(error, step, op, applied);
          }
          applied.push(`${op.name} ${op.details ?? ""}`.trim());
        }
      } finally {
        Math.random = originalRandom;
      }
    });
  }
});