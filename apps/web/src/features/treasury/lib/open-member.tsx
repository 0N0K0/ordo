import { openFormPanel } from '../../../components/panels/panels';
import type { Contributor } from '../../tasks/api';
import { MemberForm } from '../components/TeamPanel';

/**
 * Opens the panel of a member of the team or household (from the list of the members, or from its birthday in the
 * calendar): its details.
 * @param {Contributor} member Member (a contributor).
 * @returns {void}
 */
export function openMemberForm(member: Contributor): void {
  openFormPanel(member.archived ? 'Membre' : 'Modifier le membre', () => <MemberForm member={member} />);
}
