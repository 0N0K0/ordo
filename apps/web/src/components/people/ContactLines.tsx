import { Anchor, Text } from '@mantine/core';
import type { LabelledEmail, Phone } from '@ordo/shared';

/**
 * Email addresses (links to write to them) and phones of a person or an organization, one text line each, with their
 * label (« Mobile : 06… »): the details of a client, its services and contacts, and those a contributor takes from
 * what it is linked to. Nothing when both lists are empty.
 * @param {{ emails: readonly LabelledEmail[], phones: readonly Phone[] }} props Component props.
 * @returns {JSX.Element} Lines.
 */
export function ContactLines({ emails, phones }: { emails: readonly LabelledEmail[]; phones: readonly Phone[] }) {
  return (
    <>
      {emails.map((email) => (
        <Text key={`${email.label}${email.address}`} size="sm">
          {email.label ? `${email.label} : ` : ''}
          <Anchor href={`mailto:${email.address}`} size="sm">
            {email.address}
          </Anchor>
        </Text>
      ))}
      {phones.map((phone) => (
        <Text key={`${phone.label}${phone.number}`} size="sm">
          {phone.label ? `${phone.label} : ` : ''}
          {phone.number}
        </Text>
      ))}
    </>
  );
}
