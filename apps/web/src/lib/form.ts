import { schemaResolver, useForm, type UseFormReturnType } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
import { GraphQLRequestError } from './graphql-client';
import { notifyFailure, notifySuccess } from './notify';
import { usePanelFlush } from '../components/panels/panels';

type Schema = Parameters<typeof schemaResolver>[0];

/**
 * Form with the app validation rules: validated on blur, then on every change once a field has an error.
 * @param {object} options Form options.
 * @param {Values} options.initialValues Initial values.
 * @param {Schema} options.schema Standard schema (zod) validating the values.
 * @returns {UseFormReturnType<Values>} Mantine form.
 */
export function useAppForm<Values extends Record<string, unknown>>({ initialValues, schema }: { initialValues: Values; schema: Schema }): UseFormReturnType<Values> {
  const formRef = useRef<UseFormReturnType<Values> | null>(null);

  const form = useForm<Values>({
    mode: 'controlled',
    initialValues,
    validate: schemaResolver(schema, { sync: true }),
    validateInputOnBlur: true,
    clearInputErrorOnChange: false,
    onValuesChange: (values, previous) => {
      const current = formRef.current;
      if (!current) return;
      for (const field of Object.keys(values)) {
        if (values[field] !== previous[field] && current.errors[field]) current.validateField(field);
      }
    },
  });

  useEffect(() => {
    formRef.current = form;
  });

  return form;
}

/**
 * Shows an API error: per-field messages on the form (when one of the fields is in it), otherwise a toast.
 * @param {UseFormReturnType<Values>} form Form to annotate.
 * @param {unknown} error Error raised by the mutation.
 * @returns {void}
 */
export function showFormError<Values>(form: UseFormReturnType<Values>, error: unknown): void {
  const values = form.getValues() as Record<string, unknown>;
  if (error instanceof GraphQLRequestError && Object.keys(error.fields).some((field) => field.split('.')[0] in values)) {
    form.setErrors(error.fields);
    return;
  }
  notifyFailure(error);
}

/**
 * Errors under a field of a form, by path inside it (`address.city` → `city`): for an editor of a whole object or list
 * (an address, phones).
 * @param {Record<string, unknown>} errors Errors of the form.
 * @param {string} field Field.
 * @returns {Record<string, string>} Errors of the field.
 */
export function nestedErrors(errors: Record<string, unknown>, field: string): Record<string, string> {
  const prefix = `${field}.`;
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, message]) => [key.slice(prefix.length), String(message)]),
  );
}

/** What follows the toast of `formCallbacks`, besides closing the form. */
interface FormCallbackOptions<T> {
  /** Called after `onDone` with what the mutation returned (opens the item created…). Optional. */
  then?: (result: T) => void;
}

/**
 * Callbacks of the mutation of a form: once saved, a toast tells it and the form closes; an error goes to its fields
 * (or a toast; without form, always a toast).
 * @param {UseFormReturnType<Values> | null} form Form (null: a panel without fields of its own, its errors in a toast).
 * @param {string | ((result: T) => string) | null} message Message once saved (« Jalon créé. »), or made from what the mutation returned; null: no toast (the page shows the outcome: signing in…).
 * @param {(result: T) => void} [onDone] Closes the form, given what the mutation returned (the id created…). Optional.
 * @param {FormCallbackOptions<T>} [options] What follows. Optional.
 * @returns {{ onSuccess: (result: T) => void, onError: (error: Error) => void }} Callbacks.
 */
export function formCallbacks<Values, T = unknown>(
  form: UseFormReturnType<Values> | null,
  message: string | ((result: T) => string) | null,
  onDone?: (result: T) => void,
  options: FormCallbackOptions<T> = {},
): { onSuccess: (result: T) => void; onError: (error: Error) => void } {
  return {
    onSuccess: (result) => {
      if (message !== null) notifySuccess(typeof message === 'string' ? message : message(result));
      onDone?.(result);
      options.then?.(result);
    },
    onError: (error) => (form ? showFormError(form, error) : notifyFailure(error)),
  };
}

