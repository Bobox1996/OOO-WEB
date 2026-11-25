import * as T from 'three/webgpu'
import { RADIUS, UP, clamp, creekPoint } from './world'

import { Terrain, cellAt, charts } from './terrain-blocks'
type Obstacle={p:T.Vector3;radius:number}
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z)
function makeHiker(){
  const group=new T.Group(),meshes:T.BufferGeometry[]=[],mats:T.Material[]=[]
  function mat(hex:string,r=.84){const m=new T.MeshStandardMaterial({color:hex,roughness:r});mats.push(m);return m}
  const jacket=mat('#be8459'),sleeve=mat('#a96e4e'),pants=mat('#425751'),boots=mat('#51483a'),skin=mat('#c19574'),hat=mat('#c7b581'),band=mat('#6e7b5c'),bag=mat('#6a7557')
  function piece(name:string,g:T.BufferGeometry,m:T.Material,pos:T.Vector3,scale:T.Vector3,parent:T.Object3D=group){
    meshes.push(g);const mesh=new T.Mesh(g,m);mesh.name=name;mesh.position.copy(pos);mesh.scale.copy(scale);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh
  }
  const oval=(n:string,p:T.Vector3,s:T.Vector3,m:T.Material,parent:T.Object3D=group)=>piece(n,new T.SphereGeometry(1,16,12),m,p,s,parent)
  const pivot=(p:T.Vector3,par:T.Object3D=group)=>{const g=new T.Group();g.position.copy(p);par.add(g);return g}
  const body=pivot(V(0,.59,0))
  oval('field jacket',V(0,.26,0),V(.226,.316,.137),jacket,body)
  oval('walking trousers',V(0,.012,0),V(.190,.165,.119),pants,body)
  oval('collar',V(0,.466,.006),V(.117,.076,.098),band,body)
  oval('head',V(0,.615,.019),V(.157,.183,.147),skin,body)
  oval('nose',V(0,.587,.157),V(.037,.043,.031),skin,body)
  for(const x of [-.068,.068])oval('eye',V(x,.64,.145),V(.014,.017,.009),boots,body)
  oval('canvas hat brim',V(0,.74,.002),V(.253,.029,.224),hat,body)
  oval('hat crown',V(0,.78,-.005),V(.158,.081,.145),hat,body)
  oval('hat ribbon',V(0,.748,-.003),V(.162,.032,.146),band,body)
  oval('field pack',V(0,.25,-.127),V(.162,.206,.087),bag,body)
  oval('pack flap',V(0,.335,-.18),V(.148,.084,.038),band,body)
  const arms:T.Group[]=[],legs:T.Group[]=[]
  for(const side of [-1,1]){
    const arm=pivot(V(side*.207,.397,.006),body);arms.push(arm)
    oval('sleeve',V(side*.022,-.144,0),V(.072,.186,.076),sleeve,arm)
    oval('hand',V(side*.032,-.309,.014),V(.048,.073,.046),skin,arm)
    const leg=pivot(V(side*.096,.563,0));legs.push(leg)
    oval('trouser leg',V(0,-.241,0),V(.079,.262,.080),pants,leg)
    oval('boot',V(0,-.484,.034),V(.083,.077,.118),boots,leg)
  }
  return {group,animate(phase:number,stride:number){const wave=Math.sin(phase);legs[0].rotation.x=wave*.43*stride;legs[1].rotation.x=-wave*.43*stride;arms[0].rotation.x=-wave*.32*stride;arms[1].rotation.x=wave*.32*stride;body.position.y=.59+Math.abs(Math.cos(phase))*.025*stride},
    dispose(){meshes.forEach(m=>m.dispose());mats.forEach(m=>m.dispose())}}
}
export function makeWalker(terrain:Terrain,obstacles:Obstacle[]){
  const creeks=terrain.creeks
  let level=0
  const human=makeHiker(),up=V(),forward=V(),facing=V(),right=V(),move=V(),next=V(),q=new T.Quaternion(),basis=new T.Matrix4()
  const aim=V(),ideal=V(),target=V(),camUp=V(),support=V(),foot=V(),view=V(),frameX=V(),normal=V(),touch=new T.Vector2()
  const keys=new Set<string>();let initialized=false,phase=0,stride=0,yawPitch=.57,range=3.95,snapped=false,active=false
  const project=(v:T.Vector3,n:T.Vector3)=>v.addScaledVector(n,-v.dot(n)).normalize()
  function safeSpawn(p:T.Vector3){const s=terrain.sample(p);return !!s.material&&!s.wet&&s.near>1.05&&!obstacles.some(o=>p.distanceToSquared(o.p)<((o.radius+.20)/RADIUS)**2)}
  function start(point?:T.Vector3){
    if(!initialized||point){
      let spawn=point?.clone()??creekPoint(creeks[0],.61,-.085)
      if(!safeSpawn(spawn)){
        const east=V().crossVectors(spawn,Math.abs(spawn.y)<.92?UP:V(1,0,0)).normalize(),north=V().crossVectors(spawn,east)
        let chosen:T.Vector3|null=null
        for(let k=1;k<=15&&!chosen;k++)for(let i=0;i<12;i++){const a=i*Math.PI/6;const test=spawn.clone().addScaledVector(east,Math.cos(a)*k*.029).addScaledVector(north,Math.sin(a)*k*.029).normalize();if(safeSpawn(test)){chosen=test;break}}
        chosen??=charts.find(c=>safeSpawn(c.p))?.p.clone()??null
        if(!chosen)return false
        spawn=chosen
      }
      up.copy(spawn);level=terrain.solid[cellAt(up)];const river=creeks.reduce((a,b)=>a.n.dot(spawn)>b.n.dot(spawn)?a:b)
      forward.copy(river.along).multiplyScalar(-1).addScaledVector(river.across,.26);project(forward,up)
      if(forward.lengthSq()<.01)project(forward.set(1,0,0),up);facing.copy(forward);initialized=true
    }
    active=true;snapped=false;keys.clear();touch.set(0,0);human.group.visible=true;return true
  }
  function stop(){active=false;keys.clear();touch.set(0,0);human.group.visible=false}
  stop()
  const movementKeys=['KeyW','KeyS','KeyA','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight']
  function key(code:string,down:boolean){if(!movementKeys.includes(code)||!active)return false;if(down)keys.add(code);else keys.delete(code);return true}
  function look(dx:number,dy:number){forward.applyAxisAngle(up,-dx*.0062);yawPitch=clamp(yawPitch+dy*.004,-.10,.91)}
  function zoom(f:number){range=clamp(range*f,2.1,6.6)}
  function tick(dt:number,camera:T.PerspectiveCamera){
    if(!active)return false
    const x=touch.x+Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))
    const z=touch.y+Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))
    right.crossVectors(forward,up).normalize();move.copy(forward).multiplyScalar(z).addScaledVector(right,x)
    const strength=Math.min(1,move.length()),current=terrain.support(up,level);let moved=false
    if(strength>.035){
      move.normalize();const run=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=(run?2.65:1.68)*(current?.wet?.57:1)
      const step=speed*strength*dt;next.copy(up).addScaledVector(move,step/(RADIUS+(current?.height??0))).normalize()
      const s=terrain.traverse(up,next,level),blocked=obstacles.some(o=>next.distanceToSquared(o.p)<((o.radius+.085)/RADIUS)**2&&next.distanceToSquared(o.p)<up.distanceToSquared(o.p))
      if(s&&!blocked){
        level=s.layer
        q.setFromUnitVectors(up,next);forward.applyQuaternion(q);facing.applyQuaternion(q);up.copy(next);project(forward,up)
        facing.lerp(project(move,up),1-Math.exp(-dt*12));if(facing.lengthSq()<.001)facing.copy(move);project(facing,up)
        moved=true;phase+=dt*(run?10:7.8)*strength
      }
    }
    stride+=(Number(moved)*strength-stride)*(1-Math.exp(-dt*15))
    const ground=terrain.support(up,level);foot.copy(up).multiplyScalar(RADIUS+(ground?.height??terrain.sample(up).bed)+.016)
    human.group.position.copy(foot);frameX.crossVectors(up,facing).normalize();basis.makeBasis(frameX,up,facing);human.group.quaternion.setFromRotationMatrix(basis);human.animate(phase,stride)
    right.crossVectors(forward,up).normalize()
    aim.copy(foot).addScaledVector(up,.84).addScaledVector(forward,1.45)
    ideal.copy(foot).addScaledVector(up,1.04+Math.sin(yawPitch)*range).addScaledVector(forward,-Math.cos(yawPitch)*range).addScaledVector(right,.27)
    // A shoulder camera stays above the terrain along the entire boom, including cliff edges.
    for(let i=1;i<=9;i++){const t=i/9;support.copy(aim).lerp(ideal,t);normal.copy(support).normalize();const h=terrain.cameraFloor(normal,support.length()-RADIUS)+RADIUS+.19
      if(support.length()<h){ideal.copy(aim).lerp(ideal,Math.max(.20,(i-.7)/9));break}}
    normal.copy(ideal).normalize();const floor=RADIUS+terrain.cameraFloor(normal,ideal.length()-RADIUS)+.24
    if(ideal.length()<floor)ideal.copy(normal).multiplyScalar(floor)
    if(!snapped){camera.position.copy(ideal);target.copy(aim);camUp.copy(up);snapped=true}
    else{camera.position.lerp(ideal,1-Math.exp(-dt*15));target.lerp(aim,1-Math.exp(-dt*14));camUp.lerp(up,1-Math.exp(-dt*13)).normalize()}
    camera.up.copy(camUp);camera.lookAt(target);return moved
  }
  return {group:human.group,start,stop,tick,key,look,zoom,up,forward,right,get active(){return active},touch(x:number,z:number){touch.set(x,z)},clear(){keys.clear();touch.set(0,0)},dispose:human.dispose}
}
