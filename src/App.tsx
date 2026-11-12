import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { BrainCircuit, Sparkles, Sliders, CheckCircle2, AlertTriangle, Info, BookOpen } from 'lucide-react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { PreprocessedView } from './components/PreprocessedView';
import { PredictionOutput } from './components/PredictionOutput';
import { TrainingDashboard } from './components/TrainingDashboard';
import { preprocessCanvas } from './utils/mnistPreprocessor';
import { MnistDataset } from './utils/mnistData';
import {
  hasSavedModel,
  loadSavedModel,
  deleteSavedModel,
  trainModel,
  predictDigit,
} from './utils/mnistModel';
import { PredictionResult, PreprocessedOutput, TrainingProgress } from './types';

export default function App() {
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [modelStatus, setModelStatus] = useState<'checking' | 'ready' | 'not-trained' | 'training' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prediction and Canvas Preprocessing
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [preprocessed, setPreprocessed] = useState<PreprocessedOutput | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);

  // Dataset singleton
  const datasetRef = useRef<MnistDataset>(new MnistDataset());

  // Training state
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>({
    status: 'idle',
    currentEpoch: 0,
    totalEpochs: 5,
    currentBatch: 0,
    totalBatches: 0,
    currentLoss: 0,
    currentAccuracy: 0,
    valLoss: null,
    valAccuracy: null,
    history: [],
    elapsedSeconds: 0,
  });

  // Check and load saved model from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;

    async function initModel() {
      try {
        const saved = await hasSavedModel();
        if (saved) {
          const loadedModel = await loadSavedModel();
          if (loadedModel && isMounted) {
            setModel(loadedModel);
            setHasSaved(true);
            setModelStatus('ready');
            return;
          }
        }
        if (isMounted) {
          setHasSaved(false);
          setModelStatus('not-trained');
        }
      } catch (err) {
        console.error('Model initialization error:', err);
        if (isMounted) {
          setModelStatus('not-trained');
        }
      }
    }

    initModel();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Training execution
  const handleStartTraining = async (options: {
    epochs: number;
    trainSamples: number;
    batchSize: number;
  }) => {
    setModelStatus('training');
    setErrorMessage(null);

    try {
      const newModel = await trainModel(datasetRef.current, {
        epochs: options.epochs,
        trainSamples: options.trainSamples,
        batchSize: options.batchSize,
        onProgress: (prog) => {
          setTrainingProgress({ ...prog });
        },
      });

      setModel(newModel);
      setHasSaved(true);
      setModelStatus('ready');
    } catch (err) {
      console.error('Training failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Training failed');
      setModelStatus('error');
    }
  };

  // Handle Clearing saved model
  const handleClearSavedModel = async () => {
    await deleteSavedModel();
    setModel(null);
    setHasSaved(false);
    setModelStatus('not-trained');
    setPrediction(null);
    setTrainingProgress((prev) => ({
      ...prev,
      history: [],
      currentEpoch: 0,
      currentLoss: 0,
      currentAccuracy: 0,
      status: 'idle',
      message: 'Model removed from IndexedDB.',
    }));
  };

  // Preprocess canvas whenever drawing updates
  const handleCanvasChange = useCallback((canvas: HTMLCanvasElement) => {
    const output = preprocessCanvas(canvas);
    setPreprocessed(output);
  }, []);

  // Handle prediction request
  const handlePredict = async (canvas: HTMLCanvasElement) => {
    if (!model) {
      // Prompt user to train the model first
      const trainingSection = document.getElementById('training-section');
      trainingSection?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const output = preprocessCanvas(canvas);
    if (!output) {
      setPrediction(null);
      return;
    }

    setPreprocessed(output);
    setIsPredicting(true);

    try {
      const result = await predictDigit(model, output.tensorData);
      setPrediction(result);
    } catch (err) {
      console.error('Prediction inference error:', err);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleClear = useCallback(() => {
    setPrediction(null);
    setPreprocessed(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        {/* Zone 1: Single Wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-black shadow">
            <span className="font-mono text-base">7</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Digit Reader</span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a href="#canvas-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
            Drawing Canvas
          </a>
          <a href="#preprocessing-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
            MNIST Centering
          </a>
          <a href="#training-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
            Model Training
          </a>
        </nav>

        {/* Zone 3: Primary Status & Action */}
        <div className="flex items-center gap-3 shrink-0">
          {modelStatus === 'ready' ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2 py-1 rounded">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>CNN Ready</span>
              </span>
              <a
                href="#training-section"
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Retrain
              </a>
            </div>
          ) : modelStatus === 'training' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/60 px-2.5 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Training CNN...</span>
            </span>
          ) : (
            <a
              href="#training-section"
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-500 rounded-md hover:bg-cyan-400 transition-colors whitespace-nowrap"
            >
              Train Model
            </a>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Banner if model is not trained yet */}
        {modelStatus === 'not-trained' && (
          <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-amber-200">No CNN Model Stored Yet</h2>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Train a lightweight convolutional neural network on MNIST directly in your browser. It takes only ~10 seconds and saves to IndexedDB for instant future loads.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleStartTraining({ epochs: 5, trainSamples: 2000, batchSize: 64 })}
              className="px-4 py-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 transition-colors shadow"
            >
              Train Now (~10s)
            </button>
          </div>
        )}

        {/* Primary Interactive Workspace: 2-Column Split */}
        <section id="canvas-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Canvas & Preprocessor (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 flex flex-col items-center">
              <DrawingCanvas
                onPredict={handlePredict}
                onClear={handleClear}
                onCanvasChange={handleCanvasChange}
                isPredicting={isPredicting}
                disabled={modelStatus === 'training'}
              />
            </div>

            {/* Live LeCun Preprocessor Inspection */}
            <div id="preprocessing-section">
              <PreprocessedView preprocessed={preprocessed} />
            </div>
          </div>

          {/* Right Column: Prediction Output & Probability Breakdown (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <PredictionOutput prediction={prediction} isLoading={isPredicting} />

            {/* Accessibility & Keyboard Shortcuts Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Accessibility & Keyboard Controls</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Fully operable via keyboard and assistive technology. Probability meters and predictions are announced via an <code className="text-cyan-400 font-mono text-[11px]">aria-live</code> screen reader status region. Rank indicators and high-contrast labels ensure confidence is never signaled by color alone.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded border border-slate-800">
                  <kbd className="px-1 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px]">P / Enter</kbd>
                  <span className="text-slate-400">Predict</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded border border-slate-800">
                  <kbd className="px-1 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px]">C / Esc</kbd>
                  <span className="text-slate-400">Clear</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded border border-slate-800">
                  <kbd className="px-1 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px]">Ctrl+Z</kbd>
                  <span className="text-slate-400">Undo</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded border border-slate-800">
                  <kbd className="px-1 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px]">0–9</kbd>
                  <span className="text-slate-400">Sample</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: In-Browser Model Training & Live Performance Curves */}
        <section id="training-section" className="pt-4">
          <TrainingDashboard
            progress={trainingProgress}
            isTraining={modelStatus === 'training'}
            hasSaved={hasSaved}
            onStartTraining={handleStartTraining}
            onClearSavedModel={handleClearSavedModel}
          />
        </section>
      </main>

      {/* Clean Uncluttered Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Digit Reader · TensorFlow.js Browser CNN with LeCun MNIST Normalization</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>280×280 Canvas</span>
            <span aria-hidden="true">·</span>
            <span>20×20 Centered Box</span>
            <span aria-hidden="true">·</span>
            <span>IndexedDB Persistence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
