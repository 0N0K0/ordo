import { labelFormSchema } from '@ordo/shared';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useMailLabelMutations, useMailLabels } from '../api';

/**
 * Flags of mails, as every settings list: added, edited (name, color, image), deleted, reordered by drag and drop.
 * They are set on the mails as IMAP keywords (or kept in Ordo for servers without keywords).
 * @returns {JSX.Element} Manager.
 */
export function MailLabelsManager() {
  const { data: labels } = useMailLabels();
  const { create, update, remove } = useMailLabelMutations();
  return (
    <SettingsList
      kind="MAIL_LABEL"
      title="Drapeaux"
      description="Les drapeaux sont posés sur les mails côté serveur (mots-clés IMAP), ou gardés dans Ordo quand le serveur ne les accepte pas."
      noun="le drapeau"
      items={labels ?? []}
      schema={labelFormSchema}
      create={async (values) => createdId(await create.mutateAsync({ name: values.name, color: values.color }))}
      update={(id, values) => update.mutateAsync({ id, input: { name: values.name, color: values.color } })}
      remove={(id) => remove.mutateAsync(id)}
      deleteMessage={(label) => <>Le drapeau « {label.name} » sera supprimé définitivement et retiré des mails qui l’ont.</>}
    />
  );
}
