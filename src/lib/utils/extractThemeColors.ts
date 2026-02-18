export type PaletteColor = {
  hex: string;
  rgb: { r: number; g: number; b: number };
  ratio: number;
};

export type PaletteResult = {
  colors: PaletteColor[];
  debug?: {
    sampled: number;
    clusters: number;
  };
};

export type ExtractOptions = {
  targetCount?: number;
  k?: number;
  maxSize?: number;
  sampleStride?: number;
  minAlpha?: number;
  minY?: number;
  maxY?: number;
  mergeDeltaE?: number;
  maxIterations?: number;
  seed?: number;
};

const DEFAULT_OPTIONS: Required<ExtractOptions> = {
  targetCount: 4,
  k: 7,
  maxSize: 200,
  sampleStride: 2,
  minAlpha: 32,
  minY: 20,
  maxY: 245,
  mergeDeltaE: 8,
  maxIterations: 20,
  seed: 42,
};

type Lab = { L: number; a: number; b: number };
type Rgb = { r: number; g: number; b: number };

export async function extractThemeColors(
  file: File,
  options: ExtractOptions = {}
): Promise<PaletteResult> {
  const opt = { ...DEFAULT_OPTIONS, ...options };

  const bitmap = await createImageBitmap(file);
  const { ctx, w, h } = makeCanvas(bitmap, opt.maxSize);

  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const samples: Lab[] = [];
  let sampledCount = 0;

  for (let i = 0; i < data.length; i += 4 * opt.sampleStride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    sampledCount++;

    if (a < opt.minAlpha) continue;

    const y = luminance(r, g, b);
    if (y < opt.minY || y > opt.maxY) continue;

    samples.push(rgbToLab({ r, g, b }));
  }

  if (samples.length < 50) {
    const loose: Lab[] = [];
    for (let i = 0; i < data.length; i += 4 * opt.sampleStride) {
      const a = data[i + 3];
      if (a < opt.minAlpha) continue;
      loose.push(rgbToLab({ r: data[i], g: data[i + 1], b: data[i + 2] }));
    }
    const result = runPipeline(loose, opt);
    return { ...result, debug: { sampled: sampledCount, clusters: result.colors.length } };
  }

  const result = runPipeline(samples, opt);
  return { ...result, debug: { sampled: sampledCount, clusters: result.colors.length } };
}

function runPipeline(samples: Lab[], opt: Required<ExtractOptions>): PaletteResult {
  const k = Math.min(opt.k, Math.max(2, Math.floor(samples.length / 200)));
  const km = kMeansLab(samples, k, opt.maxIterations, opt.seed);

  const clusters = km.centroids.map((c, idx) => {
    const ratio = km.counts[idx] / km.total;
    const rgb = labToRgb(c);
    return {
      lab: c,
      rgb,
      hex: rgbToHex(rgb),
      ratio,
    };
  });

  clusters.sort((a, b) => b.ratio - a.ratio);

  const merged = mergeSimilar(clusters, opt.mergeDeltaE);
  merged.sort((a, b) => b.ratio - a.ratio);

  const picked: typeof merged = [];
  for (const c of merged) {
    if (picked.length >= opt.targetCount) break;
    if (!picked.some(p => deltaE76(p.lab, c.lab) < opt.mergeDeltaE)) {
      picked.push(c);
    }
  }

  for (const c of merged) {
    if (picked.length >= opt.targetCount) break;
    if (!picked.includes(c)) picked.push(c);
  }

  return {
    colors: picked.slice(0, opt.targetCount).map(c => ({
      hex: c.hex,
      rgb: c.rgb,
      ratio: round4(c.ratio),
    })),
  };
}

function makeCanvas(bitmap: ImageBitmap, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext("2d", { willReadFrequently: true } as OffscreenCanvasRenderingContext2DSettings);
  } else {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    canvas = c;
    ctx = c.getContext("2d", { willReadFrequently: true });
  }

  if (!ctx) throw new Error("Canvas 2D context not available");
  return { canvas, ctx, w, h };
}

