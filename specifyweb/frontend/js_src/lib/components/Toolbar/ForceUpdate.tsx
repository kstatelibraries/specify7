/**
 * Force export feed update
 */

import React from 'react';

import { ping } from '../../utils/ajax/ping';
import { commonText } from '../../localization/common';
import { Button } from '../Atoms/Button';
import { LoadingContext } from '../Core/Contexts';
import { useBooleanState } from '../../hooks/hooks';
import { Dialog } from '../Molecules/Dialog';
import { OverlayContext } from '../Router/Router';

export function ForceUpdateFeedOverlay(): JSX.Element {
  const loading = React.useContext(LoadingContext);
  const handleClose = React.useContext(OverlayContext);
  const [isActivated, handleActivated, handleDeactivated] = useBooleanState();

  return isActivated ? (
    <Dialog
      buttons={commonText('close')}
      header={commonText('feedExportStartedDialogHeader')}
      onClose={handleClose}
    >
      {commonText('feedExportStartedDialogText')}
    </Dialog>
  ) : (
    <Dialog
      buttons={
        <>
          <Button.DialogClose>{commonText('cancel')}</Button.DialogClose>
          <Button.Blue
            onClick={(): void =>
              loading(
                ping('/export/force_update/', {
                  method: 'POST',
                })
                  .then(handleActivated)
                  .catch(handleDeactivated)
              )
            }
          >
            {commonText('update')}
          </Button.Blue>
        </>
      }
      header={commonText('updateExportFeedDialogHeader')}
      onClose={handleClose}
    >
      {commonText('updateExportFeedDialogText')}
    </Dialog>
  );
}
