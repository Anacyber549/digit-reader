import React, { useEffect, useRef } from 'react';
import { PreprocessedOutput } from '../types';

interface PreprocessedViewProps {
  preprocessed: PreprocessedOutput | null;
}

export const PreprocessedView: React.FC<PreprocessedViewProps> = ({ preprocessed }) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (preprocessed?.canvas28) {
      // Draw 28x28 image scaled up to 112x112 (4x zoom)
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(preprocessed.canvas28, 0, 0, canvas.width, canvas.height);

      // Draw 20x20 bounding box wireframe
      const scale = canvas.width / 28;
      const { dx, dy } = preprocessed.offset;
      const { width: sw, height: sh } = preprocessed.scaledBox;

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)'; // Cyan
      ctx.lineWidth = 1;
      ctx.strokeRect(dx * scale, dy * scale, sw * scale, sh * scale);

      // Draw Center of Mass marker
      const comX = preprocessed.centerOfMass.x * scale;
      const comY = preprocessed.centerOfMass.y * scale;

      ctx.fillStyle = '#f59e0b'; // Amber marker
      ctx.beginPath();
      ctx.arc(comX, comY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Hairline crosshair for Center of Mass
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.beginPath();
      ctx.moveTo(comX - 5, comY);
      ctx.lineTo(comX + 5, comY);
      ctx.moveTo(comX, comY - 5);
      ctx.lineTo(comX, comY + 5);
      ctx.stroke();
    } else {
      // Placeholder empty grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const step = canvas.width / 4;
      for (let x = step; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = step; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }
  }, [preprocessed]);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-200">MNIST Preprocessor View</span>
        <span className="font-mono text-[10px] text-cyan-400">28 × 28 Tensor</span>
      </div>

      <div className="flex items-start gap-3">
        {/* Scaled 28x28 Canvas Preview (112x112) */}
        <div className="relative border border-slate-800 rounded overflow-hidden bg-black shrink-0">
          <canvas
            ref={previewCanvasRef}
            width={112}
            height={112}
            aria-label="28x28 pixel MNIST normalized representation"
            className="w-[112px] h-[112px] block"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Step breakdown */}
        <div className="flex-1 flex flex-col justify-between text-[11px] font-mono text-slate-400 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Bounding Box:</span>
            <span className="text-slate-300">
              {preprocessed?.boundingBox
                ? `${preprocessed.boundingBox.width}×${preprocessed.boundingBox.height}px`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">20×20 Scaled:</span>
            <span className="text-slate-300">
              {preprocessed?.scaledBox
                ? `${preprocessed.scaledBox.width}×${preprocessed.scaledBox.height}px`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Center of Mass:</span>
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {preprocessed?.centerOfMass
                ? `(${preprocessed.centerOfMass.x.toFixed(1)}, ${preprocessed.centerOfMass.y.toFixed(1)})`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Offset in 28×28:</span>
            <span className="text-cyan-400">
              {preprocessed?.offset
                ? `dx:${preprocessed.offset.dx}, dy:${preprocessed.offset.dy}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline Explanation */}
      <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-2">
        Normalized following Yann LeCun's MNIST standard: digit cropped, scaled into a 20×20 box, and centered by center of mass inside 28×28 with pixel values in [0.0, 1.0].
      </p>
    </div>
  );
};
