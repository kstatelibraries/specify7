import React from 'react';
import { useErrorContext } from '../../hooks/useErrorContext';
import { attachmentsText } from '../../localization/attachments';
import { commonText } from '../../localization/common';
import { preferencesText } from '../../localization/preferences';
import { wbText } from '../../localization/workbench';
import { Tabs } from '../AppResources/Tabs';
import { Button } from '../Atoms/Button';
import { Textarea } from '../Atoms/Form';
import { AttachmentsView } from '../Attachments';
import { fetchOriginalUrl } from '../Attachments/attachments';
import { UploadAttachment, useAttachment } from '../Attachments/Plugin';
import { LoadingContext } from '../Core/Contexts';
import { Dialog } from '../Molecules/Dialog';

export function AttachmentPicker({
  url,
  onChange: handleChange,
  isReadOnly,
}: {
  readonly url: string | undefined;
  readonly onChange: (url: string) => void;
  readonly isReadOnly: boolean;
}): JSX.Element {
  const [attachment, setAttachment] = useAttachment(undefined);
  useErrorContext('attachment', attachment);

  const [isCustom, setIsCustom] = React.useState(false);

  const loading = React.useContext(LoadingContext);

  const [UrlNotFound, setUrlNotFound] = React.useState(false);

  const [type, setType] = React.useState<
    'url' | 'image' | 'attachments' | 'attachments'
  >('url');
  const types = ['url', 'image', 'attachments', 'attachments'] as const;

  return (
    <>
      {!isReadOnly ? (
        <Button.Gray onClick={() => setIsCustom(!isCustom)}>
          {url === undefined ? commonText.pick() : commonText.change()}
        </Button.Gray>
      ) : undefined}
      {url !== undefined && !isReadOnly ? (
        <Button.Gray
          onClick={() => {
            setAttachment(undefined);
            handleChange('default');
          }}
        >
          {commonText.delete()}
        </Button.Gray>
      ) : undefined}
      {url !== undefined ? (
        <img
          className={`max-h-full max-w-full object-contain`}
          src={url}
          style={{
            width: `10rem`,
            height: `10rem`,
          }}
        />
      ) : null}

      {isCustom && (
        <Dialog
          buttons={commonText.close()}
          header={preferencesText.pickAttachment()}
          onClose={(): void => {
            setIsCustom(!isCustom);
          }}
        >
          <Tabs
            tabs={{
              [preferencesText.url()]: (
                <Textarea onValueChange={handleChange} value={url} />
              ),
              [wbText.upload()]: (
                <UploadAttachment
                  onUploaded={(attachment): void => {
                    setAttachment(attachment);
                  }}
                />
              ),
              [attachmentsText.attachments()]: (
                <AttachmentsView
                  onClick={(attachment): void => {
                    loading(
                      fetchOriginalUrl(attachment).then((url) => {
                        url !== undefined
                          ? handleChange(url)
                          : setUrlNotFound(true);
                      })
                    );
                  }}
                />
              ),
            }}
            index={[types.indexOf(type), (index) => setType(types[index])]}
          />
          {UrlNotFound === true && (
            <Dialog
              buttons={commonText.cancel()}
              onClose={() => setUrlNotFound(false)}
              header={attachmentsText.attachments()}
            >
              {preferencesText.attachmentFailed()}
            </Dialog>
          )}
        </Dialog>
      )}
    </>
  );
}
