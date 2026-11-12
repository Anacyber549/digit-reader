import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, RotateCcw, Sparkles, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { renderDigitOnCanvas } from '../utils/mnistData';

interface DrawingCanvasProps {
  onPredict: (canvas: HTMLCanvasElement) => void;
  onClear: () => void;
  onCanvasChange?: (canvas: HTMLCanvasElement) => void;
  isPredicting?: boolean;
  disabled?: boolean;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  onPredict,
  onClear,
  onCanvasChange,
  isPredicting = false,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState<number>(18); // 18px on 280x280 scales to ~1.8px on 28x28 (MNIST standard)
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with black background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 280, 280);

    setHasDrawn(false);
    setHistory([]);
    onClear();
  }, [onClear]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // Save state for undo
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, 280, 280);
    setHistory((prev) => [...prev.slice(-15), snapshot]);
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // Pop current
    const previous = newHistory[newHistory.length - 1];

    if (previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(newHistory);
      setHasDrawn(true);
      onCanvasChange?.(canvas);
    } else {
      initCanvas();
    }
  }, [history, initCanvas, onCanvasChange]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    saveSnapshot();
    setIsDrawing(true);
    setHasDrawn(true);

    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(coords.x, coords.y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fill();

    onCanvasChange?.(canvas);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    const last = lastPointRef.current;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
      // Midpoint bezier for buttery smooth stroke curves
      const midX = (last.x + coords.x) / 2;
      const midY = (last.y + coords.y) / 2;
      ctx.quadraticCurveTo(last.x, last.y, midX, midY);
      ctx.lineTo(coords.x, coords.y);
    } else {
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(coords.x, coords.y);
    }
    ctx.stroke();

    lastPointRef.current = coords;
    onCanvasChange?.(canvas);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if capture already lost
      }
      onCanvasChange?.(canvas);
    }
  };

  const triggerPredict = useCallback(() => {
    if (canvasRef.current && hasDrawn && !disabled) {
      onPredict(canvasRef.current);
    }
  }, [hasDrawn, disabled, onPredict]);

  // Load a preset sample digit (0-9) onto the canvas for keyboard & quick testing
  const loadSampleDigit = useCallback((digit: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    saveSnapshot();

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 280, 280);

    // Render scaled digit centered in 280x280 (10x scale of 28x28)
    ctx.save();
    ctx.scale(10, 10);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    renderDigitOnCanvas(ctx, digit, 0, 0);
    ctx.restore();

    setHasDrawn(true);
    onCanvasChange?.(canvas);
    onPredict(canvas);
  }, [saveSnapshot, onCanvasChange, onPredict]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input field
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'p' || e.key === 'P' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        triggerPredict();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Escape') {
        e.preventDefault();
        initCanvas();
      } else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        loadSampleDigit(parseInt(e.key, 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerPredict, initCanvas, handleUndo, loadSampleDigit]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Top canvas controls bar */}
      <div className="flex items-center justify-between w-full max-w-[280px] text-xs text-slate-400">
        <span className="font-medium text-slate-300">280 × 280 Input Canvas</span>
        <div className="flex items-center gap-2">
          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5" role="group" aria-label="Stroke width selector">
            <span className="text-[10px] text-slate-500 uppercase mr-1">Pen:</span>
            {[14, 18, 24].map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => setStrokeWidth(width)}
                aria-pressed={strokeWidth === width}
                aria-label={`Stroke thickness ${width} pixels`}
                className={`w-4 h-4 rounded text-[10px] font-mono flex items-center justify-center transition-colors ${
                  strokeWidth === width
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {width === 14 ? 'S' : width === 18 ? 'M' : 'L'}
              </button>
            ))}
          </div>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            aria-pressed={showGrid}
            aria-label="Toggle centering guide grid"
            title="Toggle guide grid"
            className={`p-1 rounded border transition-colors ${
              showGrid
                ? 'bg-slate-800 text-cyan-400 border-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            {showGrid ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas container with exact 280x280 aspect ratio */}
      <div className="relative group">
        <div className="relative w-[280px] h-[280px] rounded-lg border-2 border-slate-800 bg-black overflow-hidden shadow-2xl focus-within:ring-2 focus-within:ring-cyan-500 transition-all">
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            tabIndex={0}
            role="application"
            aria-label="Drawing canvas. Use mouse, touch, or stylus to draw a digit 0 through 9. Alternatively, press keys 0 through 9 to load sample digits."
            className="drawing-canvas w-[280px] h-[280px] cursor-crosshair block"
          />

          {/* Centering crosshair and 20x20 guide grid overlay */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              aria-hidden="true"
            >
              {/* Subtle 28x28 equivalent grid lines */}
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                }}
              />
              {/* LeCun 20x20 Target Bounding Box Center Guide (200x200 px) */}
              <div className="w-[200px] h-[200px] border border-cyan-500/25 border-dashed rounded-sm flex items-center justify-center">
                <span className="text-[10px] text-cyan-500/40 font-mono tracking-widest uppercase select-none">
                  20×20 Crop Zone
                </span>
              </div>
              {/* Crosshair Center */}
              <div className="absolute w-4 h-[1px] bg-cyan-500/40" />
              <div className="absolute h-4 w-[1px] bg-cyan-500/40" />
            </div>
          )}

          {/* Empty canvas hint overlay */}
          {!hasDrawn && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-600 p-4 text-center select-none"
              aria-hidden="true"
            >
              <p className="text-sm font-medium text-slate-500">Draw a single digit here</p>
              <p className="text-xs text-slate-600 mt-1">Mouse · Touch · Stylus</p>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Buttons: Predict & Clear */}
      <div className="flex items-center gap-3 w-full max-w-[280px]">
        <button
          type="button"
          onClick={triggerPredict}
          disabled={!hasDrawn || disabled || isPredicting}
          aria-label="Predict drawn digit (Keyboard shortcut: P or Enter)"
          className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
            hasDrawn && !disabled && !isPredicting
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isPredicting ? 'Predicting...' : 'Predict'}</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-black/20 rounded border border-black/10">
            P
          </kbd>
        </button>

        <button
          type="button"
          onClick={initCanvas}
          disabled={disabled || (!hasDrawn && history.length === 0)}
          aria-label="Clear drawing canvas (Keyboard shortcut: C or Escape)"
          className="py-2.5 px-3 rounded-md font-medium text-sm border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eraser className="w-4 h-4" />
          <span>Clear</span>
          <kbd className="hidden sm:inline-block ml-0.5 px-1 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-800 rounded">
            C
          </kbd>
        </button>

        <button
          type="button"
          onClick={handleUndo}
          disabled={disabled || history.length === 0}
          aria-label="Undo last brush stroke (Keyboard shortcut: Ctrl+Z or Cmd+Z)"
          title="Undo stroke"
          className="p-2.5 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Accessible Quick Test Samples (0-9) */}
      <div className="w-full max-w-[280px] pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span className="font-medium text-slate-400">Quick Test Samples:</span>
          <span className="font-mono text-[10px]">Keys 0–9</span>
        </div>
        <div className="grid grid-cols-10 gap-1 w-full" role="group" aria-label="Load authentic sample digits">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => loadSampleDigit(digit)}
              aria-label={`Load sample digit ${digit} onto canvas`}
              className="py-1 px-0 rounded border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 text-slate-300 text-xs font-mono font-bold transition-colors"
            >
              {digit}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
