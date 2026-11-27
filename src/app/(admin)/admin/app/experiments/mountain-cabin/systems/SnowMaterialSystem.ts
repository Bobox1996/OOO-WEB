import { MeshStandardNodeMaterial, Color } from 'three/webgpu';
import { attribute, bumpMap, cameraPosition, color, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, uniform, vec3 } from 'three/tsl';
import type { EnvironmentState } from './types';

/** One shared PBR material: metre-space triplanar detail remains stable across every terrain LOD. */
export class SnowMaterialSystem {
  readonly terrain:MeshStandardNodeMaterial;
  readonly snow:MeshStandardNodeMaterial;
  readonly rock:MeshStandardNodeMaterial;
  private coverage=uniform(.86);
  private wind=uniform(new Color(.3,0,.7));
  constructor(state:EnvironmentState) {
    const p=positionWorld;
    const n=normalWorldGeometry;
    const broad=mx_noise_float(p.mul(.021));
    const flecks=mx_noise_float(p.mul(2.8));
    // Three plane projections, weighted by the geometric normal; no stretched UVs on cliffs.
    const weights=n.abs().pow(vec3(4)); const total=weights.x.add(weights.y).add(weights.z).max(.001);
    const a=mx_noise_float(vec3(p.y.mul(1.2),p.z.mul(1.2),0));
    const b=mx_noise_float(vec3(p.x.mul(1.2),p.z.mul(1.2),0));
    const c=mx_noise_float(vec3(p.x.mul(1.2),p.y.mul(1.2),0));
    const granular=a.mul(weights.x).add(b.mul(weights.y)).add(c.mul(weights.z)).div(total);
    // Bedding planes have a slight geological dip, crossed by long vertical erosion ribs.
    // Noise warps the seams gently; it no longer paints circular snow/rock patches.
    const fold=mx_noise_float(vec3(p.x.mul(.0015),p.y.mul(.0006),p.z.mul(.0015)));
    const seam=p.y.mul(.072).add(p.x.mul(.008)).sub(p.z.mul(.006)).add(fold.mul(3.5));
    const strata=seam.sin().mul(.5).add(.5);
    const lamina=seam.mul(3.17).add(broad.mul(.3)).sin().mul(.5).add(.5);
    const flutes=mx_noise_float(vec3(p.x.mul(.018),p.y.mul(.001),p.z.mul(.018)));
    const windRibs=p.x.mul(3.2).add(p.z.mul(.6)).add(broad.mul(6)).sin().mul(.5).add(.5);
    const shelter=attribute<'float'>('terrainShelter','float');
    const exposure=n.x.mul(this.wind.r).add(n.z.mul(this.wind.b)).max(0).mul(.1);
    const elevation=smoothstep(-1100,80,p.y).mul(.11);
    const accumulation=n.y.add(broad.mul(.025)).add(shelter.mul(.4)).add(elevation).sub(exposure);
    const threshold=float(1.1).sub(this.coverage.mul(.65));
    const cover=smoothstep(threshold,threshold.add(.24),accumulation);
    const stone=mix(color('#54595c'),color('#81817c'),flutes.mul(.38).add(.5)).mul(strata.mul(.10).add(.87)).mul(lamina.mul(.045).add(.955));
    const snowColor=mix(color('#d3dfe7'),color('#f0f2ee'),granular.mul(.06).add(.92));
    // Rare crystalline facets lower roughness only in the near field, avoiding distant sparkle aliasing.
    const nearDetail=float(1).sub(smoothstep(5,35,p.distance(cameraPosition)));
    const crystals=smoothstep(.48,.67,mx_noise_float(p.mul(64))).mul(nearDetail);
    const snowRoughness=flecks.mul(.045).add(.84).sub(crystals.mul(.19));
    this.terrain=new MeshStandardNodeMaterial({roughness:.86,metalness:0});
    this.terrain.name='Alpine snow / fractured limestone';
    this.terrain.colorNode=mix(stone,snowColor,cover);
    this.terrain.roughnessNode=mix(float(.94),snowRoughness,cover);
    this.terrain.normalNode=bumpMap(mix(granular.mul(.26).add(strata.mul(.14)).add(lamina.mul(.04)),granular.mul(.012).add(windRibs.mul(.006)),cover),float(.4));
    this.terrain.aoNode=mix(strata.mul(.12).add(.87),float(1),cover);
    // A tiny cool diffuse lift approximates multiple scattering in the snow grains.
    this.terrain.emissiveNode=color('#527d9b').mul(.008).mul(cover);
    this.snow=new MeshStandardNodeMaterial({color:'#e8eef1',roughness:.88});
    this.snow.normalNode=bumpMap(granular.mul(.015).add(windRibs.mul(.007)),float(.35));
    this.snow.roughnessNode=snowRoughness;
    this.rock=new MeshStandardNodeMaterial({color:'#55585c',roughness:.97});
    this.rock.colorNode=stone;
    this.rock.normalNode=bumpMap(granular.mul(.3).add(strata.mul(.2)).add(lamina.mul(.04)),float(.5));
    this.update(state);
  }
  update(state:EnvironmentState){
    this.coverage.value=state.snowCoverage;
    const a=state.windDirection*Math.PI/180;
    this.wind.value.setRGB(Math.cos(a),0,Math.sin(a));
  }
  dispose(){this.terrain.dispose();this.snow.dispose();this.rock.dispose();}
}
