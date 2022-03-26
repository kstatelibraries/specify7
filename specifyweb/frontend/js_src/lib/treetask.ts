import { PermissionDenied } from './components/permissiondenied';
import createBackboneView from './components/reactbackboneextend';
import { NotFoundView } from './notfoundview';
import { hasTreeAccess } from './permissions';
import { router } from './router';
import { getModel } from './schema';
import { setCurrentView } from './specifyapp';
import {
  isTreeModel,
  treeDefinitions,
  treeRanksPromise,
} from './treedefinitions';
import { caseInsensitiveHash } from './helpers';

const PermissionDeniedView = createBackboneView(PermissionDenied);

export default function Routes(): void {
  router.route('tree/:table/', 'tree', (table: string) =>
    import('./components/treeview').then(async ({ default: TreeView }) => {
      const tableName = getModel(table)?.name;
      if (typeof tableName === 'undefined' || !isTreeModel(tableName)) {
        setCurrentView(new NotFoundView());
        return;
      }
      if (!hasTreeAccess(tableName, 'read')) {
        setCurrentView(new PermissionDeniedView());
        return;
      }
      await treeRanksPromise;
      const treeDefinition = caseInsensitiveHash(treeDefinitions, tableName);
      if (typeof treeDefinition === 'object')
        setCurrentView(
          new TreeView({
            tableName,
            treeDefinitionId: treeDefinition.definition.id,
            treeDefinitionItems: treeDefinition.ranks,
          })
        );
      else setCurrentView(new NotFoundView());
    })
  );
}
