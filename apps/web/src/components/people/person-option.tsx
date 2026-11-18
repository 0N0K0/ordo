import type { ComboboxItem, ComboboxLikeRenderOptionInput } from '@mantine/core';
import type { ReactNode } from 'react';
import { PersonOption } from './people-rows';

/** A person an option of a select stands for: name (initials), avatar, handle. */
interface OptionPerson {
  name: string;
  avatarUrl?: string | null;
  handle?: string | null;
}

/**
 * Drawing of the options of a select of people (`renderOption`): the avatar of the person of the option, its label,
 * and its handle (optional).
 * @param {ReadonlyMap<string, OptionPerson>} byId People, by the value of their option.
 * @param {{ handle?: boolean }} [options] Whether the handle is shown (« @tom »). Optional. Default = true.
 * @returns {(item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode} Drawing of an option.
 */
export function personOptionRenderer(byId: ReadonlyMap<string, OptionPerson>, { handle = true }: { handle?: boolean } = {}): (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode {
  return ({ option }) => {
    const person = byId.get(option.value);
    return <PersonOption name={person?.name ?? option.label} label={option.label} avatarUrl={person?.avatarUrl} hint={handle && person?.handle ? `@${person.handle}` : undefined} />;
  };
}
