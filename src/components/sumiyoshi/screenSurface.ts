import * as T from 'three'

/** Place a native, scrollable document flush against the four corners of the physical TV. */
export function screenSurface(screen:T.Mesh<T.PlaneGeometry>,camera:T.PerspectiveCamera){
  const {width,height}=screen.geometry.parameters
  const clip=new T.Matrix4(),previousClip=new T.Matrix4()
  const corner=new T.Vector4()
  const origin=new T.Vector3(),right=new T.Vector3(),bottom=new T.Vector3()
  let element:HTMLElement|null=null
  let previousTransform='',previousWidth=0,viewportWidth=0,viewportHeight=0
  function project(x:number,y:number,w:number,h:number,out:T.Vector3){
    corner.set(x,y,0,1).applyMatrix4(clip)
    // Retain the homogeneous divisor for CSS perspective during the camera move.
    out.set((corner.x+corner.w)*w/2,(corner.w-corner.y)*h/2,corner.w)
  }
  return {
    get attached(){return element!==null},
    attach(next:HTMLElement|null){
      if(element&&element!==next){
        for(const property of ['width','height','transform','visibility'])element.style.removeProperty(property)
      }
      element=next;previousTransform='';previousWidth=0;viewportWidth=0
    },
    place(w:number,h:number){
      if(!element)return
      camera.updateMatrixWorld()
      screen.updateWorldMatrix(true,false)
      clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(screen.matrixWorld)
      if(viewportWidth===w&&viewportHeight===h&&previousClip.equals(clip))return
      viewportWidth=w;viewportHeight=h;previousClip.copy(clip)
      project(-width/2,height/2,w,h,origin);project(width/2,height/2,w,h,right);project(-width/2,-height/2,w,h,bottom)
      if(Math.min(origin.z,right.z,bottom.z)<=0){element.style.visibility='hidden';return}
      const cssWidth=Math.max(1,Math.round(Math.hypot(right.x/right.z-origin.x/origin.z,right.y/right.z-origin.y/origin.z)))
      const cssHeight=cssWidth*height/width
      right.sub(origin).multiplyScalar(1/(cssWidth*origin.z));bottom.sub(origin).multiplyScalar(1/(cssHeight*origin.z))
      const transform='matrix3d('+[right.x,right.y,0,right.z,bottom.x,bottom.y,0,bottom.z,0,0,1,0,origin.x/origin.z,origin.y/origin.z,0,1].map(n=>Number(n.toFixed(9))).join(',')+')'
      if(cssWidth!==previousWidth){element.style.width=cssWidth+'px';element.style.height=cssHeight+'px';previousWidth=cssWidth}
      if(transform!==previousTransform){element.style.transform=transform;previousTransform=transform}
      element.style.visibility='visible'
    },
  }
}
