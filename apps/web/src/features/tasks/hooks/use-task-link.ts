import { useLocation, useNavigate, type To } from 'react-router';

/** URL parameter holding the id of the task open in the side panel (its number is only unique in its project). */
export const TASK_PARAM = 'task';

/**
 * Links to tasks: the task opens in the side panel over the current page (?task=<id>), keeping the other
 * parameters (view, tab…).
 * @returns {{ to: (id: string) => To, open: (id: string) => void, close: () => void }} Link helpers.
 */
export function useTaskLink() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  /**
   * Current location with the task parameter set (or removed).
   * @param {string | null} id Task id, or null to close.
   * @returns {To} Location.
   */
  const to = (id: string | null): To => {
    const params = new URLSearchParams(search);
    if (id === null) params.delete(TASK_PARAM);
    else params.set(TASK_PARAM, id);
    const query = params.toString();
    return { pathname, search: query ? `?${query}` : '' };
  };

  return {
    to: (id: string) => to(id),
    open: (id: string) => navigate(to(id)),
    close: () => navigate(to(null), { replace: true }),
  };
}
