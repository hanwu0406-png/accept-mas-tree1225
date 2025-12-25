import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

import { AppState, GestureType, PhotoData } from './types';
import { HandRecognitionService } from './handRecognition';
import { MagicParticles } from './components/MagicParticles';
import { FloatingPhotos } from './components/FloatingPhotos';
import { FallingSnow } from './components/FallingSnow';

const handService = new HandRecognitionService();

interface RotatingSceneProps {
  children: React.ReactNode;
  gesture: GestureType;
  handPos: THREE.Vector3 | null;
}

// Wrapper for rotating the entire scene content
const RotatingScene: React.FC<RotatingSceneProps> = ({ children, gesture, handPos }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lastHandX = useRef<number>(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      let speed = 0.2; // Base speed slightly slower for elegance
      
      // If Open Palm and hand moving, rotate faster (Wave to rotate)
      if (gesture === GestureType.OPEN_PALM && handPos) {
        const deltaX = handPos.x - lastHandX.current;
        // Sensitivity for wave rotation
        if (Math.abs(deltaX) > 0.02) {
            speed += Math.abs(deltaX) * 15;
        }
        lastHandX.current = handPos.x;
      }

      groupRef.current.rotation.y += delta * speed;
    }
  });
  return <group ref={groupRef}>{children}</group>;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [gesture, setGesture] = useState<GestureType>(GestureType.NONE);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [handPos, setHandPos] = useState<THREE.Vector3 | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);

  const startCamera = async () => {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // Check if ref is available (it should be now as we render it hidden)
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                
                // Start prediction loop
                predictWebcam();
                
                setCameraActive(true);
            }
        }
    } catch (err) {
        console.error("Camera access denied or failed", err);
        alert("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
      setCameraActive(false);
      setGesture(GestureType.NONE);
      setHandPos(null);
      // Cancel animation frame if running
      if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = null;
      }
  };

  const toggleGestures = () => {
      if (cameraActive) {
          stopCamera();
      } else {
          startCamera();
      }
  };

  useEffect(() => {
    const initVision = async () => {
      await handService.initialize();
      setLoading(false);
    };
    initVision();
    return () => {
      stopCamera();
    };
  }, []);

  const predictWebcam = () => {
    // If camera was stopped, exit loop
    if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.paused || videoRef.current.ended) {
       return; 
    }

    if (videoRef.current.readyState === 4) {
      const result = handService.detect(videoRef.current, Date.now());
      if (result) {
        const { type, handCenter } = handService.classifyGesture(result);
        
        setGesture(type);
        
        if (handCenter) {
          const x3d = (0.5 - handCenter.x) * 10;
          const y3d = (0.5 - handCenter.y) * 8; 
          setHandPos(new THREE.Vector3(x3d, y3d, 0));
        } else {
           setHandPos(null);
        }

        setIsPinching(type === GestureType.PINCH);

        // State Machine
        if (type === GestureType.OPEN_PALM) setAppState(AppState.SCATTER);
        if (type === GestureType.CLOSED_FIST) setAppState(AppState.TREE);
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPhotos: PhotoData[] = [];
      Array.from(e.target.files).forEach(file => {
          if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            newPhotos.push({
                id: uuidv4(),
                url,
                position: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8)
            });
          }
      });
      
      setPhotos(prev => [...prev, ...newPhotos]);
      setAppState(AppState.SCATTER); 
    }
  };

  return (
    <div className="w-full h-screen relative bg-black text-white overflow-hidden">
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none p-6 box-border">
        
        {/* Top Left: Title and Instructions */}
        <div className="absolute top-8 left-8 pointer-events-auto z-20">
          <h1 className="font-mountains text-6xl text-pink-300 drop-shadow-[0_0_20px_rgba(255,182,193,0.6)] tracking-wider">
            Merry Accept-mas
          </h1>
          <p className="font-playfair text-pink-100 italic mt-2 opacity-80 text-lg mb-6">
             Gesture: <span className="font-bold uppercase tracking-widest text-pink-400">
               {cameraActive ? gesture : 'OFF'}
             </span>
          </p>

           <div className="space-y-3 text-sm text-pink-50 font-sans bg-black/60 p-5 rounded-xl backdrop-blur-md border border-pink-900/40 shadow-xl max-w-xs">
             <p className="flex items-center gap-3"><span className="text-xl">🖐</span> Open & Wave: Scatter/Spin</p>
             <p className="flex items-center gap-3"><span className="text-xl">✊</span> Fist: Tree</p>
             <p className="flex items-center gap-3"><span className="text-xl">👌</span> Pinch: Zoom Photo</p>
          </div>
        </div>

        {/* Top Right: Camera, Upload, Toggle */}
        <div className="absolute top-8 right-8 pointer-events-auto flex flex-col items-end gap-6 z-20">
           {/* Camera Frame */}
           <div className="relative w-96 h-72 bg-black rounded-xl border-2 border-pink-500/50 shadow-[0_0_25px_rgba(255,105,180,0.2)] overflow-hidden">
              
              {/* Always render video to ensure ref is valid, hide if inactive */}
              <video 
                ref={videoRef} 
                className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                playsInline 
                muted
              />

              {!cameraActive && (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900/80 z-10">
                     <div className="text-center">
                         <p className="text-pink-300 font-cinzel mb-2">Camera Disabled</p>
                         <p className="text-xs text-gray-400 max-w-[200px]">Enable gestures to interact with the magic tree.</p>
                     </div>
                </div>
              )}
              
              {!cameraActive && !loading && (
                 <div className="absolute inset-0 flex items-center justify-center z-20">
                    <button 
                      onClick={startCamera}
                      className="bg-pink-700 hover:bg-pink-600 text-white px-5 py-2 rounded-full font-cinzel text-sm shadow-[0_0_15px_rgba(255,105,180,0.5)] border border-pink-400/50 transition-transform hover:scale-105"
                    >
                      Enable Gestures
                    </button>
                 </div>
              )}
           </div>

            {/* Controls Row */}
           <div className="flex gap-4">
             <button 
                onClick={toggleGestures}
                className={`px-4 py-2 rounded-full font-cinzel text-sm border transition-all ${
                    cameraActive 
                    ? 'bg-pink-900/80 border-pink-500 text-pink-100' 
                    : 'bg-gray-900/80 border-gray-500 text-gray-100'
                }`}
             >
                Gestures {cameraActive ? 'ON' : 'OFF'}
             </button>

              <label className="cursor-pointer bg-gradient-to-r from-pink-900/90 to-black hover:from-pink-800 hover:to-gray-900 text-pink-100 px-6 py-2 rounded-full border border-pink-500/30 transition-all shadow-[0_0_15px_rgba(255,20,147,0.4)] font-cinzel flex items-center gap-3 group">
                <span className="group-hover:text-white transition-colors">Upload Folder</span>
                {/* @ts-ignore: React 19 / TypeScript might not have full webkitdirectory definitions yet */}
                <input type="file" webkitdirectory="" directory="" multiple onChange={handleFileUpload} className="hidden" />
              </label>
           </div>
           
           {cameraActive && <div className="text-xs text-pink-400 font-cinzel animate-pulse flex items-center gap-2 px-2">
             <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span> Live Vision Active
           </div>}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-pink-500 font-cinzel text-3xl animate-pulse tracking-widest">Loading Magic...</div>
        </div>
      )}

      {/* 3D Scene */}
      <Canvas camera={{ position: [0, 0, 16], fov: 45 }} gl={{ antialias: false }}>
        <color attach="background" args={['#000501']} />
        
        {/* Lights */}
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#FFD700" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#D87093" />
        
        <Environment preset="night" />

        <RotatingScene gesture={gesture} handPos={handPos}>
            <MagicParticles 
            appState={appState} 
            handPosition={handPos} 
            uploadedImageTexture={null} 
            />
            
            <FloatingPhotos 
            photos={photos} 
            appState={appState} 
            handPosition={handPos} 
            isPinching={isPinching}
            />
        </RotatingScene>
        
        <FallingSnow count={1500} />

        {/* Additional Ambient Sparkles */}
        <Sparkles 
           count={100} 
           scale={20} 
           size={3} 
           speed={0.2} 
           opacity={0.3} 
           color="#FFC0CB" 
        />
        
        <EffectComposer enableNormalPass={false}>
           <Bloom 
             luminanceThreshold={0.2} 
             mipmapBlur 
             intensity={1.5} 
             radius={0.6}
           />
           <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>

        <OrbitControls enableZoom={true} enablePan={false} maxPolarAngle={Math.PI / 1.8} />
      </Canvas>
    </div>
  );
}