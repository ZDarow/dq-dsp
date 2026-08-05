import { useState } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Toolbar } from './Toolbar';
import { SignalFlowNav } from './SignalFlowNav';
import { SignalFlowDiagram } from '../signal-flow/SignalFlowDiagram';
import { useDSPStore } from '../../store/dsp-store';
import { InputStage } from '../input/InputStage';
import { RoutingMatrix } from '../routing/RoutingMatrix';
import { OutputStage } from '../output/OutputStage';
import { SerialConsole } from '../serial/SerialConsole';
import { AllChannelsResponseChart } from '../eq/AllChannelsResponseChart';
import { RoomEQPanel } from '../room-eq/RoomEQPanel';
import { DriftTuningPanel } from '../drift/DriftTuningPanel';
import { AboutDialog } from '../about/AboutDialog';
import { AppFooter } from './AppFooter';
import { BrowserSupportBanner } from './BrowserSupportBanner';

export function AppShell() {
  useKeyboardShortcuts();
  const [showAbout, setShowAbout] = useState(false);
  const selectedBlock = useDSPStore((s) => s.selectedBlock);
  const serialConsoleOpen = useDSPStore((s) => s.serialConsoleOpen);

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Main content — its own scroll container so the side console can be
       * pinned to the viewport on desktop and not have to grow to match
       * main-column height. */}
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        {/* Toolbar — sticky at top, liquid glass */}
        <div className="sticky top-0 z-40 glass-panel-strong" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
          <BrowserSupportBanner />
          <Toolbar onAbout={() => setShowAbout(true)} />
          <SignalFlowNav />
        </div>

        {/* Signal Flow Diagram — viewport-relative height (vh) so it scales
         * with screen size, not just with rem. Clamped between 8rem and
         * 22rem so it never gets unreadable on phones nor cartoonish on 5K.
         * On 4K (1692-2160px tall): 17vh ≈ 290-370px. On FullHD (1080):
         * 17vh ≈ 184px. On phone (768): clamps to 8rem floor. */}
        <div
          className="px-4 py-2 overflow-x-auto touch-pan-x"
          style={{ height: 'clamp(8rem, 17vh, 22rem)' }}
        >
          <SignalFlowDiagram />
        </div>

        {/* All-channel frequency response overlay */}
        <AllChannelsResponseChart />

        {/* Detail Panel — liquid glass surface */}
        <div className="glass-panel mx-4 mb-4" style={{ borderRadius: 'var(--radius-panel)' }}>
          {selectedBlock?.type === 'input' && <InputStage inputIndex={selectedBlock.index} />}
          {selectedBlock?.type === 'roomEq' && <RoomEQPanel />}
          {selectedBlock?.type === 'routing' && <RoutingMatrix />}
          {selectedBlock?.type === 'output' && <OutputStage outputIndex={selectedBlock.index} />}
          {selectedBlock?.type === 'system' && <DriftTuningPanel />}
          {selectedBlock === null && (
            <div className="flex items-center justify-center h-32 text-text-dimmed text-sm">
              Select a block in the signal flow diagram to configure it
            </div>
          )}
        </div>

        {/* Always-visible footer — version + author */}
        <AppFooter />
      </div>

      {/* Console panels — side panel on desktop, bottom section on mobile */}
      {serialConsoleOpen && <SerialConsole />}

      {/* About dialog */}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}
