import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { PredictionResult } from '../types';

interface PredictionOutputProps {
  prediction: PredictionResult | null;
  isLoading?: boolean;
}

export const PredictionOutput: React.FC<PredictionOutputProps> = ({
  prediction,
  isLoading = false,
}) => {
  // Screen reader announcement message
  const getScreenReaderAnnouncement = () => {
    if (!prediction) return 'No prediction yet. Draw a digit on the canvas and click Predict.';
    if (prediction.isConfident) {
      return `Predicted digit: ${prediction.predictedDigit} with ${(
        prediction.confidence * 100
      ).toFixed(1)}% confidence.`;
    }
    return `Not sure. Top two guesses: digit ${prediction.topTwo[0].digit} at ${(
      prediction.topTwo[0].probability * 100
    ).toFixed(1)}% and digit ${prediction.topTwo[1].digit} at ${(
      prediction.topTwo[1].probability * 100
    ).toFixed(1)}%.`;
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Screen Reader Live Region */}
      <div role="status" aria-live="polite" className="sr-only">
        {getScreenReaderAnnouncement()}
      </div>

      {/* Main Prediction Hero Card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 flex flex-col items-center justify-center min-h-[170px] relative overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Running CNN Inference...</span>
          </div>
        ) : !prediction ? (
          <div className="flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <HelpCircle className="w-8 h-8 text-slate-600 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-400">Awaiting Drawing Input</p>
            <p className="text-xs text-slate-500 mt-1">
              Draw a digit 0–9 on the canvas and click Predict or press <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">P</kbd>
            </p>
          </div>
        ) : prediction.isConfident ? (
          /* Confident Prediction: Top prob >= 60% */
          <div className="flex flex-col items-center text-center w-full">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>High Confidence Prediction</span>
              <span className="text-slate-500 font-mono">(&ge;60%)</span>
            </div>

            {/* Large Predicted Digit */}
            <div
              className="text-7xl sm:text-8xl font-black font-mono tracking-tight text-white my-1 tabular-nums drop-shadow-md select-none"
              aria-label={`Predicted digit ${prediction.predictedDigit}`}
            >
              {prediction.predictedDigit}
            </div>

            <div className="text-sm font-mono text-slate-300 flex items-center gap-2">
              <span>Confidence:</span>
              <span className="text-cyan-400 font-bold text-base tabular-nums">
                {(prediction.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          /* Unconfident Prediction: Top prob < 60% */
          <div className="flex flex-col items-center text-center w-full py-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Low Confidence (&lt;60%)</span>
            </div>

            {/* "Not sure" banner */}
            <div className="text-3xl font-extrabold text-amber-300 font-sans tracking-tight mb-2">
              Not sure
            </div>

            <p className="text-xs text-slate-400 mb-3 max-w-xs">
              Top probability is {(prediction.confidence * 100).toFixed(1)}%, which is below the 60% certainty threshold.
            </p>

            {/* Top Two Guesses Side-by-Side */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {/* Guess 1 */}
              <div className="flex flex-col items-center p-2.5 rounded border border-amber-500/40 bg-amber-950/20">
                <span className="text-[10px] font-mono uppercase text-amber-400/90 font-semibold">
                  #1 Guess
                </span>
                <span className="text-3xl font-black font-mono text-white my-0.5">
                  {prediction.topTwo[0].digit}
                </span>
                <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                  {(prediction.topTwo[0].probability * 100).toFixed(1)}%
                </span>
              </div>

              {/* Guess 2 */}
              <div className="flex flex-col items-center p-2.5 rounded border border-slate-700 bg-slate-800/40">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                  #2 Guess
                </span>
                <span className="text-3xl font-black font-mono text-slate-200 my-0.5">
                  {prediction.topTwo[1].digit}
                </span>
                <span className="text-xs font-mono font-bold text-slate-300 tabular-nums">
                  {(prediction.topTwo[1].probability * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Probability Distribution Bar Chart (Digits 0–9) */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800 text-xs">
          <h3 className="font-semibold text-slate-200">Probability Breakdown (0–9)</h3>
          <span className="text-slate-400 font-mono text-[11px]">Softmax Output</span>
        </div>

        <div className="space-y-2" role="region" aria-label="10-digit probability distribution">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
            const prob = prediction ? prediction.probabilities[digit] : 0;
            const percent = (prob * 100).toFixed(1);
            const isTop1 = prediction && prediction.topTwo[0].digit === digit;
            const isTop2 = prediction && prediction.topTwo[1].digit === digit;

            return (
              <div
                key={digit}
                className={`flex items-center gap-2.5 text-xs py-0.5 px-1 rounded transition-colors ${
                  isTop1
                    ? 'bg-cyan-950/30 font-medium'
                    : isTop2 && !prediction?.isConfident
                    ? 'bg-amber-950/20'
                    : ''
                }`}
              >
                {/* Digit Label */}
                <div className="flex items-center justify-between w-12 shrink-0">
                  <span className="font-mono font-bold text-sm text-slate-200">
                    {digit}
                  </span>
                  {/* Rank Badge - Never color alone */}
                  {isTop1 ? (
                    <span
                      className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      title="Highest Probability Guess"
                    >
                      #1
                    </span>
                  ) : isTop2 ? (
                    <span
                      className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-semibold"
                      title="Second Highest Probability Guess"
                    >
                      #2
                    </span>
                  ) : (
                    <span className="w-4" />
                  )}
                </div>

                {/* Progress Meter Bar */}
                <div
                  className="flex-1 h-3.5 bg-slate-950 border border-slate-800/80 rounded-sm overflow-hidden relative"
                  role="meter"
                  aria-valuenow={parseFloat(percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Digit ${digit} probability: ${percent}%`}
                >
                  <div
                    className={`h-full transition-all duration-300 rounded-sm ${
                      isTop1
                        ? 'bg-cyan-500'
                        : isTop2 && !prediction?.isConfident
                        ? 'bg-amber-500'
                        : 'bg-slate-700'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(prob > 0 ? 1 : 0, prob * 100))}%` }}
                  />
                </div>

                {/* Percentage Value with Tabular Numerals */}
                <div className="w-14 text-right shrink-0">
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isTop1
                        ? 'text-cyan-300 font-bold'
                        : isTop2 && !prediction?.isConfident
                        ? 'text-amber-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend for accessibility & color independence */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
              <span>#1 Top Guess</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              <span>#2 Runner-Up</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Threshold: &ge;60% confidence</span>
        </div>
      </div>
    </div>
  );
};
