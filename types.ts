import * as THREE from 'three';

export enum AppMode {
  TREE = 'TREE',       // Closed cone state
  SCATTER = 'SCATTER', // Open floating state
  FOCUS = 'FOCUS'      // Single photo zoomed in
}

export enum GestureType {
  NONE = 'NONE',
  OPEN_HAND = 'OPEN_HAND',
  FIST = 'FIST',
  PINCH = 'PINCH'
}

export interface ParticleData {
  id: string;
  mesh: THREE.Mesh;
  type: 'GOLD_SPHERE' | 'APPLE' | 'STAR' | 'BELL' | 'PHOTO';
  treePos: THREE.Vector3;    // Target position in Tree mode
  scatterPos: THREE.Vector3; // Target position in Scatter mode
  rotationSpeed: THREE.Vector3;
  initialScale: number;      // Store original scale to restore after hiding
}

export interface HandData {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  gesture: GestureType;
  isPresent: boolean;
}