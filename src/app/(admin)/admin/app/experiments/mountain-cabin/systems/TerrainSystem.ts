import { BufferAttribute, BufferGeometry, Camera, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Scene, Vector3 } from 'three/webgpu';
import { AlpineHeightfield, terrainChunks, type TerrainChunkDescriptor } from './procedural';
import { SnowMaterialSystem } from './SnowMaterialSystem';
import { QUALITY, type EnvironmentState, type Quality } from './types';

interface Chunk {mesh:Mesh; fine:BufferAttribute; coarse:BufferAttribute; size:number; center:Vector3; coarseActive:boolean;}
export class TerrainSystem {
  readonly group=new Group();
  readonly materials:SnowMaterialSystem;
  private field:AlpineHeightfield;
  private chunks:Chunk[]=[];
  private state:EnvironmentState;
  private builtQuality:Quality;
  private tracks=new Group();
  private trackMaterial=new MeshStandardMaterial({color:'#92a8b8',roughness:1,transparent:true,opacity:.2,depthWrite:false});
  constructor(private scene:Scene,state:EnvironmentState){
    this.state={...state}; this.builtQuality=state.quality; this.field=new AlpineHeightfield(state.seed); this.materials=new SnowMaterialSystem(state);
    this.group.name='Continuous alpine terrain / metres';this.group.add(this.tracks);scene.add(this.group);this.build();
  }
  heightAt(x:number,z:number){return this.field.heightAt(x,z);}
  updateState(state:EnvironmentState){this.state={...state};this.materials.update(state);}
  regenerate(seed:number){this.state.seed=seed;this.field=new AlpineHeightfield(seed);this.clearGeometry();this.build();}
  setQuality(q:Quality){if(this.builtQuality===q)return;this.state.quality=q;this.builtQuality=q;this.clearGeometry();this.build();}
  update(camera:Camera){
    const p=camera.position;
    for(const chunk of this.chunks){
      const far=p.distanceTo(chunk.center)>chunk.size*3.6;
      if(far!==chunk.coarseActive){chunk.mesh.geometry.setIndex(far?chunk.coarse:chunk.fine);chunk.coarseActive=far;}
    }
  }
  private build(){
    const resolution=QUALITY[this.state.quality].terrain;
    for(const desc of terrainChunks()){
      const n=Math.max(24,Math.round(resolution*(desc.ring===0?1:Math.max(.28,.74-desc.ring*.065))/2)*2);
      this.chunks.push(this.createChunk(desc,n));
    }
    this.makeTracks();
  }
  private createChunk(desc:TerrainChunkDescriptor,n:number):Chunk{
    const {x:cx,z:cz,size,ring}=desc,step=size/n,half=size/2;
    const positions:number[]=[],heights=new Float32Array((n+1)*(n+1)),shelter:number[]=[];
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
      const wx=cx-half+x*step,wz=cz-half+z*step,h=this.heightAt(wx,wz);
      positions.push(wx,h,wz);heights[z*(n+1)+x]=h;
    }
    const normals:number[]=[];
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
      const h=heights[z*(n+1)+x];
      const l=heights[z*(n+1)+Math.max(0,x-1)],r=heights[z*(n+1)+Math.min(n,x+1)];
      const b=heights[Math.max(0,z-1)*(n+1)+x],f=heights[Math.min(n,z+1)*(n+1)+x];
      const nx=(l-r)/(x===0||x===n?step:2*step),nz=(b-f)/(z===0||z===n?step:2*step),length=Math.hypot(nx,1,nz);
      normals.push(nx/length,1/length,nz/length);shelter.push(Math.max(-.12,Math.min(.12,((l+r+b+f)*.25-h)/step*.3)));
    }
    const makeIndices=(stride:number)=>{
      const indices:number[]=[];
      for(let z=0;z<n;z+=stride)for(let x=0;x<n;x+=stride){
        const a=z*(n+1)+x,b=a+stride,c=a+stride*(n+1),d=c+stride;
        if(stride===2&&(x===0||z===0||x+stride===n||z+stride===n)){
          // Keep the full-resolution boundary even in coarse LOD, so skirts remain welded.
          const edge=[a];if(x===0)edge.push(a+n+1);edge.push(c);if(z+stride===n)edge.push(c+1);edge.push(d);if(x+stride===n)edge.push(b+n+1);edge.push(b);if(z===0)edge.push(a+1);
          const center=a+n+2;for(let i=0;i<edge.length;i++)indices.push(center,edge[i],edge[(i+1)%edge.length]);
        }else indices.push(a,c,b,b,c,d);
      }
      return indices;
    };
    const fineIndices=makeIndices(1),coarseIndices=makeIndices(2);
    // Downward skirts hide T-junctions between successive clipmap resolutions.
    const edges=[Array.from({length:n+1},(_,i)=>i),Array.from({length:n+1},(_,i)=>i*(n+1)+n),Array.from({length:n+1},(_,i)=>n*(n+1)+n-i),Array.from({length:n+1},(_,i)=>(n-i)*(n+1))];
    const skirtDepth=Math.max(5,step*3);
    for(const edge of edges){const lower:number[]=[];for(const index of edge){const i=positions.length/3;lower.push(i);positions.push(positions[index*3],positions[index*3+1]-skirtDepth,positions[index*3+2]);normals.push(normals[index*3],normals[index*3+1],normals[index*3+2]);shelter.push(shelter[index]);}
      for(let i=0;i<n;i++){const tri=[edge[i],lower[i],edge[i+1],edge[i+1],lower[i],lower[i+1]];fineIndices.push(...tri);coarseIndices.push(...tri);}
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setAttribute('terrainShelter',new Float32BufferAttribute(shelter,1));
    const fine=new BufferAttribute(new Uint32Array(fineIndices),1),coarse=new BufferAttribute(new Uint32Array(coarseIndices),1);
    geometry.setIndex(fine);geometry.computeBoundingSphere();
    const mesh=new Mesh(geometry,this.materials.terrain);mesh.name=`Alpine clipmap ${ring} / ${cx},${cz}`;mesh.receiveShadow=ring<3;mesh.castShadow=ring===0;mesh.frustumCulled=true;this.group.add(mesh);
    return {mesh,fine,coarse,size,center:geometry.boundingSphere!.center.clone(),coarseActive:false};
  }
  private makeTracks(){
    // Two interrupted ski grooves and a footpath, draped onto the same collision field.
    for(const offset of [-.21,.21]){
      const vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=240;i++){const z=-150+i*2.7,x=-18+Math.sin(z*.022)*5+Math.sin(z*.005)*13+offset;
        for(const dx of [-.065,.065])vertices.push(x+dx,this.heightAt(x+dx,z)+.045,z);
        if(i<240){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}}
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new Mesh(g,this.trackMaterial);m.name='Subtle ski groove';this.tracks.add(m);
    }
    for(let i=0;i<44;i++){
      const z=-7-i*.66,x=-3.9-Math.sin(i*.08)*3+(i%2?-.18:.18),vertices:number[]=[],indices:number[]=[];
      vertices.push(x,this.heightAt(x,z)+.032,z);
      for(let k=0;k<=10;k++){const a=k/10*Math.PI*2,px=x+Math.cos(a)*.105,pz=z+Math.sin(a)*.19;vertices.push(px,this.heightAt(px,pz)+.032,pz);if(k<10)indices.push(0,k+2,k+1);}
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();this.tracks.add(new Mesh(g,this.trackMaterial));
    }
  }
  private clearGeometry(){for(const chunk of this.chunks){this.group.remove(chunk.mesh);chunk.mesh.geometry.dispose();}this.chunks=[];for(const child of [...this.tracks.children]){this.tracks.remove(child);(child as Mesh).geometry.dispose();}}
  dispose(){this.clearGeometry();this.materials.dispose();this.trackMaterial.dispose();this.scene.remove(this.group);}
}
