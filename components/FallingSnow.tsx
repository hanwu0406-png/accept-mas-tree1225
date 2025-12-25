import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const FallingSnow = ({ count = 1500 }) => {
  const mesh = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 25;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 25;
      const speed = 0.02 + Math.random() * 0.08;
      temp.push({ x, y, z, originalY: y, speed });
    }
    return temp;
  }, [count]);

  const initialPositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    particles.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
    });
    return pos;
  }, [particles, count]);

  useFrame(() => {
    if (!mesh.current) return;
    
    const positions = mesh.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      // Update Y
      let y = positions[i * 3 + 1];
      y -= particles[i].speed;
      
      // Reset if below floor
      if (y < -10) {
        y = 10;
        // Randomize X/Z slightly on reset for variety
        positions[i * 3] = (Math.random() - 0.5) * 25;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 25;
      }
      
      positions[i * 3 + 1] = y;
    }
    
    mesh.current.geometry.attributes.position.needsUpdate = true;
    
    // Slight wind rotation
    mesh.current.rotation.y += 0.0005;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={initialPositions.length / 3}
          array={initialPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#FFF0F5"
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};