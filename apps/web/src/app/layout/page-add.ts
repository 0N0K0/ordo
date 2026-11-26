import { createContext, useContext, useEffect } from 'react';

/**
 * Day a page adds onto (« Ma journée »), read by its own « Ajouter » and by the one of the header: the day shown, and
 * the calendars the page hides (a new event goes to the first one shown).
 */
export interface AddDay {
  /** Day shown (YYYY-MM-DD, Paris), past, today or to come. */
  day: string;
  /** Calendars hidden by the page. */
  hiddenCalendarIds: readonly string[];
}

/** Day the page shown adds onto, and the way the page sets it. */
interface PageAddState {
  /** Day of the page shown; null on a page without one. */
  addDay: AddDay | null;
  setAddDay: (addDay: AddDay | null) => void;
}

export const PageAddContext = createContext<PageAddState>({ addDay: null, setAddDay: () => undefined });

/**
 * Day the page shown adds onto (null on a page without one), as the header « Ajouter » prefills its items with it.
 * @returns {AddDay | null} Day.
 */
export function usePageAddDay(): AddDay | null {
  return useContext(PageAddContext).addDay;
}

/**
 * Tells the header the day this page adds onto, while the page is shown (none once it is left).
 * @param {AddDay | null} addDay Day; null: none yet (its data loading).
 * @returns {void}
 */
export function useProvideAddDay(addDay: AddDay | null): void {
  const { setAddDay } = useContext(PageAddContext);
  const day = addDay?.day ?? null;
  // The ids as one key: a new list with the same ids changes nothing.
  const hidden = addDay ? addDay.hiddenCalendarIds.join(',') : '';
  useEffect(() => {
    setAddDay(day === null ? null : { day, hiddenCalendarIds: hidden ? hidden.split(',') : [] });
    return () => setAddDay(null);
  }, [day, hidden, setAddDay]);
}
