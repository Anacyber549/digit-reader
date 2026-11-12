export interface PredictionResult {
  predictedDigit: number | null;
  probabilities: number[]; // Length 10, sum ~ 1.0
  confidence: number; // 0 to 1
  isConfident: boolean; // confidence >= 0.60
  topTwo: [
    { digit: number; probability: number },
    { digit: number; probability: number }
  ];
  timestamp: number;
}

export interface TrainingMetricPoint {
  epoch: number;
  batch?: number;
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
}

export interface TrainingProgress {
  status: 'idle' | 'preparing-data' | 'training' | 'completed' | 'error';
  currentEpoch: number;
  totalEpochs: number;
  currentBatch: number;
  totalBatches: number;
  currentLoss: number;
  currentAccuracy: number;
  valLoss: number | null;
  valAccuracy: number | null;
  history: TrainingMetricPoint[];
  elapsedSeconds: number;
  message?: string;
}

export interface PreprocessedOutput {
  tensorData: Float32Array; // 28 * 28 = 784 numbers between 0 and 1
  canvas28: HTMLCanvasElement; // 28x28 canvas for visualization
  centerOfMass: { x: number; y: number };
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null;
  scaledBox: { width: number; height: number };
  offset: { dx: number; dy: number };
}

export type ModelSource = 'saved-indexeddb' | 'freshly-trained' | 'pretrained' | 'none';
