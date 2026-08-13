import { useTranslation } from 'react-i18next';
import { useDSPStore } from '../../store/dsp-store';
import type { SelectedBlock } from '../../types/dsp';
import { INPUT_COLORS, OUTPUT_COLORS } from '../../utils/colors';
import { Tooltip } from '../ui/Tooltip';

const NAV_ITEMS: { block: SelectedBlock; labelKey: string; labelParams?: Record<string, number>; color: string }[] = [
  { block: { type: 'roomEq' }, labelKey: 'nav.roomEq', color: '#22cccc' },
  { block: { type: 'system' }, labelKey: 'nav.system', color: '#888888' },
  { block: { type: 'input', index: 0 }, labelKey: 'nav.input', labelParams: { n: 1 }, color: INPUT_COLORS[0] },
  { block: { type: 'input', index: 1 }, labelKey: 'nav.input', labelParams: { n: 2 }, color: INPUT_COLORS[1] },
  { block: { type: 'routing' }, labelKey: 'nav.routing', color: '#4466ff' },
  { block: { type: 'output', index: 0 }, labelKey: 'nav.output', labelParams: { n: 1 }, color: OUTPUT_COLORS[0] },
  { block: { type: 'output', index: 1 }, labelKey: 'nav.output', labelParams: { n: 2 }, color: OUTPUT_COLORS[1] },
  { block: { type: 'output', index: 2 }, labelKey: 'nav.output', labelParams: { n: 3 }, color: OUTPUT_COLORS[2] },
  { block: { type: 'output', index: 3 }, labelKey: 'nav.output', labelParams: { n: 4 }, color: OUTPUT_COLORS[3] },
];

function blocksEqual(a: SelectedBlock, b: SelectedBlock): boolean {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;
  if (a.type === 'routing' && b.type === 'routing') return true;
  if (a.type === 'roomEq' && b.type === 'roomEq') return true;
  if (a.type === 'system' && b.type === 'system') return true;
  if ('index' in a && 'index' in b) return a.index === b.index;
  return false;
}

/** Small chain-link icon for linked channels */
function LinkIndicator() {
  return (
    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="inline text-accent">
      <path d="M6.5 9.5l3-3" />
      <path d="M4.5 8.5l-1.3 1.3a2.5 2.5 0 0 0 3.5 3.5L8 12" />
      <path d="M11.5 7.5l1.3-1.3a2.5 2.5 0 0 0-3.5-3.5L8 4" />
    </svg>
  );
}

export function SignalFlowNav() {
  const { t } = useTranslation();
  const selectedBlock = useDSPStore((s) => s.selectedBlock);
  const setSelectedBlock = useDSPStore((s) => s.setSelectedBlock);
  const inputLinkGroups = useDSPStore((s) => s.inputLinkGroups);
  const outputLinkGroups = useDSPStore((s) => s.outputLinkGroups);
  const roomEqEnabled = useDSPStore((s) => s.roomEqEnabled);
  const setRoomEqEnabled = useDSPStore((s) => s.setRoomEqEnabled);

  /** Check if a nav item is part of a linked group */
  function isItemLinked(item: (typeof NAV_ITEMS)[number]): boolean {
    if (item.block?.type === 'input') {
      const idx = item.block.index;
      return inputLinkGroups.some((g) => g.includes(idx));
    }
    if (item.block?.type === 'output') {
      const idx = item.block.index;
      return outputLinkGroups.some((g) => g.includes(idx));
    }
    return false;
  }

  /**
   * For an output, return true if its group has another member with a
   * lower index — used to draw a chain icon between adjacent linked
   * outputs in the nav.
   */
  function shouldDrawLinkIconBefore(idx: number): boolean {
    const group = outputLinkGroups.find((g) => g.includes(idx));
    return !!group && group.some((m) => m < idx);
  }

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto">
      {NAV_ITEMS.map((item, i) => {
        const isSelected = blocksEqual(selectedBlock, item.block);
        const linked = isItemLinked(item);
        return (
          <div key={i} className="flex items-center">
            {/* Show link bracket between paired items */}
            {linked && item.block?.type === 'input' && item.block.index === 1 && (
              <LinkIndicator />
            )}
            {linked && item.block?.type === 'output' && shouldDrawLinkIconBefore(item.block.index) && (
              <LinkIndicator />
            )}
            <button
              onClick={() => setSelectedBlock(item.block)}
              className="pill-badge is-toggleable text-xs whitespace-nowrap"
              data-active={isSelected}
              style={{
                ['--pill-color' as string]: item.color,
                opacity: item.block?.type === 'roomEq' && !roomEqEnabled ? 0.55 : 1,
              }}
            >
              {item.labelKey && t(item.labelKey, item.labelParams)}
            </button>
            {item.block?.type === 'roomEq' && (
              <Tooltip content={roomEqEnabled ? t('nav.roomEqOn') : t('nav.roomEqOff')}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={roomEqEnabled}
                  aria-label={roomEqEnabled ? t('nav.disableRoomEq') : t('nav.enableRoomEq')}
                  onClick={() => setRoomEqEnabled(!roomEqEnabled)}
                  className="ml-1 mr-1 inline-flex items-center w-7 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0"
                  style={{
                    backgroundColor: roomEqEnabled ? item.color : '#3a3a4a',
                  }}
                >
                  <span
                    className="block w-3 h-3 rounded-full bg-white transition-transform"
                    style={{
                      transform: roomEqEnabled ? 'translateX(14px)' : 'translateX(2px)',
                    }}
                  />
                </button>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}
