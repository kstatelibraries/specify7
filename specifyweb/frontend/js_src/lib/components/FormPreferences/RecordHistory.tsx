import React from 'react';

import type { SpQuery } from '../DataModel/types';
import type { AnySchema } from '../DataModel/helpers';
import { format } from '../Forms/dataObjFormatters';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { commonText } from '../../localization/common';
import { formsText } from '../../localization/forms';
import { flippedSortTypes } from '../QueryBuilder/helpers';
import { QueryFieldSpec } from '../QueryBuilder/fieldSpec';
import { schema } from '../DataModel/schema';
import { Button } from '../Atoms/Button';
import { useAsyncState, useBooleanState } from '../../hooks/hooks';
import { Dialog, dialogClassNames } from '../Molecules/Dialog';
import { QueryBuilder } from '../QueryBuilder/Wrapped';
import { queryFieldFilters } from '../QueryBuilder/FieldFilter';
import { createQuery } from '../QueryBuilder';

export function RecordHistory({
  resource,
}: {
  readonly resource: SpecifyResource<AnySchema>;
}): JSX.Element {
  const [isOpen, handleOpen, handleClose] = useBooleanState();
  return (
    <>
      <Button.Small
        disabled={resource.isNew()}
        title={resource.isNew() ? formsText('saveRecordFirst') : undefined}
        onClick={handleOpen}
      >
        {formsText('historyOfEdits')}
      </Button.Small>
      {isOpen && (
        <RecordHistoryDialog resource={resource} onClose={handleClose} />
      )}
    </>
  );
}

function RecordHistoryDialog({
  resource,
  onClose: handleClose,
}: {
  readonly resource: SpecifyResource<AnySchema>;
  readonly onClose: () => void;
}): JSX.Element | null {
  const query = useEditHistoryQuery(resource);
  return typeof query === 'object' ? (
    <Dialog
      buttons={<Button.DialogClose>{commonText('close')}</Button.DialogClose>}
      className={{
        container: dialogClassNames.wideContainer,
      }}
      header={formsText('historyOfEdits')}
      onClose={handleClose}
    >
      <QueryBuilder
        autoRun
        isEmbedded
        isReadOnly={false}
        query={query}
        recordSet={undefined}
      />
    </Dialog>
  ) : null;
}

function useEditHistoryQuery(
  resource: SpecifyResource<AnySchema>
): SpecifyResource<SpQuery> | undefined {
  const formatted = useFormatted(resource);

  return React.useMemo(
    () =>
      typeof formatted === 'string'
        ? createQuery(
            formsText('historyOfEditsQueryName', formatted),
            schema.models.SpAuditLog
          ).set('fields', [
            QueryFieldSpec.fromPath('SpAuditLog', ['tableNum'])
              .toSpQueryField()
              .set('isDisplay', false)
              .set('operStart', queryFieldFilters.equal.id)
              .set('startValue', resource.specifyModel.tableId.toString()),
            QueryFieldSpec.fromPath('SpAuditLog', ['recordId'])
              .toSpQueryField()
              .set('isDisplay', false)
              .set('operStart', queryFieldFilters.equal.id)
              .set('startValue', resource.id.toString()),
            QueryFieldSpec.fromPath('SpAuditLog', ['timestampModified'])
              .toSpQueryField()
              .set('sortType', flippedSortTypes.descending),
          ])
        : undefined,
    [resource, formatted]
  );
}
function useFormatted(
  resource: SpecifyResource<AnySchema>
): string | undefined {
  const [formatted] = useAsyncState(
    React.useCallback(
      async () => format(resource, undefined, true),
      [resource]
    ),
    true
  );
  return formatted;
}