/** Options of `useFieldSave`: how the fields of an existing item are saved. */
export interface FieldSaveOptions<Values> {
  /**
   * Saves fields of the existing item, given those changed and every value as saved once they are (for an update that
   * takes the whole item). Null: a new item, the form stays a form saved by its button.
   */
  save: ((changes: Partial<Values>, values: Values) => Promise<unknown>) | null;
  /** Standard schema (zod) of the values, the one of the form: checks a field before it is saved. */
  schema: Schema;
  /** Values of the item as the cache holds them now: followed when they change elsewhere (a cell, another tab). Optional. */
  saved?: Values;
  /** Fields saved on leaving them (texts, numbers, a description); the others are saved as soon as they change. Optional. Default = none. */
  onBlur?: readonly (keyof Values & string)[];
  /** Read only (archived…): nothing is saved. Optional. Default = false. */
  readOnly?: boolean;
  /** Called with what a save returned (a toast of links removed…). Optional. */
  onSaved?: (result: unknown, changes: Partial<Values>) => void;
  /**
   * Values as they are saved, from those of the form (a blank line dropped): compared with those saved and sent; the
   * form keeps what was typed (its errors found on it). Optional. Default = the values as they are.
   */
  toSaved?: (values: Values) => Values;
  /**
   * Errors the schema cannot find, on fields about to be saved (a password to type again once a server changed): the
   * fields are not saved, the errors under them. Optional.
   */
  check?: (values: Values, fields: readonly (keyof Values & string)[]) => Record<string, string>;
}

/** What `useFieldSave` gives: the form, whether a save runs, and the save of fields now. */
export interface FieldSave<Values> {
  form: UseFormReturnType<Values>;
  saving: boolean;
  /** Checks and saves fields now (no-op on a new item or read only); false when one is invalid (not saved). */
  commit: (fields: readonly (keyof Values & string)[], always?: boolean) => boolean;
  /** Settles once the saves asked so far are done, failed ones included (before an action on the item as saved: a preview, a validation). */
  settled: () => Promise<void>;
  /**
   * Binding of an editor without `getInputProps` (a description, an address, phones) to a field saved on leaving it:
   * its value, its change, and its save when it is left.
   */
  fieldProps: <K extends keyof Values & string>(field: K) => { value: Values[K]; onChange: (value: Values[K]) => void; onBlur: () => void };
  /**
   * Binding of a field that tells when its value is chosen (`onCommit`: a color picked at once, typed on leaving it,
   * `ColorField`): its input props, saved on `onCommit` only, whatever `onBlur` lists.
   */
  commitProps: (field: keyof Values & string) => ReturnType<UseFormReturnType<Values>['getInputProps']> & { onCommit: () => void };
}

/**
 * Same value, compared as JSON (lists, objects); a file chosen by itself (two files have the same JSON).
 * @param {unknown} a Value.
 * @param {unknown} b Value.
 * @returns {boolean} Whether they are the same.
 */
const sameValue = (a: unknown, b: unknown): boolean => a === b || (!(a instanceof Blob) && !(b instanceof Blob) && JSON.stringify(a ?? null) === JSON.stringify(b ?? null));

/**
 * Field of a path of the form: its first segment (`links.0.url` → `links`).
 * @param {string} path Path.
 * @returns {string} Field.
 */
const fieldOf = (path: string): string => path.split('.')[0];

/**
 * Whether one of these fields, or one of their parts (« links.0.url »), is in error: a folded group of them unfolds.
 * @param {Record<string, unknown>} errors Errors of the form, by path.
 * @param {readonly string[]} fields Fields.
 * @returns {boolean} In error.
 */
export const hasFieldError = (errors: Record<string, unknown>, fields: readonly string[]): boolean => Object.entries(errors).some(([path, error]) => Boolean(error) && fields.includes(fieldOf(path)));

/**
 * Errors of some fields, as the schema finds them on all the values (a rule across fields counts), by path.
 * @param {Schema} schema Standard schema.
 * @param {Record<string, unknown>} values Values.
 * @param {readonly string[]} fields Fields checked.
 * @returns {Record<string, string>} Errors.
 */
function fieldErrors(schema: Schema, values: Record<string, unknown>, fields: readonly string[]): Record<string, string> {
  const result = schema['~standard'].validate(values);
  // The schemas of the app are synchronous (zod): an asynchronous one checks nothing here (the API still does).
  if (result instanceof Promise || !result.issues) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.issues) {
    const path = (issue.path ?? []).map((segment) => String(typeof segment === 'object' ? segment.key : segment)).join('.');
    if (fields.includes(fieldOf(path)) && !(path in errors)) errors[path] = issue.message;
  }
  return errors;
}

