import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { AppMode, GestureType, ParticleData, HandData } from '../types';
import { COLORS, TREE_HEIGHT, TREE_RADIUS_BOTTOM, PARTICLE_COUNT, SCATTER_BOUNDS, LERP_FACTOR, ROTATION_SENSITIVITY } from '../constants';
import { detectGesture } from '../utils/gestureUtils';

interface ThreeSceneProps {
  photoUrls: string[];
  setAppMode: (mode: AppMode) => void;
  appMode: AppMode;
  onGestureDetected: (g: GestureType) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ photoUrls, setAppMode, appMode, onGestureDetected, videoRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const overlaySceneRef = useRef<THREE.Scene | null>(null); // New Overlay Scene
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const particlesRef = useRef<ParticleData[]>([]);
  const particleGroupRef = useRef<THREE.Group | null>(null); // Ref to group
  const starFieldRef = useRef<THREE.Points | null>(null);
  const frameIdRef = useRef<number>(0);

  // Logic References
  const appModeRef = useRef<AppMode>(appMode);
  const isTransitioningRef = useRef<boolean>(false);
  const handDataRef = useRef<HandData>({ x: 0.5, y: 0.5, gesture: GestureType.NONE, isPresent: false });
  const focusedPhotoIdRef = useRef<string | null>(null);

  useEffect(() => {
    appModeRef.current = appMode;
    isTransitioningRef.current = false;
    if (appMode === AppMode.SCATTER) {
      focusedPhotoIdRef.current = null;
    }
  }, [appMode]);