function kMeansLab(points: Lab[], k: number, maxIter: number, seed: number) {
  const rng = mulberry32(seed);

  const centroids: Lab[] = [];
  const used = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(rng() * points.length);
    if (used.has(idx)) continue;
    used.add(idx);
    centroids.push({ ...points[idx] });
  }

  const assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let best = 0;
      let bestDist = Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const d = dist2Lab(p, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }

      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    const sumL = new Array(k).fill(0);
    const suma = new Array(k).fill(0);
    const sumb = new Array(k).fill(0);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < points.length; i++) {
      const a = assignments[i];
      const p = points[i];
      sumL[a] += p.L;
      suma[a] += p.a;
      sumb[a] += p.b;
      counts[a]++;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        const idx = Math.floor(rng() * points.length);
        centroids[c] = { ...points[idx] };
        continue;
      }
      centroids[c] = {
        L: sumL[c] / counts[c],
        a: suma[c] / counts[c],
        b: sumb[c] / counts[c],
      };
    }

    if (!changed) break;
  }

  const counts = new Array(k).fill(0);
  for (const a of assignments) counts[a]++;

  return {
    centroids,
    counts,
    total: points.length,
  };
}

function mergeSimilar(
  clusters: Array<{ lab: Lab; rgb: Rgb; hex: string; ratio: number }>,
  threshold: number
) {
  const out: typeof clusters = [];

  for (const c of clusters) {
    const hit = out.find(o => deltaE76(o.lab, c.lab) < threshold);
    if (!hit) {
      out.push({ ...c });
    } else {
      const w1 = hit.ratio;
      const w2 = c.ratio;
      const w = w1 + w2;

      hit.lab = {
        L: (hit.lab.L * w1 + c.lab.L * w2) / w,
        a: (hit.lab.a * w1 + c.lab.a * w2) / w,
        b: (hit.lab.b * w1 + c.lab.b * w2) / w,
      };
      hit.ratio = w;

      hit.rgb = labToRgb(hit.lab);
      hit.hex = rgbToHex(hit.rgb);
    }
  }

  const sum = out.reduce((s, x) => s + x.ratio, 0) || 1;
  out.forEach(x => (x.ratio = x.ratio / sum));
  return out;
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function dist2Lab(p: Lab, c: Lab) {
  const dL = p.L - c.L;
  const da = p.a - c.a;
  const db = p.b - c.b;
  return dL * dL + da * da + db * db;
}

function deltaE76(x: Lab, y: Lab) {
  return Math.sqrt(dist2Lab(x, y));
}

function rgbToHex({ r, g, b }: Rgb) {
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(clamp8(r))}${to(clamp8(g))}${to(clamp8(b))}`.toUpperCase();
}

function clamp8(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToLab({ r, g, b }: Rgb): Lab {
  const sr = r / 255, sg = g / 255, sb = b / 255;

  const R = sr <= 0.04045 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
  const G = sg <= 0.04045 ? sg / 12.92 : Math.pow((sg + 0.055) / 1.055, 2.4);
  const B = sb <= 0.04045 ? sb / 12.92 : Math.pow((sb + 0.055) / 1.055, 2.4);

  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;

  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const fx = labF(X / Xn);
  const fy = labF(Y / Yn);
  const fz = labF(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labToRgb(lab: Lab): Rgb {
  const { L, a, b } = lab;

  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;

  const X = Xn * labFinv(fx);
  const Y = Yn * labFinv(fy);
  const Z = Zn * labFinv(fz);

  let R = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  let G = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  let B = X * 0.0557 + Y * -0.2040 + Z * 1.0570;

  R = R <= 0.0031308 ? 12.92 * R : 1.055 * Math.pow(R, 1 / 2.4) - 0.055;
  G = G <= 0.0031308 ? 12.92 * G : 1.055 * Math.pow(G, 1 / 2.4) - 0.055;
  B = B <= 0.0031308 ? 12.92 * B : 1.055 * Math.pow(B, 1 / 2.4) - 0.055;

  return {
    r: clamp8(R * 255),
    g: clamp8(G * 255),
    b: clamp8(B * 255),
  };
}

function labF(t: number) {
  return t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
}

function labFinv(t: number) {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
