/** Deterministic, metre-scale terrain primitives. No renderer or browser dependency. */
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class AlpineHeightfield {
  private permutation: Uint8Array;
  readonly seed: number;
  constructor(seed: number) {
    this.seed = seed;
    const random = seededRandom(seed), p = Array.from({length:256}, (_,i)=>i);
    for(let i=255;i>0;i--){ const j=Math.floor(random()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; }
    this.permutation = Uint8Array.from([...p,...p]);
  }
  noise(x:number,y:number):number {
    const xi=Math.floor(x), yi=Math.floor(y), X=xi&255,Y=yi&255;
    x-=xi; y-=yi;
    const u=x*x*x*(x*(x*6-15)+10),v=y*y*y*(y*(y*6-15)+10),p=this.permutation;
    const grad=(h:number,a:number,b:number)=>{ switch(h&7){case 0:return a+b;case 1:return -a+b;case 2:return a-b;case 3:return -a-b;case 4:return a;case 5:return -a;case 6:return b;default:return -b;} };
    const a=grad(p[p[X]+Y],x,y),b=grad(p[p[X+1]+Y],x-1,y),c=grad(p[p[X]+Y+1],x,y-1),d=grad(p[p[X+1]+Y+1],x-1,y-1);
    return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
  }
  fbm(x:number,z:number,octaves=4):number {
    let sum=0,amp=.55;
    for(let i=0;i<octaves;i++){sum+=this.noise(x,z)*amp; const nx=x*1.87-z*.47; z=x*.47+z*1.87; x=nx+17.7; amp*=.5;}
    return sum;
  }
  ridged(x:number,z:number,octaves=4):number {
    let sum=0,amp=.55,weight=1;
    for(let i=0;i<octaves;i++){let n=1-Math.abs(this.noise(x,z)); n*=n; sum+=n*amp*weight; weight=Math.min(1,n*1.7); x=x*2.13+9.3; z=z*2.07+3.7; amp*=.48;}
    return sum;
  }
  heightAt(x:number,z:number):number {
    const dist=Math.hypot(x,z);
    // A continuous asymmetric shoulder anchors the refuge, with a dramatic valley-facing drop.
    const localDetail=this.fbm(x*.012,z*.012,4)*10+this.fbm(x*.13,z*.13,2)*.65;
    const shoulder= -Math.abs(x)*.39 - Math.max(z,0)*.52 - Math.max(-z,0)*.105
      - Math.pow(Math.max(z,0),2)*.000045 + localDetail*smoothstep(12,110,dist)
      + this.fbm(x*.0017,z*.0017,3)*Math.min(dist*.28,150);
    if(dist<220) return this.gradeSite(x,z,shoulder);

    const wx=x+this.fbm(x*.00022+14,z*.00022-21,3)*620;
    const wz=z+this.fbm(x*.00024-8,z*.00024+9,3)*560;
    const base=-1250+this.fbm(wx*.00023,wz*.00023,3)*180;
    let mountain=base;
    // Long geological folds, not radial cones. Each has a broken crest and asymmetric walls.
    // x, z, half length, half width, crest above the cabin datum, plan rotation.
    const ranges = ALPINE_RANGES;
    for(let i=0;i<ranges.length;i++){
      const [cx,cz,length,width,crest,angle]=ranges[i];
      const c=Math.cos(angle),s=Math.sin(angle),dx=wx-cx,dz=wz-cz;
      const along=dx*c+dz*s,cross=-dx*s+dz*c;
      const end=Math.abs(along)/length;
      if(end>1.5||Math.abs(cross)>width*3.7)continue;
      const jagged=this.ridged(along*.00072+i*8.3,cross*.00015+i*5.1,4);
      const crestHeight=crest-490+ jagged*970 + this.noise(along*.0013+i*6.1,i*7.9+.43)*260;
      const asymmetry=cross>0?.86:1.18;
      const profile=Math.exp(-Math.pow(Math.abs(cross)/(width*asymmetry),1.34));
      const terminus=1-smoothstep(.62,1.48,end);
      const ridge=base+(crestHeight-base)*profile*terminus;
      mountain=Math.max(mountain,ridge);
    }
    const roughness=smoothstep(-1000,500,mountain);
    // Incised tributary gullies read as exposed ribs on the steep walls.
    const incisions=(1-this.ridged(wx*.0024,wz*.0024,3))*155*roughness;
    mountain += this.fbm(wx*.003,wz*.003,4)*190*roughness - incisions;
    mountain += this.fbm(x*.025,z*.025,3)*8*roughness;
    const terrain=Math.max(mountain,shoulder);
    return this.gradeSite(x,z,terrain);
  }
  private gradeSite(x:number,z:number,h:number) {
    const distance=Math.hypot(x*.92,z*1.16);
    const pad=-.08+this.noise(x*.19+3,z*.19+5)*.035;
    return pad+(h-pad)*smoothstep(10.5,26,distance);
  }
}

export const ALPINE_RANGES: readonly (readonly number[])[] = [
  [-2100,4300,5000,1550,1520,-.20], [4200,5400,4400,1750,2010,.28],
  [-6200,6600,4200,1900,1800,-.64], [1300,10400,8500,2500,2200,-.12],
  [-10000,13000,6500,2700,1950,.25], [9500,15400,8000,2600,2350,-.3],
  [-5000,21500,12000,3300,2300,.08], [16000,26000,12000,3800,2800,-.2],
  [-9500,-3500,7000,2100,1300,1.0], [8700,-2300,8000,2100,1700,-1.14],
  [1300,-11000,9000,2800,1700,.24], [-15000,-12000,10000,3300,2150,.4],
  [21000,-1500,10000,3800,2300,1.0], [-23000,3000,14000,3900,2450,1.2],
  [-5000,-26000,16000,4000,2400,-.08], [12000,39000,24000,6000,3400,.1],
];

export interface TerrainChunkDescriptor { x:number; z:number; size:number; ring:number; }
/** Nested 3×3 grids cover the plane without overlapping visible surfaces. */
export function terrainChunks():TerrainChunkDescriptor[] {
  const chunks:TerrainChunkDescriptor[]=[{x:0,z:0,size:192,ring:0}];
  let innerHalf=96;
  for(let ring=1;ring<=6;ring++){
    const size=innerHalf*2;
    for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){
      if(x===0&&z===0)continue;
      chunks.push({x:x*size,z:z*size,size,ring});
    }
    innerHalf*=3;
  }
  return chunks;
}
