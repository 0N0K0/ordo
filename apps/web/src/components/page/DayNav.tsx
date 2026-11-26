import { addDays } from '@ordo/shared';
import { DateField } from '../inputs/DateField';
import { PICKER_FORMATS } from '../../lib/format';
import { parisToday } from '../../lib/dates';
import { PeriodNav } from './PeriodNav';

interface DayNavProps {
  /** Day shown (YYYY-MM-DD). */
  day: string;
  /** Changes the day shown. */
  onChange: (day: string) => void;
}

/**
 * Navigation between days, the same everywhere a page shows one day (« Ma journée »):
 * « Aujourd’hui », the previous day, the day shown in a date picker (its weekday written out), the next day; today in
 * Paris.
 * @param {DayNavProps} props Component props.
 * @returns {JSX.Element} Navigation.
 */
export function DayNav({ day, onChange }: DayNavProps) {
  const today = parisToday();
  return (
    <PeriodNav
      current={day === today}
      // eslint-disable-next-line no-restricted-syntax -- the navigation between days itself.
      labels={{ previous: 'Jour précédent', next: 'Jour suivant' }}
      onToday={() => onChange(today)}
      onPrevious={() => onChange(addDays(day, -1))}
      onNext={() => onChange(addDays(day, 1))}
    >
      <DateField
        aria-label="Jour"
        value={day}
        onChange={(value) => value && onChange(value)}
        valueFormat={PICKER_FORMATS.weekday}
        w={240}
        styles={{ input: { textAlign: 'center', textTransform: 'capitalize' } }}
      />
    </PeriodNav>
  );
}
