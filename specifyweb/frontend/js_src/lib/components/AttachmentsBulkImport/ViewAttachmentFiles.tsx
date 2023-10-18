import React from 'react';
import type { LocalizedString } from 'typesafe-i18n';

import { attachmentsText } from '../../localization/attachments';
import { commonText } from '../../localization/common';
import { LANGUAGE } from '../../localization/utils/config';
import { f } from '../../utils/functools';
import type { IR, RA } from '../../utils/types';
import { Link } from '../Atoms/Link';
import { getResourceViewUrl } from '../DataModel/resource';
import type { Tables } from '../DataModel/types';
import { GenericSortedDataViewer } from '../Molecules/GenericSortedDataViewer';
import { useDragDropFiles } from '../Molecules/useDragDropFiles';
import type { PartialAttachmentUploadSpec } from './Import';
import { ResourceDisambiguationDialog } from './ResourceDisambiguation';
import type { PartialUploadableFileSpec } from './types';
import {
  keyLocalizationMapAttachment,
  resolveAttachmentRecord,
  resolveAttachmentStatus,
} from './utils';
import { Ul } from '../Atoms';
import { headerText } from '../../localization/header';

const sizeFormatter = new Intl.NumberFormat(LANGUAGE, {
  unit: 'byte',
  notation: 'compact',
  unitDisplay: 'narrow',
  style: 'unit',
});
const resolveAttachmentDatasetData = (
  uploadableFiles: RA<PartialUploadableFileSpec>,
  setDisambiguationIndex: (index: number) => void,
  baseTableName: keyof Tables | undefined
) =>
  uploadableFiles.map(
    ({ uploadFile, status, matchedId, disambiguated, attachmentId }, index) => {
      const handleDisambiguate =
        matchedId !== undefined &&
        matchedId.length > 1 &&
        attachmentId === undefined &&
        // FEATURE: Allow disambiguating again
        disambiguated === undefined
          ? () => setDisambiguationIndex(index)
          : undefined;

      const resolvedRecord =
        baseTableName === undefined
          ? undefined
          : resolveAttachmentRecord(
              matchedId,
              disambiguated,
              uploadFile.parsedName
            );
      const isRuntimeError =
        status !== undefined &&
        typeof status === 'object' &&
        (status.type === 'cancelled' || status.type === 'skipped');
      const statusText = f.maybe(status, resolveAttachmentStatus) ?? '';
      return {
        selectedFileName: [
          uploadFile.file.name,
          uploadFile.file instanceof File
            ? ''
            : `(${attachmentsText.noFile()})`,
        ].join(' '),
        fileSize: sizeFormatter.format(uploadFile.file.size),
        // Will be replaced by icons soon
        status: [statusText, <p>{statusText}</p>],
        record: [
          resolvedRecord?.type === 'matched'
            ? resolvedRecord.id
            : resolvedRecord?.reason,
          <button onClick={handleDisambiguate} type="button">
            {resolvedRecord?.type === 'matched' ? (
              <Link.NewTab
                href={getResourceViewUrl(baseTableName!, resolvedRecord.id)}
              >
                {uploadFile.parsedName?.toString()}
              </Link.NewTab>
            ) : (
              resolvedRecord !== undefined && (
                <div>{keyLocalizationMapAttachment[resolvedRecord.reason]}</div>
              )
            )}
          </button>,
        ],

        attachmentId,
        canDisambiguate: typeof handleDisambiguate === 'function',
        isNativeError: resolvedRecord?.type === 'invalid',
        isRuntimeError,
      } as const;
    }
  );

