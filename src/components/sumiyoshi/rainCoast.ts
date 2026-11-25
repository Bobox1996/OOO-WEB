import * as T from 'three'
import { seeded } from '../drive-in/geometry'
import marinePainting from '../../../art/pixelscape/house/rain-coast.png'

// The glass is at z=-3.76 m. Rays through the opening intersect a water plane
// below the house, so the near swell moves past the sill while the horizon holds.
const waterLevel = -.74
const ink = `
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), w = fract(p);
    w = w*w*(3.-2.*w);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),w.x),
               mix(hash(i+vec2(0.,1.)),hash(i+1.),w.x), w.y);
  }
  vec3 linearInk(vec3 s) {
    return mix(s/12.92, pow((s+.055)/1.055,vec3(2.4)), step(.04045,s));
  }
  vec3 coastInk(vec3 paint) {
    float value=clamp(dot(paint,vec3(.2126,.7152,.0722)),0.,1.);
    // Group the painted washes from midnight blue through slate to pearl.
    // Keep some source chroma for the warm cloud break above the horizon.
    float band=floor(value*16.+.5)/16.;
    vec3 slate=vec3(.43,.50,.59);
    vec3 ramp=mix(vec3(.04,.08,.14),slate,min(1.,2.*band));
    ramp=mix(ramp,vec3(.94,.94,.91),max(0.,2.*band-1.));
    return mix(ramp,paint+vec3(band-value),.49);
  }
`

