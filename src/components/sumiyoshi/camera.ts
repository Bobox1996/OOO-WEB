import * as T from 'three'
import { forestCenterX, forestEntranceX, npcPositions, type Area, type Point } from './world'

export type Mode='seated'|'focus'|'walk'|'talk'|'vendor'|'bottle'
export type View={area:Area;mode:Mode;member:number}
export const opening:View={area:'home',mode:'seated',member:0}

export function cameraDirector(camera:T.PerspectiveCamera){
  const eye=new T.Vector3(),aim=new T.Vector3(),target=new T.Vector3()
  let snap=true,high=false,railX=0,onRail=false
  return {
    cut(){snap=true}, elevation(){high=!high},
    get elevated(){return high},
    frame(view:View,player:Point,dt:number,reduced:boolean,reading=false,rasterWidth=960){
      const {area,mode,member}=view,{x,z}=player
      const a=camera.aspect,portrait=a<.87
      let fov=48
      const alongStreet=area==='street'&&mode==='walk'&&!high
      if(mode==='seated'){
        // From the seated eye, leave a wider strip of the planted window on the phone.
        eye.set(portrait?.14:-2.25,portrait?1.55:1.87,portrait?3.79:3.85)
        aim.set(portrait?-.13:0,portrait?.93:1.38,-2.45)
        fov=portrait?T.MathUtils.radToDeg(2*Math.atan(2.77/(6.24*a))):48
      }else if(mode==='focus'){
        // A first-person lean toward the set. The entire display and a leafy margin stay in frame.
        const widthFraction=reading&&portrait?.92:.80
        // A portrait lens opens wider at the sofa, staying inside the rear wall.
        const dist=portrait?4.35:1.66/(Math.tan(T.MathUtils.degToRad(21.5))*a*widthFraction)
        const vfov=portrait?T.MathUtils.radToDeg(2*Math.atan(1.66/(dist*a*widthFraction))):43
        eye.set(.0,1.58,-2.4+Math.max(dist,2.80));aim.set(0,1.59,-2.4);fov=vfov
      }else if(mode==='talk'){
        const p=npcPositions[member],side=member===0||member===1?1:member===5?1:-1
        const dz=member<2?.05:1.55
        eye.set(p.x+side*(member<2?2.24:1.34),1.65,p.z+dz)
        aim.set(p.x,portrait?1.38:1.47,p.z);fov=portrait?55:43
      }else if(mode==='vendor'||mode==='bottle'){
        eye.set(8.25,1.58,portrait?3.95:3.12);aim.set(8.1,1.26,.15);fov=portrait?49:43
      }else if(area==='street'){
        if(high){
          const d=Math.max(29,26/(a*Math.tan(T.MathUtils.degToRad(21))))
          if(portrait){
            eye.set(x*.93,10.5,19.8);aim.set(x*.93,1.7,-.3);fov=58
          }else{
            eye.set(.06*x,d*.47,1+d*.88);aim.set(0,1.65,-.3);fov=42
          }
        }else{
          // Parallel tracking keeps the shopfront, the walker and their reflections in registration.
          const span=portrait?8.65:15.6,depth=15.8+(z-2.5)*.07
          const smooth=snap||!onRail||reduced?1:1-Math.exp(-dt*7.5)
          // At the recessed entrance, leave both outer jambs of Forest-Wanna-Be in shot.
          const atForest=1-T.MathUtils.smoothstep(Math.abs(x-forestEntranceX),.25,3.3)
          const center=x+atForest*(forestCenterX-forestEntranceX)
          railX+=(center-railX)*smooth
          const pitch=span/Math.max(rasterWidth,1)
          const column=Math.round(railX/pitch)*pitch
          eye.set(column,portrait?2.25:2.15,depth)
          aim.set(column,portrait?3.25:2.80,0)
          fov=T.MathUtils.radToDeg(2*Math.atan(span/(2*depth*a)))
        }
      }else{
        const home=area==='home'
        if(high){
          eye.set(x*.62,portrait?11:9.4,z*.47+(home?6.7:8.0))
          aim.set(x*.75,.63,z*.57-.57);fov=portrait?60:51
        }else{
          const depth=home?6.6:7.15
          eye.set(x*.67+(portrait?.16:.62),portrait?2.45:2.30,depth+z*.41)
          aim.set(x*.73-(portrait?0:.25),portrait?1.18:1.23,z*.40-1.35)
          fov=portrait?63:46
        }
      }
      const t=snap||reduced?1:1-Math.exp(-dt*6.8)
      camera.position.lerp(eye,t);target.lerp(aim,t)
      if(alongStreet){camera.position.x=eye.x;target.x=aim.x}
      onRail=alongStreet
      camera.lookAt(target)
      camera.fov=T.MathUtils.lerp(camera.fov,T.MathUtils.clamp(fov,16,94),t);camera.updateProjectionMatrix();snap=false
    },
  }
}
