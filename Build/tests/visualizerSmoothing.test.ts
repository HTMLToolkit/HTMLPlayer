import { applyTimeDomainSmoothing } from "../src/platform/visualizers/smoothing";

class FakeCanvas {}

describe("applyTimeDomainSmoothing", () => {
  it("preserves the first frame unchanged and seeds the history", () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    const data = new Uint8Array([128, 140, 160, 200]);
    applyTimeDomainSmoothing(canvas, data);
    expect(Array.from(data)).toEqual([128, 140, 160, 200]);
  });

  it("blends subsequent frames toward the new raw samples", () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    const data = new Uint8Array([128, 128, 128, 128]);
    applyTimeDomainSmoothing(canvas, data);

    data.set([200, 200, 200, 200]);
    applyTimeDomainSmoothing(canvas, data);
    expect(Array.from(data)).toEqual([157, 157, 157, 157]);

    data.set([200, 200, 200, 200]);
    applyTimeDomainSmoothing(canvas, data);
    expect(Array.from(data)).toEqual([174, 174, 174, 174]);

    data.set([200, 200, 200, 200]);
    applyTimeDomainSmoothing(canvas, data);
    expect(Array.from(data)).toEqual([184, 184, 184, 184]);
  });

  it("holds a steady value once the input stops changing", () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    const data = new Uint8Array([100, 100]);
    applyTimeDomainSmoothing(canvas, data);

    for (let frame = 0; frame < 40; frame++) {
      data.set([100, 100]);
      applyTimeDomainSmoothing(canvas, data);
    }
    expect(Array.from(data)).toEqual([100, 100]);
  });

  it("re-seeds when the canvas buffer length changes", () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    const data = new Uint8Array([10, 20, 30]);
    applyTimeDomainSmoothing(canvas, data);

    const resized = new Uint8Array([200, 200]);
    applyTimeDomainSmoothing(canvas, resized);
    expect(Array.from(resized)).toEqual([200, 200]);
  });
});