function seaWindow(clock: {value: number}) {
  const material = new T.ShaderMaterial({
    toneMapped: false,
    uniforms: {time: clock, painting:{value:null}, hasPainting:{value:false}},
    vertexShader: `
      varying vec3 windowPoint;
      void main() {
        windowPoint=(modelMatrix * vec4(position,1.)).xyz;
        gl_Position=projectionMatrix * viewMatrix * vec4(windowPoint,1.);
      }`,
    fragmentShader: `
      uniform float time;
      uniform bool hasPainting;
      uniform sampler2D painting;
      varying vec3 windowPoint;
      ${ink}
      vec3 quietSea(float bearing, float altitude) {
        vec2 p=vec2(bearing*5.,altitude*35.);
        float air=.58*noise(p)+.27*noise(2.3*p+19.)+.15*noise(4.1*p+4.);
        vec3 sky=mix(vec3(.58,.67,.72),vec3(.29,.37,.47),
                     smoothstep(0.,.18,altitude + .11*(air-.5)));
        float facet=noise(vec2(bearing*20.,altitude*510.-time*.32));
        vec3 sea=mix(vec3(.24,.38,.44),vec3(.47,.56,.63),exp(6.*min(0.,altitude)));
        sea+=vec3(.09)*smoothstep(.41,.78,facet)*smoothstep(.006,.12,-altitude);
        return mix(sea,sky,smoothstep(-.001,.001,altitude));
      }

      float rainImpact(vec2 p, float range) {
        vec2 grid=p*1.1, cell=floor(grid);
        float seed=hash(cell), age=fract(time*.63+seed*13.);
        vec2 at=vec2(.27+.46*hash(cell+8.),.27+.46*hash(cell+21.));
        float radius=length(fract(grid)-at);
        float width=clamp(fwidth(radius),.013,.1);
        float ring=1.-smoothstep(.014,.014+width,abs(radius-age*.30));
        return ring*(1.-age)*step(.74,seed)*smoothstep(.08,.27,age)*(1.-smoothstep(12.,29.,range));
      }

      float panoramaEdge(float u) {
        // A grazing look through the side of the window keeps the same sky
        // break and island instead of mirroring the panorama at the glass edge.
        if(u<.10) return .10*exp((u-.10)*10.);
        if(u>.90) return 1.-.10*exp((.90-u)*10.);
        return u;
      }

      vec3 paintedCoast(vec3 ray, float altitude) {
        // The horizon of the 2172 x 724 painted study is on row 351.
        // A cylindrical sky meets a water-plane projection of that same image.
        // A walk toward the glass therefore changes the near waves' apparent size.
        vec3 direction=ray;
        vec2 water=vec2(0.);
        float proximity=0., range=4000.;
        if(altitude<0.) {
          range=min(4000.,(cameraPosition.y-(${waterLevel}))/max(-ray.y,.0001));
          vec3 surface=cameraPosition+ray*range;
          direction=normalize(surface-vec3(-1.09,1.73,3.89));
          water=surface.xz;
          proximity=(1.-smoothstep(35.,165.,range))*smoothstep(.001,.021,-altitude);
        }
        float a=asin(direction.y);
        vec2 uv=vec2(panoramaEdge(.245+atan(direction.x,-direction.z)/1.04),
                     panoramaEdge(.515+1.86*a));
        float swell=.47*water.y+.15*water.x;
        float crossSea=.28*water.y-.33*water.x;
        uv+=proximity*vec2(.0018*sin(swell+.70*time)+.0008*sin(crossSea-.38*time),
                           .0029*sin(swell*.81+.58*time)+.0011*cos(crossSea+.74*time));
        uv.x+=smoothstep(.005,.11,altitude)*.018*sin(time*.021);
        // Average fine brushwork before grouping the values. At the back of
        // the room neighbouring whitecaps read as short connected strokes.
        vec3 paint=texture2D(painting,uv,.80).rgb;
        if(altitude<0.) {
          // A sparkle travels down the already painted silver lip of a wave;
          // its shaded face stays deep blue. Distant facets merge in the haze.
          float silver=smoothstep(.42,.78,paint.g);
          float flash=sin(.8*water.x+water.y*1.37+time*1.38);
          float filtered=1.-smoothstep(.55,2.4,fwidth(swell));
          float crest=smoothstep(.38,.72,flash);
          paint+=silver*proximity*filtered*crest*vec3(.043,.049,.052);
          paint+=vec3(.066,.084,.091)*rainImpact(water,range);
        }
        return paint;
      }

      void main() {
        vec3 ray=normalize(windowPoint-cameraPosition);
        float bearing=atan(ray.x,-ray.z);
        float altitude=asin(ray.y);
        vec3 color=coastInk(hasPainting ? paintedCoast(ray,altitude) : quietSea(bearing,altitude));

        // Beads adhere to the outer pane. A few creep along the same tracks,
        // picking up a silver lower rim and a dark, refracted upper edge.
        vec3 glass=cameraPosition+ray*((-3.78-cameraPosition.z)/min(-.001,ray.z));
        vec2 pane=glass.xy*vec2(7.7,5.2);
        vec2 cell=floor(pane), st=fract(pane);
        float salt=hash(cell);
        float slide=smoothstep(.24,.91,fract(time*.044+salt))*.46*step(.86,salt);
        vec2 bead=vec2(.15+.69*hash(cell+11.),.73-slide);
        vec2 local=(st-bead)*vec2(1.,.60);
        float size=.019+.024*hash(cell+7.);
        float aa=max(.007,fwidth(length(local))*.66);
        float drop=(1.-smoothstep(size-aa,size+aa,length(local)))*step(.74,salt);
        float edge=1.-smoothstep(.09,.85,abs(glass.x-1.4)/4.);
        color+=vec3(.10,.12,.13)*drop*(.85-.24*edge)*(-sign(local.y));
        gl_FragColor=vec4(linearInk(clamp(color,0.,1.)),1.);
        #include <colorspace_fragment>
      }`,
  })
  const window = new T.Mesh(new T.PlaneGeometry(11,4.8),material)
  window.name='Rain coast | offshore water and cloud shelves'
  window.position.set(1.35,1.70,-4.02)
  // The traced horizon extends past the camera far plane; hardware depth is
  // reserved for the actual room, exterior rain and independent harbour skiff.
  material.depthWrite=false
  window.renderOrder=-100
  return window
}

