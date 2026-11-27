import { MathUtils, Vector3 } from 'three/webgpu';
import { EnvironmentState } from './types';
export interface WeatherFrame { daylight:number; twilight:number; night:number; storm:number; overcast:number; snow:number; inversion:number; sun:Vector3; }
const smooth = (a:number,b:number,x:number) => MathUtils.smoothstep(x,a,b);
export class WeatherSystem {
  state:EnvironmentState;
  frame:WeatherFrame={daylight:0,twilight:0,night:0,storm:0,overcast:0,snow:0,inversion:0,sun:new Vector3()};
  constructor(initial:EnvironmentState){this.state={...initial};this.update(100,initial);}
  update(dt:number,target:EnvironmentState){
    const a=1-Math.exp(-dt*1.3),w=1-Math.exp(-dt*.55);
    for(const key of ['windSpeed','cloudDensity','cloudAltitude','snowCoverage','visibility','exposure','fov'] as const) this.state[key]=MathUtils.lerp(this.state[key],target[key],a);
    this.state.windDirection=(this.state.windDirection+((target.windDirection-this.state.windDirection+540)%360-180)*a+360)%360;
    // Circular interpolation avoids a noon detour when moving across midnight.
    let delta=(target.time-this.state.time+36)%24-12;
    this.state.time=(this.state.time+delta*a+24)%24;
    this.state.weather=target.weather;this.state.quality=target.quality;this.state.paused=target.paused;this.state.sound=target.sound;
    const f=this.frame,angle=(this.state.time-6)/24*Math.PI*2;
    f.sun.set(Math.cos(angle)*-.78,Math.sin(angle),Math.cos(angle)*.62).normalize();
    f.daylight=smooth(-.10,.22,f.sun.y);
    f.night=1-smooth(-.26,-.035,f.sun.y);
    f.twilight=(1-smooth(.05,.4,Math.abs(f.sun.y)))*(1-f.night);
    f.storm=MathUtils.lerp(f.storm,target.weather==='Snowstorm'?1:0,w);
    f.overcast=MathUtils.lerp(f.overcast,['Overcast','Snowfall','Snowstorm'].includes(target.weather)?1:0,w);
    f.snow=MathUtils.lerp(f.snow,target.weather==='Snowstorm'?1:target.weather==='Snowfall'?.45:0,w);
    f.inversion=MathUtils.lerp(f.inversion,target.weather==='Cloud Inversion'?1:0,w);
  }
}
