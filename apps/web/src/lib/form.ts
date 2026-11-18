import { schemaResolver, useForm, type UseFormReturnType } from '@mantine/form';
import { useEffect, useRef } from 'react';
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
 * Shows an API error: per-field messages on the form, otherwise a toast.
 * @param {UseFormReturnType<Values>} form Form to annotate.
 * @param {unknown} error Error raised by the mutation.
 * @returns {void}
 */
export function showFormError<Values>(form: UseFormReturnType<Values>, error: unknown): void {
  if (error instanceof GraphQLRequestError && Object.keys(error.fields).length > 0) {
    form.setErrors(error.fields);
    return;
  }
  if (error instanceof GraphQLRequestError && error.code === 'UNAUTHENTICATED') return;
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
 * @param {string | ((result: T) => string)} message Message once saved (« Jalon créé. »), or made from what the mutation returned.
 * @param {(result: T) => void} [onDone] Closes the form, given what the mutation returned (the id created…). Optional.
 * @param {FormCallbackOptions<T>} [options] What follows. Optional.
 * @returns {{ onSuccess: (result: T) => void, onError: (error: Error) => void }} Callbacks.
 */
export function formCallbacks<Values, T = unknown>(
  form: UseFormReturnType<Values> | null,
  message: string | ((result: T) => string),
  onDone?: (result: T) => void,
  options: FormCallbackOptions<T> = {},
): { onSuccess: (result: T) => void; onError: (error: Error) => void } {
  return {
    onSuccess: (result) => {
      // eslint-disable-next-line no-restricted-syntax -- formCallbacks itself.
      notifySuccess(typeof message === 'string' ? message : message(result));
      onDone?.(result);
      options.then?.(result);
    },
    onError: (error) => (form ? showFormError(form, error) : notifyFailure(error)),
  };
}
