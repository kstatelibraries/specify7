/**
 * Handle URLs that correspond to displaying a resource or a record set
 */

import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { deserializeResource } from '../../hooks/resource';
import { useAsyncState } from '../../hooks/useAsyncState';
import { f } from '../../utils/functools';
import { defined } from '../../utils/types';
import { fetchCollection } from '../DataModel/collection';
import {
  fetchCollectionsForResource,
  getCollectionForResource,
} from '../DataModel/domain';
import type { AnySchema, SerializedResource } from '../DataModel/helperTypes';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { getResourceViewUrl } from '../DataModel/resource';
import { getModel, getModelById, schema } from '../DataModel/schema';
import type { SpecifyModel } from '../DataModel/specifyModel';
import type { CollectionObject, RecordSet } from '../DataModel/types';
import { ProtectedTable, ProtectedTool } from '../Permissions/PermissionDenied';
import { NotFoundView } from '../Router/NotFoundView';
import { formatUrl } from '../Router/queryString';
import { switchCollection } from '../RouterCommands/SwitchCollection';
import { OtherCollection } from './OtherCollectionView';
import { DisplayResource, ShowResource } from './ShowResource';
import { usePref } from '../UserPreferences/usePref';

export function ViewRecordSet(): JSX.Element {
  const { id, index } = useParams();
  const recordSetId = f.parseInt(id);
  const resourceIndex = f.parseInt(index) ?? 0;

  return typeof recordSetId === 'number' &&
    typeof resourceIndex === 'number' ? (
    <ProtectedTool action="read" tool="recordSets">
      <RecordSetView recordSetId={recordSetId} resourceIndex={resourceIndex} />
    </ProtectedTool>
  ) : (
    <NotFoundView />
  );
}

function RecordSetView({
  resourceIndex,
  recordSetId,
}: {
  readonly resourceIndex: number;
  readonly recordSetId: number;
}): JSX.Element | null {
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
    true
  );
  // eslint-disable-next-line no-nested-ternary
  return typeof recordSet === 'object' ? (
    <CheckLoggedInCollection resource={recordSet}>
      <DisplayRecordSet recordSet={recordSet} resourceIndex={resourceIndex} />
    </CheckLoggedInCollection>
  ) : recordSet === false ? (
    <NotFoundView />
  ) : null;
}

function DisplayRecordSet({
  recordSet,
  resourceIndex,
}: {
  readonly recordSet: SpecifyResource<RecordSet>;
  readonly resourceIndex: number;
}): null {
  const [recordToOpen] = usePref('form', 'recordSet', 'recordToOpen');
  const navigate = useNavigate();
  useAsyncState(
    React.useCallback(
      async () =>
        fetchCollection('RecordSetItem', {
          recordSet: recordSet.id,
          offset: resourceIndex,
          orderBy: recordToOpen === 'first' ? 'id' : '-id',
          limit: 1,
        }).then(({ records }) =>
          navigate(
            formatUrl(
              getResourceViewUrl(
                getModelById(recordSet.get('dbTableId')).name,
                records[0]?.recordId ?? 'new'
              ),
              { recordSetId: recordSet.id.toString() }
            )
          )
        ),
      [recordSet, resourceIndex, recordToOpen]
    ),
    true
  );
  return null;
}

/** Begins the process of creating a new resource */
export function NewResourceView(): JSX.Element {
  const { tableName = '' } = useParams();
  const { state } = useLocation();
  const resource = (
    state as { readonly resource: SerializedResource<AnySchema> | undefined }
  )?.resource;
  const record = React.useMemo(
    () => f.maybe(resource, deserializeResource),
    [resource]
  );
  const parsedTableName = getModel(tableName)?.name;

  return typeof parsedTableName === 'string' ? (
    <ProtectedTable action="create" tableName={parsedTableName}>
      {typeof record === 'object' ? (
        <ShowResource resource={record} />
      ) : (
        <DisplayResource id={undefined} tableName={parsedTableName} />
      )}
    </ProtectedTable>
  ) : (
    <NotFoundView />
  );
}

