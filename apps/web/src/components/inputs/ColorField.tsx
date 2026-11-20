// eslint-disable-next-line no-restricted-imports -- ColorField wraps ColorInput.
import { ColorInput, type ColorInputProps } from '@mantine/core';
import { useRef } from 'react';
import { useColorSwatches } from '../../lib/use-color-swatches';

/** Props of a color field: those of Mantine's `ColorInput` (but its palette), and when its color is chosen. */
type ColorFieldProps = Omit<ColorInputProps, 'format' | 'swatches' | 'swatchesPerRow' | 'onChangeEnd'> & {
  /**
   * The color chosen: at once when picked (a swatch, the picker, the eyedropper), on leaving the field when typed (a
   * color typed half way is not one). Uncontrolled (`defaultValue`): only when it changed. Optional.
   */
  onCommit?: (color: string) => void;
};

/**
 * Color field of a form, the same everywhere: hex color, the palette of the theme in rows of 9. Its color is chosen
 * (`onCommit`) at once when picked, on leaving it when typed: in a panel saved field by field, `commitProps` of
 * `useFieldSave`.
 * @param {ColorFieldProps} props Field props (label: « Couleur » by default).
 * @returns {JSX.Element} Field.
 */
export function ColorField({ label = 'Couleur', onCommit, onChange, onFocus, onBlur, wrapperProps, ...props }: ColorFieldProps) {
  const swatches = useColorSwatches();
  // Typing in the field: Mantine tells a valid color typed as it tells one picked (`onChangeEnd`).
  const typing = useRef(false);
  // Color since the field was entered (fixed by Mantine on leaving it) and, uncontrolled, the last one chosen.
  const latest = useRef(props.value ?? props.defaultValue ?? '');
  const chosen = useRef(props.value ?? props.defaultValue ?? '');

  /**
   * Tells the color chosen (uncontrolled: when it changed).
   * @param {string} color Color.
   * @returns {void}
   */
  const choose = (color: string) => {
    if (props.value === undefined && color === chosen.current) return;
    chosen.current = color;
    onCommit?.(color);
  };

  return (
    <ColorInput
      label={label}
      format="hex"
      swatches={swatches}
      swatchesPerRow={9}
      {...props}
      wrapperProps={{
        ...wrapperProps,
        onChangeCapture: () => {
          typing.current = true;
          queueMicrotask(() => (typing.current = false));
        },
      }}
      onFocus={(event) => {
        // Controlled: the value given (changed elsewhere too).
        if (props.value !== undefined) latest.current = props.value;
        onFocus?.(event);
      }}
      onChange={(color) => {
        latest.current = color;
        onChange?.(color);
      }}
      onChangeEnd={(color) => {
        if (!typing.current) choose(color);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        choose(latest.current);
      }}
    />
  );
}
