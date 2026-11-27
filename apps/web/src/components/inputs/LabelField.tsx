import { TextInput, type TextInputProps } from "@mantine/core";
import classes from "./LabelField.module.css";

/** Props of the label field: those of a `TextInput`, and whether it stays at the top of a scrolled form. */
export interface LabelFieldProps extends TextInputProps {
  /** Stays at the top of the panel while the form scrolls. Optional. Default = true (false: a field of a page or of a list). */
  sticky?: boolean;
}

/**
 * Label field of a form (« Libellé », the name of the item), the same in every form: required, and fixed at the top
 * of the side panel while the rest of the form scrolls under it. Other props go to the `TextInput`.
 * @param {LabelFieldProps} props Component props: the label defaults to « Libellé », required by default.
 * @returns {JSX.Element} Field.
 */
export function LabelField({
  label = "Libellé",
  required = true,
  sticky = true,
  className,
  ...others
}: LabelFieldProps) {
  return (
    <TextInput
      label={label}
      required={required}
      className={
        sticky
          ? [classes.sticky, className].filter(Boolean).join(" ")
          : className
      }
      {...others}
    />
  );
}
