/**
 * Entrypoint for the Security Panel
 */

import React from 'react';

import { ajax } from '../../utils/ajax';
import { fetchCollection } from '../DataModel/collection';
import type { Institution, SpecifyUser } from '../DataModel/types';
import type { SerializedResource } from '../DataModel/helpers';
import { serializeResource } from '../DataModel/helpers';
import { index } from '../../utils/utils';
import { adminText } from '../../localization/admin';
import { hasPermission, hasTablePermission } from '../Permissions/helpers';
import { schema } from '../DataModel/schema';
import type { BackEndRole } from '../Security/utils';
import { processPolicies } from '../Security/utils';
import type { GetOrSet, IR, RA } from '../../utils/types';
import { userInformation } from '../InitialContext/userInformation';
import { Container, H2, H3 } from '../Atoms';
import { ActiveLink } from '../Molecules';
import { ErrorBoundary } from '../Errors/ErrorBoundary';
import { useAsyncState } from '../../hooks/hooks';
import { useAvailableCollections } from '../Forms/OtherCollectionView';
import { SafeOutlet } from '../Router/RouterUtils';
import type { Role } from '../Security/Role';
import { className } from '../Atoms/className';

export type SecurityOutlet = {
  readonly institution: SerializedResource<Institution> | undefined;
  readonly getSetUsers: GetOrSet<
    IR<SerializedResource<SpecifyUser>> | undefined
  >;
  readonly getSetLibraryRoles: GetOrSet<IR<Role> | undefined>;
};

export function SecurityPanel(): JSX.Element | null {
  const [institution] = useAsyncState(
    React.useCallback(
      async () =>
        hasTablePermission('Institution', 'read')
          ? fetchCollection('Institution', { limit: 1 }).then(
              ({ records }) => records[0]
            )
          : undefined,
      []
    ),
    true
  );

  const users = useAsyncState<IR<SerializedResource<SpecifyUser>>>(
    React.useCallback(
      async () =>
        hasTablePermission('SpecifyUser', 'read')
          ? fetchCollection('SpecifyUser', { limit: 0 }).then(({ records }) =>
              index(records)
            )
          : {
              [userInformation.id]: serializeResource(userInformation),
            },
      []
    ),
    false
  );

  const libraryRoles = useAsyncState<IR<Role>>(
    React.useCallback(
      async () =>
        hasPermission('/permissions/library/roles', 'read')
          ? ajax<RA<BackEndRole>>('/permissions/library_roles/', {
              headers: { Accept: 'application/json' },
            }).then(({ data }) =>
              index(
                data.map((role) => ({
                  ...role,
                  policies: processPolicies(role.policies),
                }))
              )
            )
          : undefined,
      []
    ),
    false
  );

  const context: SecurityOutlet = {
    institution,
    getSetUsers: users,
    getSetLibraryRoles: libraryRoles,
  };

  /*
   * FEATURE: replace blank home page with a security dashabord
   *    that includes: whether page is using https, how many super admins
   *    there are and etc
   */
  return (
    <Container.FullGray>
      <H2 className="text-2xl">{adminText('securityPanel')}</H2>
      <div className="flex h-0 flex-1 gap-4">
        <Aside institution={institution} />
        <ErrorBoundary dismissable>
          <SafeOutlet<SecurityOutlet> {...context} />
        </ErrorBoundary>
      </div>
    </Container.FullGray>
  );
}

function Aside({
  institution,
}: {
  readonly institution: SerializedResource<Institution> | undefined;
}): JSX.Element {
  const availableCollections = useAvailableCollections();
  return (
    <aside className={className.containerBase}>
      {typeof institution === 'object' && (
        <section>
          <H3>{schema.models.Institution.label}</H3>
          <ActiveLink href="/specify/security/institution">
            {institution.name}
          </ActiveLink>
        </section>
      )}
      <section>
        <H3>{adminText('collections')}</H3>
        <ul>
          {availableCollections.map((collection, index) => (
            <li key={index}>
              <ActiveLink
                href={`/specify/security/collection/${collection.id}/`}
              >
                {collection.collectionName}
              </ActiveLink>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
