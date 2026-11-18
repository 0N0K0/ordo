import { useDebouncedValue } from '@mantine/hooks';
import { mailSearchCriteriaSchema, type MailSearchCriteria } from '@ordo/shared';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSetParams } from '../../../lib/search-params';

/** Other URL parameters changed with the search (the page, the mail open…). */
type ParamChanges = Record<string, string | null>;

/**
 * Search of a list of mails kept in the URL: the text typed (`q`), the advanced criteria applied (`adv`, as JSON) and
 * whether the advanced search is open (`advanced=1`). A prefix keeps them apart from the other parameters of a page
 * (`mailQ`, `mailAdv`, `mailAdvanced` in a project). Each setter takes the other parameters to change with it, in the same
 * history entry.
 * @param {string} [prefix] Prefix of the parameters. Optional. Default = none.
 * @returns {object} Text (as typed, and debounced), criteria, open state, and their setters.
 */
export function useMailSearch(prefix = '') {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const key = (name: string) => (prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name);
  const textKey = key('q');
  const advancedKey = key('adv');
  const openKey = key('advanced');
  // The field keeps what is typed (the URL follows); it starts from the URL.
  const [text, setText] = useState(params.get(textKey) ?? '');
  const [debouncedText] = useDebouncedValue(text, 400);
  const rawAdvanced = params.get(advancedKey);
  const advanced = useMemo<MailSearchCriteria | null>(() => {
    try {
      const parsed = mailSearchCriteriaSchema.safeParse(JSON.parse(rawAdvanced ?? 'null'));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [rawAdvanced]);
  const advancedOpen = params.get(openKey) === '1';
  return {
    text,
    debouncedText,
    /**
     * Changes the text searched.
     * @param {string} value Text.
     * @param {ParamChanges} [changes] Other parameters. Optional.
     * @returns {void}
     */
    setText: (value: string, changes: ParamChanges = {}) => {
      setText(value);
      setParams({ [textKey]: value || null, ...changes });
    },
    advanced,
    /**
     * Applies advanced criteria (null: leaves the advanced search, closed).
     * @param {MailSearchCriteria | null} criteria Criteria.
     * @param {ParamChanges} [changes] Other parameters. Optional.
     * @returns {void}
     */
    setAdvanced: (criteria: MailSearchCriteria | null, changes: ParamChanges = {}) =>
      setParams({ [advancedKey]: criteria ? JSON.stringify(criteria) : null, ...(criteria ? {} : { [openKey]: null }), ...changes }),
    advancedOpen,
    /**
     * Opens or closes the advanced search.
     * @param {boolean} open Open.
     * @param {ParamChanges} [changes] Other parameters. Optional.
     * @returns {void}
     */
    setAdvancedOpen: (open: boolean, changes: ParamChanges = {}) => setParams({ [openKey]: open ? '1' : null, ...changes }),
  };
}
