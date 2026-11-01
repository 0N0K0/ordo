import { Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { loginFormSchema, type LoginFormValues } from '@ordo/shared';
import { Link } from 'react-router';
import { showFormError, useAppForm } from '../../../lib/form';
import { useLogin } from '../api';
import { AuthHeader } from '../AuthLayout';

/**
 * Login with a username or an email address.
 * @returns {JSX.Element} Login page.
 */
export function LoginPage() {
  const login = useLogin();
  const form = useAppForm<LoginFormValues>({
    initialValues: { identifier: '', password: '' },
    schema: loginFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    login.mutate(values, { onError: (error) => showFormError(form, error) });
  });

  return (
    <>
      <AuthHeader title="Connexion" />
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          <TextInput
            label="Identifiant ou adresse email"
            autoComplete="username"
            autoFocus
            required
            {...form.getInputProps('identifier')}
          />
          <PasswordInput
            label="Mot de passe"
            autoComplete="current-password"
            required
            {...form.getInputProps('password')}
          />
          <Anchor component={Link} to="/forgot-password" size="sm">
            Mot de passe oublié ?
          </Anchor>
          <Button type="submit" loading={login.isPending} fullWidth>
            Se connecter
          </Button>
        </Stack>
      </form>
    </>
  );
}