  // Materials - Optimized for reuse
  const materialsRef = useRef({
    gold: new THREE.MeshStandardMaterial({
      color: COLORS.GOLD,
      metalness: 0.8,
      roughness: 0.3,
      emissive: COLORS.GOLD,
      emissiveIntensity: 0.2
    }),
    silver: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.9,
      roughness: 0.1,
    }),
    red: new THREE.MeshStandardMaterial({
      color: COLORS.RED,
      metalness: 0.4,
      roughness: 0.2,
      emissive: 0x330000
    }),
  });

  // MediaPipe Setup
  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let lastVideoTime = -1;

    const setupMediaPipe = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      startWebcam();
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predictWebcam);
        }
      }
    };

    const predictWebcam = async () => {
      if (!handLandmarker || !videoRef.current) return;
      let startTimeMs = performance.now();
      if (videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          const gesture = detectGesture(landmarks);
          const wrist = landmarks[0];
          const middle = landmarks[9];
          const centroidX = 1 - (wrist.x + middle.x) / 2;
          const centroidY = (wrist.y + middle.y) / 2;
          handDataRef.current = { x: centroidX, y: centroidY, gesture, isPresent: true };
          onGestureDetected(gesture);
        } else {
          handDataRef.current.isPresent = false;
          handDataRef.current.gesture = GestureType.NONE;
          onGestureDetected(GestureType.NONE);
        }
      }
      requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();
    return () => {
      if (handLandmarker) handLandmarker.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onGestureDetected, videoRef]);

  // Three.js Logic
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scenes
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Deep Black
    scene.fog = new THREE.FogExp2(0x000000, 0.02);
    sceneRef.current = scene;

    const overlayScene = new THREE.Scene();
    overlaySceneRef.current = overlayScene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 40);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.autoClear = false; // Important for dual scene rendering
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Post Processing (Applied to Main Scene only)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.15;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.6;
    bloomPassRef.current = bloomPass;
    const outputPass = new OutputPass();
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    composerRef.current = composer;

    // 3. Lighting (Add to BOTH scenes to ensure lit objects work in overlay if needed, though photos are unlit)
    const addLights = (s: THREE.Scene) => {
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
      s.add(ambientLight);
      const mainLight = new THREE.DirectionalLight(0xffd700, 2.0);
      mainLight.position.set(10, 20, 10);
      s.add(mainLight);
      const fillLight = new THREE.PointLight(0xff3300, 1.0, 50);
      fillLight.position.set(-10, 5, -10);
      s.add(fillLight);
    };
    addLights(scene);
    addLights(overlayScene);

    // 4. Background Starfield (Main Scene)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 150;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starFieldMat = new THREE.PointsMaterial({ color: 0x888888, size: 0.15, transparent: true, opacity: 0.6 });
    const starField = new THREE.Points(starGeo, starFieldMat);
    scene.add(starField);
    starFieldRef.current = starField;

    // 5. Particle Generation
    const particleGroup = new THREE.Group();
    scene.add(particleGroup);
    particleGroupRef.current = particleGroup;

    // Low Poly Geometries for High Performance
    const sphereGeo = new THREE.SphereGeometry(1, 8, 8); // Low poly
    const photoGeo = new THREE.PlaneGeometry(1.2, 1.6);
    const planeGeo = new THREE.PlaneGeometry(1, 1);

    // Textures
    const createEmojiTexture = (emoji: string) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 32, 34);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const starTex = createEmojiTexture('⭐');
    const bellTex = createEmojiTexture('🔔');
    const appleTex = createEmojiTexture('🍎');

    const emojiMatProps = { transparent: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.2 };
    const starMat = new THREE.MeshStandardMaterial({ map: starTex, ...emojiMatProps, emissive: 0x222200 });
    const bellMat = new THREE.MeshStandardMaterial({ map: bellTex, ...emojiMatProps });
    const appleMat = new THREE.MeshStandardMaterial({ map: appleTex, ...emojiMatProps });

    const particles: ParticleData[] = [];
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let mesh: THREE.Mesh;
      let type: ParticleData['type'];
      let scale = 1;

      const r = Math.random();

      // DISTRIBUTION STRATEGY
      if (photoUrls.length > 0 && r > 0.99) {
        // PHOTO
        type = 'PHOTO';
        const url = photoUrls[i % photoUrls.length];
        const tex = new THREE.TextureLoader().load(
          url,
          () => {
            // Success callback - texture loaded successfully
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.anisotropy = maxAnisotropy;
          },
          undefined,
          (error) => {
            // Error callback - texture failed to load
            console.warn('Failed to load texture:', url, error);
            // Create a fallback texture with a placeholder
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#2F4F4F'; // Matte green
              ctx.fillRect(0, 0, 64, 64);
              ctx.fillStyle = '#FFD700'; // Gold
              ctx.font = '48px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('❄', 32, 32);
            }
            const fallbackTex = new THREE.CanvasTexture(canvas);
            fallbackTex.colorSpace = THREE.SRGBColorSpace;
            // Replace the material's map with fallback
            mat.map = fallbackTex;
            mat.needsUpdate = true;
          }
        );
        // toneMapped: false is KEY for original colors
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.DoubleSide,
          toneMapped: false
        });
        mesh = new THREE.Mesh(photoGeo, mat);
        mesh.userData = { isPhoto: true, id: `photo-${i}` };
        scale = 1.5;
      } else if (r > 0.96) {
        type = 'STAR';
        mesh = new THREE.Mesh(planeGeo, starMat);
        scale = 0.8;
      } else if (r > 0.93) {
        type = 'BELL';
        mesh = new THREE.Mesh(planeGeo, bellMat);
        scale = 0.7;
      } else if (r > 0.90) {
        type = 'APPLE';
        mesh = new THREE.Mesh(planeGeo, appleMat);
        scale = 0.7;
      } else if (r > 0.60) {
        type = 'GOLD_SPHERE';
        mesh = new THREE.Mesh(sphereGeo, materialsRef.current.gold);
        scale = 0.15 + Math.random() * 0.15;
      } else if (r > 0.40) {
        type = 'APPLE';
        mesh = new THREE.Mesh(sphereGeo, materialsRef.current.red);
        scale = 0.12 + Math.random() * 0.15;
      } else {
        type = 'GOLD_SPHERE';
        mesh = new THREE.Mesh(sphereGeo, materialsRef.current.silver);
        scale = 0.1 + Math.random() * 0.1;
      }

      mesh.scale.set(scale, scale, scale);

      // TREE POSITION
      const yPercent = i / PARTICLE_COUNT;
      const y = (yPercent - 0.5) * TREE_HEIGHT;
      const coneRadius = TREE_RADIUS_BOTTOM * (1 - yPercent);
      const theta = i * goldenAngle;
      const rJitter = coneRadius * (0.9 + Math.random() * 0.2);
      const treeX = Math.cos(theta) * rJitter;
      const treeZ = Math.sin(theta) * rJitter;
      const treePos = new THREE.Vector3(treeX, y, treeZ);

      // SCATTER POSITION
      const u = Math.random();
      const v = Math.random();
      const thetaScatter = 2 * Math.PI * u;
      const phiScatter = Math.acos(2 * v - 1);
      const radiusScatter = 5 + Math.pow(Math.random(), 2) * SCATTER_BOUNDS;
      const scX = radiusScatter * Math.sin(phiScatter) * Math.cos(thetaScatter);
      const scY = radiusScatter * Math.sin(phiScatter) * Math.sin(thetaScatter);
      const scZ = radiusScatter * Math.cos(phiScatter);
      const scatterPos = new THREE.Vector3(scX, scY, scZ);

      mesh.position.copy(treePos);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      particleGroup.add(mesh);
      particles.push({
        id: `p-${i}`,
        mesh,
        type,
        treePos,
        scatterPos,
        rotationSpeed: new THREE.Vector3(Math.random() * 0.02, Math.random() * 0.02, 0),
        initialScale: scale
      });
    }

    // Huge Top Star
    const topStarGeo = new THREE.OctahedronGeometry(1.5, 0);
    const topStarMesh = new THREE.Mesh(topStarGeo, new THREE.MeshStandardMaterial({
      color: 0xffddaa, emissive: 0xffaa00, emissiveIntensity: 5
    }));
    topStarMesh.position.set(0, TREE_HEIGHT / 2 + 0.8, 0);
    particleGroup.add(topStarMesh);
    particles.push({
      id: 'top-star',
      mesh: topStarMesh,
      type: 'STAR',
      treePos: new THREE.Vector3(0, TREE_HEIGHT / 2 + 0.8, 0),
      scatterPos: new THREE.Vector3(0, 20, 0),
      rotationSpeed: new THREE.Vector3(0, 0.05, 0),
      initialScale: 1.5
    });

    particlesRef.current = particles;

    // 6. Animation Loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      const hand = handDataRef.current;
      const currentMode = appModeRef.current;
      const time = Date.now() * 0.001;

      // Animate Starfield
      if (starFieldRef.current) {
        starFieldRef.current.rotation.y = time * 0.01;
      }

      // Scene Rotation Logic (Applied to ParticleGroup in Main Scene)
      if (currentMode === AppMode.SCATTER && hand.isPresent && hand.gesture !== GestureType.PINCH) {
        const targetRotX = (hand.y - 0.5) * ROTATION_SENSITIVITY;
        const targetRotY = (hand.x - 0.5) * ROTATION_SENSITIVITY * 2;
        particleGroup.rotation.x += (targetRotX - particleGroup.rotation.x) * 0.05;
        particleGroup.rotation.y += (targetRotY - particleGroup.rotation.y) * 0.05;
      } else {
        particleGroup.rotation.y += 0.001;
        particleGroup.rotation.x += (0 - particleGroup.rotation.x) * 0.05;
      }

      // --- GLOBAL BLOOM & EXPOSURE (Background always glowing) ---
      // We keep these high to maintain the Christmas atmosphere for background elements
      const breathe = Math.sin(time * 0.5) * 0.2;
      const targetBloomStrength = 1.2 + breathe;

      if (bloomPassRef.current) {
        bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, targetBloomStrength, 0.05);
        bloomPassRef.current.threshold = 0.15;
        bloomPassRef.current.radius = 0.6;
      }
      // Exposure for background
      if (rendererRef.current) {
        rendererRef.current.toneMappingExposure = 1.1;
      }

      // Photo Picking Logic
      if (currentMode === AppMode.SCATTER && !isTransitioningRef.current && hand.gesture === GestureType.PINCH) {
        const photoParticles = particlesRef.current.filter(p => p.type === 'PHOTO');
        if (photoParticles.length > 0) {
          const rand = photoParticles[Math.floor(Math.random() * photoParticles.length)];
          focusedPhotoIdRef.current = rand.mesh.userData.id;
          isTransitioningRef.current = true;
          setAppMode(AppMode.FOCUS);
        }
      }

      // Update Particles
      const particles = particlesRef.current;
      const len = particles.length;

      const isTree = currentMode === AppMode.TREE;
      const isScatter = currentMode === AppMode.SCATTER;
      const isFocus = currentMode === AppMode.FOCUS;

      const vec3 = new THREE.Vector3();

      for (let i = 0; i < len; i++) {
        const p = particles[i];

        // --- SCENE GRAPH PARENTING LOGIC ---
        // If this is the focused particle, it should live in the Overlay Scene (No Bloom).
        // All other particles live in the Main Scene Particle Group (With Bloom + Rotation).
        const isFocusedParticle = isFocus && p.mesh.userData.id === focusedPhotoIdRef.current;
        const targetParent = isFocusedParticle ? overlayScene : particleGroup;

        if (p.mesh.parent !== targetParent) {
          // Coordinate Space Transformation for Smooth Transition
          // 1. Get current World properties
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
          const worldScale = new THREE.Vector3();
          p.mesh.updateWorldMatrix(true, false);
          p.mesh.getWorldPosition(worldPos);
          p.mesh.getWorldQuaternion(worldQuat);
          p.mesh.getWorldScale(worldScale);

          // 2. Switch Parent
          p.mesh.parent?.remove(p.mesh);
          targetParent.add(p.mesh);

          // 3. Apply properties in new space
          if (targetParent === overlayScene) {
            // Moving to World Space (Overlay)
            p.mesh.position.copy(worldPos);
            p.mesh.quaternion.copy(worldQuat);
            p.mesh.scale.copy(worldScale);
          } else {
            // Moving back to Local Space (ParticleGroup)
            particleGroup.worldToLocal(worldPos);
            p.mesh.position.copy(worldPos);
            // Rotation will be re-driven by animation loop, so quaternion drift is acceptable here
            // Scale is driven by targetScale below
          }
        }

        // --- MOVEMENT LOGIC ---
        let targetScale = p.initialScale;
        let targetPos = new THREE.Vector3();

        if (isTree) {
          targetPos.copy(p.treePos);
        } else if (isScatter) {
          targetPos.copy(p.scatterPos);
          vec3.copy(p.scatterPos);
          vec3.y += Math.sin(time + p.treePos.x) * 0.1;
          targetPos.copy(vec3);
        } else if (isFocus) {
          if (isFocusedParticle) {
            // Position in FRONT OF CAMERA (World Space, since parent is overlayScene)
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            const focusPos = camera.position.clone().add(camDir.multiplyScalar(10));

            targetPos.copy(focusPos);
            targetScale = 5.0;
            p.mesh.lookAt(camera.position);
          } else {
            // Background particles (Local Space in particleGroup)
            targetPos.copy(p.scatterPos);
            vec3.copy(p.scatterPos);
            vec3.y += Math.sin(time + p.treePos.x) * 0.1;
            targetPos.copy(vec3);
            targetScale = p.initialScale;

            // Clean the lens: Hide particles too close to the camera 
            // To do this in local space, we need world distance
            const worldP = p.mesh.position.clone().applyMatrix4(particleGroup.matrixWorld);
            if (worldP.distanceTo(camera.position) < 12) {
              targetScale = 0;
            }
          }
        }

        // Apply Lerp
        const posLerp = isFocus ? 0.08 : LERP_FACTOR;
        p.mesh.position.lerp(targetPos, posLerp);

        const currentScale = p.mesh.scale.x;
        const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
        p.mesh.scale.setScalar(nextScale);

        // Rotate non-focused particles
        if (!isFocusedParticle) {
          p.mesh.rotation.x += p.rotationSpeed.x;
          p.mesh.rotation.y += p.rotationSpeed.y;
        }
      }

      // --- RENDER PIPELINE ---
      // 1. Render Main Scene (Background + Bloom)
      renderer.clear();
      composer.render();

      // 2. Render Overlay Scene (Focused Photo, No Bloom)
      // Clear depth so overlay is always on top (or we can rely on Z-buffer if we want clipping)
      // Clearing depth ensures the photo doesn't clip into floating stars
      renderer.clearDepth();
      renderer.render(overlayScene, camera);
    };
    animate();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !composerRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      composerRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
      rendererRef.current?.dispose();
      containerRef.current?.innerHTML && (containerRef.current.innerHTML = '');
    };
  }, [photoUrls, setAppMode]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

export default ThreeScene;
