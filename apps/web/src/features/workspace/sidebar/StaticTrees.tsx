import { NO_CLIENT, type ProjectNode, type TreeSection } from '../tree';
import { NoClientRow } from './NoClientRow';
import { TreeRow } from './TreeRow';

interface BranchProps {
  node: ProjectNode;
  depth: number;
  section: TreeSection;
  /** Prefix of the expand keys, so each section remembers its own state. */
  keyPrefix: string;
  isExpanded: (key: string) => boolean;
  onToggle: (key: string) => void;
}

/**
 * Project row with its sub-projects.
 * @param {BranchProps} props Component props.
 * @returns {JSX.Element} Branch.
 */
function ProjectBranch({ node, depth, section, keyPrefix, isExpanded, onToggle }: BranchProps) {
  const key = `${keyPrefix}p:${node.project.id}`;
  const expanded = isExpanded(key);
  const hasChildren = node.children.length > 0;
  return (
    <>
      <TreeRow
        entity={{ type: 'project', item: node.project }}
        depth={depth}
        muted={section.context?.has(`p:${node.project.id}`) ?? false}
        expansion={hasChildren ? { expanded, onToggle: () => onToggle(key) } : undefined}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasChildren ? expanded : undefined}
      />
      {hasChildren &&
        expanded &&
        node.children.map((child) => (
          <ProjectBranch
            key={child.project.id}
            node={child}
            depth={depth + 1}
            section={section}
            keyPrefix={keyPrefix}
            isExpanded={isExpanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

interface StaticTreeProps {
  section: TreeSection;
  label: string;
  keyPrefix: string;
  isExpanded: (key: string) => boolean;
  onToggle: (key: string) => void;
}

/**
 * Read-only tree (favorites, archives): items of the section with their client and parents as
 * context, shown muted. No drag and drop.
 * @param {StaticTreeProps} props Component props.
 * @returns {JSX.Element} Tree.
 */
export function StaticTree({ section, label, keyPrefix, isExpanded, onToggle }: StaticTreeProps) {
  const branchProps = { section, keyPrefix, isExpanded, onToggle };
  return (
    <div role="tree" aria-label={label}>
      {section.clients.map(({ client, projects }) => {
        const key = `${keyPrefix}${client.id}`;
        const expanded = isExpanded(key);
        return (
          <div key={client.id} role="none">
            <TreeRow
              entity={{ type: 'client', item: client }}
              muted={section.context?.has(`c:${client.id}`) ?? false}
              expansion={projects.length > 0 ? { expanded, onToggle: () => onToggle(key) } : undefined}
              role="treeitem"
              aria-level={1}
              aria-expanded={projects.length > 0 ? expanded : undefined}
            />
            {expanded &&
              projects.map((node) => <ProjectBranch key={node.project.id} node={node} depth={1} {...branchProps} />)}
          </div>
        );
      })}

      {section.orphans.length > 0 && (
        <>
          <NoClientRow
            expanded={isExpanded(`${keyPrefix}${NO_CLIENT}`)}
            onToggle={() => onToggle(`${keyPrefix}${NO_CLIENT}`)}
            hasChildren
          />
          {isExpanded(`${keyPrefix}${NO_CLIENT}`) &&
            section.orphans.map((node) => <ProjectBranch key={node.project.id} node={node} depth={1} {...branchProps} />)}
        </>
      )}
    </div>
  );
}
