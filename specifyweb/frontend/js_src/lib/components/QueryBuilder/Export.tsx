import React from 'react';

import { commonText } from '../../localization/common';
import { queryText } from '../../localization/query';
import { ping } from '../../utils/ajax/ping';
import type { RA } from '../../utils/types';
import { keysToLowerCase } from '../../utils/utils';
import type { SerializedResource } from '../DataModel/helperTypes';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import type { SpQuery, SpQueryField, Tables } from '../DataModel/types';
import { Dialog } from '../Molecules/Dialog';
import { hasPermission } from '../Permissions/helpers';
import { userPreferences } from '../Preferences/userPreferences';
import { mappingPathIsComplete } from '../WbPlanView/helpers';
import { generateMappingPathPreview } from '../WbPlanView/mappingPreview';
import { QueryButton } from './Components';
import { QueryField, unParseQueryFields } from './helpers';
import { hasLocalityColumns } from './helpers';
import { useAsyncState } from '../../hooks/useAsyncState';
import { schema } from '../DataModel/schema';
import { fetchCollection } from '../DataModel/collection';

export function QueryExportButtons({
  baseTableName,
  fields,
  queryResource,
  getQueryFieldRecords,
  recordSetId,
  selectedRows,
}: {
  readonly baseTableName: keyof Tables;
  readonly fields: RA<QueryField>;
  readonly queryResource: SpecifyResource<SpQuery>;
  readonly getQueryFieldRecords:
    | (() => RA<SerializedResource<SpQueryField>>)
    | undefined;
  readonly recordSetId: number | undefined;
  readonly selectedRows: ReadonlySet<number>;
}): JSX.Element {
  const showConfirmation = (): boolean =>
    fields.some(({ mappingPath }) => !mappingPathIsComplete(mappingPath));

  const [state, setState] = React.useState<'creating' | 'warning' | undefined>(
    undefined
  );

  const [recordSet] = useAsyncState(
    React.useCallback(
      async () =>
        new schema.models.RecordSet.Resource({
          id: recordSetId,
        })
          .fetch()
          .then((recordSet) => recordSet ?? false),
      [recordSetId]
    ),
    false
  );

  const collection = useAsyncState(
    React.useCallback(
      async () =>
        fetchCollection('RecordSetItem', {
          recordSet: recordSetId,
          offset: 40,
          orderBy: 'id',
          limit: 40,
        }),
      [recordSetId]
    ),
    true
  );

  const filteredCollection = collection[0]?.records.filter((record) =>
    selectedRows.has(record.recordId)
  );

  function doQueryExport(url: string, delimiter: string | undefined): void {
    if (typeof getQueryFieldRecords === 'function')
      queryResource.set('fields', getQueryFieldRecords());
    const serialized = queryResource.toJSON();
    setState('creating');
    void ping(url, {
      method: 'POST',
      body: keysToLowerCase({
        ...serialized,
        captions: fields
          .filter(({ isDisplay }) => isDisplay)
          .map(({ mappingPath }) =>
            generateMappingPathPreview(baseTableName, mappingPath)
          ),
        recordSetId,
        delimiter,
      }),
    });
  }

  const canUseKml =
    (baseTableName === 'Locality' ||
      fields.some(({ mappingPath }) => mappingPath.includes('locality'))) &&
    hasPermission('/querybuilder/query', 'export_kml');

  return (
    <>
      {state === 'creating' ? (
        <Dialog
          buttons={commonText.close()}
          header={queryText.queryExportStarted()}
          onClose={(): void => setState(undefined)}
        >
          {queryText.queryExportStartedDescription()}
        </Dialog>
      ) : state === 'warning' ? (
        <Dialog
          buttons={commonText.close()}
          header={queryText.missingCoordinatesForKml()}
          onClose={(): void => setState(undefined)}
        >
          {queryText.missingCoordinatesForKmlDescription()}
        </Dialog>
      ) : undefined}
      {hasPermission('/querybuilder/query', 'export_csv') && (
        <QueryButton
          disabled={fields.length === 0}
          showConfirmation={showConfirmation}
          onClick={(): void =>
            doQueryExport(
              '/stored_query/exportcsv/',
              userPreferences.get(
                'queryBuilder',
                'behavior',
                'exportFileDelimiter'
              )
            )
          }
        >
          {queryText.createCsv()}
        </QueryButton>
      )}
      {canUseKml && (
        <QueryButton
          disabled={fields.length === 0}
          showConfirmation={showConfirmation}
          onClick={(): void =>
            hasLocalityColumns(fields)
              ? doQueryExport('/stored_query/exportkml/', undefined)
              : setState('warning')
          }
        >
          {queryText.createKml()}
        </QueryButton>
      )}
    </>
  );
}
