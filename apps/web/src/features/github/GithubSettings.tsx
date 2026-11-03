import { Alert, Anchor, Badge, Button, Group, Paper, PasswordInput, Skeleton, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { GithubLogoIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useGithubContributors, useGithubLogin, useGithubMutations } from './api';

/**
 * GitHub login of a contributor, saved when the field is left.
 * @param {{ id: string, login: string | null }} props Contributor and current login.
 * @returns {JSX.Element} Field.
 */
function LoginField({ id, login }: { id: string; login: string | null }) {
  const { setLogin } = useGithubMutations();
  const [value, setValue] = useState(login ?? '');
  const [error, setError] = useState<string | null>(null);
  return (
    <TextInput
      size="xs"
      placeholder="login GitHub"
      leftSection="@"
      value={value}
      error={error}
      onChange={(event) => setValue(event.currentTarget.value)}
      onBlur={() => {
        const next = value.trim().replace(/^@/, '') || null;
        if (next === login) return;
        setLogin.mutate(
          { id, login: next },
          { onSuccess: () => setError(null), onError: (saveError) => setError(saveError.message) },
        );
      }}
    />
  );
}

/**
 * GitHub settings: the personal access token the boards are synchronized with, and the GitHub login of each
 * contributor (assignees go through it).
 * @returns {JSX.Element} Settings.
 */
export function GithubSettings() {
  const { data: login, isPending } = useGithubLogin();
  const { data: contributors } = useGithubContributors();
  const { setToken, removeToken } = useGithubMutations();
  const [token, setTokenValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Asks for confirmation before disconnecting GitHub.
   * @returns {void}
   */
  const confirmRemove = () => {
    const modalId = 'github-disconnect';
    modals.open({
      modalId,
      title: 'Déconnecter GitHub',
      children: (
        <Stack gap="md">
          <Text size="sm">
            Le jeton sera oublié et les synchronisations s’arrêteront. Les liens entre projets et tableaux sont conservés : ils reprendront avec un nouveau jeton.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              removeToken.mutate(undefined, { onSuccess: () => notifySuccess('GitHub déconnecté.'), onError: (removeError) => notifyError(removeError.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  if (isPending) return <Skeleton height={200} />;
  return (
    <Stack gap="lg">
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Group gap="xs">
            <GithubLogoIcon aria-hidden size={20} />
            <Title order={2} size="h4">
              Connexion
            </Title>
            {login && (
              <Badge variant="light" color="green">
                Connecté : @{login}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            Ordo se connecte avec un{' '}
            <Anchor href="https://github.com/settings/tokens" target="_blank" rel="noopener" size="sm">
              jeton d’accès personnel
            </Anchor>{' '}
            : jeton « classic » avec les droits <code>project</code> et <code>repo</code>, ou jeton « fine-grained » avec l’accès aux projets et aux issues des dépôts
            concernés. Il est chiffré en base.
          </Text>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setToken.mutate(token, {
                onSuccess: (account) => {
                  setTokenValue('');
                  setError(null);
                  notifySuccess(`GitHub connecté : @${account}.`);
                },
                onError: (saveError) => setError(saveError.message),
              });
            }}
          >
            <Group align="flex-start" gap="sm">
              <PasswordInput
                label={login ? 'Remplacer le jeton' : 'Jeton'}
                placeholder="ghp_… ou github_pat_…"
                value={token}
                error={error}
                onChange={(event) => setTokenValue(event.currentTarget.value)}
                style={{ flex: 1, maxWidth: 480 }}
                autoComplete="off"
              />
              <Button type="submit" mt={25} loading={setToken.isPending} disabled={!token.trim()}>
                {login ? 'Remplacer' : 'Connecter'}
              </Button>
              {login && (
                <Button variant="subtle" color="red" mt={25} onClick={confirmRemove}>
                  Déconnecter
                </Button>
              )}
            </Group>
          </form>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={2} size="h4">
            Contributeurs sur GitHub
          </Title>
          <Text size="sm" c="dimmed">
            Les assignés d’une issue sont ceux des contributeurs qui ont son login GitHub ; les autres logins sont laissés tels quels des deux côtés.
          </Text>
          {!contributors?.length ? (
            <Alert color="gray">Aucun contributeur.</Alert>
          ) : (
            <Table verticalSpacing={4} maw={560}>
              <Table.Tbody>
                {contributors.map((contributor) => (
                  <Table.Tr key={contributor.id}>
                    <Table.Td>
                      <Text size="sm">{contributor.name}</Text>
                    </Table.Td>
                    <Table.Td w={260}>
                      <LoginField id={contributor.id} login={contributor.githubLogin ?? null} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
