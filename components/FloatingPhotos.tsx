import React, { useRef, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { PhotoData, AppState } from '../types';

interface FloatingPhotosProps {
  photos: PhotoData[];
  appState: AppState;
  handPosition: THREE.Vector3 | null;
  isPinching: boolean;
}

// Sub-component to handle texture loading and aspect ratio
const PhotoItem = ({ url, position }: { url: string, position: THREE.Vector3 }) => {
  const texture = useLoader(THREE.TextureLoader, url);
  // Default to square if aspect is 0 or undefined, otherwise calculate
  const aspect = (texture.image && texture.image.width && texture.image.height) 
    ? (texture.image.width / texture.image.height) 
    : 1;

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[aspect, 1]} />
        <meshBasicMaterial 
            map={texture} 
            transparent 
            opacity={0.9} 
            side={THREE.DoubleSide} 
            depthWrite={false} 
        />
      </mesh>
    </Billboard>
  );
};

export const FloatingPhotos: React.FC<FloatingPhotosProps> = ({ photos, appState, handPosition, isPinching }) => {
  const groupRef = useRef<THREE.Group>(null);
  const activePhotoId = useRef<string | null>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Check for interaction
    let closestDist = Infinity;
    let closestId: string | null = null;
    const tempVec = new THREE.Vector3();

    // Interaction logic
    // Only allow grabbing in SCATTER mode
    if (handPosition && isPinching && appState === AppState.SCATTER) {
      // Loop through children to find closest in World Space
      groupRef.current.children.forEach((child, idx) => {
         // Ensure child and photo exist (in case of loading async)
         if (!child || !photos[idx]) return;

         child.getWorldPosition(tempVec);
         const dist = handPosition.distanceTo(tempVec);
         
         // Threshold for grabbing
         if (dist < 1.5 && dist < closestDist) {
           closestDist = dist;
           closestId = photos[idx].id;
         }
      });
    }

    if (closestId) {
      activePhotoId.current = closestId;
    } else if (!isPinching) {
      activePhotoId.current = null;
    }

    // Animation loop for group children
    groupRef.current.children.forEach((child, idx) => {
       const photo = photos[idx];
       if (!photo || !child) return;

       const isGrabbed = activePhotoId.current === photo.id;
       
       let targetPos = photo.position.clone();
       // Default scale is smaller (0.35)
       let targetScale = 0.35;

       if (isGrabbed && handPosition) {
         // Transform hand world pos to local pos of the group
         // This allows the photo to stay with the hand even if the group rotates
         const localHand = groupRef.current.worldToLocal(handPosition.clone());
         
         // Move slightly in front of hand
         targetPos = localHand.add(new THREE.Vector3(0, 0, 0.5)); 
         // Zoom scale (Large)
         targetScale = 4.0; 
       } else {
         // Floating animation
         targetPos.y += Math.sin(state.clock.elapsedTime + idx) * 0.002;
       }

       child.position.lerp(targetPos, 0.1);
       
       // Uniform scaling preserves aspect ratio set by planeGeometry
       const currentScale = child.scale.x;
       const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
       child.scale.setScalar(newScale);
       
       // Rotate the inner mesh instead of the Billboard group
       // Billboard group rotation is managed by Drei to face camera
       const innerMesh = child.children[0];
       if (innerMesh) {
           if (!isGrabbed) {
              innerMesh.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + idx) * 0.1;
           } else {
              innerMesh.rotation.z = 0;
           }
       }
    });
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        {photos.map((photo) => (
          <PhotoItem key={photo.id} url={photo.url} position={photo.position} />
        ))}
      </Suspense>
    </group>
  );
};