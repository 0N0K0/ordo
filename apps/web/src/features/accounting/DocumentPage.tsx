import { useParams } from 'react-router';
import { DocumentEditor } from './DocumentEditor';

/**
 * Page of one accounting document.
 * @returns {JSX.Element} Page.
 */
export function DocumentPage() {
  const { id = '' } = useParams();
  return <DocumentEditor id={id} />;
}
