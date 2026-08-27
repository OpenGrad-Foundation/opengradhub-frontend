/**
 * Client-side downscaling is a bandwidth optimisation — the server re-encodes
 * every proof photo regardless — so this stays fail-open. What it must not do is
 * send a needlessly large blob, or turn a transparent image black.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downscaleImage } from '@/app/dashboard/tracker/_components/record-proofs';

type ToBlobCall = { quality: number; type: string };

let toBlobCalls: ToBlobCall[];
let blobSizes: number[];
let fillRectCalls: Array<{ style: string; w: number; h: number }>;
let drawnAt: Array<{ w: number; h: number }>;
let canvasSize: { width: number; height: number };
let closed: number;
let realCreateElement: typeof document.createElement;

function stubCanvas() {
  const ctx = {
    fillStyle: '',
    fillRect(_x: number, _y: number, w: number, h: number) {
      fillRectCalls.push({ style: this.fillStyle, w, h });
    },
    drawImage(_img: unknown, _x: number, _y: number, w: number, h: number) {
      drawnAt.push({ w, h });
    },
  };
  const canvas = {
    get width() { return canvasSize.width; },
    set width(v: number) { canvasSize.width = v; },
    get height() { return canvasSize.height; },
    set height(v: number) { canvasSize.height = v; },
    getContext: () => ctx,
    toBlob: (cb: (b: Blob | null) => void, type: string, quality: number) => {
      toBlobCalls.push({ type, quality });
      const size = blobSizes[toBlobCalls.length - 1] ?? blobSizes[blobSizes.length - 1] ?? 1000;
      cb({ size, type } as Blob);
    },
  };
  return canvas as unknown as HTMLCanvasElement;
}

function stubBitmap(width: number, height: number) {
  return { width, height, close: () => { closed++; } };
}

beforeEach(() => {
  toBlobCalls = [];
  blobSizes = [1000];
  fillRectCalls = [];
  drawnAt = [];
  canvasSize = { width: 0, height: 0 };
  closed = 0;
  realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? stubCanvas() : realCreateElement(tag),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'createImageBitmap');
});

function setDecoder(fn: () => Promise<unknown>) {
  Reflect.set(globalThis, 'createImageBitmap', vi.fn(fn));
}

function givenBitmap(width: number, height: number) {
  setDecoder(async () => stubBitmap(width, height));
}

const file = (name = 'p.jpg') => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });

describe('downscaleImage', () => {
  it('bounds the long edge to 1280 and encodes JPEG at 0.72', async () => {
    givenBitmap(4000, 3000);

    await downscaleImage(file());

    expect(drawnAt[0]).toEqual({ w: 1280, h: 960 });
    expect(toBlobCalls[0]).toEqual({ type: 'image/jpeg', quality: 0.72 });
  });

  it('re-encodes at a lower quality when the first attempt is still large', async () => {
    givenBitmap(4000, 3000);
    blobSizes = [900_000, 300_000];

    const out = (await downscaleImage(file())) as Blob;

    expect(toBlobCalls.map((c) => c.quality)).toEqual([0.72, 0.55]);
    expect(out.size).toBe(300_000);
  });

  it('keeps the first encode when it is already small enough', async () => {
    givenBitmap(2000, 1000);
    blobSizes = [120_000];

    await downscaleImage(file());

    expect(toBlobCalls).toHaveLength(1);
  });

  it('fills the canvas white before drawing, so transparency is not black', async () => {
    givenBitmap(800, 600);

    await downscaleImage(file());

    expect(fillRectCalls[0]).toEqual({ style: '#ffffff', w: 800, h: 600 });
  });

  it('never produces a zero-width canvas for an extreme aspect ratio', async () => {
    givenBitmap(4000, 1);

    await downscaleImage(file());

    expect(drawnAt[0].h).toBeGreaterThanOrEqual(1);
  });

  it('sends the original file when the browser cannot decode it', async () => {
    // Losing the photo is worse than uploading it uncompressed: the server
    // compresses it anyway.
    setDecoder(async () => { throw new Error('no HEIC decoder'); });
    const original = file('IMG_0001.HEIC');

    const out = await downscaleImage(original);

    expect(out).toBe(original);
  });

  it('releases the decoded bitmap', async () => {
    givenBitmap(1600, 1200);

    await downscaleImage(file());

    expect(closed).toBe(1);
  });
});
