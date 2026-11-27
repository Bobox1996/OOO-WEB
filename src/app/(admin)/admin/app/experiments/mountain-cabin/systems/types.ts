export type WeatherKind = 'Clear' | 'Overcast' | 'Snowfall' | 'Snowstorm' | 'Cloud Inversion';
export type CameraMode = 'Cabin' | 'Orbit' | 'First Person' | 'Landscape';
export type Quality = 'Low' | 'Medium' | 'High' | 'Ultra';
export interface EnvironmentState { time: number; weather: WeatherKind; windSpeed: number; windDirection: number; cloudDensity: number; cloudAltitude: number; snowCoverage: number; visibility: number; exposure: number; fov: number; quality: Quality; paused: boolean; sound: boolean; seed: number; autoTime: boolean; }
export const INITIAL_STATE: EnvironmentState = {time:18.25,weather:'Cloud Inversion',windSpeed:4.5,windDirection:245,cloudDensity:.78,cloudAltitude:2400,snowCoverage:.86,visibility:28,exposure:1.1,fov:52,quality:'High',paused:false,sound:false,seed:4812,autoTime:false};
export const QUALITY: Record<Quality,{pixelRatio:number; terrain:number; trees:number; particles:number; shadow:number; clouds:number}> = {Low:{pixelRatio:1,terrain:64,trees:900,particles:900,shadow:1024,clouds:3},Medium:{pixelRatio:1.25,terrain:96,trees:2200,particles:2400,shadow:1024,clouds:5},High:{pixelRatio:1.5,terrain:128,trees:4200,particles:5000,shadow:2048,clouds:7},Ultra:{pixelRatio:2,terrain:160,trees:6500,particles:8500,shadow:4096,clouds:9}};
export const SITE_ELEVATION = 3086;
export interface RuntimeStats {fps:number; backend:string; loading:boolean; error?:string;}
export interface EnvironmentActions {setState:(patch:Partial<EnvironmentState>)=>void; setCamera:(mode:CameraMode)=>void; reset:()=>void; capture:()=>void;}
