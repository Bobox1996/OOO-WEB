import * as T from 'three'
import { glow, glowTexture, seeded, texture } from './geometry'

/** An overcast blue horizon and warm practicals give wet surfaces an environment to reflect. */
export function lightSet(scene:T.Scene, inside:boolean, renderer:T.WebGLRenderer) {
  const horizon = inside ? '#ccaa80' : '#526981'
  const env = texture(512,256,c=>{
    const g=c.createLinearGradient(0,0,0,256)
    g.addColorStop(0,inside?'#bdb2a0':'#162140')
    g.addColorStop(.45,horizon);g.addColorStop(.56,inside?'#978d78':'#354b58')
    g.addColorStop(1,inside?'#564a43':'#192936')
    c.fillStyle=g;c.fillRect(0,0,512,256)
    c.fillStyle=inside?'#fff4cd':'#eef4ff';c.fillRect(70,75,inside?150:95,inside?18:33)
    c.fillStyle=inside?'#fff8da':'#f6d8a9';c.fillRect(334,102,45,15)
  })
  env.mapping=T.EquirectangularReflectionMapping
  const gen=new T.PMREMGenerator(renderer), target=gen.fromEquirectangular(env)
  gen.dispose();env.dispose();scene.environment=target.texture
  scene.environmentIntensity=inside?.62:.52
  scene.background=new T.Color(inside?'#47535a':'#25394c')
  if(!inside)scene.fog=new T.FogExp2('#3c5065',.014)
  scene.add(new T.HemisphereLight(inside?'#ffeed8':'#b0c4ee',inside?'#c3a18a':'#657a8f',inside?1.27:.93))
  const key=new T.DirectionalLight(inside?'#ffe0b4':'#b9ccff',inside?1.89:1.42)
  key.position.set(-8,16,7);key.castShadow=true
  key.shadow.mapSize.set(1024,1024)
  const width=inside?10:22
  Object.assign(key.shadow.camera,{left:-width,right:width,top:width,bottom:-width,near:.5,far:65})
  key.shadow.normalBias=.026;key.shadow.bias=-.00015;key.shadow.radius=2;scene.add(key)
  const rim=new T.DirectionalLight(inside?'#c5eeea':'#a4c3ec',inside?.54:.54)
  rim.position.set(8,7,-10);scene.add(rim)
  if(!inside){
    for(const [x,y,z,color,intensity,range] of [[-10,2.7,7,0xffc086,75,13],[9.05,2.65,.30,0x9bf4da,4.5,8],[0,4,-15,0xcbdfff,95,15]]){
      const lamp=new T.PointLight(color,intensity,range,2);lamp.position.set(x,y,z);scene.add(lamp)
    }
    const bloom=glowTexture()
    for(const [x,y,z] of [[-13.3,2.45,-6.85],[13.2,2.45,-6.85],[12.9,2.45,8.45]]){
      glow(scene,bloom,x,y,z,1.65,'#ffd7a1',.45)
    }
    glow(scene,bloom,8.5,2.15,-1.22,1.25,'#97eacd',.27)
    addWetLight(scene,-10,7.02,6.9,4.7,'#ffc58c',444)
    addWetLight(scene,8.5,-.95,1.6,4.2,'#98fad9',661)
    const dome=new T.Mesh(new T.SphereGeometry(105,32,12),new T.ShaderMaterial({
      side:T.BackSide,depthWrite:false,vertexShader:`varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 d;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec3 n=normalize(d);vec2 p=n.xz/(.6+max(n.y,0.))*4.;float h=smoothstep(-.06,.72,n.y);
      float cloud=noise(p)*.59+noise(p*2.1)*.3+noise(p*4.2)*.11;
      vec3 sky=mix(vec3(.065,.099,.152),vec3(.013,.021,.056),h);
      sky+=vec3(.026,.031,.043)*(cloud-.40)*2.9;
      gl_FragColor=vec4(sky,1.);
      #include <colorspace_fragment>
      }`
    }))
    scene.add(dome)
  }
  return target
}

