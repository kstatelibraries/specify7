import React from 'react';
import { RA, filterArray } from '../../utils/types';
import { SpecifyResource } from '../DataModel/legacyTypes';
import type { AnySchema } from '../DataModel/helperTypes';
import { Dialog } from '../Molecules/Dialog';
import { attachmentsText } from '../../localization/attachments';
import { useAsyncState } from '../../hooks/useAsyncState';
import { CollectionObjectAttachment } from '../DataModel/types';
import { serializeResource } from '../DataModel/helpers';
import { AttachmentGallery } from './Gallery';
import { useCachedState } from '../../hooks/useCachedState';
import { defaultAttachmentScale } from '.';
import { Button } from '../Atoms/Button';
import { commonText } from '../../localization/common';
import { f } from '../../utils/functools';
import { useBooleanState } from '../../hooks/useBooleanState';

const haltIncrementSize = 300;

export function RecordSetAttachments<SCHEMA extends AnySchema>({
  records,
  onFetch: handleFetch,
}: {
  readonly records: RA<SpecifyResource<SCHEMA> | undefined>;
  readonly onFetch:
    | ((index: number) => Promise<RA<number | undefined> | void>)
    | undefined;
}): JSX.Element {
  const recordFetched = React.useRef<number>(0);

  const [showAttachments, handleShowAttachments, handleHideAttachments] =
    useBooleanState();

  const [attachments] = useAsyncState(
    React.useCallback(async () => {
      const relatedAttachementRecords = await Promise.all(
        records.map((record) =>
          record
            ?.rgetCollection(`${record.specifyModel.name}Attachments`)
            .then(
              ({ models }) =>
                models as RA<SpecifyResource<CollectionObjectAttachment>>
            )
        )
      );

      const fetchCount = records.findIndex(
        (record) => record?.populated !== true
      );

      recordFetched.current = fetchCount === -1 ? records.length : fetchCount;

      const attachements = await Promise.all(
        filterArray(relatedAttachementRecords.flat()).map(
          async (collectionObjectAttachment) => ({
            attachment: await collectionObjectAttachment
              .rgetPromise('attachment')
              .then((resource) => serializeResource(resource)),
            related: collectionObjectAttachment,
          })
        )
      );

      return {
        attachments: attachements.map(({ attachment }) => attachment),
        related: attachements.map(({ related }) => related),
        count: attachements.length,
      };
    }, [records]),
    true
  );

  //halt value was added to not scraped all the records for attachment in cases where there is more than 300 and no attachments, the user is able to ask for the next 300 if necessary
  const [haltValue, setHaltValue] = React.useState(300);
  const halt =
    attachments?.attachments.length === 0 && records.length >= haltValue;

  const [scale = defaultAttachmentScale] = useCachedState(
    'attachments',
    'scale'
  );

  return (
    <>
      <Button.Icon
        icon="photos"
        onClick={() => handleShowAttachments()}
        title="attachments"
      ></Button.Icon>
      {showAttachments && (
        <Dialog
          buttons={
            <Button.DialogClose>{commonText.close()}</Button.DialogClose>
          }
          header={
            attachments?.count !== undefined
              ? commonText.countLine({
                  resource: attachmentsText.attachments(),
                  count: attachments.count,
                })
              : attachmentsText.attachments()
          }
          onClose={handleHideAttachments}
        >
          {halt ? (
            haltValue === records.length ? (
              <>{attachmentsText.noAttachments()}</>
            ) : (
              <div className="flex flex-col gap-4">
                {attachmentsText.attachmentHaltLimit({ halt: haltValue })}
                <Button.Orange
                  onClick={(): void =>
                    setHaltValue(
                      Math.min(haltValue + haltIncrementSize, records.length)
                    )
                  }
                >
                  {attachmentsText.fetchNextAttachments()}
                </Button.Orange>
              </div>
            )
          ) : (
            <AttachmentGallery
              attachments={attachments?.attachments ?? []}
              isComplete={recordFetched.current === records.length}
              scale={scale}
              onChange={(attachment, index): void =>
                void attachments?.related[index].set(`attachment`, attachment)
              }
              onFetchMore={
                attachments === undefined || handleFetch === undefined || halt
                  ? undefined
                  : async () =>
                      handleFetch?.(recordFetched.current).then(f.void)
              }
            />
          )}
        </Dialog>
      )}
    </>
  );
}
