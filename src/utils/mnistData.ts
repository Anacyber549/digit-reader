import * as tf from '@tensorflow/tfjs';

const MNIST_IMAGES_SPRITE_PATH = 'https://storage.googleapis.com/learnjs-data/model-builder/mnist_images.png';
const MNIST_LABELS_PATH = 'https://storage.googleapis.com/learnjs-data/model-builder/mnist_labels_uint8';

export const IMAGE_SIZE = 784; // 28 * 28
export const NUM_CLASSES = 10;
export const NUM_DATASET_ELEMENTS = 65000;

export class MnistDataset {
  private datasetImages: Float32Array | null = null;
  private datasetLabels: Uint8Array | null = null;

  async load(onProgress?: (percent: number, step: string) => void): Promise<void> {
    if (this.datasetImages && this.datasetLabels) {
      return;
    }

    onProgress?.(10, 'Connecting to MNIST dataset repository...');

    try {
      // 1. Fetch sprite image
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const imgRequest = new Promise<void>((resolve, reject) => {
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          img.width = img.naturalWidth;
          img.height = img.naturalHeight;

          canvas.width = img.width;
          canvas.height = img.height;
          if (!ctx) {
            reject(new Error('Failed to get 2d canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0);

          const datasetBytesView = new Float32Array(
            (img.width * img.height) / 4
          );

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < datasetBytesView.length; i++) {
            datasetBytesView[i] = imgData.data[i * 4] / 255;
          }

          this.datasetImages = datasetBytesView;
          resolve();
        };
        img.onerror = (err) => reject(new Error('Failed to load MNIST sprite: ' + String(err)));
        img.src = MNIST_IMAGES_SPRITE_PATH;
      });

      onProgress?.(30, 'Downloading MNIST labels...');
      // 2. Fetch labels
      const labelsRequest = fetch(MNIST_LABELS_PATH).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching labels`);
        const buffer = await res.arrayBuffer();
        this.datasetLabels = new Uint8Array(buffer);
      });

      await Promise.all([imgRequest, labelsRequest]);
      onProgress?.(100, 'MNIST dataset ready.');
    } catch (err) {
      console.warn('Online MNIST download failed, falling back to procedural MNIST generator:', err);
      // Fallback: Generate procedural augmented digit dataset for offline/restricted environments
      onProgress?.(50, 'Initializing offline procedural MNIST generator...');
      this.generateProceduralDataset(4000);
      onProgress?.(100, 'Procedural training dataset ready.');
    }
  }

  /**
   * Generates procedural handwritten digits using canvas bezier/arc strokes
   * as a fail-safe fallback when external CDN is inaccessible.
   */
  private generateProceduralDataset(count: number) {
    this.datasetImages = new Float32Array(count * IMAGE_SIZE);
    this.datasetLabels = new Uint8Array(count * NUM_CLASSES);

    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let i = 0; i < count; i++) {
      const digit = i % 10;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 28, 28);
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2.5 + Math.random() * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Slight jitter/variations
      const ox = (Math.random() - 0.5) * 3;
      const oy = (Math.random() - 0.5) * 3;

      renderDigitOnCanvas(ctx, digit, ox, oy);

      const imgData = ctx.getImageData(0, 0, 28, 28);
      const imgOffset = i * IMAGE_SIZE;
      for (let p = 0; p < IMAGE_SIZE; p++) {
        this.datasetImages[imgOffset + p] = imgData.data[p * 4] / 255;
      }

      // One-hot label
      const labelOffset = i * NUM_CLASSES;
      this.datasetLabels[labelOffset + digit] = 1;
    }
  }

  getTrainData(numExamples = 2000): { xs: tf.Tensor4D; labels: tf.Tensor2D } {
    if (!this.datasetImages || !this.datasetLabels) {
      throw new Error('Dataset not loaded yet. Call load() first.');
    }

    const totalAvailable = Math.floor(this.datasetImages.length / IMAGE_SIZE);
    const count = Math.min(numExamples, totalAvailable);

    const xsSlice = this.datasetImages.slice(0, count * IMAGE_SIZE);
    const labelsSlice = this.datasetLabels.slice(0, count * NUM_CLASSES);

    const xs = tf.tensor4d(xsSlice, [count, 28, 28, 1]);
    const labels = tf.tensor2d(labelsSlice, [count, NUM_CLASSES]);

    return { xs, labels };
  }

  getTestData(numExamples = 400): { xs: tf.Tensor4D; labels: tf.Tensor2D } {
    if (!this.datasetImages || !this.datasetLabels) {
      throw new Error('Dataset not loaded yet. Call load() first.');
    }

    const totalAvailable = Math.floor(this.datasetImages.length / IMAGE_SIZE);
    const count = Math.min(numExamples, totalAvailable - 1000);
    const startIdx = Math.max(0, totalAvailable - count);

    const xsSlice = this.datasetImages.slice(startIdx * IMAGE_SIZE, (startIdx + count) * IMAGE_SIZE);
    const labelsSlice = this.datasetLabels.slice(startIdx * NUM_CLASSES, (startIdx + count) * NUM_CLASSES);

    const xs = tf.tensor4d(xsSlice, [count, 28, 28, 1]);
    const labels = tf.tensor2d(labelsSlice, [count, NUM_CLASSES]);

    return { xs, labels };
  }
}

/**
 * Procedural stroke generator for each digit (0-9)
 */
export function renderDigitOnCanvas(ctx: CanvasRenderingContext2D, digit: number, ox = 0, oy = 0) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath();

  switch (digit) {
    case 0:
      ctx.ellipse(14, 14, 6.5, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 1:
      ctx.moveTo(11, 8);
      ctx.lineTo(14, 5);
      ctx.lineTo(14, 23);
      ctx.stroke();
      break;
    case 2:
      ctx.arc(14, 9, 5, Math.PI, 0);
      ctx.lineTo(8, 22);
      ctx.lineTo(20, 22);
      ctx.stroke();
      break;
    case 3:
      ctx.arc(13, 10, 4.5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(13, 17, 5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    case 4:
      ctx.moveTo(18, 22);
      ctx.lineTo(18, 5);
      ctx.lineTo(8, 16);
      ctx.lineTo(21, 16);
      ctx.stroke();
      break;
    case 5:
      ctx.moveTo(19, 6);
      ctx.lineTo(10, 6);
      ctx.lineTo(9, 13);
      ctx.arc(13, 16, 5.5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    case 6:
      ctx.moveTo(18, 6);
      ctx.quadraticCurveTo(7, 10, 8, 17);
      ctx.arc(13, 17, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 7:
      ctx.moveTo(8, 6);
      ctx.lineTo(20, 6);
      ctx.lineTo(11, 23);
      ctx.stroke();
      break;
    case 8:
      ctx.arc(14, 10, 4.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(14, 17, 5.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 9:
      ctx.arc(14, 11, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(19, 11);
      ctx.quadraticCurveTo(19, 18, 10, 23);
      ctx.stroke();
      break;
  }
  ctx.restore();
}
