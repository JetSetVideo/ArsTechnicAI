/**
 * ThreeDViewer — Interactive 3D scene with ThreeJS.
 * Place mannequins, adjust lighting/camera, export renders.
 * Integrates with the 3D module pipeline for AI generation.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Camera, Download, Grid3X3,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface MannequinConfig {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: string;
  pose: 't-pose' | 'a-pose' | 'standing' | 'walking' | 'sitting' | 'arms-up' | 'running';
  visible: boolean;
}

interface ThreeDViewerProps {
  width?: number;
  height?: number;
  backgroundColor?: string;
  gridColor?: string;
  gridVisible?: boolean;
  mannequins?: MannequinConfig[];
  onExport?: (dataUrl: string) => void;
  onMannequinSelect?: (id: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({
  width = 800,
  height = 500,
  backgroundColor = '#0a0a0f',
  gridColor = '#333',
  gridVisible = true,
  mannequins: initialMannequins = [],
  onExport,
  onMannequinSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mannequinMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const animFrameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const [mannequins, setMannequins] = useState<MannequinConfig[]>(initialMannequins);
  const [selectedMannequinId, setSelectedMannequinId] = useState<string | null>(null);
  const [lightingPreset, setLightingPreset] = useState<'studio' | 'outdoor' | 'dramatic' | 'soft'>('studio');
  const [cameraPreset, setCameraPreset] = useState<'front' | 'three-quarter' | 'side' | 'top' | 'free'>('three-quarter');

  // ─── Scene initialization ────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 15, 50);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(5, 3.5, 6);
    camera.lookAt(0, 0.8, 0);
    cameraRef.current = camera;

    // Manual mouse orbit controls
    const dom = renderer.domElement;
    const handleMouseDown = (e: MouseEvent) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !camera) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      // Rotate camera around target
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position.clone().sub(new THREE.Vector3(0, 0.8, 0)));
      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.2, Math.min(Math.PI * 0.45, spherical.phi - dy * 0.005));
      camera.position.setFromSpherical(spherical).add(new THREE.Vector3(0, 0.8, 0));
      camera.lookAt(0, 0.8, 0);
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => { isDragging.current = false; };
    const handleWheel = (e: WheelEvent) => {
      if (!camera) return;
      const dir = camera.position.clone().normalize();
      const dist = camera.position.length();
      const newDist = Math.max(2, Math.min(15, dist + e.deltaY * 0.01));
      camera.position.copy(dir.multiplyScalar(newDist));
    };
    dom.addEventListener('mousedown', handleMouseDown);
    dom.addEventListener('mousemove', handleMouseMove);
    dom.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel);

    // Ground plane with grid
    if (gridVisible) {
      const gridHelper = new THREE.GridHelper(10, 20, gridColor, '#1a1a2e');
      gridHelper.name = 'grid';
      scene.add(gridHelper);

      const groundGeo = new THREE.PlaneGeometry(10, 10);
      const groundMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.9, metalness: 0.1 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      ground.receiveShadow = true;
      ground.name = 'ground';
      scene.add(ground);
    }

    // Default lighting
    applyLightingPreset(scene, lightingPreset);

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', handleMouseDown);
      dom.removeEventListener('mousemove', handleMouseMove);
      dom.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [width, height, backgroundColor, gridColor, gridVisible, lightingPreset]);

  // ─── Mannequin management ────────────────────────────────────────

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old mannequins
    for (const [id, mesh] of mannequinMeshes.current) {
      scene.remove(mesh);
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material?.dispose();
        }
      });
    }
    mannequinMeshes.current.clear();

    // Create mannequins
    for (const config of mannequins) {
      if (!config.visible) continue;
      const group = createMannequinMesh(config);
      scene.add(group);
      mannequinMeshes.current.set(config.id, group);
    }
  }, [mannequins]);

  // ─── Lighting presets ────────────────────────────────────────────

  const applyLightingPreset = (scene: THREE.Scene, preset: string) => {
    // Remove existing lights
    scene.children
      .filter(c => c instanceof THREE.Light)
      .forEach(l => scene.remove(l));

    switch (preset) {
      case 'studio': {
        const key = new THREE.DirectionalLight('#ffffff', 4);
        key.position.set(5, 8, 3);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);

        const fill = new THREE.DirectionalLight('#8899cc', 1.5);
        fill.position.set(-3, 2, -2);
        scene.add(fill);

        const rim = new THREE.DirectionalLight('#ffccaa', 2);
        rim.position.set(0, 3, -5);
        scene.add(rim);
        break;
      }
      case 'outdoor': {
        const sun = new THREE.DirectionalLight('#fff5e6', 6);
        sun.position.set(10, 15, 5);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        scene.add(sun);

        const ambient = new THREE.AmbientLight('#8899cc', 1.5);
        scene.add(ambient);
        break;
      }
      case 'dramatic': {
        const key = new THREE.SpotLight('#ffffff', 8, 20, Math.PI / 6, 0.5);
        key.position.set(3, 6, 2);
        key.castShadow = true;
        scene.add(key);

        const rim = new THREE.DirectionalLight('#ff6644', 3);
        rim.position.set(-2, 4, -4);
        scene.add(rim);
        break;
      }
      case 'soft': {
        const ambient = new THREE.AmbientLight('#ffffff', 3);
        scene.add(ambient);

        const key = new THREE.DirectionalLight('#ffffff', 2);
        key.position.set(2, 5, 2);
        scene.add(key);
        break;
      }
    }
  };

  // ─── Camera presets ──────────────────────────────────────────────

  const applyCameraPreset = useCallback((preset: string) => {
    const camera = cameraRef.current;
    if (!camera) return;

    switch (preset) {
      case 'front':
        camera.position.set(0, 1.2, 5);
        break;
      case 'three-quarter':
        camera.position.set(4, 2.5, 4);
        break;
      case 'side':
        camera.position.set(5, 1.2, 0);
        break;
      case 'top':
        camera.position.set(0, 6, 0.1);
        break;
    }
    camera.lookAt(0, 0.8, 0);
  }, []);

  useEffect(() => {
    if (cameraPreset !== 'free') applyCameraPreset(cameraPreset);
  }, [cameraPreset, applyCameraPreset]);

  // ─── Export ──────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    onExport?.(dataUrl);
  }, [onExport]);

  // ─── Add mannequin ───────────────────────────────────────────────

  const addMannequin = () => {
    const newId = `mannequin-${Date.now()}`;
    const newMannequin: MannequinConfig = {
      id: newId,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      color: '#d4a574',
      pose: 't-pose',
      visible: true,
    };
    setMannequins([...mannequins, newMannequin]);
  };

  // ─── UI ──────────────────────────────────────────────────────────

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
        flexWrap: 'wrap',
      }}>
        {/* Camera presets */}
        {(['front', 'three-quarter', 'side', 'top', 'free'] as const).map(p => (
          <button key={p} onClick={() => setCameraPreset(p)} style={{
            padding: '3px 8px', borderRadius: 4, border: '1px solid',
            borderColor: cameraPreset === p ? 'var(--accent-primary)' : 'var(--border-color)',
            background: cameraPreset === p ? 'rgba(0,212,170,0.08)' : 'none',
            color: cameraPreset === p ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: '0.5625rem', cursor: 'pointer', textTransform: 'capitalize',
          }}>{p}</button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />

        {/* Lighting presets */}
        {(['studio', 'outdoor', 'dramatic', 'soft'] as const).map(p => (
          <button key={p} onClick={() => { setLightingPreset(p); if (sceneRef.current) applyLightingPreset(sceneRef.current, p); }} style={{
            padding: '3px 8px', borderRadius: 4, border: '1px solid',
            borderColor: lightingPreset === p ? 'var(--accent-primary)' : 'var(--border-color)',
            background: lightingPreset === p ? 'rgba(0,212,170,0.08)' : 'none',
            color: lightingPreset === p ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: '0.5625rem', cursor: 'pointer', textTransform: 'capitalize',
          }}>{p}</button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />

        <button onClick={addMannequin} style={{
          padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-color)',
          background: 'none', color: 'var(--accent-primary)', fontSize: '0.5625rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}>+ Add Mannequin</button>

        <div style={{ flex: 1 }} />

        <button onClick={handleExport} style={{
          padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-color)',
          background: 'none', color: 'var(--text-muted)', fontSize: '0.5625rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Download size={12} /> Export
        </button>
      </div>

      {/* 3D Canvas */}
      <div ref={containerRef} style={{ width: '100%', height, position: 'relative', cursor: 'grab' }}>
        {mannequins.length === 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: 'var(--text-muted)', fontSize: '0.75rem', pointerEvents: 'none',
          }}>
            Add a mannequin to start composing your scene
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Mannequin Mesh Builder ────────────────────────────────────────

function createMannequinMesh(config: MannequinConfig): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...config.position);
  group.rotation.set(...config.rotation);
  group.scale.setScalar(config.scale);
  group.name = `mannequin-${config.id}`;

  const skinMat = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.5,
    metalness: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#333',
    roughness: 0.3,
    metalness: 0.2,
  });

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.7, 16), skinMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skinMat);
  neck.position.y = 1.4;
  group.add(neck);

  // Arms (two segments each)
  const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 8), skinMat);
  upperArmL.position.set(-0.35, 1.25, 0);
  upperArmL.rotation.z = 0.3;
  upperArmL.castShadow = true;
  group.add(upperArmL);

  const lowerArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8), skinMat);
  lowerArmL.position.set(-0.55, 0.95, 0);
  lowerArmL.rotation.z = 0.2;
  lowerArmL.castShadow = true;
  group.add(lowerArmL);

  const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 8), skinMat);
  upperArmR.position.set(0.35, 1.25, 0);
  upperArmR.rotation.z = -0.3;
  upperArmR.castShadow = true;
  group.add(upperArmR);

  const lowerArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8), skinMat);
  lowerArmR.position.set(0.55, 0.95, 0);
  lowerArmR.rotation.z = -0.2;
  lowerArmR.castShadow = true;
  group.add(lowerArmR);

  // Legs
  const upperLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.45, 8), darkMat);
  upperLegL.position.set(-0.12, 0.5, 0);
  upperLegL.castShadow = true;
  upperLegL.receiveShadow = true;
  group.add(upperLegL);

  const lowerLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 8), darkMat);
  lowerLegL.position.set(-0.12, 0.1, 0);
  lowerLegL.castShadow = true;
  group.add(lowerLegL);

  const upperLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.45, 8), darkMat);
  upperLegR.position.set(0.12, 0.5, 0);
  upperLegR.castShadow = true;
  upperLegR.receiveShadow = true;
  group.add(upperLegR);

  const lowerLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 8), darkMat);
  lowerLegR.position.set(0.12, 0.1, 0);
  lowerLegR.castShadow = true;
  group.add(lowerLegR);

  // Feet
  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), darkMat);
  footL.position.set(-0.12, -0.05, 0.04);
  footL.castShadow = true;
  footL.receiveShadow = true;
  group.add(footL);

  const footR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), darkMat);
  footR.position.set(0.12, -0.05, 0.04);
  footR.castShadow = true;
  footR.receiveShadow = true;
  group.add(footR);

  return group;
}

export default ThreeDViewer;
