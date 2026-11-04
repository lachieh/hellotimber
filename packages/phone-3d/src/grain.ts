import type * as THREE from "three";

/**
 * The cover's moulded finish: a fine fleck of lighter and darker grains through the colour and a
 * little through the sheen, like the speckled navy of the real Xpress-on cover. Computed in the
 * mesh's own space, so it needs no UVs and stays put on the part as it turns.
 */
export interface Grain {
  /** Grains across one unit of the mesh's own space (the GLB's units: the phone is ~0.27 tall). */
  density: number;
  /** How far a grain moves the colour either way, as a share of it. */
  amount: number;
  /** How far a grain moves the roughness either way. */
  sheen: number;
}

/** A grain about a pixel across with the phone filling the stage, filtering to an even colour when smaller. */
export const CASE_GRAIN: Grain = { density: 2600, amount: 0.15, sheen: 0.2 };

/** Adds `grain` to a standard material (in place; returns it). */
export function grained<T extends THREE.MeshStandardMaterial>(material: T, grain: Grain): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrain = { value: [grain.density, grain.amount, grain.sheen] };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrainAt;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrainAt = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vGrainAt;
uniform vec3 uGrain;
float grainHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
// Value noise: smooth between the grains, so it filters rather than shimmers as it shrinks.
float grainNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(grainHash(i), grainHash(i + vec3(1, 0, 0)), f.x),
        mix(grainHash(i + vec3(0, 1, 0)), grainHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(grainHash(i + vec3(0, 0, 1)), grainHash(i + vec3(1, 0, 1)), f.x),
        mix(grainHash(i + vec3(0, 1, 1)), grainHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float grain = grainNoise(vGrainAt * uGrain.x) * 0.75 + grainNoise(vGrainAt * uGrain.x * 2.3) * 0.25;
// Fewer light flecks than dark: the light ones read as the cover's sparkle.
diffuseColor.rgb *= 1.0 + uGrain.y * (smoothstep(0.35, 0.8, grain) * 1.6 - 0.6);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + uGrain.z * (0.5 - grain), 0.0, 1.0);`,
      );
  };
  material.customProgramCacheKey = () => "phone-grain";
  return material;
}
