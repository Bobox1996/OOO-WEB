'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EnvironmentUI, Icon, type MoveDirection } from './systems/EnvironmentUI';
import { INITIAL_STATE, type CameraMode, type EnvironmentState, type RuntimeStats } from './systems/types';
import type { AlpineEngine } from './systems/AlpineEngine';
import styles from './environment.module.css';

export default function MountainCabin() {
  const scene = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLElement>(null);
  const engine = useRef<AlpineEngine | null>(null);
  const stateRef = useRef<EnvironmentState>({ ...INITIAL_STATE });
  const [state, setState] = useState<EnvironmentState>({ ...INITIAL_STATE });
  const [camera, setCamera] = useState<CameraMode>('Cabin');
  const [photography, setPhotography] = useState(false);
  const [stats, setStats] = useState<RuntimeStats>({ fps: 0, backend: '', loading: true });
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const deviceDefaultsApplied = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3600);
  }, []);

  const change = useCallback((patch: Partial<EnvironmentState>) => {
    if (patch.seed !== undefined && patch.seed !== stateRef.current.seed) setCamera('Cabin');
    stateRef.current = { ...stateRef.current, ...patch };
    setState(stateRef.current);
    engine.current?.setState(patch);
  }, []);
  const changeCamera = useCallback((mode: CameraMode) => {
    setCamera(mode);
    engine.current?.setCamera(mode);
  }, []);

  useEffect(() => {
    if (!scene.current) return;
    const container = scene.current;
    let active = true;
    let initializing = true;
    let syncedBackendQuality = false;
    let instance: AlpineEngine | undefined;
    if (!deviceDefaultsApplied.current) {
      deviceDefaultsApplied.current = true;
      if (window.innerWidth < 700 && stateRef.current.quality === 'High') {
        stateRef.current = { ...stateRef.current, quality: 'Medium' };
        setState(stateRef.current);
      }
    }
    // A recreated audio context must wait for a fresh Sound button gesture.
    if (stateRef.current.sound) {
      stateRef.current = { ...stateRef.current, sound: false };
      setState(stateRef.current);
    }
    setStats({ fps: 0, backend: '', loading: true });
    void (async () => {
      try {
        const { AlpineEngine: Engine } = await import('./systems/AlpineEngine');
        if (!active) return;
        instance = new Engine(container, (next: RuntimeStats) => {
          if (!active) return;
          if (!next.loading && !syncedBackendQuality) {
            syncedBackendQuality = true;
            if (next.backend.startsWith('WebGL')) {
              stateRef.current = { ...stateRef.current, quality: 'Low' };
              setState(stateRef.current);
            }
          }
          setStats(next);
        });
        await instance.init(stateRef.current);
        if (!active) return;
        engine.current = instance;
        instance.setState(stateRef.current);
      } catch (error) {
        instance?.dispose();
        if (active) setStats({ fps: 0, backend: '', loading: false, error: error instanceof Error ? error.message : 'The alpine scene could not be started.' });
      } finally {
        initializing = false;
        if (!active) instance?.dispose();
      }
    })();
    return () => {
      active = false;
      // WebGPU initialization and shader compilation cannot be interrupted safely.
      // The async finally block disposes after initialization settles if unmounted.
      if (!initializing) instance?.dispose();
      if (engine.current === instance) engine.current = null;
    };
  }, [retry]);

  useEffect(() => {
    if (!state.autoTime || state.paused || stats.loading || stats.error) return;
    const timer = setInterval(() => change({ time: (stateRef.current.time + .025) % 24 }), 1000);
    return () => clearInterval(timer);
  }, [state.autoTime, state.paused, stats.loading, stats.error, change]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPhotography(false); return; }
      const target = event.target as HTMLElement | null;
      if (target?.matches('input,select,textarea,button') || target?.isContentEditable) return;
      if (event.key.toLowerCase() === 'p' && !event.repeat) setPhotography(value => !value);
      if (event.code === 'Space' && !event.repeat) { event.preventDefault(); change({ paused: !stateRef.current.paused }); }
      const index = Number(event.key) - 1;
      if (index >= 0 && index < 4) changeCamera((['Cabin', 'Orbit', 'First Person', 'Landscape'] as CameraMode[])[index]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [change, changeCamera]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const capture = async () => {
    if (!engine.current || stats.loading || stats.error) { announce('Wait for the landscape to finish loading.'); return; }
    try { await engine.current.capture(); announce('Your mountain moment has been saved.'); }
    catch { announce('Image capture was unavailable. Please try again.'); }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.current?.requestFullscreen) await shell.current.requestFullscreen();
      else announce('Fullscreen is not available in this browser.');
    } catch { announce('Fullscreen is not available in this window.'); }
  };
  const move = (direction: MoveDirection, pressed: boolean) => engine.current?.setMove(direction, pressed);

  return <main className={`${styles.app} ${photography ? styles.photography : ''}`} ref={shell} onDoubleClick={() => { if (photography) setPhotography(false); }}>
    <div className={styles.scene} ref={scene} aria-label="Interactive three-dimensional alpine landscape"/>
    <div className={styles.vignette} aria-hidden="true"/>
    <EnvironmentUI state={state} camera={camera} stats={stats} photography={photography} onChange={change} onCamera={changeCamera} onPhoto={() => setPhotography(value => !value)} onReset={() => { setCamera('Cabin'); engine.current?.resetView(); }} onCapture={() => void capture()} onFullscreen={() => void fullscreen()} onMove={move} notice={notice}/>
    {stats.loading && <div className={styles.loading} role="status"><div className={styles.loadingMark}><Icon name="mountain" size={46}/></div><span className={styles.loadingEyebrow}>MOUNTAIN CABIN</span><h2>A little closer to quiet.</h2><p>Build your own refuge above the clouds.</p><div className={styles.loadingLine}/><span className={styles.loadingDetail}>Shaping the landscape · Preparing the atmosphere</span></div>}
    {stats.error && <div className={styles.error} role="alert"><Icon name="mountain" size={36}/><h2>The mountain is taking a moment.</h2><p>This experience needs WebGPU or WebGL 2 with hardware acceleration. Try a current desktop browser with graphics acceleration enabled.</p><details><summary>Technical details</summary><p>{stats.error}</p></details><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
  </main>;
}
