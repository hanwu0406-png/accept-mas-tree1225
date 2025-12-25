import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { GestureType } from "./types";

export class HandRecognitionService {
  private handLandmarker: HandLandmarker | null = null;
  private runningMode: "IMAGE" | "VIDEO" = "VIDEO";

  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numHands: 2
    });
  }

  detect(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null {
    if (!this.handLandmarker) return null;
    return this.handLandmarker.detectForVideo(video, timestamp);
  }

  // Improved heuristic gesture classifier
  classifyGesture(result: HandLandmarkerResult): { type: GestureType; handCenter: {x: number, y: number} | null, pinchDistance: number } {
    if (!result.landmarks || result.landmarks.length === 0) {
      return { type: GestureType.NONE, handCenter: null, pinchDistance: 0 };
    }

    const landmarks = result.landmarks[0]; // Primary hand
    
    // Tips
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Bases (MCP)
    const indexMCP = landmarks[5];
    const middleMCP = landmarks[9];
    const wrist = landmarks[0];

    // Distance helper (2D)
    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // Calculate Reference Scale (Palm Size)
    // Distance from Wrist to Middle Finger MCP is a stable proxy for hand size in the frame
    const palmSize = dist(wrist, middleMCP);
    
    // Avoid division by zero or extremely small scale noise
    const safeScale = palmSize < 0.01 ? 0.01 : palmSize;

    // --- 1. PINCH DETECTION ---
    const pinchDist = dist(thumbTip, indexTip);
    // Threshold: 0.65 * safeScale. 
    // If palmSize is 0.1 (far), threshold is 0.065. 
    // If palmSize is 0.3 (close), threshold is 0.195.
    // This makes it sensitive but robust to depth.
    const isPinchCandidate = pinchDist < (safeScale * 0.65);

    // --- 2. FIST DETECTION ---
    // A finger is curled if Tip is close to Wrist relative to palm size.
    // Extended finger tip is usually > 1.5 * palmSize from wrist.
    // Curled finger tip is usually < 1.2 * palmSize from wrist.
    // We use 1.35 as a generous threshold for "not extended".
    const isCurled = (tip: any) => dist(tip, wrist) < (safeScale * 1.35);

    const curledFingers = [indexTip, middleTip, ringTip, pinkyTip].filter(tip => isCurled(tip));
    const curledCount = curledFingers.length;

    // --- DECISION LOGIC ---

    // PRIORITY 1: CLOSED FIST
    // Requires all 4 fingers (Index, Middle, Ring, Pinky) to be curled.
    if (curledCount === 4) {
      return { 
        type: GestureType.CLOSED_FIST, 
        handCenter: {x: wrist.x, y: wrist.y}, 
        pinchDistance: 1 
      };
    }

    // PRIORITY 2: PINCH
    // If not a full fist, but thumb and index are close.
    // We prioritize this over Open Palm.
    if (isPinchCandidate) {
      return { 
        type: GestureType.PINCH, 
        handCenter: {x: indexTip.x, y: indexTip.y}, 
        pinchDistance: pinchDist 
      };
    }

    // PRIORITY 3: OPEN PALM
    // If fewer than 2 fingers are curled (i.e., most are extended).
    if (curledCount <= 1) {
       return { 
         type: GestureType.OPEN_PALM, 
         handCenter: {x: middleMCP.x, y: middleMCP.y}, 
         pinchDistance: 1 
       };
    }

    // Fallback
    return { type: GestureType.NONE, handCenter: null, pinchDistance: 1 };
  }
}