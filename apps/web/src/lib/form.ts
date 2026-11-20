import { schemaResolver, useForm, type UseFormReturnType } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
import { GraphQLRequestError } from './graphql-client';
import { notifyFailure, notifySuccess } from './notify';

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
}

/** What `useFieldSave` gives: the form, whether a save runs, and the save of fields now. */
export interface FieldSave<Values> {
  form: UseFormReturnType<Values>;
  saving: boolean;
  /** Checks and saves fields now (no-op on a new item or read only). */
  commit: (fields: readonly (keyof Values & string)[]) => void;
}

/**
 * Same value, compared as JSON (lists, objects).
 * @param {unknown} a Value.
 * @param {unknown} b Value.
 * @returns {boolean} Whether they are the same.
 */
const sameValue = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Field of a path of the form: its first segment (`links.0.url` → `links`).
 * @param {string} path Path.
 * @returns {string} Field.
 */
const fieldOf = (path: string): string => path.split('.')[0];

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
 * Detail panel of an existing item, saved field by field as the task panel (decision D22): the form of the item, whose
 * fields are saved as soon as they change (selects, dates, switches, lists, `setFieldValue` / `setValues`), or on
 * leaving them for those of `onBlur` (texts, numbers; Enter in a text too). Each field is checked first, its error
 * under it (the rules of `useAppForm`: on leaving it, then on every change); a field in error is not saved. The change
 * shows at once; the saves run one after the other; a failure puts the field back as saved, in an error toast (an
 * error of the API on a field goes under it; a confirmation declined, `ActionDeclined`, puts it back silently). Values
 * changed elsewhere are followed, but not while a field is being typed. Without `save` (a new item) or read only, the
 * form is returned as it is: a form saved by its button.
 * @param {UseFormReturnType<Values>} base Form of the item (`useAppForm`).
 * @param {FieldSaveOptions<Values>} options How it is saved.
 * @returns {FieldSave<Values>} Form to bind the fields to, whether a save is running (`SaveStatus`), and the save of
 *   fields now (those saved on leaving them, by an editor without `getInputProps`: a description, a place).
 */
export function useFieldSave<Values extends Record<string, unknown>>(base: UseFormReturnType<Values>, options: FieldSaveOptions<Values>): FieldSave<Values> {
  const { save, schema, saved, onBlur = [], readOnly = false, onSaved } = options;
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

  if (!live) return { form: base, saving: pending > 0, commit: () => undefined };

  /**
   * Saves fields once checked, when they changed.
   * @param {readonly string[]} fields Fields.
   * @returns {void}
   */
  const commit = (fields: readonly string[]) => {
    const values = base.getValues();
    const previous = savedNow();
    const errors = fieldErrors(schema, values, fields);
    base.setErrors((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([path]) => !fields.includes(fieldOf(path)))), ...errors }));
    if (Object.keys(errors).length) return;
    const changes = Object.fromEntries(fields.filter((field) => !sameValue(values[field], previous[field])).map((field) => [field, values[field]])) as Partial<Values>;
    const changed = Object.keys(changes);
    if (!changed.length) return;
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
  };

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
  return { form, saving: pending > 0, commit };
}

