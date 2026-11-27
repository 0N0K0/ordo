import { useContext, type ReactNode } from "react";
import { InModalContext } from "./in-modal";
import classes from "./DialogFooter.module.css";

/**
 * Footer of a modal, always visible: its content scrolls above it, its buttons never at the bottom of the content.
 * Out of a modal (a form of the side panel), the buttons as they are. Used by `FormActions` and `DestructiveActions`.
 * @param {{ children: ReactNode }} props Component props: the buttons.
 * @returns {JSX.Element} Footer.
 */
export function DialogFooter({ children }: { children: ReactNode }) {
  const inModal = useContext(InModalContext);
  if (!inModal) return <>{children}</>;
  return <div className={classes.footer}>{children}</div>;
}