export function ViewAttachmentFiles({
  uploadableFiles,
  baseTableName,
  onDisambiguation: handleDisambiguation,
  onFilesDropped: handleFilesDropped,
  headers,
}: {
  readonly uploadableFiles: RA<PartialUploadableFileSpec>;
  readonly baseTableName: keyof Tables | undefined;
  readonly uploadSpec: PartialAttachmentUploadSpec;
  readonly onDisambiguation:
    | ((
        disambiguatedId: number,
        indexToDisambiguate: number,
        multiple: boolean
      ) => void)
    | undefined;
  readonly onFilesDropped?: (file: FileList) => void;
  readonly headers: IR<JSX.Element | LocalizedString>;
}): JSX.Element | null {
  const [disambiguationIndex, setDisambiguationIndex] = React.useState<
    number | undefined
  >(undefined);

  const data = React.useMemo(
    () =>
      resolveAttachmentDatasetData(
        uploadableFiles,
        setDisambiguationIndex,
        baseTableName
      ),
    [uploadableFiles, setDisambiguationIndex, baseTableName]
  );

  const fileDropDivRef = React.useRef<HTMLDivElement>(null);
  const { isDragging, callbacks } = useDragDropFiles(
    handleFilesDropped,
    fileDropDivRef
  );

  return (
    <>
      <div
        className="flex w-full flex-1 flex-col gap-2 overflow-auto rounded bg-[color:var(--background)] p-4 shadow-md"
        {...callbacks}
      >
        <div className="h-full overflow-auto" ref={fileDropDivRef}>
          {data.length === 0 ? (
            <StartUploadDescription isDragging={isDragging} />
          ) : (
            <>
              <div className="font-semibold">
                {commonText.colonLine({
                  label: attachmentsText.totalFiles(),
                  value: data.length.toString(),
                })}
              </div>
              <GenericSortedDataViewer
                cellClassName={(row, column, index) =>
                  `bg-[color:var(--background)] p-2 print:p-1 ${
                    row.canDisambiguate && column === 'record'
                      ? 'hover:bg-brand-200'
                      : ''
                  }
                  ${
                    (row.isNativeError && column === 'record') ||
                    (row.isRuntimeError && column === 'status')
                      ? 'wbs-form text-red-600'
                      : ''
                  } ${
                    index % 2 === 0
                      ? 'bg-gray-100/60 dark:bg-[color:var(--form-background)]'
                      : 'bg-[color:var(--background)]'
                  }`
                }
                className="w-full"
                data={data}
                getLink={undefined}
                headerClassName={`border-b-2 ${
                  isDragging ? 'bg-brand-100' : ''
                }`}
                headers={headers}
              />
            </>
          )}
        </div>
      </div>
      {typeof disambiguationIndex === 'number' &&
      typeof handleDisambiguation === 'function' &&
      baseTableName !== undefined ? (
        <ResourceDisambiguationDialog
          baseTable={baseTableName}
          handleAllResolve={(resourceId) => {
            handleDisambiguation(resourceId, disambiguationIndex, true);
            setDisambiguationIndex(undefined);
          }}
          handleResolve={(resourceId) => {
            handleDisambiguation(resourceId, disambiguationIndex, false);
            setDisambiguationIndex(undefined);
          }}
          previousSelected={uploadableFiles[disambiguationIndex].disambiguated}
          resourcesToResolve={uploadableFiles[disambiguationIndex].matchedId!}
          onClose={() => setDisambiguationIndex(undefined)}
        />
      ) : undefined}
    </>
  );
}

function StartUploadDescription({
  isDragging,
}: {
  readonly isDragging: boolean;
}): JSX.Element {
  return (
    <div
      className={`flex h-full flex-1 items-center justify-center ${
        isDragging ? 'bg-brand-100' : ''
      }`}
    >
      <Ul className="flex flex-col gap-3">
        <li>{attachmentsText.chooseFilesToGetStarted()}</li>
        <li>{attachmentsText.selectIdentifier()}</li>
        <li>
          <Link.NewTab href={'https://discourse.specifysoftware.org/'}>
            {headerText.documentation()}
          </Link.NewTab>
        </li>
      </Ul>
    </div>
  );
}
