import { createContext } from "react";

/** Whether the content is in a modal (given by `openModal` and the repetition modal): its buttons go to its footer (`DialogFooter`). */
export const InModalContext = createContext(false);
