/**
 * Do DWCA export
 */

import React from 'react';

import { formData, ping } from '../../ajax';
import type { AppResourceFilters } from '../../appresourcesfilters';
import type { SpAppResource } from '../../datamodel';
import type { SerializedResource } from '../../datamodelutils';
import { f } from '../../functools';
import { commonText } from '../../localization/common';
import { hasPermission } from '../../permissionutils';
import { toResource } from '../../specifymodel';
import { AppResourcesAside } from '../appresourcesaside';
import type { AppResources } from '../appresourceshooks';
import { useAppResources } from '../appresourceshooks';
import { Button } from '../basic';
import { LoadingContext } from '../contexts';
import { ErrorBoundary } from '../errorboundary';
import { useBooleanState, useTitle } from '../hooks';
import type { UserTool } from '../main';
import { Dialog } from '../modaldialog';

function MakeDwca({
  onClose: handleClose,
}: {
  readonly onClose: () => void;
}): JSX.Element | null {
  useTitle(commonText('makeDwca'));
  const resources = useAppResources();

  const [definition, setDefinition] = React.useState<string | undefined>(
    undefined
  );

  const loading = React.useContext(LoadingContext);
  const [isExporting, handleExporting, handleExported] = useBooleanState();

  return resources === undefined ? null : definition === undefined ? (
    <PickAppResource
      header={commonText('chooseDwcaDialogTitle')}
      resources={resources}
      onClose={handleClose}
      onSelected={(definition): void => setDefinition(definition?.name)}
    />
  ) : isExporting ? (
    <ExportStarted onClose={handleClose} />
  ) : (
    <>
      <PickAppResource
        header={commonText('chooseMetadataResource')}
        resources={resources}
        skippable
        onClose={(): void => setDefinition(undefined)}
        onSelected={(metadata): void => {
          handleExporting();
          loading(startExport(definition, metadata?.name).then(handleExported));
        }}
      />
      ;
    </>
  );
}

const initialFilters: AppResourceFilters = {
  viewSets: false,
  appResources: ['otherXmlResource', 'otherAppResources'],
};

function PickAppResource({
  resources,
  header,
  skippable = false,
  onClose: handleClose,
  onSelected: handleSelected,
}: {
  readonly resources: AppResources;
  readonly header: string;
  readonly skippable?: boolean;
  readonly onSelected: (
    appResource: SerializedResource<SpAppResource> | undefined
  ) => void;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      buttons={
        skippable ? (
          <>
            <Button.DialogClose>{commonText('back')}</Button.DialogClose>
            <Button.Blue onClick={(): void => handleSelected(undefined)}>
              {commonText('skip')}
            </Button.Blue>
          </>
        ) : (
          commonText('back')
        )
      }
      header={header}
      onClose={handleClose}
    >
      <AppResourcesAside
        initialFilters={initialFilters}
        resources={resources}
        onCreate={undefined}
        onOpen={(selected): void =>
          f.maybe(toResource(selected, 'SpAppResource'), handleSelected)
        }
      />
    </Dialog>
  );
}

function ExportStarted({
  onClose: handleClose,
}: {
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      buttons={commonText('close')}
      header={commonText('dwcaExportStartedDialogHeader')}
      onClose={handleClose}
    >
      {commonText('dwcaExportStartedDialogText')}
    </Dialog>
  );
}

const startExport = async (
  definition: string,
  metadata: string | undefined
): Promise<void> =>
  ping('/export/make_dwca/', {
    method: 'POST',
    body: formData({
      definition,
      ...(typeof metadata === 'string' ? { metadata } : {}),
    }),
  }).then(f.void);

export const userTool: UserTool = {
  task: 'make-dwca',
  title: commonText('makeDwca'),
  enabled: () => hasPermission('/export/dwca', 'execute'),
  isOverlay: true,
  view: ({ onClose: handleClose }) => (
    <ErrorBoundary dismissable>
      <MakeDwca onClose={handleClose} />
    </ErrorBoundary>
  ),
  groupLabel: commonText('export'),
};
