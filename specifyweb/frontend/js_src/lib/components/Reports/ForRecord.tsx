import React from 'react';

import type { IR } from '../../utils/types';
import { replaceKey } from '../../utils/utils';
import type { SerializedResource } from '../DataModel/helperTypes';
import type { SpecifyTable } from '../DataModel/specifyTable';
import type { SpQuery } from '../DataModel/types';
import { queryFieldFilters } from '../QueryBuilder/FieldFilter';
import { QueryFieldSpec } from '../QueryBuilder/fieldSpec';
import { usePref } from '../UserPreferences/usePref';
import { RunReport } from './Run';
import { serializeResource } from '../DataModel/serializers';

export function ReportForRecord({
  query: rawQuery,
  parameters,
  definition,
  table,
  resourceId,
  onClose: handleClose,
}: {
  readonly query: SerializedResource<SpQuery>;
  readonly definition: Element;
  readonly parameters: IR<string>;
  readonly table: SpecifyTable;
  readonly resourceId: number;
  readonly onClose: () => void;
}): JSX.Element {
  const [clearQueryFilters] = usePref(
    'reports',
    'behavior',
    'clearQueryFilters'
  );
  const query = React.useMemo(() => {
    const query = replaceKey(
      rawQuery,
      'fields',
      rawQuery.fields.map((field) =>
        field.alwaysFilter === true
          ? field
          : {
              ...field,
              operStart:
                clearQueryFilters && field.startValue === ''
                  ? queryFieldFilters.any.id
                  : field.operStart,
              startValue: clearQueryFilters ? '' : field.startValue,
              operEnd: null,
              endValue: null,
            }
      )
    );
    const newField = QueryFieldSpec.fromPath(table.name, [table.idField.name])
      .toSpQueryField()
      .set('operStart', queryFieldFilters.equal.id)
      .set('startValue', resourceId.toString())
      .set('position', query.fields.length)
      .set('query', query.resource_uri);
    return replaceKey(query, 'fields', [
      ...query.fields,
      serializeResource(newField),
    ]);
  }, [rawQuery, table, resourceId, clearQueryFilters]);

  return (
    <RunReport
      definition={definition}
      parameters={parameters}
      query={query}
      recordSetId={undefined}
      onClose={handleClose}
    />
  );
}
