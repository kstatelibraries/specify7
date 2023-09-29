import React from 'react';
import { OverlayContext } from '../Router/Router';
import { useNavigate } from 'react-router-dom';
import { useAsyncState, usePromise } from '../../hooks/useAsyncState';
import { Dialog, LoadingScreen } from '../Molecules/Dialog';
import { Button } from '../Atoms/Button';
import { commonText } from '../../localization/common';
import { wbText } from '../../localization/workbench';
import { Link } from '../Atoms/Link';
import { DateElement } from '../Molecules/DateElement';
import { RA } from '../../utils/types';
import { ajax } from '../../utils/ajax';
import { AttachmentDataSetMeta, FetchedDataSet } from './types';
import { fetchAttachmentResourceId } from './fetchAttachmentResource';
import { attachmentsText } from '../../localization/attachments';
import { useEagerDataSet } from './useEagerDataset';
import { RenameAttachmentDataSetDialog } from './RenameAttachmentDataSet';
import { SortIndicator, useSortConfig } from '../Molecules/Sorting';

const fetchAttachmentMappings = () =>
  fetchAttachmentResourceId.then(async (resourceId) =>
    resourceId === undefined
      ? Promise.resolve(undefined)
      : ajax<RA<AttachmentDataSetMeta>>(
          `/attachment_gw/dataset/${resourceId}/`,
          {
            headers: { Accept: 'application/json' },
            method: 'GET',
          }
        ).then(({ data }) => data)
  );

function FetchModifyWrapped({
  id,
  onClose: handleClose,
}: {
  readonly id: number;
  readonly onClose: () => void;
}): JSX.Element | null {
  const [rawDataset] = useAsyncState(
    React.useCallback(
      () =>
        fetchAttachmentResourceId.then(async (resourceId) =>
          resourceId === undefined
            ? Promise.resolve(undefined)
            : ajax<FetchedDataSet>(
                `/attachment_gw/dataset/${resourceId}/${id}/`,
                {
                  headers: { Accept: 'application/json' },
                  method: 'GET',
                }
              ).then(({ data }) => data)
        ),
      [id]
    ),
    true
  );
  return rawDataset === undefined ? null : (
    <ModifyDataset dataset={rawDataset} onClose={handleClose}></ModifyDataset>
  );
}

function ModifyDataset({
  dataset,
  onClose: handleClose,
}: {
  readonly dataset: FetchedDataSet;
  readonly onClose: () => void;
}): JSX.Element {
  const [eagerDataset, isSaving, _, triggerSave, commitChange] =
    useEagerDataSet(dataset);

  return (
    <>
      {isSaving && <LoadingScreen />}
      <RenameAttachmentDataSetDialog
        attachmentDataSetName={eagerDataset.name}
        datasetId={'id' in eagerDataset ? eagerDataset.id : undefined}
        onClose={handleClose}
        onRename={(newName) => {
          commitChange((oldState) => ({
            ...oldState,
            name: newName,
            status: dataset.status,
          }));
          triggerSave();
          handleClose();
        }}
      />
    </>
  );
}

export function AttachmentsImportOverlay(): JSX.Element | null {
  const handleClose = React.useContext(OverlayContext);
  const navigate = useNavigate();
  const attachmentDataSetsPromise = React.useMemo(fetchAttachmentMappings, []);
  const [unsortedDatasets] = usePromise(attachmentDataSetsPromise, true);
  const [sortConfig, handleSort, applySortConfig] = useSortConfig(
    'attachmentDatasets',
    'timestampCreated'
  );
  const sortedDatasets = React.useMemo(
    () =>
      unsortedDatasets === undefined
        ? undefined
        : applySortConfig(
            unsortedDatasets,
            (dataset) => dataset[sortConfig.sortField]
          ),
    [unsortedDatasets, applySortConfig, sortConfig]
  );
  const [editing, setEditing] = React.useState<number | undefined>(undefined);

  return sortedDatasets === undefined ? null : (
    <>
      {typeof editing === 'number' && (
        <FetchModifyWrapped
          id={editing}
          onClose={() => navigate('/specify/')}
        />
      )}
      <Dialog
        buttons={
          <>
            <Button.DialogClose>{commonText.close()}</Button.DialogClose>
            <Button.Info
              onClick={() => navigate('/specify/attachments/import/new')}
            >
              {commonText.new()}
            </Button.Info>
          </>
        }
        header={attachmentsText.attachmentImportDatasetsCount({
          count: sortedDatasets.length,
        })}
        onClose={handleClose}
      >
        <table className="grid-table grid-cols-[repeat(3,auto)_min-content] gap-2">
          <thead>
            <tr>
              <th scope="col">
                <Button.LikeLink onClick={() => handleSort('name')}>
                  {wbText.dataSetName()}
                </Button.LikeLink>
                <SortIndicator fieldName="name" sortConfig={sortConfig} />
              </th>

              <th scope="col" onClick={() => handleSort('timestampCreated')}>
                <Button.LikeLink onClick={() => handleSort('name')}>
                  {attachmentsText.timeStampCreated()}
                </Button.LikeLink>
                <SortIndicator
                  fieldName="timeStampCreated"
                  sortConfig={sortConfig}
                />
              </th>

              <th scope="col" onClick={() => handleSort('timestampModified')}>
                <Button.LikeLink onClick={() => handleSort('name')}>
                  {attachmentsText.timeStampModified()}
                </Button.LikeLink>

                <SortIndicator
                  fieldName="timeStampModified"
                  sortConfig={sortConfig}
                />
              </th>

              <td />
            </tr>
          </thead>
          <tbody>
            {sortedDatasets.map((attachmentDataSet) => (
              <tr key={attachmentDataSet.id}>
                <td>
                  <Link.Default
                    className="overflow-x-auto"
                    href={`/specify/attachments/import/${attachmentDataSet.id}`}
                  >
                    {attachmentDataSet.name}
                  </Link.Default>
                </td>
                <td>
                  <DateElement date={attachmentDataSet.timestampCreated} />
                </td>
                <td>
                  {typeof attachmentDataSet.timestampModified === 'string' ? (
                    <DateElement date={attachmentDataSet.timestampModified} />
                  ) : null}
                </td>
                <td>
                  <Button.Icon
                    icon="pencil"
                    title={commonText.edit()}
                    onClick={() => setEditing(attachmentDataSet.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Dialog>
    </>
  );
}
