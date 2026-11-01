import { Button, FileButton, Group, Input, Stack, Text } from '@mantine/core';
import { ICON_MIME_TYPES, MAX_ICON_BYTES } from '@ordo/shared';
import { ImageIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { EntityAvatar } from './EntityAvatar';

export interface IconValue {
  /** Newly chosen file. */
  file: File | null;
  /** Whether the current icon must be removed. */
  remove: boolean;
}

interface IconFieldProps {
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
export function IconField({ value, onChange, currentUrl, name, color, error }: IconFieldProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shownUrl = previewUrl ?? (value.remove ? null : currentUrl);

  /**
   * Validates the chosen file before keeping it.
   * @param {File | null} file Chosen file.
   * @returns {void}
   */
  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!(ICON_MIME_TYPES as readonly string[]).includes(file.type)) {
      setLocalError('Format non pris en charge (JPG, PNG, WebP ou SVG).');
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setLocalError('Image trop lourde (1 Mo maximum).');
      return;
    }
    setLocalError(null);
    onChange({ file, remove: false });
  };

  return (
    <Input.Wrapper label="Icône" error={localError ?? error}>
      <Group gap="md" mt={4}>
        <EntityAvatar name={name || '?'} iconUrl={shownUrl} color={color} size="lg" radius="md" />
        <Stack gap={4}>
          <Group gap="xs">
            <FileButton onChange={handleFile} accept={ICON_MIME_TYPES.join(',')}>
              {(props) => (
                <Button {...props} variant="default" size="xs" leftSection={<ImageIcon aria-hidden />}>
                  Choisir une image
                </Button>
              )}
            </FileButton>
            {shownUrl && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<TrashIcon aria-hidden />}
                onClick={() => onChange({ file: null, remove: true })}
              >
                Retirer
              </Button>
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
