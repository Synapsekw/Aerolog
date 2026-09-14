'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Drone } from 'lucide-react';

type Props = { angle: number; heading: number; tilt: number; flying: boolean; reduced: boolean };

/** The licensed Phantom model is loaded only in the browser, separately from the page. */
function PhantomDrone(props: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  const draw = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  current.current = props;

  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};
    async function initialize(host: HTMLDivElement) {
      try {
        const [THREE, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(160, 130);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = .95;
        renderer.domElement.setAttribute('aria-hidden', 'true');
        host.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-3.4, 3.4, 2.76, -2.76, .1, 50);
        scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x526278, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-3, 6, 5); scene.add(key);
        const rim = new THREE.DirectionalLight(0xaccfff, 1.1); rim.position.set(4, 3, -4); scene.add(rim);
        const aircraft = new THREE.Group(); scene.add(aircraft);
        const rotors: InstanceType<typeof THREE.Group>[] = [];
        let raf = 0, lastFrame = 0, visible = true, loaded = false;

        const requestDraw = () => { if (!disposed && !raf && visible && !document.hidden) raf = requestAnimationFrame(render); };
        const render = (now: number) => {
          raf = 0;
          if (disposed || !visible || document.hidden) return;
          const p = current.current;
          const elevation = Math.asin(Math.max(.3, Math.min(.98, p.tilt)));
          camera.position.set(Math.sin(p.angle) * Math.cos(elevation) * 9, Math.sin(elevation) * 9, Math.cos(p.angle) * Math.cos(elevation) * 9);
          camera.lookAt(0, -.15, 0);
          const turn = Math.atan2(Math.sin(p.heading - aircraft.rotation.y), Math.cos(p.heading - aircraft.rotation.y));
          aircraft.rotation.y += p.reduced ? turn : turn * .2;
          aircraft.rotation.z = p.flying && !p.reduced ? THREE.MathUtils.clamp(turn * -.14, -.11, .11) : 0;
          aircraft.rotation.x = p.flying && !p.reduced ? -.035 : 0;
          if (loaded && (now - lastFrame > 30 || !p.flying)) {
            const delta = Math.min((now - lastFrame) / 1000, .05);
            if (p.flying && !p.reduced) rotors.forEach((rotor, i) => { rotor.rotation.y += delta * (i % 2 ? -55 : 55); });
            renderer.render(scene, camera); lastFrame = now;
          }
          if ((p.flying && !p.reduced) || Math.abs(turn) > .005) requestDraw();
        };
        draw.current = requestDraw;
        const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) requestDraw(); else { cancelAnimationFrame(raf); raf = 0; } });
        observer.observe(host);
        const visibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else requestDraw(); };
        document.addEventListener('visibilitychange', visibility);
        const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); raf = 0; if (!disposed) setStatus('fallback'); };
        renderer.domElement.addEventListener('webglcontextlost', lost);

        cleanup = () => {
          cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
          renderer.domElement.removeEventListener('webglcontextlost', lost); draw.current = null;
          scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
          renderer.dispose(); renderer.domElement.remove();
        };
        const gltf = await new GLTFLoader().loadAsync('/models/phantom-4.glb');
        if (disposed) { gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); } }); return; }
        const model = new THREE.Group();
        model.add(gltf.scene);
        // An isolated bolt in the source is outside the aircraft's silhouette.
        const stray = model.getObjectByName('polySurface93_phong1_0');
        stray?.removeFromParent();
        model.updateMatrixWorld(true);
        const hubs: [string, number, number, number][] = [
          ['polySurface147_White2_0', .1105902647, .0856657451, .1016924931],
          ['polySurface152_White2_0', .1093288206, .0856657451, .0200261970],
          ['polySurface153_White2_0', .0285311776, .0856657451, .0200261970],
          ['polySurface154_White2_0', .0272697359, .0856657451, .1016924931],
        ];
        hubs.forEach(([name, x, y, z]) => {
          const blade = model.getObjectByName(name);
          if (!blade) return;
          const hub = new THREE.Group(); hub.position.set(x, y, z); model.add(hub);
          hub.attach(blade); rotors.push(hub);
        });
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const normalized = new THREE.Group(); normalized.add(model);
        normalized.scale.setScalar(2.8 / Math.max(size.x, size.z));
        aircraft.add(normalized);
        aircraft.rotation.y = current.current.heading;
        loaded = true; setStatus('ready'); requestDraw();
      } catch {
        cleanup();
        if (!disposed) setStatus('fallback');
      }
    }
    initialize(host);
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => { draw.current?.(); }, [props.angle, props.heading, props.tilt, props.flying, props.reduced]);

  return <div className="al-phantom" data-model-status={status} aria-hidden="true"><div ref={holder} className={status === 'ready' ? 'al-phantom-canvas al-phantom-ready' : 'al-phantom-canvas'}/>{status !== 'ready' && <Drone className="al-phantom-fallback" size={35} strokeWidth={1.2}/>}</div>;
}

export default memo(PhantomDrone);