function rainCurtain(clock: {value: number}) {
  const random=seeded(7419), count=480
  const positions=new Float32Array(count*6), streaks=new Float32Array(count*6)
  for(let i=0;i<count;i++) {
    const x=(random()-.5)*22, y=random()*7, z=-4.07-random()*11
    const length=.055+.069*random(), speed=3.4+random()*2.8
    for(let j=0;j<2;j++) {
      const v=(2*i+j)*3
      positions.set([x,y,z],v)
      streaks.set([length,speed,j],v)
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.BufferAttribute(positions,3))
  geometry.setAttribute('streak',new T.BufferAttribute(streaks,3))
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,uniforms:{time:clock},
    vertexShader:`
      attribute vec3 streak;
      uniform float time;
      varying float strength;
      void main(){
        vec3 p=position;
        p.y=mod(p.y-time*streak.y,7.)-.80;
        p.x+=(7.-p.y)*.13+streak.x*streak.z*.13;
        p.y-=streak.x*streak.z;
        strength=(.09+.16*(1.-streak.z))*smoothstep(-.79,-.48,p.y);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`
      varying float strength;
      void main(){
        gl_FragColor=vec4(.48,.62,.72,strength);
        #include <colorspace_fragment>
      }`,
  })
  const rain=new T.LineSegments(geometry,material)
  rain.name='Salt rain | lee of the eave'
  rain.frustumCulled=false
  return rain
}

function harbourBoat() {
  // 48 texels resolve to only a few strokes from the sofa. The lit wheelhouse
  // fixes both the scale of the water and the height of the far horizon.
  const canvas=document.createElement('canvas')
  canvas.width=48;canvas.height=16
  const c=canvas.getContext('2d')!
  c.fillStyle='#51616b';c.fillRect(6,10,34,2);c.fillRect(11,12,22,1)
  c.fillRect(36,9,6,1);c.fillRect(8,9,3,1)
  c.fillStyle='#647582';c.fillRect(19,7,11,3);c.fillRect(16,6,15,1)
  c.fillStyle='#ccc1a2';c.fillRect(24,7,3,2)
  c.fillStyle='#73808b';c.fillRect(18,3,1,4);c.fillRect(21,4,1,2)
  c.fillStyle='#9daaad';c.fillRect(17,3,2,1)
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter
  const material=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false})
  const skiff=new T.Mesh(new T.PlaneGeometry(2.55,.85),material)
  skiff.name='Offshore skiff | cabin light'
  skiff.position.set(.7,waterLevel+.22,-50.)
  return skiff
}

export function rainCoast(scene: T.Scene) {
  const clock={value:0}
  const window=seaWindow(clock), rain=rainCurtain(clock), skiff=harbourBoat()
  const url=typeof marinePainting==='string'?marinePainting:marinePainting.src
  let disposed=false
  const ready=new T.TextureLoader().loadAsync(url).then(texture=>{
    if(disposed){texture.dispose();return}
    // The shader grades the artist's sRGB swatches before converting to linear.
    texture.colorSpace=T.NoColorSpace
    texture.magFilter=T.NearestFilter
    texture.minFilter=T.LinearMipmapLinearFilter
    texture.needsUpdate=true
    window.material.uniforms.painting.value=texture
    window.material.uniforms.hasPainting.value=true
  }).catch(()=>{ /* The procedural sea is fully playable if image decoding fails. */ })
  scene.add(window,skiff,rain)
  return {
    ready,
    update(seconds: number) { clock.value=Math.floor(seconds*12)/12 },
    dispose() {
      disposed=true
      window.material.uniforms.painting.value?.dispose()
      scene.remove(window,rain,skiff)
      window.geometry.dispose();window.material.dispose()
      rain.geometry.dispose();rain.material.dispose()
      skiff.material.map?.dispose();skiff.geometry.dispose();skiff.material.dispose()
    },
  }
}
