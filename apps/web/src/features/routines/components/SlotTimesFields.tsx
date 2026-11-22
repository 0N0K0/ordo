import { Text } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { rangeProps } from '../../../components/inputs/date-range';

/** Times of a moment of the day: from when, and before when, it is done (each optional). */
interface SlotTimes {
  fromTime: string | null;
  dueTime: string | null;
}

/**
 * « dès » and « avant » times of a moment of the day: the other one follows when they cross, « La fin doit suivre le
 * début. » on « avant » when not after « dès » (rangeProps).
 * @param {{ value: SlotTimes, onChange: (times: SlotTimes) => void, name: string, onBlur?: () => void }} props Times, change, the moment named in the labels (« moment 2, cas 1 »), and what follows leaving a time (a panel saving it). `onBlur` optional.
 * @returns {JSX.Element} Two time pickers.
 */
export function SlotTimesFields({ value, onChange, name, onBlur }: { value: SlotTimes; onChange: (times: SlotTimes) => void; name: string; onBlur?: () => void }) {
  const hours = rangeProps({ value: [value.fromTime ?? '', value.dueTime ?? ''], onChange: ([from, due]) => onChange({ fromTime: from || null, dueTime: due || null }) }, true);
  return (
    <>
      <TimePicker size="xs" aria-label={`À partir de, ${name}`} leftSection={<Text size="xs">dès</Text>} {...hours.start} onBlur={onBlur} />
      <TimePicker size="xs" aria-label={`Avant, ${name}`} leftSection={<Text size="xs">avant</Text>} {...hours.end} onBlur={onBlur} />
    </>
  );
}
