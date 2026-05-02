import { useDSPStore } from '../../store/dsp-store';
import { INPUT_COLORS, OUTPUT_COLORS } from '../../utils/colors';
import { NUM_INPUTS, NUM_OUTPUTS } from '../../constants/filter-options';
import { CrosspointCell } from './CrosspointCell';

export function RoutingMatrix() {
  const routing = useDSPStore((s) => s.routing);
  const toggleRoutingPoint = useDSPStore((s) => s.toggleRoutingPoint);
  const setRoutingGain = useDSPStore((s) => s.setRoutingGain);
  const setRoutingPreset = useDSPStore((s) => s.setRoutingPreset);

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-sm font-bold text-accent">Routing Matrix (2x4)</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setRoutingPreset('stereo')}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg transition-colors"
          >
            Stereo
          </button>
          <button
            onClick={() => setRoutingPreset('mono')}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg transition-colors"
          >
            Mono
          </button>
          <button
            onClick={() => setRoutingPreset('clear')}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="inline-grid gap-2" style={{ gridTemplateColumns: `auto repeat(${NUM_OUTPUTS}, 80px)` }}>
        {/* Header row */}
        <div />
        {Array.from({ length: NUM_OUTPUTS }, (_, o) => (
          <div key={`hdr-${o}`} className="text-center text-xs font-bold" style={{ color: OUTPUT_COLORS[o] }}>
            Out {o + 1}
          </div>
        ))}

        {/* Matrix rows */}
        {Array.from({ length: NUM_INPUTS }, (_, i) => (
          <>
            <div key={`lbl-${i}`} className="flex items-center text-xs font-bold pr-2" style={{ color: INPUT_COLORS[i] }}>
              In {i + 1}
            </div>
            {Array.from({ length: NUM_OUTPUTS }, (_, o) => (
              <CrosspointCell
                key={`${i}-${o}`}
                crosspoint={routing[i][o]}
                inputIndex={i}
                outputIndex={o}
                inputColor={INPUT_COLORS[i]}
                outputColor={OUTPUT_COLORS[o]}
                onToggle={() => toggleRoutingPoint(i, o)}
                onGainChange={(gain) => setRoutingGain(i, o, gain)}
              />
            ))}
          </>
        ))}
      </div>
    </div>
  );
}
