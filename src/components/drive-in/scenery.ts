import * as T from 'three'
import { ball, batch, box, face, glow, glowTexture, group, lettering, lit, part, rod, seeded, texture, type Parent } from './geometry'

const rng=seeded
const lamps=[[-13,-11],[12,-10],[-14,1],[14,5],[-12,12],[12,12]]
const projection={x:0,y:5.6,z:-16,w:14.4,h:7.35}

function sky(scene:T.Scene) {
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:`
    varying vec3 dir;
    void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `,fragmentShader:`
    varying vec3 dir;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(dir);float h=max(0.,d.y);
      vec2 p=d.xz/(.35+max(d.y,-.1))*vec2(3.,5.);
      float clouds=noise(p)*.54+noise(2.*p)*.29+noise(4.*p)*.12+noise(8.*p)*.05;
      vec3 col=mix(vec3(.085,.155,.228),vec3(.011,.025,.059),smoothstep(0.,.65,h));
      col=mix(col,vec3(.015,.035,.07),smoothstep(.36,.68,clouds)*.76);
      float halo=exp(-8.*length(d-vec3(-.42,.23,-.88)));
      col+=vec3(.09,.11,.13)*halo;
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`})
  scene.add(new T.Mesh(new T.SphereGeometry(118,36,16),skyMaterial))
}
function asphalt(p: Parent) {
  const r=rng(189),n=1536,size=52,px=(v:number)=>(v/size+.5)*n
  const tex=texture(n,n,c=>{
    c.fillStyle='#35444d';c.fillRect(0,0,n,n)
    for(let i=0;i<75000;i++){
      c.fillStyle=r()>.46?'rgba(128,158,173,.10)':'rgba(6,17,30,.19)'
      c.fillRect(r()*n,r()*n,1+r()*5,.6+r()*1.5)
    }
    for (let row=-12;row<=10;row+=6) {
      for(let x=-12;x<=12;x+=4){
        c.fillStyle='rgba(187,197,185,.54)';c.fillRect(px(x),px(row),2.8,116)
        c.fillRect(px(x)-8,px(row),18,3)
      }
    }
    const reflection=(wx:number,wz:number,length:number,width:number,color:string)=>{
      for(let i=0;i<850;i++){
        const t=r(),j=(r()+r()+r()-1.5)
        const x=px(wx)+j*(width+width*t)*n/size
        c.globalAlpha=(1-t)*(.13+r()*.46);c.fillStyle=color
        c.fillRect(x,px(wz+t*length),1+r()*12,.65+r()*2)
      }
      c.globalAlpha=1
    }
    lamps.forEach(([x,z])=>reflection(x,z,7,1.05,'#ffe2aa'))
    reflection(-10.5,-11,11,1.25,'#ff9c75');reflection(-9,7.9,4,1.8,'#ffa87d')
    reflection(8.5,-1,5,1,'#87dfd6')
    const floor=c.createLinearGradient(0,0,n,n)
    floor.addColorStop(0,'rgba(16,26,39,.12)');floor.addColorStop(.52,'rgba(87,123,138,.1)');floor.addColorStop(1,'rgba(22,24,45,.2)')
    c.fillStyle=floor;c.fillRect(0,0,n,n)
  })
  tex.anisotropy=4
  const ground=part(p,new T.PlaneGeometry(size,size),new T.MeshStandardMaterial({map:tex,roughness:.51,metalness:.18}),0,0,0)
  ground.rotation.x=-Math.PI/2
}
function forest(p: Parent) {
  const r=rng(760), shades=['#24454d','#385254','#284552','#314e4d','#465e59']
  for(let i=0;i<175;i++){
    let x=(r()-.5)*88,z=-22-r()*25
    if (i%3===0){x=(r()<.5?-1:1)*(17+r()*16);z=r()*45-22}
    const h=2+r()*6.8
    box(p,x,h*.26,z,.14,h*.52,.17,'#393f42')
    for(let j=0;j<3;j++){
      const mesh=part(p,new T.ConeGeometry(h*(.27-j*.06),h*(.57-j*.07),7),shades[(i+j)%5],x,h*(.4+.19*j),z)
      mesh.rotation.y=r()*1.8
    }
  }
  for(let i=0;i<45;i++){
    const x=(r()-.5)*94,z=-34-r()*15,w=1.4+r()*3,h=1+r()*5
    box(p,x,h/2,z,w,h,2.6,'#455464')
    for(let k=0;k<3;k++) if(r()>.26)box(p,x-w*.31+k*w*.31,h*.64,z+1.32,.17,.29,.03,lit(r()<.55?'#dcb788':'#889ba0'))
  }
  for(let i=0;i<14;i++){
    const x=-60+i*9, h=4+r()*10
    const m=part(p,new T.IcosahedronGeometry(1,0),'#506474',x,1,-62-r()*11)
    m.scale.set(10+r()*12,h,6)
  }
}
function booth(p: Parent, halo:T.Texture) {
  const g=group(p,-9,0,6)
  box(g,0,.12,0,4.7,.24,3.5,'#737b7d')
  box(g,0,1.35,0,4.15,2.55,2.85,'#ae6654')
  for(let x=-1.92;x<2;x+=.22) box(g,x,.58,1.441,.035,.85,.045,'#d89070')
  box(g,0,1.78,1.445,3.39,1.34,.04,lit('#573e39'))
  box(g,0,1.85,1.47,3.16,.99,.04,lit('#ab7760'))
  for(const x of [-1.57,1.57])box(g,x,1.75,1.54,.12,1.28,.15,'#f1c796')
  box(g,0,1.1,1.63,3.61,.13,.5,'#ebe6be')
  box(g,0,2.64,0,4.63,.21,3.32,'#4a696f')
  box(g,0,2.79,0,4.39,.13,3.13,'#7f9893')
  for(let i=0;i<13;i++) {
    const a=box(g,(i-6)*.323,2.46,1.64,.324,.13,.77,i%2?'#f0c5a1':'#bd7968');a.rotation.x=.13
  }
  box(g,0,3.14,.97,2.7,.7,.23,'#71494a')
  lettering(g,'TEAM',0,3.14,1.095,2.4,.51,'#ffe6bc','#744a49')
  for(const x of [-1.2,-.8,-.4,0,.4,.8,1.2])ball(g,x,2.84,1.13,.034,.034,.03,lit('#ffdeb1'))
  glow(g,halo,0,2.3,1.6,3,'#ffb377',.27)
  return g
}
function machine(p:Parent,halo:T.Texture) {
  const g=group(p,8.5,0,-1.65)
  box(g,0,.1,0,2.1,.2,1.65,'#747c77')
  box(g,0,1.25,0,1.53,2.34,1.16,'#588989')
  box(g,0,2.54,0,1.7,.41,1.27,'#b6c5b3')
  lettering(g,'VISION',0,2.54,.648,1.5,.37,'#c4ffdf','#315553')
  box(g,-.13,1.63,.59,.84,.71,.06,'#28454a')
  lettering(g,'ADMIT ONE',-.13,1.64,.637,.71,.35,'#bce5c7','#294c4d')
  box(g,-.15,.89,.61,.8,.12,.1,'#283b3b');ball(g,.52,1.19,.62,.084,.084,.045,lit('#ffcb74'))
  for(let i=0;i<6;i++)box(g,(i-2.5)*.15,.43,.594,.09,.17,.025,'#324b50')
  glow(g,halo,0,2.5,.66,1.8,'#a0fbd8',.32)
  return g
}
function marquee(p:Parent,halo:T.Texture) {
  const g=group(p,-10.35,0,-12.3);g.rotation.y=.17
  box(g,0,2,0,.22,4,.29,'#708086')
  box(g,.72,3.4,-.15,.19,6.8,.2,'#8d5656')
  box(g,-.35,4.98,0,3.95,1.34,.29,'#9b675a')
  const sign=texture(768,256,c=>{
    c.fillStyle='#183b46';c.fillRect(0,0,768,256)
    c.strokeStyle='#ffa886';c.lineWidth=8;c.strokeRect(9,9,750,238)
    c.textAlign='center';c.fillStyle='#ffcc96';c.font='600 37px Georgia';c.fillText('O U T   O F   O F F I C E',384,65)
    c.fillStyle='#ffe2aa';c.font='italic bold 122px Georgia';c.fillText('Drive-In',384,190)
    c.strokeStyle='#dc896e';c.lineWidth=2;c.beginPath();c.moveTo(95,211);c.lineTo(673,211);c.stroke()
  })
  face(g,-.35,4.98,.155,3.94,1.34,sign)
  box(g,-.13,4.02,0,2.7,.39,.18,'#43434b')
  lettering(g,'O P E N   L A T E',-.13,4.02,.099,2.54,.33,'#ffb390','#493c42')
  for(let i=0;i<9;i++)ball(g,-2.16+i*.46,5.71,.15,.045,.045,.04,lit('#ffdb9f'))
  glow(g,halo,-.4,5,.19,5,'#ff956b',.20)
}
function screenFrame(p:Parent) {
  const {w,h,z,y}=projection
  box(p,0,y,z-.19,w+.32,h+.32,.37,'#9ca8a6')
  box(p,0,y,z+.005,w+.1,h+.11,.04,'#293641')
  for(const x of [-5.7,-2.85,0,2.85,5.7]){
    box(p,x,1.15,z,.105,2.3,.14,'#84989d')
    rod(p,[x,.05,z-1.5],[x,2.3,z],.055,'#677779')
    if(x<5.7)rod(p,[x,.09,z],[x+2.85,2.05,z],.046,'#758487')
  }
  box(p,0,1.58,z+.05,6.1,.38,.16,'#273e46')
  lettering(p,'O U T   O F   O F F I C E     /     C I N E M A',0,1.58,z+.14,5.85,.27,'#ccdfd5','#243a44')
}
export function buildLot(scene:T.Scene) {
  sky(scene); scene.fog=new T.FogExp2('#465965',.018)
  scene.add(new T.HemisphereLight('#d6e8fc','#829092',1.47))
  const moon=new T.DirectionalLight('#d1e5ff',1.85);moon.position.set(-12,24,-11);scene.add(moon)
  const warm=new T.DirectionalLight('#ffc59e',.58);warm.position.set(0,9,13);scene.add(warm)
  const lot=group(scene),halo=glowTexture()
  asphalt(lot);forest(lot);marquee(lot,halo);screenFrame(lot)
  const team=booth(lot,halo),vision=machine(lot,halo)
  for(const [x,z] of lamps){
    const side=Math.sign(x)
    box(lot,x,.22,z,.43,.44,.44,'#7a8782');rod(lot,[x,0,z],[x,4.9,z],.077,'#708592')
    rod(lot,[x,4.75,z],[x-side*.69,5.03,z],.054,'#7d909b')
    box(lot,x-side*.77,5.01,z,.51,.13,.36,'#405065')
    box(lot,x-side*.77,4.932,z,.41,.035,.28,lit('#ffe4b1'))
    glow(lot,halo,x-side*.77,4.91,z,2.6,'#ffce90')
  }
  for(const z of [-15,12.8])for(let x=-14;x<15;x+=2.8) {
    box(lot,x,.4,z,.1,.8,.11,'#849293')
    if(x<13)box(lot,x+1.4,.57,z,2.8,.083,.1,'#7c8d90')
  }
  for(const side of [-1,1])for(let z=-14;z<=12;z+=3) {
    box(lot,side*14.8,.46,z,.13,.92,.13,'#81948f')
    box(lot,side*14.8,.65,z+1.5,.085,.1,3,'#768987')
  }
  // Utility lines sag between timber poles at the back of the screening field.
  for(let i=0;i<5;i++){
    const x=-33+i*15,z=-23.5
    box(lot,x,3.7,z,.22,7.4,.24,'#4f5456');box(lot,x,7.05,z,2.3,.12,.14,'#647178')
    for(const offset of [-.84,.84]){
      let last=[x+offset,7.15,z]
      for(let j=1;j<=6 && i<4;j++){
        const t=j/6,next=[x+offset+15*t,7.15-2.4*t*(1-t),z]
        rod(lot,last,next,.021,'#374855',4);last=next
      }
    }
  }
  for(let i=0;i<18;i++){
    const x=-14+i*1.63,y=3.2+.67*Math.pow((i-8.5)/8.5,2)
    if(i<17)rod(lot,[x,y,-14.8],[x+1.63,3.2+.67*Math.pow((i+1-8.5)/8.5,2),-14.8],.017,'#455458')
    if(Math.abs(x)>7.5){ball(lot,x,y-.1,-14.8,.065,.089,.065,lit('#ffce92'));glow(lot,halo,x,y-.1,-14.8,.65,'#ffb786')}
  }
  batch(lot)
  return {team,vision,projection}
}
