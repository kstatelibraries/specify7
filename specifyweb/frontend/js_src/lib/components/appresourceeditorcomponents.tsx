import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { indentUnit, StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import type { Diagnostic } from '@codemirror/lint';
import { lintGutter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { EditorView } from 'codemirror';
import React from 'react';

import { getAppResourceType } from '../appresourcesfilters';
import { jsonLinter, xmlLinter } from '../codemirrorlinters';
import type {
  SpAppResource,
  SpViewSetObj as SpViewSetObject,
  SpViewSetObj as SpViewSetObject_,
} from '../datamodel';
import type { SerializedResource } from '../datamodelutils';
import type { SpecifyResource } from '../legacytypes';
import { adminText } from '../localization/admin';
import { commonText } from '../localization/common';
import { tableFromUrl } from '../resource';
import type { RA } from '../types';
import { appResourceSubTypes, appResourceTypes } from './appresourcescreate';
import { getAppResourceExtension } from './appresourceshooks';
import { Button, DataEntry } from './basic';
import { LoadingContext } from './contexts';
import { downloadFile, FilePicker, fileToText } from './filepicker';
import { useBooleanState } from './hooks';
import { Dialog } from './modaldialog';
import { usePref } from './preferenceshooks';

export function AppResourceIcon({
  resource,
}: {
  readonly resource: SerializedResource<SpViewSetObject | SpAppResource>;
}): JSX.Element {
  const tableName = tableFromUrl(resource.resource_uri ?? '');
  if (tableName === 'SpViewSetObj') return appResourceTypes.viewSets.icon;
  const type = getAppResourceType(
    resource as SerializedResource<SpAppResource>
  );
  return appResourceSubTypes[type].icon;
}

export function AppResourceEditButton({
  title,
  children,
}: {
  readonly title: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const [isEditingMeta, handleEditingMeta, handleEditedMeta] =
    useBooleanState();
  return (
    <>
      <DataEntry.Edit onClick={handleEditingMeta} />
      {isEditingMeta && (
        <Dialog
          header={title}
          buttons={commonText('close')}
          onClose={handleEditedMeta}
        >
          {children}
        </Dialog>
      )}
    </>
  );
}

export function AppResourceLoad({
  onLoaded: handleLoaded,
}: {
  readonly onLoaded: (data: string, mimeType: string) => void;
}): JSX.Element {
  const [isOpen, handleOpen, handleClose] = useBooleanState();
  const loading = React.useContext(LoadingContext);
  return (
    <>
      <Button.Green className="whitespace-nowrap" onClick={handleOpen}>
        {adminText('loadFile')}
      </Button.Green>
      {isOpen && (
        <Dialog
          header={adminText('loadFile')}
          onClose={handleClose}
          buttons={commonText('cancel')}
        >
          <FilePicker
            onSelected={(file): void =>
              loading(
                fileToText(file)
                  .then((data) => handleLoaded(data, file.type))
                  .finally(handleClose)
              )
            }
            acceptedFormats={undefined}
          />
        </Dialog>
      )}
    </>
  );
}

export function AppResourceDownload({
  resource,
  data,
}: {
  readonly resource: SerializedResource<SpViewSetObject | SpAppResource>;
  readonly data: string;
}): JSX.Element {
  const loading = React.useContext(LoadingContext);
  return (
    <Button.Green
      className="whitespace-nowrap"
      disabled={data.length === 0}
      onClick={(): void =>
        loading(
          downloadFile(
            `${resource.name}.${getAppResourceExtension(resource)}`,
            data
          )
        )
      }
    >
      {commonText('download')}
    </Button.Green>
  );
}

const linterKey = `parseError:${'spAppResourceDatas'.toLowerCase()}`;
export function useCodeMirrorExtensions(
  resource: SerializedResource<SpAppResource | SpViewSetObject_>,
  appResource: SpecifyResource<SpAppResource | SpViewSetObject_>
): Extension[] {
  const [lineWrap] = usePref('appResources', 'behavior', 'lineWrap');
  const [indentSize] = usePref('appResources', 'behavior', 'indentSize');
  const [indentWithTab] = usePref('appResources', 'behavior', 'indentWithTab');
  const indentCharacter = indentWithTab ? '\t' : ' '.repeat(indentSize);

  const mode = getAppResourceExtension(resource);
  const [extensions, setExtensions] = React.useState<Extension[]>([]);
  React.useEffect(() => {
    function handleLinted(results: RA<Diagnostic>): void {
      const hasErrors = results.length > 0;
      if (hasErrors)
        appResource.saveBlockers?.add(
          linterKey,
          undefined,
          results.map(({ message }) => message).join('\n')
        );
      else appResource.saveBlockers?.remove(linterKey);
    }

    const language =
      mode === 'json'
        ? [json(), jsonLinter(handleLinted)]
        : mode === 'properties'
        ? [StreamLanguage.define(properties)]
        : [xml(), xmlLinter(handleLinted)];
    setExtensions([
      ...language,
      ...(lineWrap ? [EditorView.lineWrapping] : []),
      indentUnit.of(indentCharacter),
      EditorState.tabSize.of(indentSize),
      lintGutter(),
    ]);

    return (): void => appResource.saveBlockers?.remove(linterKey);
  }, [appResource, mode, lineWrap, indentCharacter, indentSize]);

  return extensions;
}