function addWetLight(scene:T.Scene,x:number,z:number,width:number,depth:number,color:string,seed:number){
  const rand=seeded(seed)
  const map=texture(256,192,c=>{
    c.fillStyle=color
    for(let i=0;i<2100;i++){
      const t=rand(),px=(rand()+rand()+rand()-1.5)*(.62+.26*t)+.5
      const fall=Math.max(0,1-Math.abs(px-.5)*1.8)
      c.globalAlpha=(1-t)*(.16+rand()*.5)*fall
      c.fillRect(px*256,t*192,1+rand()*(4+9*t),.6+rand()*.8)
    }
  })
  const pool=new T.Mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({
    map,transparent:true,opacity:.56,depthWrite:false,blending:T.AdditiveBlending,
  }))
  pool.rotation.x=-Math.PI/2;pool.position.set(x,.026,z+depth/2);scene.add(pool)
}

/** The film is attached to the sloped glass, so it shifts against the scenery when the driver looks around. */
export function windscreen(cabin:T.Object3D){
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute([-.932,1.132,-1.267,.932,1.132,-1.267,.777,1.749,.078,-.777,1.749,.078],3))
  g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2))
  g.setIndex([0,1,2,0,2,3])
  const mat=new T.ShaderMaterial({uniforms:{time:{value:0}},side:T.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 v; uniform float time;
    float rand(vec2 p){return fract(sin(dot(p,vec2(17.13,93.7)))*43758.5453);}
    void main(){vec2 grid=v*vec2(94.,55.);vec2 cell=floor(grid);float a=rand(cell);
      if(a<.73) discard;
      vec2 p=fract(grid)-vec2(.24+.51*rand(cell+.7),.3+.34*rand(cell+5.));
      p.y+=.075*sin(time*(.25+a)+a*65.);
      vec2 q=p*vec2(1.,.75);float radius=.07+.098*rand(cell+3.);
      float d=length(q);float aa=max(fwidth(d),.016);
      float mask=1.-smoothstep(radius-aa,radius+aa,d);if(mask<.005)discard;
      float edge=smoothstep(radius*.4,radius,d);
      float gleam=clamp(dot(normalize(q+.0001),normalize(vec2(-.58,.81))),0.,1.)*edge;
      gl_FragColor=vec4(mix(vec3(.055,.09,.12),vec3(.76,.89,1.),gleam),mask*(.13+.45*gleam));
      #include <colorspace_fragment>
    }`})
  cabin.add(new T.Mesh(g,mat));return mat
}

export function weather(scene:T.Scene){
  const r=seeded(896),n=680,coords=new Float32Array(n*6),drops=new Float32Array(n*4)
  for(let i=0;i<n;i++){
    drops.set([(r()-.5)*46,r()*15,r()*43-24,.1+r()*.2],i*4)
  }
  const geo=new T.BufferGeometry(),attr=new T.BufferAttribute(coords,3)
  attr.setUsage(T.DynamicDrawUsage);geo.setAttribute('position',attr)
  const rain=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#d9edff',opacity:.29,transparent:true,depthWrite:false}))
  rain.frustumCulled=false;scene.add(rain)
  // Ring instances share one buffer and become visible only for their brief impact.
  const rings=new T.InstancedMesh(new T.RingGeometry(.85,1,16),new T.MeshBasicMaterial({color:'#a7c6db',transparent:true,opacity:.18,depthWrite:false}),76)
  const splashes=Array.from({length:rings.count},()=>[(r()-.5)*26,r()*23-11,r(),.85+r()*.7])
  const dummy=new T.Object3D();dummy.rotation.x=-Math.PI/2;rings.frustumCulled=false;scene.add(rings)
  return (t:number)=>{
    for(let i=0;i<n;i++){
      const a=i*4,b=i*6,y=((drops[a+1]-t*(5.7+drops[a+3]*8))%15+15)%15
      const x=drops[a]+(15-y)*.13
      coords[b]=x;coords[b+1]=y;coords[b+2]=drops[a+2];coords[b+3]=x+.038;coords[b+4]=y-drops[a+3];coords[b+5]=drops[a+2]
    }
    attr.needsUpdate=true
    splashes.forEach(([x,z,phase,speed],i)=>{
      const age=(t*.68*speed+phase)%1,s=age<.68?.018+age*.21:0
      dummy.position.set(x,.039,z);dummy.scale.set(s,s,1);dummy.updateMatrix();rings.setMatrixAt(i,dummy.matrix)
    })
    rings.instanceMatrix.needsUpdate=true
  }
}
