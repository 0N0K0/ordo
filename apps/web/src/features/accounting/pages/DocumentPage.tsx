import { useParams } from 'react-router';
import { DocumentEditor } from '../components/DocumentEditor';

/**
 * Page of one accounting document.
 * @returns {JSX.Element} Page.
 */
export function DocumentPage() {
  const { id = '' } = useParams();
  return <DocumentEditor id={id} />;
}
