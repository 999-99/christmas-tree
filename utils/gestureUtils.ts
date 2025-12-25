import { GestureType } from '../types';

// Helper to calculate distance between two 3D points
const distance = (p1: any, p2: any) => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
};

export const detectGesture = (landmarks: any[]): GestureType => {
  if (!landmarks || landmarks.length === 0) return GestureType.NONE;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const wrist = landmarks[0];
  const indexMCP = landmarks[5]; // Knuckle

  // 1. PINCH Detection
  // Distance between thumb tip and index tip
  const pinchDist = distance(thumbTip, indexTip);
  if (pinchDist < 0.05) {
    return GestureType.PINCH;
  }

  // 2. FIST Detection
  // Check if fingertips are close to the palm/wrist compared to knuckles
  // A simple heuristic: average distance of tips to wrist
  const tips = [indexTip, middleTip, ringTip, pinkyTip];
  let avgDistToWrist = 0;
  tips.forEach(tip => {
    avgDistToWrist += distance(tip, wrist);
  });
  avgDistToWrist /= 4;

  // Thresholds need tuning based on hand size, but relative measures are better.
  // Using a simplified hardcoded threshold for web demo stability.
  if (avgDistToWrist < 0.25) { 
    return GestureType.FIST;
  }

  // 3. OPEN HAND Detection
  // Check if fingers are extended
  // If tips are far from wrist
  if (avgDistToWrist > 0.4) {
    return GestureType.OPEN_HAND;
  }

  return GestureType.NONE;
};