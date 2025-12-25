import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Helper to create texture from a character
const createCharTexture = (char: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0,0,64,64);
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(char, 32, 32);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.needsUpdate = true;
    return t;
};

// Sub-component for a specific character system
const CodeSystem = ({ char, color, count }: { char: string, color: string, count: number }) => {
    const mesh = useRef<THREE.Points>(null);
    const texture = useMemo(() => createCharTexture(char, color), [char, color]);

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
          const x = (Math.random() - 0.5) * 30;
          const y = (Math.random() - 0.5) * 30;
          const z = (Math.random() - 0.5) * 30;
          const speed = 0.03 + Math.random() * 0.1;
          temp.push({ x, y, z, speed });
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
            let y = positions[i * 3 + 1];
            y -= particles[i].speed;
            if (y < -15) {
                y = 15;
                positions[i * 3] = (Math.random() - 0.5) * 30; // Randomize X
                positions[i * 3 + 2] = (Math.random() - 0.5) * 30; // Randomize Z
            }
            positions[i * 3 + 1] = y;
        }
        mesh.current.geometry.attributes.position.needsUpdate = true;
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
                map={texture}
                size={0.15} // Small size as requested
                transparent
                opacity={0.8}
                alphaTest={0.1}
                depthWrite={false}
                sizeAttenuation={true}
                color="#FFFFFF" // Tint managed by texture
            />
        </points>
    );
}

export const FallingCodes = () => {
  return (
    <group>
        <CodeSystem char="0" color="#00FF00" count={200} />
        <CodeSystem char="1" color="#00FF00" count={200} />
        <CodeSystem char="Σ" color="#00FFFF" count={100} />
        <CodeSystem char="π" color="#FFFF00" count={100} />
        <CodeSystem char="{}" color="#FF00FF" count={100} />
    </group>
  );
};