/**
 * Detail panel of an existing item, saved field by field as the task panel: the form of the item, whose
 * fields are saved as soon as they change (selects, dates, switches, lists, `setFieldValue` / `setValues`), or on
 * leaving them for those of `onBlur` (texts, numbers; Enter in a text too). Each field is checked first, its error
 * under it (the rules of `useAppForm`: on leaving it, then on every change); a field in error is not saved. The change
 * shows at once; the saves run one after the other; a failure puts the field back as saved, in an error toast (an
 * error of the API on a field goes under it; a confirmation declined, `ActionDeclined`, puts it back silently). Values
 * changed elsewhere are followed, but not while a field is being typed. What was not saved yet (a text being typed,
 * not left) is saved when the side panel holding the form closes (`usePanelFlush`: by its close button, Escape or a
 * click outside — an invalid field keeps it open once, its error under it), when the form goes away (the panel closed
 * by its content or replaced, the page changed) and when the browser leaves the page (`pagehide`, as far as the
 * browser lets the request go). Without `save` (a new item) or read only, the form is returned as it is: a form saved
 * by its button.
 * @param {UseFormReturnType<Values>} base Form of the item (`useAppForm`).
 * @param {FieldSaveOptions<Values>} options How it is saved.
 * @returns {FieldSave<Values>} Form to bind the fields to, whether a save is running (`SaveStatus`), the save of
 *   fields now (those saved on leaving them, by an editor without `getInputProps`: a place), the end of the saves
 *   asked (`settled`, before an action on the item as saved), and the binding of an editor without `getInputProps` to
 *   a field saved on leaving it (`fieldProps`: a description, an address, phones), and of a field saved when it
 *   tells its value is chosen (`commitProps`: a color).
 */
