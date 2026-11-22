import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { relationWords } from '../../../components/people/people-options';
import { useActiveWorkspace } from '../../workspaces/api';
import { useTreasuryAccounts, type TreasuryAccount, type TreasuryBudget } from '../api';
import { useBudgetColumns } from '../hooks/use-budget-columns';
import { useEntryEnv } from '../lib/entry-env';
import { entryTableColumns, forecastColumns, lineColumns, loanColumns } from '../lib/treasury-columns';

/** No account yet. */
const NO_ACCOUNTS: TreasuryAccount[] = [];
/** No budget: the columns of the budgets, in the settings. */
const NO_BUDGETS: TreasuryBudget[] = [];
/** No comment counted: the columns of the entries, in the settings. */
const NO_COMMENTS = new Map<string, number>();

/**
 * No entry of a row of the forecast: its columns, in the settings.
 * @returns {undefined} None.
 */
const NO_ENTRY = (): undefined => undefined;

/**
 * Columns new views of the tables of the treasury start with: the forecast, the entries and their split, the budgets
 * (of a month, out of budget, defined), the loans.
 * @returns {JSX.Element} Sections.
 */
export function TreasuryColumnDefaults() {
  const { perso } = useActiveWorkspace();
  const { data: accounts } = useTreasuryAccounts();
  const env = useEntryEnv(accounts ?? NO_ACCOUNTS);
  const budgets = useBudgetColumns(NO_BUDGETS);
  return (
    <>
      <ColumnDefaults tableKey="treasury-forecast" columns={forecastColumns(NO_ENTRY, env)} label="Prévisionnel" />
      <ColumnDefaults tableKey="treasury-entries" columns={entryTableColumns(env, NO_COMMENTS)} label="Mouvements" />
      <ColumnDefaults tableKey="treasury-entry-lines" columns={lineColumns(env)} label="Répartition d’un mouvement" />
      <ColumnDefaults tableKey="treasury-budget-report" columns={budgets.reportColumns} label="Budgets du mois" />
      <ColumnDefaults tableKey="treasury-budget-outside" columns={budgets.outsideColumns} label="Hors budget" />
      <ColumnDefaults tableKey="treasury-budgets" columns={budgets.definedColumns} label="Budgets définis" />
      <ColumnDefaults tableKey="treasury-loans" columns={loanColumns(relationWords(perso))} label="Prêts" />
    </>
  );
}
