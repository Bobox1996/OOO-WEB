import { useState, type ReactNode } from 'react';
import type { CameraMode, EnvironmentState, Quality, RuntimeStats, WeatherKind } from './types';
import { SITE_ELEVATION } from './types';
import styles from '../environment.module.css';

export type MoveDirection = 'forward' | 'backward' | 'left' | 'right';
interface Props {
  state: EnvironmentState; camera: CameraMode; stats: RuntimeStats; photography: boolean;
  onChange: (patch: Partial<EnvironmentState>) => void; onCamera: (mode: CameraMode) => void;
  onPhoto: () => void; onReset: () => void; onCapture: () => void; onFullscreen: () => void;
  onMove: (direction: MoveDirection, pressed: boolean) => void; notice: string;
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    mountain: <><path d="m2 18 7-12 4 7 3-5 6 10H2Z"/><path d="m6 11 3 2 2-3m3 2 2 2 2-2"/></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v6m8 0v6M10 15v6"/></>,
    cabin: <><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M8 21v-9h8v9M3 10h18"/></>,
    orbit: <><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="2"/><path d="m18 3 3 2-1 4"/></>,
    walk: <><circle cx="14" cy="4" r="2"/><path d="m9 22 3-7-2-4 3-4 3 5 4 1M4 13l4-2 2-4m2 8 5 7"/></>,
    landscape: <><path d="M3 5h18v14H3zM3 15l6-6 6 10m-3-5 4-4 5 5"/><circle cx="17" cy="8" r="1"/></>,
    camera: <><path d="M3 7h4l2-3h6l2 3h4v14H3V7Z"/><circle cx="12" cy="13" r="4"/></>,
    fullscreen: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></>,
    sound: <><path d="m10 4-5 5H2v6h3l5 5V4Z"/><path d="M14 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></>,
    mute: <><path d="m10 4-5 5H2v6h3l5 5V4Z"/><path d="m15 9 6 6m0-6-6 6"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    play: <path d="m7 4 13 8-13 8V4Z"/>,
    reset: <><path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/></>,
    random: <><path d="m3 7 4 0 10 10h4M3 17h4L17 7h4m-4-4 4 4-4 4m0 2 4 4-4 4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    wind: <><path d="M3 8h12c5 0 4-6 1-4M3 12h15c5 0 5 7 1 6M3 16h7c4 0 3 5 0 4"/></>,
    arrow: <path d="m5 15 7-7 7 7"/>,
    check: <path d="m5 12 4 4 10-10"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.mountain}</svg>;
}

export const formatTime = (time: number) => {
  const minutes = Math.floor(((time % 24) + 24) % 24 * 60);
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
};

function Slider({ label, value, min, max, step = 1, display, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (n: number) => void;
}) {
  return <label className={styles.slider}><span>{label}<output>{display}</output></span><input aria-label={label} aria-valuetext={display} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/></label>;
}

const cameras: { mode: CameraMode; icon: string; label: string }[] = [
  { mode: 'Cabin', icon: 'cabin', label: 'Cabin' }, { mode: 'Orbit', icon: 'orbit', label: 'Orbit' },
  { mode: 'First Person', icon: 'walk', label: 'Explore' }, { mode: 'Landscape', icon: 'landscape', label: 'Landscape' },
];
const moments: { name: string; time: number; weather: WeatherKind; cloudDensity: number; visibility: number }[] = [
  { name: 'First light', time: 7.15, weather: 'Clear', cloudDensity: .3, visibility: 28 },
  { name: 'Daylight', time: 12.5, weather: 'Clear', cloudDensity: .18, visibility: 30 },
  { name: 'Alpenglow', time: 17.1, weather: 'Clear', cloudDensity: .38, visibility: 26 },
  { name: 'Blue hour', time: 18.5, weather: 'Clear', cloudDensity: .44, visibility: 24 },
  { name: 'Starlight', time: 23, weather: 'Clear', cloudDensity: .12, visibility: 30 },
  { name: 'White silence', time: 11.5, weather: 'Snowstorm', cloudDensity: .95, visibility: 2 },
];

