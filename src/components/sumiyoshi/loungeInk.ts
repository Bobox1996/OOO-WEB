import { MeshStandardMaterial } from 'three'

// Grade the lit finishes in display space. The TV picture and character sprites
// supply their own artwork and never pass through this material.
export function applyLoungeInk(material: MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', `
      #include <colorspace_fragment>
      vec3 lit = gl_FragColor.rgb;
      float value = clamp(dot(lit, vec3(.2126, .7152, .0722)), 0.0, 1.0);

      // A fixed 2x2 threshold softens the boundaries of the 19 painted values.
      vec2 cell = mod(floor(gl_FragCoord.xy), 2.0);
      float threshold = .25 * (2.0 * mod(cell.x + cell.y, 2.0) + cell.y) - .375;
      float band = floor(value * 18.0 + .5 + threshold * .72) / 18.0;

      // Blue-black leather, violet-grey half tones and the warm plaster highlight.
      vec3 ink = mix(vec3(.062, .072, .105), vec3(.242, .230, .260), min(4.0 * band, 1.0));
      ink = mix(ink, vec3(.494, .472, .468), clamp(4.0 * band - 1.0, 0.0, 1.0));
      ink = mix(ink, vec3(.764, .739, .684), clamp(4.0 * band - 2.0, 0.0, 1.0));
      ink = mix(ink, vec3(1.0, .974, .910), clamp(4.0 * band - 3.0, 0.0, 1.0));
      gl_FragColor.rgb = clamp(ink + .94 * (lit - value), 0.0, 1.0);
    `)
  }
}
