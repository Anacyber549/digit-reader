import { PreprocessedOutput } from '../types';

/**
 * Preprocess a 280x280 canvas drawing into MNIST format:
 * - White digit on black background
 * - Cropped to digit bounding box
 * - Scaled into a 20x20 box preserving aspect ratio
 * - Centered by Center of Mass in a 28x28 canvas
 * - Normalized to Float32Array with values [0.0, 1.0]
 */
export function preprocessCanvas(sourceCanvas: HTMLCanvasElement): PreprocessedOutput | null {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Detect bounding box and verify non-empty canvas
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let totalDrawnIntensity = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Support white strokes on dark background or opaque colored ink
      const brightness = Math.max(r, g, b) * (a / 255);

      if (brightness > 20) {
        totalDrawnIntensity += brightness;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If canvas is blank or noise only
  if (maxX === -1 || maxY === -1 || totalDrawnIntensity < 200) {
    return null;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 2. Scale bounding box into a 20x20 box preserving aspect ratio
  let scaledW = 20;
  let scaledH = 20;

  if (cropW >= cropH) {
    scaledW = 20;
    scaledH = Math.max(1, Math.round(20 * (cropH / cropW)));
  } else {
    scaledH = 20;
    scaledW = Math.max(1, Math.round(20 * (cropW / cropH)));
  }

  // Intermediate offscreen canvas for the 20x20 scaled digit
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = scaledW;
  scaledCanvas.height = scaledH;
  const scaledCtx = scaledCanvas.getContext('2d');
  if (!scaledCtx) return null;

  // Draw cropped slice into scaled canvas with bilinear smoothing
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(
    sourceCanvas,
    minX,
    minY,
    cropW,
    cropH,
    0,
    0,
    scaledW,
    scaledH
  );

  const scaledImgData = scaledCtx.getImageData(0, 0, scaledW, scaledH);
  const scaledData = scaledImgData.data;

  // 3. Compute Center of Mass (CoM) on the scaled digit
  let sumIntensity = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < scaledH; y++) {
    for (let x = 0; x < scaledW; x++) {
      const idx = (y * scaledW + x) * 4;
      const r = scaledData[idx];
      const g = scaledData[idx + 1];
      const b = scaledData[idx + 2];
      const a = scaledData[idx + 3];
      const intensity = (Math.max(r, g, b) / 255) * (a / 255);

      if (intensity > 0) {
        sumIntensity += intensity;
        sumX += x * intensity;
        sumY += y * intensity;
      }
    }
  }

  const comX = sumIntensity > 0 ? sumX / sumIntensity : scaledW / 2;
  const comY = sumIntensity > 0 ? sumY / sumIntensity : scaledH / 2;

  // 4. Center by Center of Mass in 28x28 box
  // Target center of mass is 13.5 (the exact center coordinate in [0..27])
  let dx = Math.round(13.5 - comX);
  let dy = Math.round(13.5 - comY);

  // Keep within bounds of 28x28
  dx = Math.max(0, Math.min(28 - scaledW, dx));
  dy = Math.max(0, Math.min(28 - scaledH, dy));

  // 5. Render final 28x28 MNIST canvas
  const canvas28 = document.createElement('canvas');
  canvas28.width = 28;
  canvas28.height = 28;
  const ctx28 = canvas28.getContext('2d');
  if (!ctx28) return null;

  // Black background
  ctx28.fillStyle = '#000000';
  ctx28.fillRect(0, 0, 28, 28);

  // Draw scaled digit at calculated center-of-mass offset
  ctx28.drawImage(scaledCanvas, dx, dy);

  // Extract pixel intensities normalized to [0..1]
  const final28ImgData = ctx28.getImageData(0, 0, 28, 28);
  const tensorData = new Float32Array(28 * 28);

  for (let i = 0; i < 28 * 28; i++) {
    const idx = i * 4;
    const r = final28ImgData.data[idx];
    const g = final28ImgData.data[idx + 1];
    const b = final28ImgData.data[idx + 2];
    const a = final28ImgData.data[idx + 3];
    const val = (Math.max(r, g, b) / 255) * (a / 255);
    tensorData[i] = val;
  }

  return {
    tensorData,
    canvas28,
    centerOfMass: { x: dx + comX, y: dy + comY },
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      width: cropW,
      height: cropH,
    },
    scaledBox: { width: scaledW, height: scaledH },
    offset: { dx, dy },
  };
}
