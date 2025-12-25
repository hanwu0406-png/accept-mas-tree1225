import * as THREE from 'three';

export enum AppState {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  HEART = 'HEART',
  PHOTO_VIEW = 'PHOTO_VIEW'
}

export enum GestureType {
  NONE = 'NONE',
  OPEN_PALM = 'OPEN_PALM',
  CLOSED_FIST = 'CLOSED_FIST',
  PINCH = 'PINCH'
}

export interface ParticleData {
  id: number;
  initialPos: THREE.Vector3;
  treePos: THREE.Vector3;
  heartPos: THREE.Vector3;
  scatterPos: THREE.Vector3;
  ribbonPos?: THREE.Vector3;
  isRibbon?: boolean;
  isTrunk?: boolean;
  color: THREE.Color;
  size: number;
  speed: number;
  phase: number;
}

export interface PhotoData {
  id: string;
  url: string;
  position: THREE.Vector3;
}