export function useFieldSave<Values extends Record<string, unknown>>(base: UseFormReturnType<Values>, options: FieldSaveOptions<Values>): FieldSave<Values> {
  const { save, schema, saved, onBlur = [], readOnly = false, onSaved, toSaved = (values: Values) => values, check } = options;
  const live = save !== null && !readOnly;
  // Values as saved (or being saved), and the last values of the cache seen.
  const savedValues = useRef<Values | null>(null);
  const seen = useRef<Values | undefined>(saved);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [pending, setPending] = useState(0);

  /**
   * Values as saved (or being saved): those the form started with, until a save.
   * @returns {Values} Values.
   */
  const savedNow = (): Values => (savedValues.current ??= base.getInitialValues());

  /**
   * Saves fields once checked, when they changed (or always: a save that carries more than the fields, the moves of a
   * routine restored with its repetition).
   * @param {readonly string[]} fields Fields.
   * @param {boolean} [always] Saved even unchanged. Optional. Default = when they changed.
   * @returns {boolean} False when one is invalid (not saved, its error under it).
   */
  const commit = (fields: readonly string[], always = false): boolean => {
    const values = base.getValues();
    const previous = savedNow();
    const errors = { ...fieldErrors(schema, values, fields), ...check?.(values, fields as readonly (keyof Values & string)[]) };
    base.setErrors((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([path]) => !fields.includes(fieldOf(path)))), ...errors }));
    if (Object.keys(errors).length) return false;
    const toSave = toSaved(values);
    const changes = Object.fromEntries(fields.filter((field) => always || !sameValue(toSave[field], previous[field])).map((field) => [field, toSave[field]])) as Partial<Values>;
    const changed = Object.keys(changes);
    if (!changed.length || !save) return true;
    const next = { ...previous, ...changes } as Values;
    savedValues.current = next;
    setPending((count) => count + 1);
    queue.current = queue.current
      .then(() => save(changes, next))
      .then(
        (result) => onSaved?.(result, changes),
        (error: unknown) => {
          // Put back as saved; the API's errors on these fields go under them (what was typed stays).
          const back = Object.fromEntries(changed.map((field) => [field, previous[field]])) as Partial<Values>;
          savedValues.current = { ...(savedValues.current ?? previous), ...back };
          if (error instanceof GraphQLRequestError && Object.keys(error.fields).some((path) => changed.includes(fieldOf(path)))) {
            base.setErrors((current) => ({ ...current, ...error.fields }));
            return;
          }
          base.setValues(back);
          notifyFailure(error);
        },
      )
      .finally(() => setPending((count) => count - 1));
    return true;
  };

  /**
   * Saves every field that differs from what was saved (a text being typed, not left yet).
   * @returns {boolean} False when one is invalid (not saved, its error under it).
   */
  const flush = (): boolean => {
    const toSave = toSaved(base.getValues());
    const previous = savedNow();
    const fields = Object.keys(toSave).filter((field) => !sameValue(toSave[field], previous[field]));
    return fields.length ? commit(fields) : true;
  };

  // What was not saved yet is saved before the panel closes, when the form goes away or the page.
  usePanelFlush(live ? flush : () => true);

  // Values changed elsewhere: taken, unless the field is being typed (it differs from what was saved).
  useEffect(() => {
    const before = seen.current;
    seen.current = saved;
    if (!saved || !before) return;
    const local = base.getValues();
    const adopted: Record<string, unknown> = {};
    for (const key of Object.keys(saved)) {
      if (sameValue(saved[key], before[key])) continue;
      if (sameValue(local[key], savedNow()[key])) adopted[key] = saved[key];
      savedValues.current = { ...savedNow(), [key]: saved[key] };
    }
    if (Object.keys(adopted).length) base.setValues(adopted as Partial<Values>);
  });

  /**
   * Settles once the saves asked so far are done (they never reject: a failure is shown, the field put back).
   * @returns {Promise<void>} Settled.
   */
  const settled = () => queue.current;

  if (!live) {
    /**
     * Binding of an editor to a field of the form saved by its button (nothing saved on leaving it).
     * @param {string} field Field.
     * @returns {{ value: unknown, onChange: (value: unknown) => void, onBlur: () => void }} Binding.
     */
    const formFieldProps: FieldSave<Values>['fieldProps'] = (field) => ({
      value: base.getValues()[field],
      onChange: (value) => base.setFieldValue(field, value as never),
      onBlur: () => undefined,
    });
    return { form: base, saving: pending > 0, commit: () => true, settled, fieldProps: formFieldProps, commitProps: (field) => ({ ...base.getInputProps(field), onCommit: () => undefined }) };
  }

  /**
   * Whether a field is saved on leaving it.
   * @param {string} path Path.
   * @returns {boolean} Saved on blur.
   */
  const onLeave = (path: string) => (onBlur as readonly string[]).includes(fieldOf(path));

  const form: UseFormReturnType<Values> = {
    ...base,
    getInputProps: (path, inputOptions) => {
      const props = base.getInputProps(path, inputOptions);
      const field = fieldOf(String(path));
      return {
        ...props,
        onChange: (...args: unknown[]) => {
          (props.onChange as (...values: unknown[]) => void)(...args);
          if (!onLeave(field)) commit([field]);
        },
        onBlur: (...args: unknown[]) => {
          (props.onBlur as ((...values: unknown[]) => void) | undefined)?.(...args);
          if (onLeave(field)) commit([field]);
        },
      };
    },
    setFieldValue: (path, value, setOptions) => {
      base.setFieldValue(path, value, setOptions);
      if (!onLeave(String(path))) commit([fieldOf(String(path))]);
    },
    setValues: (values) => {
      base.setValues(values);
      const fields = Object.keys(typeof values === 'function' ? base.getValues() : values).filter((field) => !onLeave(field));
      if (fields.length) commit(fields);
    },
    // Enter in a text: the fields saved on leaving them are saved.
    onSubmit: () => (event) => {
      event?.preventDefault();
      commit(onBlur);
    },
  };
  /**
   * Binding of an editor to a field, saved on leaving it.
   * @param {string} field Field.
   * @returns {{ value: unknown, onChange: (value: unknown) => void, onBlur: () => void }} Binding.
   */
  const fieldProps: FieldSave<Values>['fieldProps'] = (field) => ({
    value: base.getValues()[field],
    onChange: (value) => form.setFieldValue(field, value as never),
    onBlur: () => commit([field]),
  });
  /**
   * Binding of a field saved when it tells its value is chosen (a color: picked, or typed then left).
   * @param {string} field Field.
   * @returns {object} Input props and `onCommit`.
   */
  const commitProps: FieldSave<Values>['commitProps'] = (field) => ({ ...base.getInputProps(field), onCommit: () => commit([field]) });
  return { form, saving: pending > 0, commit, settled, fieldProps, commitProps };
}