export function ViewResource(): JSX.Element {
  const { tableName = '', id } = useParams();
  return <DisplayResource id={id} tableName={tableName} />;
}

export function ViewResourceByGuid({
  model,
  guid,
}: {
  readonly model: SpecifyModel;
  readonly guid: string;
}): JSX.Element | null {
  const [id] = useAsyncState<number | false>(
    React.useCallback(
      async () =>
        fetchCollection((model as SpecifyModel<CollectionObject>).name, {
          guid,
          limit: 1,
        }).then(({ records }) => records[0]?.id ?? false),
      [model, guid]
    ),
    true
  );

  const navigate = useNavigate();
  React.useEffect(
    () =>
      typeof id === 'number'
        ? navigate(getResourceViewUrl(model.name, id), { replace: true })
        : undefined,
    [id]
  );
  return id === false ? <NotFoundView /> : null;
}

export function ViewByCatalog(): JSX.Element {
  return (
    <ProtectedTable action="read" tableName="CollectionObject">
      <ProtectedTable action="read" tableName="Collection">
        <ViewByCatalogProtected />
      </ProtectedTable>
    </ProtectedTable>
  );
}

function ViewByCatalogProtected(): JSX.Element | null {
  const { collectionCode = '', catalogNumber = '' } = useParams();

  const navigate = useNavigate();
  const [id] = useAsyncState<number | false>(
    React.useCallback(async () => {
      const collections = await fetchCollection('Collection', {
        code: collectionCode,
        limit: 2,
      }).then(({ records }) => records);
      if (collections.length === 0) {
        console.error('Unable to find the collection');
        return false;
      } else if (collections.length !== 1)
        console.error('Multiple collections with the same code', {
          collections,
          collectionCode,
        });
      const collection = collections[0];
      if (collection.id !== schema.domainLevelIds.collection) {
        switchCollection(navigate, collection.id);
        return undefined;
      }

      const formatter = defined(
        schema.models.CollectionObject.getLiteralField('catalogNumber')
      ).getUiFormatter();

      let formattedNumber = catalogNumber;
      if (typeof formatter === 'object') {
        const formatted = formatter.format(catalogNumber);
        if (formatted === undefined) {
          console.error('bad catalog number:', catalogNumber);
          return false;
        }
        formattedNumber = formatted;
      }

      return fetchCollection('CollectionObject', {
        catalogNumber: formattedNumber,
        limit: 1,
      }).then(({ records }) => {
        const id = records[0]?.id;
        if (typeof id === 'number') return id;
        console.error('Unable to find the resource');
        return false;
      });
    }, [collectionCode, catalogNumber, navigate]),
    true
  );

  React.useEffect(
    () =>
      typeof id === 'number'
        ? navigate(getResourceViewUrl('CollectionObject', id), {
            replace: true,
          })
        : undefined,
    [navigate, id]
  );

  return id === false ? <NotFoundView /> : null;
}

/**
 * Check if it makes sense to view this resource when logged into current
 * collection
 */
export function CheckLoggedInCollection({
  resource,
  children,
}: {
  readonly resource: SpecifyResource<AnySchema>;
  readonly children: JSX.Element;
}): JSX.Element | null {
  const [otherCollections] = useAsyncState(
    React.useCallback(
      () =>
        resource.isNew()
          ? false
          : resource.fetch().then((resource) => {
              const collectionId = getCollectionForResource(resource);
              return schema.domainLevelIds.collection === collectionId
                ? false
                : typeof collectionId === 'number'
                ? [collectionId]
                : fetchCollectionsForResource(resource).then((collectionIds) =>
                    !Array.isArray(collectionIds) ||
                    collectionIds.includes(schema.domainLevelIds.collection)
                      ? false
                      : collectionIds
                  );
            }),
      [resource]
    ),
    true
  );

  return otherCollections === false ? (
    children
  ) : Array.isArray(otherCollections) ? (
    <OtherCollection collectionIds={otherCollections} />
  ) : null;
}
