import { useTranslation } from 'react-i18next';
import type { FilterType } from '../../types/filter';
import { FILTER_TYPES } from '../../constants/filter-options';
import { Tooltip } from '../ui/Tooltip';

interface FilterTypeSelectProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
}

export function FilterTypeSelect({ value, onChange }: FilterTypeSelectProps) {
  const { t } = useTranslation();
  const help = t(`filterType.${value}`, { defaultValue: t('filterType.default') });
  return (
    <Tooltip content={help}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FilterType)}
        className="bg-control-bg text-text-primary text-xs px-2 py-1 rounded border border-surface-bg focus:border-accent focus:outline-none"
        aria-label={t('filterType.aria')}
      >
        {FILTER_TYPES.map((ft) => (
          <option key={ft.value} value={ft.value}>
            {ft.label}
          </option>
        ))}
      </select>
    </Tooltip>
  );
}
