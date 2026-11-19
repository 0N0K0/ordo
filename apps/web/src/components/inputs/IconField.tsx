import { FileButton, Group, Input, Stack, Text } from '@mantine/core';
import { ICON_ERRORS, ICON_MIME_TYPES, MAX_ICON_BYTES } from '@ordo/shared';
import { ImageIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { ItemAvatar } from '../items/ItemAvatar';
import { ActionButton } from '../actions/ActionButton';

export interface IconValue {
  /** Newly chosen file. */
  file: File | null;
  /** Whether the current icon must be removed. */
  remove: boolean;
}

interface IconFieldProps {
  /** Whole image shown, not cropped (client logos). */
  contain?: boolean;
  value: IconValue;
  onChange: (value: IconValue) => void;
  /** Icon currently stored. */
  currentUrl: string | null;
  /** Name and color used for the initials preview. */
  name: string;
  color?: string | null;
  error?: string;
}

/**
 * Icon picker with preview (JPG, PNG, WebP or SVG, 1 MB max).
 * @param {IconFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function IconField({ value, onChange, currentUrl, name, color, error, contain }: IconFieldProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const shownUrl = previewUrl ?? (value.remove ? null : currentUrl);

  /**
   * Validates the chosen file before keeping it.
   * @param {File | null} file Chosen file.
   * @returns {void}
   */
  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!(ICON_MIME_TYPES as readonly string[]).includes(file.type)) {
      setLocalError(ICON_ERRORS.format);
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setLocalError(ICON_ERRORS.tooLarge);
      return;
    }
    setLocalError(null);
    onChange({ file, remove: false });
  };

  return (
    <Input.Wrapper label="Icône" error={localError ?? error}>
      <Group gap="md" mt={4}>
        <ItemAvatar name={name || '?'} iconUrl={shownUrl} color={color ?? 'initials'} size="lg" radius="md" contain={contain} />
        <Stack gap={4}>
          <Group gap="xs">
            <FileButton onChange={handleFile} accept={ICON_MIME_TYPES.join(',')}>
              {(props) => (
                <ActionButton priority="secondary" {...props} size="xs" icon={<ImageIcon aria-hidden />}>
                  Choisir une image
                </ActionButton>
              )}
            </FileButton>
            {shownUrl && (
              <ActionButton priority="tertiary" danger icon={<TrashIcon aria-hidden />} onClick={() => onChange({ file: null, remove: true })}>
                Retirer
              </ActionButton>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            JPG, PNG, WebP ou SVG — 1 Mo maximum.
          </Text>
        </Stack>
      </Group>
    </Input.Wrapper>
  );
}
