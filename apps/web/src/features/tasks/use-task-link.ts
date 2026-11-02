import { useLocation, useNavigate, type To } from 'react-router';

/** URL parameter holding the number of the task open in the side panel. */
export const TASK_PARAM = 'task';

/**
 * Links to tasks: the task opens in the side panel over the current page (?task=12),
 * keeping the other parameters (view, tab…).
 * @returns {{ to: (number: number) => To, open: (number: number) => void, close: () => void }} Link helpers.
 */
export function useTaskLink() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  /**
   * Current location with the task parameter set (or removed).
   * @param {number | null} number Task number, or null to close.
   * @returns {To} Location.
   */
  const to = (number: number | null): To => {
    const params = new URLSearchParams(search);
    if (number === null) params.delete(TASK_PARAM);
    else params.set(TASK_PARAM, String(number));
    const query = params.toString();
    return { pathname, search: query ? `?${query}` : '' };
  };

  return {
    to: (number: number) => to(number),
    open: (number: number) => navigate(to(number)),
    close: () => navigate(to(null), { replace: true }),
  };
}
