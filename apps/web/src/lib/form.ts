import { schemaResolver, useForm, type UseFormReturnType } from '@mantine/form';
import { useEffect, useRef } from 'react';
import { GraphQLRequestError } from './graphql-client';
import { notifyError } from './notify';

type Schema = Parameters<typeof schemaResolver>[0];

/**
 * Form with the app validation rules: validated on blur, then on every change once a field has an error.
 * @param {object} options Form options.
 * @param {Values} options.initialValues Initial values.
 * @param {Schema} options.schema Standard schema (zod) validating the values.
 * @returns {UseFormReturnType<Values>} Mantine form.
 */
export function useAppForm<Values extends Record<string, unknown>>({
  initialValues,
  schema,
}: {
  initialValues: Values;
  schema: Schema;
}): UseFormReturnType<Values> {
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
  notifyError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
}
