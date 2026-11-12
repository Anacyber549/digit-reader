import * as tf from '@tensorflow/tfjs';
import { PredictionResult, TrainingMetricPoint, TrainingProgress } from '../types';
import { MnistDataset } from './mnistData';

export const MODEL_STORAGE_KEY = 'indexeddb://digit-reader-cnn-v1';

/**
 * Creates a standard convolutional neural network (CNN) for MNIST digit classification
 */
export function createCnnModel(): tf.Sequential {
  const model = tf.sequential();

  // First Convolutional Layer
  model.add(
    tf.layers.conv2d({
      inputShape: [28, 28, 1],
      kernelSize: 3,
      filters: 16,
      activation: 'relu',
      kernelInitializer: 'varianceScaling',
    })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

  // Second Convolutional Layer
  model.add(
    tf.layers.conv2d({
      kernelSize: 3,
      filters: 32,
      activation: 'relu',
      kernelInitializer: 'varianceScaling',
    })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

  // Flatten and Dense Layers
  model.add(tf.layers.flatten());
  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelInitializer: 'varianceScaling',
    })
  );
  model.add(tf.layers.dropout({ rate: 0.25 }));

  // Output 10 classes (digits 0 - 9) with softmax
  model.add(
    tf.layers.dense({
      units: 10,
      activation: 'softmax',
      kernelInitializer: 'varianceScaling',
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

/**
 * Checks if a trained model is saved in browser IndexedDB
 */
export async function hasSavedModel(): Promise<boolean> {
  try {
    const models = await tf.io.listModels();
    return Boolean(models[MODEL_STORAGE_KEY]);
  } catch (err) {
    console.warn('Could not query IndexedDB models:', err);
    return false;
  }
}

/**
 * Loads the saved model from IndexedDB
 */
export async function loadSavedModel(): Promise<tf.LayersModel | null> {
  try {
    const exists = await hasSavedModel();
    if (!exists) return null;
    const model = await tf.loadLayersModel(MODEL_STORAGE_KEY);
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    return model;
  } catch (err) {
    console.error('Failed to load model from IndexedDB:', err);
    return null;
  }
}

/**
 * Deletes the saved model from IndexedDB
 */
export async function deleteSavedModel(): Promise<boolean> {
  try {
    await tf.io.removeModel(MODEL_STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn('Error removing model:', err);
    return false;
  }
}

/**
 * Trains the CNN on MNIST data in the browser and saves to IndexedDB
 */
export async function trainModel(
  dataset: MnistDataset,
  options: {
    epochs?: number;
    batchSize?: number;
    trainSamples?: number;
    onProgress?: (progress: TrainingProgress) => void;
  }
): Promise<tf.LayersModel> {
  const epochs = options.epochs ?? 5;
  const batchSize = options.batchSize ?? 64;
  const trainSamples = options.trainSamples ?? 2000;
  const startTime = Date.now();

  const progress: TrainingProgress = {
    status: 'preparing-data',
    currentEpoch: 0,
    totalEpochs: epochs,
    currentBatch: 0,
    totalBatches: Math.ceil(trainSamples / batchSize),
    currentLoss: 0,
    currentAccuracy: 0,
    valLoss: null,
    valAccuracy: null,
    history: [],
    elapsedSeconds: 0,
    message: 'Loading MNIST dataset...',
  };

  options.onProgress?.({ ...progress });

  // 1. Ensure dataset is loaded
  await dataset.load((percent, step) => {
    progress.message = `${step} (${percent}%)`;
    options.onProgress?.({ ...progress });
  });

  progress.status = 'training';
  progress.message = 'Initializing CNN architecture...';
  options.onProgress?.({ ...progress });

  const model = createCnnModel();
  const { xs: trainXs, labels: trainLabels } = dataset.getTrainData(trainSamples);
  const { xs: testXs, labels: testLabels } = dataset.getTestData(400);

  const totalBatchesPerEpoch = Math.ceil(trainSamples / batchSize);

  try {
    await model.fit(trainXs, trainLabels, {
      batchSize,
      epochs,
      validationData: [testXs, testLabels],
      shuffle: true,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          progress.currentBatch = batch + 1;
          progress.totalBatches = totalBatchesPerEpoch;
          progress.currentLoss = logs?.loss ?? 0;
          progress.currentAccuracy = logs?.acc ?? 0;
          progress.elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
          progress.message = `Epoch ${progress.currentEpoch}/${epochs} · Batch ${progress.currentBatch}/${totalBatchesPerEpoch}`;
          options.onProgress?.({ ...progress });
          // Allow UI thread to breathe
          await tf.nextFrame();
        },
        onEpochEnd: async (epoch, logs) => {
          const point: TrainingMetricPoint = {
            epoch: epoch + 1,
            loss: logs?.loss ?? 0,
            accuracy: logs?.acc ?? 0,
            valLoss: logs?.val_loss,
            valAccuracy: logs?.val_acc,
          };
          progress.currentEpoch = epoch + 1;
          progress.currentLoss = point.loss;
          progress.currentAccuracy = point.accuracy;
          progress.valLoss = point.valLoss ?? null;
          progress.valAccuracy = point.valAccuracy ?? null;
          progress.history.push(point);
          progress.elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
          progress.message = `Epoch ${epoch + 1} completed · Accuracy: ${(point.accuracy * 100).toFixed(1)}%`;
          options.onProgress?.({ ...progress });
          await tf.nextFrame();
        },
      },
    });

    // 2. Save model into IndexedDB
    progress.message = 'Saving model to browser IndexedDB...';
    options.onProgress?.({ ...progress });
    await model.save(MODEL_STORAGE_KEY);

    progress.status = 'completed';
    progress.message = `Model successfully trained & saved to IndexedDB in ${progress.elapsedSeconds}s!`;
    options.onProgress?.({ ...progress });
  } finally {
    // Dispose training tensors to prevent WebGL/CPU memory leak
    trainXs.dispose();
    trainLabels.dispose();
    testXs.dispose();
    testLabels.dispose();
  }

  return model;
}

/**
 * Predicts a digit from a 784-element Float32Array (28x28 normalized [0..1])
 */
export async function predictDigit(
  model: tf.LayersModel,
  tensorData: Float32Array
): Promise<PredictionResult> {
  const inputTensor = tf.tensor4d(tensorData, [1, 28, 28, 1]);
  const outputTensor = model.predict(inputTensor) as tf.Tensor;
  const probabilitiesTyped = await outputTensor.data();
  const probabilities = Array.from(probabilitiesTyped);

  // Free memory
  inputTensor.dispose();
  outputTensor.dispose();

  let maxProb = -1;
  let predictedDigit = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > maxProb) {
      maxProb = probabilities[i];
      predictedDigit = i;
    }
  }

  // Rank all digits to find top two
  const ranked = probabilities
    .map((p, d) => ({ digit: d, probability: p }))
    .sort((a, b) => b.probability - a.probability);

  const topTwo: [{ digit: number; probability: number }, { digit: number; probability: number }] = [
    ranked[0] ?? { digit: 0, probability: 0 },
    ranked[1] ?? { digit: 1, probability: 0 },
  ];

  return {
    predictedDigit,
    probabilities,
    confidence: maxProb,
    isConfident: maxProb >= 0.60,
    topTwo,
    timestamp: Date.now(),
  };
}
