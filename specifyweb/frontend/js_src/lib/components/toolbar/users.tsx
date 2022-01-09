import React from 'react';

import commonText from '../../localization/common';
import * as navigation from '../../navigation';
import schema from '../../schema';
import type { IR } from '../../types';
import userInfo from '../../userinfo';
import { useTitle } from '../hooks';
import type { UserTool } from '../main';
import { LoadingScreen, Dialog } from '../modaldialog';
import createBackboneView from '../reactbackboneextend';
import { BlueButton, Link } from '../basic';

function Users({
  onClose: handleClose,
}: {
  readonly onClose: () => void;
}): JSX.Element {
  useTitle(commonText('manageUsers'));
  const [users, setUsers] = React.useState<IR<string> | undefined>(undefined);

  React.useEffect(() => {
    const users = new schema.models.SpecifyUser.LazyCollection({
      filters: { orderby: 'name' },
    });
    users
      .fetch({ limit: 0 })
      .done(() =>
        destructorCalled
          ? undefined
          : setUsers(
              Object.fromEntries(
                users.models.map((user) => [
                  user.get<string>('name'),
                  user.viewUrl(),
                ])
              )
            )
      );

    let destructorCalled = false;
    return (): void => {
      destructorCalled = true;
    };
  }, []);
  return typeof users === 'undefined' ? (
    <LoadingScreen />
  ) : (
    <Dialog
      header={commonText('manageUsersDialogTitle')}
      onClose={handleClose}
      buttons={[
        'cancel',
        <BlueButton
          onClick={(): void => {
            handleClose();
            navigation.go('view/specifyuser/new/');
          }}
        >
          {commonText('new')}
        </BlueButton>,
      ]}
    >
      <ul>
        {Object.entries(users).map(([userName, viewUrl]) => (
          <li key={userName}>
            <Link className="intercept-navigation" href={viewUrl}>
              {userName}
            </Link>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

const View = createBackboneView(Users);

const userTool: UserTool = {
  task: 'users',
  title: commonText('manageUsers'),
  view: ({ onClose }) => new View({ onClose }),
  enabled: () => userInfo.isadmin,
};

export default userTool;
