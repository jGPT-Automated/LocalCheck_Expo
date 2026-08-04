import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

/**
 * "Shaped image shader" — the reveal that resolves the brand artwork out of
 * black by stamping 16 staggered layers of signed-distance shapes (circle,
 * triangle, box, parallelogram) whose size shrinks as the animation advances.
 *
 * Source: nativebloom "Shaped image shader" block, whose reference
 * implementation is react-native-skia-lab
 * (`src/screens/shader/hooks/use-visual.ts`). The SkSL below is carried over
 * unmodified so the motion matches the reference exactly.
 *
 * LocalCheck uses it as a single-image reveal rather than a slideshow
 * transition: the same image is bound to both shader slots and `hasPrevImage`
 * stays 0, so `main()` renders only the incoming pass. Keeping the shader
 * byte-identical (instead of stripping the unused branch) means a future
 * image-to-image transition needs no shader edit.
 */
const SHAPED_IMAGE_SKSL = `
  uniform shader iPrevImage;
  uniform shader iCurrImage;
  uniform vec2 iResolution;
  uniform float iData[8];

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 p) {
    float n = hash12(p);
    return vec2(n, hash12(p + n + 19.19));
  }

  vec2 rotate2d(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  float sdTriangle(vec2 p) {
    vec2 a = vec2(0.0, -0.42);
    vec2 b = vec2(0.43, 0.34);
    vec2 c = vec2(-0.43, 0.34);
    vec2 e0 = b - a;
    vec2 e1 = c - b;
    vec2 e2 = a - c;
    vec2 v0 = p - a;
    vec2 v1 = p - b;
    vec2 v2 = p - c;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(
      min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
          vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
      vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x))
    );
    return -sqrt(d.x) * sign(d.y);
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  float sdParallelogram(vec2 p) {
    vec2 skewed = vec2(p.x - p.y * 0.46, p.y);
    return sdBox(skewed, vec2(0.39, 0.30));
  }

  float shapeMask(vec2 p, float shapeType, float pixelSize) {
    float aa = max(0.003, 1.5 / pixelSize);

    if (shapeType < 0.5) {
      float d = length(p) - 0.34;
      return 1.0 - smoothstep(0.0, aa, d);
    }

    if (shapeType < 1.5) {
      float d = sdTriangle(p);
      return 1.0 - smoothstep(0.0, aa, d);
    }

    if (shapeType < 2.5) {
      float d = sdBox(p, vec2(0.36, 0.36));
      return 1.0 - smoothstep(0.0, aa, d);
    }

    float d = sdParallelogram(p);
    return 1.0 - smoothstep(0.0, aa, d);
  }

  float shapeSize(float t) {
    float maxSize = max(iData[7], 2.0);
    float minSize = max(iData[6], 2.0);
    return maxSize * pow(minSize / maxSize, clamp(t, 0.0, 1.0));
  }

  vec4 sampleMark(
    vec2 xy,
    float globalProgress,
    float layerIndex,
    float size,
    float step,
    float birthStart,
    float birthWindow,
    float revealDuration,
    float jitterRatio,
    vec2 id,
    float shapeType,
    float seed,
    float imageSlot
  ) {
    float order = hash12(id + vec2(seed + layerIndex * 37.0, layerIndex * 11.0));
    float birthTime = birthStart + order * birthWindow;
    float age = globalProgress - birthTime;

    if (age < 0.0) {
      return vec4(0.0);
    }

    vec2 jitter = (hash22(id + vec2(seed, layerIndex * 17.0)) - 0.5) * step * jitterRatio;
    vec2 center = (id + 0.5) * step + jitter;
    vec2 local = (xy - center) / size;
    float rotation = hash12(id + vec2(layerIndex * 23.0, seed * 1.7)) * 6.2831853;
    local = rotate2d(local, -rotation);

    float reveal = smoothstep(0.0, revealDuration, age);
    float mask = shapeMask(local, shapeType, size) * reveal;
    vec3 color = imageSlot > 0.5
      ? iCurrImage.eval(clamp(center, vec2(0.0), iResolution)).rgb
      : iPrevImage.eval(clamp(center, vec2(0.0), iResolution)).rgb;

    return vec4(color, mask);
  }

  vec4 sampleLayer(
    vec2 xy,
    float globalProgress,
    float layerIndex,
    float stepRatio,
    float jitterRatio,
    float shapeType,
    float seed,
    float imageSlot
  ) {
    if (globalProgress <= 0.0) {
      return vec4(0.0);
    }

    float layerSizeT = clamp(layerIndex / 15.0, 0.0, 1.0);
    float layerSpacing = 1.0 / 16.0;
    float birthWindow = 0.14;
    float revealDuration = 0.08;
    float birthStart = layerIndex * layerSpacing;

    if (globalProgress < birthStart) {
      return vec4(0.0);
    }

    float size = shapeSize(layerSizeT);
    float step = max(size * stepRatio, 2.0);
    vec2 cell = floor(xy / step);
    vec4 hit = vec4(0.0);

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 id = cell + vec2(float(x), float(y));
        vec4 mark = sampleMark(
          xy,
          globalProgress,
          layerIndex,
          size,
          step,
          birthStart,
          birthWindow,
          revealDuration,
          jitterRatio,
          id,
          shapeType,
          seed,
          imageSlot
        );

        if (mark.a > hit.a) {
          hit = mark;
        }
      }
    }

    return hit;
  }

  vec2 layerTuning(float layerIndex) {
    if (layerIndex > 14.5) { return vec2(0.30, 0.16); }
    if (layerIndex > 13.5) { return vec2(0.30, 0.18); }
    if (layerIndex > 12.5) { return vec2(0.31, 0.20); }
    if (layerIndex > 11.5) { return vec2(0.33, 0.23); }
    if (layerIndex > 10.5) { return vec2(0.36, 0.26); }
    if (layerIndex > 9.5) { return vec2(0.40, 0.30); }
    if (layerIndex > 8.5) { return vec2(0.45, 0.35); }
    if (layerIndex > 7.5) { return vec2(0.50, 0.40); }
    if (layerIndex > 6.5) { return vec2(0.55, 0.45); }
    if (layerIndex > 5.5) { return vec2(0.58, 0.50); }
    if (layerIndex > 4.5) { return vec2(0.60, 0.55); }
    if (layerIndex > 3.5) { return vec2(0.60, 0.60); }
    if (layerIndex > 2.5) { return vec2(0.59, 0.65); }
    if (layerIndex > 1.5) { return vec2(0.58, 0.68); }
    if (layerIndex > 0.5) { return vec2(0.57, 0.70); }
    return vec2(0.56, 0.72);
  }

  vec4 sampleVisual(
    vec2 xy,
    float progress,
    float shapeType,
    float seed,
    float imageSlot
  ) {
    for (int i = 0; i < 16; i++) {
      float layerIndex = 15.0 - float(i);
      vec2 tuning = layerTuning(layerIndex);
      vec4 hit = sampleLayer(
        xy,
        progress,
        layerIndex,
        tuning.x,
        tuning.y,
        shapeType,
        seed,
        imageSlot
      );

      if (hit.a > 0.01) {
        return vec4(hit.rgb, 1.0);
      }
    }

    return vec4(0.0);
  }

  vec4 main(vec2 xy) {
    vec4 hit = sampleVisual(xy, iData[0], iData[2], iData[4], 1.0);
    if (hit.a > 0.01) {
      return hit;
    }

    if (iData[5] > 0.5) {
      hit = sampleVisual(xy, 1.0, iData[1], iData[3], 0.0);
      if (hit.a > 0.01) {
        return hit;
      }
    }

    return vec4(0.0);
  }
`;

let compiled: SkRuntimeEffect | null | undefined;

/**
 * Compile on first use, once, and never throw.
 *
 * This used to compile at module scope and throw on failure. That is unsafe
 * here: the intro renders on the auth screen, which is the app's front door,
 * and a module-scope throw happens at import — before any error boundary
 * exists to catch it — so a shader problem would have meant the app could not
 * open at all. Returning null instead lets the reveal be skipped and the sign
 * in form render normally.
 */
export function getShapedImageShader(): SkRuntimeEffect | null {
  if (compiled === undefined) {
    try {
      compiled = Skia.RuntimeEffect.Make(SHAPED_IMAGE_SKSL) ?? null;
    } catch {
      compiled = null;
    }
    if (compiled === null) {
      console.warn("Shaped image shader failed to compile; skipping the reveal.");
    }
  }
  return compiled;
}

/** Shape stamped by the reveal. 0 circle · 1 triangle · 2 box · 3 parallelogram. */
export const REVEAL_SHAPE = 2;

/** Seeds the per-cell hash so the scatter is stable across launches. */
export const REVEAL_SEED = 7;

/** Reference block values — the size ramp each layer interpolates between. */
export const MIN_SHAPE_SIZE = 15;
export const MAX_SHAPE_SIZE = 800;
