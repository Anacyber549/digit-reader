import React, { useState } from 'react';
import { Play, RotateCw, CheckCircle, Database, Cpu, Activity, Trash2 } from 'lucide-react';
import { TrainingProgress } from '../types';

interface TrainingDashboardProps {
  progress: TrainingProgress;
  isTraining: boolean;
  hasSaved: boolean;
  onStartTraining: (options: { epochs: number; trainSamples: number; batchSize: number }) => void;
  onClearSavedModel: () => void;
}

export const TrainingDashboard: React.FC<TrainingDashboardProps> = ({
  progress,
  isTraining,
  hasSaved,
  onStartTraining,
  onClearSavedModel,
}) => {
  const [epochs, setEpochs] = useState<number>(5);
  const [trainSamples, setTrainSamples] = useState<number>(2000);
  const [batchSize] = useState<number>(64);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  const handleStart = () => {
    onStartTraining({ epochs, trainSamples, batchSize });
  };

  // SVG Chart Dimensions
  const chartWidth = 520;
  const chartHeight = 140;
  const padding = { top: 15, right: 25, bottom: 25, left: 40 };

  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  // Compute Loss and Accuracy SVG paths
  const history = progress.history;
  const maxEpochs = Math.max(epochs, history.length);

  // Accuracy coordinates (0.0 to 1.0)
  const accuracyPoints = history.map((pt, idx) => {
    const x = padding.left + (idx / Math.max(1, maxEpochs - 1)) * innerW;
    const y = padding.top + (1 - Math.min(1, Math.max(0, pt.accuracy))) * innerH;
    return { x, y, val: pt.accuracy, epoch: pt.epoch };
  });

  // Loss coordinates (normalized up to max loss e.g. 2.5 or dynamic)
  const maxLoss = Math.max(1.5, ...history.map((pt) => pt.loss));
  const lossPoints = history.map((pt, idx) => {
    const x = padding.left + (idx / Math.max(1, maxEpochs - 1)) * innerW;
    const y = padding.top + (1 - Math.min(1, Math.max(0, pt.loss / maxLoss))) * innerH;
    return { x, y, val: pt.loss, epoch: pt.epoch };
  });

  const accuracyPath = accuracyPoints.length > 0
    ? accuracyPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    : '';

  const lossPath = lossPoints.length > 0
    ? lossPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    : '';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-5 w-full">
      {/* Screen Reader Announcement for Training Progress */}
      <div role="status" aria-live="polite" className="sr-only">
        {isTraining
          ? `Training in progress: Epoch ${progress.currentEpoch} of ${progress.totalEpochs}. Loss: ${progress.currentLoss.toFixed(
              3
            )}, Accuracy: ${(progress.currentAccuracy * 100).toFixed(1)}%.`
          : progress.status === 'completed'
          ? `Training completed successfully. Final accuracy: ${(
              progress.currentAccuracy * 100
            ).toFixed(1)}%. Model saved to IndexedDB.`
          : 'Training dashboard idle.'}
      </div>

      {/* Header & Storage Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">CNN Model Training on MNIST</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Train a convolutional network directly inside your browser via WebGL / TensorFlow.js.
          </p>
        </div>

        {/* Persistence Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasSaved ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium">Saved in IndexedDB (Loads instantly)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs border border-slate-700">
              <Database className="w-3.5 h-3.5" />
              <span>No model saved yet</span>
            </div>
          )}

          {hasSaved && (
            <button
              type="button"
              onClick={() => {
                if (showConfirmClear) {
                  onClearSavedModel();
                  setShowConfirmClear(false);
                } else {
                  setShowConfirmClear(true);
                }
              }}
              className="text-xs text-slate-400 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
              title={showConfirmClear ? 'Click again to confirm delete' : 'Delete saved model'}
              aria-label="Delete saved model from IndexedDB"
            >
              {showConfirmClear ? (
                <span className="text-[11px] text-rose-400 font-mono font-semibold">Confirm?</span>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Training Controls Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Epoch Selector */}
        <div className="flex flex-col gap-1">
          <label htmlFor="epochs-select" className="text-xs font-medium text-slate-400">
            Training Epochs
          </label>
          <select
            id="epochs-select"
            value={epochs}
            disabled={isTraining}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:border-cyan-500 disabled:opacity-50"
          >
            <option value={3}>3 Epochs (Fast ~6s)</option>
            <option value={5}>5 Epochs (Recommended ~12s)</option>
            <option value={8}>8 Epochs (High Accuracy ~18s)</option>
            <option value={10}>10 Epochs (Deep ~25s)</option>
          </select>
        </div>

        {/* Dataset Size Selector */}
        <div className="flex flex-col gap-1">
          <label htmlFor="samples-select" className="text-xs font-medium text-slate-400">
            Training Samples
          </label>
          <select
            id="samples-select"
            value={trainSamples}
            disabled={isTraining}
            onChange={(e) => setTrainSamples(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:border-cyan-500 disabled:opacity-50"
          >
            <option value={1200}>1,200 Digits (Ultra Quick)</option>
            <option value={2000}>2,000 Digits (Balanced)</option>
            <option value={3500}>3,500 Digits (Higher Generalization)</option>
            <option value={5000}>5,000 Digits (Benchmark)</option>
          </select>
        </div>

        {/* Action Button */}
        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={handleStart}
            disabled={isTraining}
            className={`w-full py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              isTraining
                ? 'bg-slate-800 text-cyan-400 cursor-wait'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow'
            }`}
          >
            {isTraining ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Training CNN...</span>
              </>
            ) : hasSaved ? (
              <>
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retrain New Model</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Train Model on MNIST</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Training Telemetry Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
            Epoch Progress
          </span>
          <span className="text-lg font-bold font-mono text-slate-100 tabular-nums">
            {progress.currentEpoch} / {progress.totalEpochs}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {isTraining ? `Batch ${progress.currentBatch}/${progress.totalBatches}` : 'Ready'}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-cyan-400 uppercase font-mono tracking-wider">
            Accuracy (Train)
          </span>
          <span className="text-lg font-bold font-mono text-cyan-300 tabular-nums">
            {progress.currentAccuracy > 0
              ? `${(progress.currentAccuracy * 100).toFixed(1)}%`
              : '—'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Val Acc: {progress.valAccuracy ? `${(progress.valAccuracy * 100).toFixed(1)}%` : '—'}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-amber-400 uppercase font-mono tracking-wider">
            Loss (Cross-Entropy)
          </span>
          <span className="text-lg font-bold font-mono text-amber-300 tabular-nums">
            {progress.currentLoss > 0 ? progress.currentLoss.toFixed(4) : '—'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Val Loss: {progress.valLoss ? progress.valLoss.toFixed(4) : '—'}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
            Elapsed Time
          </span>
          <span className="text-lg font-bold font-mono text-slate-100 tabular-nums">
            {progress.elapsedSeconds}s
          </span>
          <span className="text-[10px] text-emerald-400 font-mono truncate">
            {progress.status === 'completed'
              ? 'Saved to Storage'
              : progress.status === 'training'
              ? 'Computing Gradients...'
              : 'IndexedDB Standby'}
          </span>
        </div>
      </div>

      {/* Live Training Status Message */}
      {progress.message && (
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900 px-3 py-2 rounded border border-slate-800">
          <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{progress.message}</span>
        </div>
      )}

      {/* Live Dual SVG Graphs: Loss and Accuracy Curves */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Live Training Curves (Epoch History)</span>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-1 bg-cyan-400 inline-block rounded-full" />
              <span>Accuracy (0–100%)</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-1 bg-amber-400 inline-block rounded-full" />
              <span>Loss (Cross-Entropy)</span>
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto min-w-[420px] select-none block"
            aria-label="Loss and Accuracy line charts showing training progress over epochs"
          >
            {/* Grid Lines */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left + innerW}
              y2={padding.top}
              stroke="#334155"
              strokeDasharray="2,2"
              strokeWidth="0.5"
            />
            <line
              x1={padding.left}
              y1={padding.top + innerH / 2}
              x2={padding.left + innerW}
              y2={padding.top + innerH / 2}
              stroke="#1e293b"
              strokeDasharray="2,2"
              strokeWidth="0.5"
            />
            <line
              x1={padding.left}
              y1={padding.top + innerH}
              x2={padding.left + innerW}
              y2={padding.top + innerH}
              stroke="#334155"
              strokeWidth="1"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + innerH}
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Left Y Axis Labels (Accuracy %) */}
            <text
              x={padding.left - 6}
              y={padding.top + 4}
              textAnchor="end"
              className="fill-cyan-400 font-mono text-[9px]"
            >
              100%
            </text>
            <text
              x={padding.left - 6}
              y={padding.top + innerH / 2 + 3}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[9px]"
            >
              50%
            </text>
            <text
              x={padding.left - 6}
              y={padding.top + innerH}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[9px]"
            >
              0%
            </text>

            {/* Right Y Axis Labels (Loss) */}
            <text
              x={padding.left + innerW + 6}
              y={padding.top + 4}
              textAnchor="start"
              className="fill-amber-400 font-mono text-[9px]"
            >
              {maxLoss.toFixed(1)}
            </text>
            <text
              x={padding.left + innerW + 6}
              y={padding.top + innerH}
              textAnchor="start"
              className="fill-amber-400 font-mono text-[9px]"
            >
              0.0
            </text>

            {/* Accuracy Curve (Cyan) */}
            {accuracyPath && (
              <path
                d={accuracyPath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Accuracy Data Points */}
            {accuracyPoints.map((pt, i) => (
              <g key={`acc-${i}`}>
                <circle cx={pt.x} cy={pt.y} r="3.5" fill="#06b6d4" stroke="#0f172a" strokeWidth="1" />
                <text
                  x={pt.x}
                  y={Math.max(padding.top + 8, pt.y - 6)}
                  textAnchor="middle"
                  className="fill-cyan-200 font-mono text-[8px] font-bold"
                >
                  {(pt.val * 100).toFixed(0)}%
                </text>
              </g>
            ))}

            {/* Loss Curve (Amber) */}
            {lossPath && (
              <path
                d={lossPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4,2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Loss Data Points */}
            {lossPoints.map((pt, i) => (
              <g key={`loss-${i}`}>
                <circle cx={pt.x} cy={pt.y} r="3" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
              </g>
            ))}

            {/* X Axis Ticks (Epochs) */}
            {Array.from({ length: maxEpochs }).map((_, i) => {
              const x = padding.left + (i / Math.max(1, maxEpochs - 1)) * innerW;
              return (
                <text
                  key={`epoch-tick-${i}`}
                  x={x}
                  y={padding.top + innerH + 15}
                  textAnchor="middle"
                  className="fill-slate-400 font-mono text-[9px]"
                >
                  E{i + 1}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
