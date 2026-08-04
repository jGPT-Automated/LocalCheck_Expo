import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

/**
 * Tagged-template helper for SkSL fragment shaders.
 *
 * Ported from the react-native-skia-lab reference
 * (https://github.com/daehyeonmun2021/react-native-skia-lab, `src/utils/skia.ts`),
 * minus its `glsl` interpolation layer — LocalCheck's shaders are static
 * strings, so a plain raw-join is enough and keeps the dependency surface flat.
 *
 * Compilation happens at module scope, so a malformed shader fails loudly at
 * import rather than silently rendering nothing on a real phone.
 */
export function frag(
  source: TemplateStringsArray,
  ...values: (string | number)[]
): SkRuntimeEffect {
  const code = source.raw.reduce(
    (acc, chunk, index) => acc + chunk + (values[index] ?? ""),
    ""
  );
  const effect = Skia.RuntimeEffect.Make(code);
  if (effect === null) {
    throw new Error("Could not compile SkSL shader");
  }
  return effect;
}
