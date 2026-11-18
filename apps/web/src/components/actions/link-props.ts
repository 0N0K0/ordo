import { Link } from 'react-router';
import type { RowAction } from './ActionsMenu';

/**
 * Props of an element opening an action (link, outside link or file).
 * @param {RowAction} action Action.
 * @returns {object} Props (typed loosely: the polymorphic components take either).
 */
export function linkProps(action: RowAction): object {
  if (action.to) return { component: Link, to: action.to };
  if (action.href) return { component: 'a', href: action.href, ...(action.download ? { download: true } : { target: '_blank', rel: 'noreferrer' }) };
  return {};
}