export function EnvironmentUI(props: Props) {
  const { state, camera, stats, photography, onChange, onCamera, onPhoto, onReset, onCapture, onFullscreen, onMove, notice } = props;
  const [panel, setPanel] = useState(false);
  const temperature = Math.round(-11 + 5 * Math.cos((state.time - 14) / 12 * Math.PI) - (state.weather === 'Snowstorm' ? 5 : 0));
  const weatherPreset = (weather: WeatherKind) => {
    const patch: Partial<EnvironmentState> = { weather };
    if (weather === 'Snowstorm') Object.assign(patch, { windSpeed: 18, visibility: 1.8, cloudDensity: .96 });
    if (weather === 'Snowfall') Object.assign(patch, { windSpeed: 6, visibility: 7, cloudDensity: .8 });
    if (weather === 'Cloud Inversion') Object.assign(patch, { windSpeed: 4.5, visibility: 28, cloudDensity: .82, cloudAltitude: 2400 });
    if (weather === 'Clear') Object.assign(patch, { windSpeed: 4.5, visibility: 30, cloudDensity: .22 });
    if (weather === 'Overcast') Object.assign(patch, { windSpeed: 7, visibility: 14, cloudDensity: .85 });
    onChange(patch);
  };
  if (photography) return <button type="button" className={styles.exitPhoto} onClick={onPhoto} aria-label="Exit photography mode"><Icon name="close" size={14}/><span>Exit · Esc</span></button>;
  return <div className={styles.interface}>
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.eyebrow}><Icon name="mountain" size={22}/><span><a className={styles.backLink} href="/admin/app" aria-label="Back to OOO experiments">OUT OF OFFICE</a> <span className={styles.separator}>/</span> ALPINE STUDIES</span></div>
        <h1>Mountain Cabin<span className={styles.titleDot}>.</span></h1>
        <p>A small place in a vast world.</p>
      </div>
      <div className={styles.topActions}>
        <button className={styles.iconButton} type="button" title={state.sound ? 'Turn sound off' : 'Turn sound on'} aria-label={state.sound ? 'Turn sound off' : 'Turn sound on'} aria-pressed={state.sound} onClick={() => onChange({ sound: !state.sound })}><Icon name={state.sound ? 'sound' : 'mute'}/></button>
        <button className={styles.iconButton} type="button" title="Photography mode · P" aria-label="Photography mode" onClick={onPhoto}><Icon name="camera"/></button>
        <button className={`${styles.settingsButton} ${panel ? styles.selected : ''}`} type="button" aria-label="Environment" aria-expanded={panel} aria-controls="environment-controls" onClick={() => setPanel(!panel)}><Icon name={panel ? 'close' : 'settings'}/><span>Environment</span></button>
      </div>
    </header>

    {panel && <aside className={styles.panel} id="environment-controls" aria-label="Environment controls">
      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>MAKE IT YOUR MOMENT</span><h2>The atmosphere</h2></div><button className={styles.iconButton} type="button" aria-label="Close environment controls" onClick={() => setPanel(false)}><Icon name="close" size={16}/></button></div>
      <div className={styles.panelBody}>
        <div className={styles.sectionLabel}>LIGHT & TIME</div>
        <Slider label="Time of day" value={state.time} min={0} max={23.99} step={.01} display={formatTime(state.time)} onChange={time => onChange({ time, autoTime: false })}/>
        <div className={styles.moments}>{moments.map(moment => <button key={moment.name} type="button" className={Math.abs(state.time - moment.time) < .1 && state.weather === moment.weather ? styles.momentActive : ''} onClick={() => onChange({ time: moment.time, weather: moment.weather, cloudDensity: moment.cloudDensity, visibility: moment.visibility, windSpeed: moment.weather === 'Snowstorm' ? 18 : 4.5, autoTime: false })}>{moment.name}</button>)}</div>
        <label className={styles.switchRow}><span>Let the day unfold<small>One day in 16 minutes</small></span><input type="checkbox" checked={state.autoTime} onChange={e => onChange({ autoTime: e.target.checked })}/><span className={styles.switch} aria-hidden="true"/></label>
        <div className={styles.rule}/>
        <label className={styles.selectLabel}><span>Weather</span><select aria-label="Weather" value={state.weather} onChange={e => weatherPreset(e.target.value as WeatherKind)}>{(['Clear', 'Overcast', 'Snowfall', 'Snowstorm', 'Cloud Inversion'] as WeatherKind[]).map(weather => <option key={weather}>{weather}</option>)}</select></label>
        <Slider label="Wind speed" value={state.windSpeed} min={0} max={25} step={.5} display={`${state.windSpeed.toFixed(1)} m/s`} onChange={windSpeed => onChange({ windSpeed })}/>
        <Slider label="Wind direction" value={state.windDirection} min={0} max={360} display={`${state.windDirection}°`} onChange={windDirection => onChange({ windDirection })}/>
        <Slider label="Cloud density" value={state.cloudDensity} min={0} max={1} step={.01} display={`${Math.round(state.cloudDensity * 100)}%`} onChange={cloudDensity => onChange({ cloudDensity })}/>
        <Slider label="Cloud altitude" value={state.cloudAltitude} min={1600} max={3700} step={25} display={`${state.cloudAltitude.toLocaleString()} m`} onChange={cloudAltitude => onChange({ cloudAltitude })}/>
        <Slider label="Snow coverage" value={state.snowCoverage} min={0} max={1} step={.01} display={`${Math.round(state.snowCoverage * 100)}%`} onChange={snowCoverage => onChange({ snowCoverage })}/>
        <Slider label="Visibility" value={state.visibility} min={.3} max={35} step={.1} display={`${state.visibility.toFixed(1)} km`} onChange={visibility => onChange({ visibility })}/>
        <details className={styles.details}><summary>Camera & rendering<span>+</span></summary>
          <Slider label="Field of view" value={state.fov} min={30} max={85} display={`${state.fov}°`} onChange={fov => onChange({ fov })}/>
          <Slider label="Exposure" value={state.exposure} min={.45} max={1.8} step={.05} display={state.exposure.toFixed(2)} onChange={exposure => onChange({ exposure })}/>
          <label className={styles.selectLabel}><span>Graphics</span><select aria-label="Graphics quality" value={state.quality} onChange={e => onChange({ quality: e.target.value as Quality })}>{(['Low', 'Medium', 'High', 'Ultra'] as Quality[]).map(q => <option key={q}>{q}</option>)}</select></label>
          <p className={styles.renderInfo}>{stats.backend || 'Initializing renderer'} · {stats.fps > 0 ? `${Math.round(stats.fps)} FPS` : 'Preparing scene'}<br/>Resolution adapts to your device.</p>
        </details>
        <div className={styles.panelActions}>
          <button type="button" onClick={onReset}><Icon name="reset" size={15}/>Reset view</button>
          <button type="button" onClick={() => onChange({ seed: Math.floor(Math.random() * 1000000) })}><Icon name="random" size={15}/>New landscape</button>
          <button type="button" onClick={onCapture}><Icon name="camera" size={15}/>Capture image</button>
          <button type="button" onClick={onFullscreen}><Icon name="fullscreen" size={15}/>Fullscreen</button>
        </div>
        <p className={styles.seedNote}>LANDSCAPE {state.seed.toString().padStart(6, '0')}<span>PROTOTYPE 01</span></p>
      </div>
    </aside>}

    <div className={styles.location}><span className={styles.locationLine}/><span className={styles.locationLabel}>YOUR REFUGE, ABOVE THE CLOUDS</span><div>{SITE_ELEVATION.toLocaleString()}<span>m</span></div><p>High alpine · Simulated environment</p></div>
    <div className={styles.bottomArea}>
      <div className={styles.cameraHint}>{camera === 'First Person' ? 'WASD to walk · Drag to look · Shift to walk faster' : camera === 'Orbit' ? 'Drag to orbit · Scroll to move closer' : camera === 'Landscape' ? 'A little perspective changes everything.' : 'Find your mountain. Make it home.'}</div>
      <nav className={styles.cameraDock} aria-label="Camera views">{cameras.map(item => <button type="button" key={item.mode} className={camera === item.mode ? styles.cameraSelected : ''} aria-label={`${item.mode} view`} aria-pressed={camera === item.mode} onClick={() => onCamera(item.mode)}><Icon name={item.icon} size={17}/><span>{item.label}</span></button>)}<span className={styles.dockDivider}/><button type="button" className={styles.pauseButton} aria-label={state.paused ? 'Resume environment' : 'Pause environment'} aria-pressed={state.paused} onClick={() => onChange({ paused: !state.paused })}><Icon name={state.paused ? 'play' : 'pause'} size={17}/></button></nav>
    </div>
    <div className={styles.conditions}><div className={styles.clock}>{formatTime(state.time)}<span>{temperature}°</span></div><div className={styles.weatherLine}><span className={styles.liveDot}/>{state.weather}<span className={styles.conditionDivider}>/</span><Icon name="wind" size={13}/>{state.windSpeed.toFixed(1)} m/s</div></div>
    {camera === 'First Person' && <div className={styles.movePad} aria-label="Walking controls">{(['forward', 'left', 'backward', 'right'] as MoveDirection[]).map(direction => <button type="button" key={direction} data-direction={direction} aria-label={`Walk ${direction}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onMove(direction, true); }} onPointerUp={() => onMove(direction, false)} onPointerCancel={() => onMove(direction, false)} onLostPointerCapture={() => onMove(direction, false)}><Icon name="arrow" size={20}/></button>)}</div>}
    {!!stats.backend && stats.backend.includes('WebGL') && <div className={styles.compatibility}>WebGL compatibility mode · For full quality, enable WebGPU in a supported browser.</div>}
    {notice && <div role="status" className={styles.toast}><Icon name="check" size={16}/>{notice}</div>}
  </div>;
}
