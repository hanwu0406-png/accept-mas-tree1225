import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, ParticleData } from '../types';

const COUNT = 6000; 
const RIBBON_COUNT = 800;
const DUMMY = new THREE.Object3D();

interface MagicParticlesProps {
  appState: AppState;
  handPosition: THREE.Vector3 | null;
  uploadedImageTexture: THREE.Texture | null;
}

export const MagicParticles: React.FC<MagicParticlesProps> = ({ appState, handPosition, uploadedImageTexture }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [particles, setParticles] = useState<ParticleData[]>([]);

  // Generate Particles
  useEffect(() => {
    const tempParticles: ParticleData[] = [];
    
    // Reverted Palette (Pink/Gold/White)
    const mixedPalette = [
      new THREE.Color('#D87093'), // PaleVioletRed
      new THREE.Color('#FF69B4'), // HotPink
      new THREE.Color('#FFB6C1'), // LightPink
      new THREE.Color('#FFFFFF'), // White
      new THREE.Color('#FFD700'), // Gold
      new THREE.Color('#FF1493'), // DeepPink
    ];

    const trunkColor = new THREE.Color('#4A3728');
    const ribbonColor = new THREE.Color('#F8F8FF'); // GhostWhite

    for (let i = 0; i < COUNT; i++) {
      const isRibbon = i < RIBBON_COUNT;
      
      // -- Tree Shape (Cone) --
      const theta = Math.random() * Math.PI * 2;
      const height = Math.random() * 10 - 5; // -5 to 5
      const normalizedHeight = (height + 5) / 10; // 0 to 1
      const radiusAtHeight = (1 - normalizedHeight) * 3.5;
      
      // Standard tree particle position
      const r = Math.random() * radiusAtHeight;
      const xTree = r * Math.cos(theta);
      const zTree = r * Math.sin(theta);
      const yTree = height;

      // -- Trunk logic --
      const isTrunk = !isRibbon && i > COUNT - (COUNT * 0.1); 
      let treePos: THREE.Vector3;
      
      if (isTrunk) {
        treePos = new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() * 4) - 5, (Math.random() - 0.5) * 0.8);
      } else {
        treePos = new THREE.Vector3(xTree, yTree, zTree);
      }

      // -- Ribbon Logic (Spiral) --
      let ribbonPos = new THREE.Vector3();
      if (isRibbon) {
        const turns = 5;
        const h = (i / RIBBON_COUNT) * 10 - 5; 
        const normH = (h + 5) / 10;
        const spiralRadius = (1 - normH) * 4.2; // Slightly outside
        const angle = normH * Math.PI * 2 * turns;
        
        ribbonPos.set(
          spiralRadius * Math.cos(angle),
          h,
          spiralRadius * Math.sin(angle)
        );
        treePos = ribbonPos.clone();
      }

      // -- Heart Shape --
      const t = Math.random() * Math.PI * 2;
      const hScale = 0.25;
      const xHeart = hScale * (16 * Math.pow(Math.sin(t), 3)) * (1 + (Math.random() - 0.5) * 0.2);
      const yHeart = hScale * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) + 1;
      const zHeart = (Math.random() - 0.5) * 2;
      const heartPos = new THREE.Vector3(xHeart, yHeart, zHeart);

      // -- Scatter Shape --
      const scatterPos = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      // -- Color Assignment --
      let color;
      if (isRibbon) {
        color = ribbonColor;
      } else if (isTrunk) {
        color = trunkColor;
      } else {
        // Randomly pick from the mixed palette
        color = mixedPalette[Math.floor(Math.random() * mixedPalette.length)];
      }

      tempParticles.push({
        id: i,
        initialPos: scatterPos.clone(),
        treePos,
        heartPos,
        scatterPos,
        ribbonPos: isRibbon ? ribbonPos : undefined,
        isRibbon,
        isTrunk,
        color,
        size: isRibbon ? Math.random() * 0.12 + 0.08 : Math.random() * 0.1 + 0.05,
        speed: Math.random() * 0.02 + 0.01,
        phase: Math.random() * Math.PI * 2,
      });
    }
    setParticles(tempParticles);
  }, []);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    const mesh = meshRef.current;
    
    particles.forEach((p, i) => {
      let target = p.treePos;

      if (appState === AppState.SCATTER) {
         target = p.scatterPos;
      } else if (appState === AppState.HEART) {
         target = p.heartPos;
      } else if (appState === AppState.TREE && p.isRibbon && p.ribbonPos) {
         // Ribbon Flow Animation
         const turns = 5;
         const originalH = p.ribbonPos.y; 
         // Flow texture
         const angleOffset = time * -0.5; 
         
         const normH = (originalH + 5) / 10;
         const spiralRadius = (1 - normH) * 4.2;
         const angle = normH * Math.PI * 2 * turns + angleOffset;
         
         target = new THREE.Vector3(
           spiralRadius * Math.cos(angle),
           originalH,
           spiralRadius * Math.sin(angle)
         );
      }

      // Hand Interaction (Swirl in Scatter)
      if (handPosition && (appState === AppState.SCATTER)) {
         const dist = p.initialPos.distanceTo(handPosition);
         if (dist < 4) {
            target = target.clone().add(
                new THREE.Vector3(Math.cos(time + p.id) * 0.5, Math.sin(time + p.id) * 0.5, 0)
            );
         }
      }

      // Sway / Breathe
      const sway = Math.sin(time * 2 + p.phase) * 0.05;
      
      // Interpolate
      p.initialPos.lerp(target, 0.08);

      DUMMY.position.copy(p.initialPos);
      DUMMY.position.y += sway;
      
      // Dynamic scaling
      const scaleBase = p.isRibbon ? 1.2 : 1.0;
      const scale = p.size * scaleBase * (1 + Math.sin(time * 5 + p.phase) * 0.5);
      DUMMY.scale.set(scale, scale, scale);
      
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);

      // Blinking lights (Non-ribbon, non-trunk)
      if (!p.isRibbon && !p.isTrunk && i % 15 === 0) {
         const blink = Math.sin(time * 3 + p.phase) > 0;
         mesh.setColorAt(i, blink ? p.color : p.color.clone().multiplyScalar(0.4));
      } else {
         mesh.setColorAt(i, p.color);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial 
            toneMapped={false}
            emissive={new THREE.Color("#D87093")}
            emissiveIntensity={0.4}
            color="#ffffff"
            roughness={0.2}
            metalness={0.8}
        />
      </instancedMesh>
    </group>
  );
};