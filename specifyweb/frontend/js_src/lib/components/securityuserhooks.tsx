import React from 'react';

import { ajax, Http } from '../ajax';
import { fetchCollection } from '../collection';
import type { Address, Collection, SpecifyUser } from '../datamodel';
import type { SerializedResource } from '../datamodelutils';
import { serializeResource } from '../datamodelutils';
import { f } from '../functools';
import { group, sortFunction } from '../helpers';
import type { SpecifyResource } from '../legacytypes';
import {
  hasDerivedPermission,
  hasPermission,
  hasTablePermission,
} from '../permissionutils';
import { fetchResource, getResourceApiUrl, idFromUrl } from '../resource';
import { schema } from '../schema';
import { fetchRoles, fetchUserRoles, processPolicies } from '../securityutils';
import type { IR, RA, RR } from '../types';
import { defined } from '../types';
import { userInformation } from '../userinfo';
import { useAsyncState } from './hooks';
import type { RoleBase } from './securitycollection';
import type { Policy } from './securitypolicy';
import type { Role } from './securityrole';

/** Fetch roles from all collections */
export function useCollectionRoles(
  collections: RA<SerializedResource<Collection>>
): RR<number, RA<Role> | undefined> | undefined {
  const [collectionRoles] = useAsyncState(
    React.useCallback(
      async () =>
        Promise.all(
          collections.map(async (collection) =>
            fetchRoles(collection.id).then(
              (roles) => [collection.id, roles] as const
            )
          )
        ).then((entries) => Object.fromEntries(entries)),
      [collections]
    ),
    false
  );
  return collectionRoles;
}

/** Fetch user roles in all collections */
export function useUserRoles(
  userResource: SpecifyResource<SpecifyUser>,
  collections: RA<SerializedResource<Collection>>
): readonly [
  userRoles: IR<RA<RoleBase> | undefined> | undefined,
  setUserRoles: (value: IR<RA<RoleBase> | undefined>) => void,
  initialRoles: React.MutableRefObject<IR<RA<RoleBase> | undefined>>,
  hasChanges: boolean
] {
  const initialUserRoles = React.useRef<IR<RA<RoleBase> | undefined>>({});
  const [userRoles, setUserRoles] = useAsyncState<IR<RA<RoleBase> | undefined>>(
    React.useCallback(
      async () =>
        userResource.isNew()
          ? Object.fromEntries(collections.map(({ id }) => [id, []]))
          : Promise.all(
              collections.map(async (collection) =>
                fetchUserRoles(collection.id, userResource.id).then(
                  (roles) => [collection.id, roles] as const
                )
              )
            )
              .then((entries) => Object.fromEntries(entries))
              .then((userRoles) => {
                initialUserRoles.current = userRoles;
                return userRoles;
              }),
      [userResource, collections]
    ),
    false
  );
  const changedRoles =
    typeof userRoles === 'object' &&
    Object.entries(userRoles).some(
      ([collectionId, roles]) =>
        JSON.stringify(roles) !==
        JSON.stringify(initialUserRoles.current[collectionId])
    );

  return [userRoles, setUserRoles, initialUserRoles, changedRoles];
}

export type UserAgents = RA<{
  readonly divisionId: number;
  readonly collections: RA<number>;
  /*
   * Address resource is used to store a link to the Agent resource,
   * because QueryComboBox requires some sort of parent resource
   */
  readonly address: SpecifyResource<Address>;
}>;

/** Fetch User Agents in all Collections */
export function useUserAgents(
  userId: number | undefined,
  collections: RA<SerializedResource<Collection>>,
  version: number
): UserAgents | undefined {
  const [userAgents] = useAsyncState(
    React.useCallback(
      async () =>
        f.var(
          hasTablePermission('Discipline', 'read')
            ? group(
                await Promise.all(
                  group(
                    collections.map((collection) => [
                      defined(idFromUrl(collection.discipline)),
                      collection.id,
                    ])
                  ).map(async ([disciplineId, collections]) =>
                    fetchResource('Discipline', disciplineId)
                      .then((discipline) =>
                        defined(idFromUrl(defined(discipline).division))
                      )
                      .then((divisionId) =>
                        collections.map(
                          (collectionId) => [divisionId, collectionId] as const
                        )
                      )
                  )
                ).then(f.flat)
              )
            : ([
                [
                  schema.domainLevelIds.division,
                  userInformation.availableCollections
                    .filter(
                      ({ discipline }) =>
                        discipline ===
                        getResourceApiUrl(
                          'Discipline',
                          schema.domainLevelIds.discipline
                        )
                    )
                    .map(({ id }) => id),
                ],
              ] as const),
          async (divisions) =>
            (typeof userId === 'number'
              ? hasTablePermission('Agent', 'read') &&
                hasTablePermission('Division', 'read')
                ? fetchCollection(
                    'Agent',
                    {
                      limit: 1,
                      specifyUser: userId,
                    },
                    {
                      division__in: divisions.map(([id]) => id).join(','),
                    }
                  ).then(({ records }) => records)
                : Promise.resolve([serializeResource(userInformation.agent)])
              : Promise.resolve([])
            ).then((agents) =>
              f.var(
                Object.fromEntries(
                  agents.map((agent) => [
                    defined(idFromUrl(agent.division)),
                    agent,
                  ])
                ),
                (agents) =>
                  divisions.map(([divisionId, collections]) => ({
                    divisionId,
                    collections,
                    address: new schema.models.Address.Resource({
                      agent: f.maybe(agents[divisionId]?.id, (agentId) =>
                        getResourceApiUrl('Agent', agentId)
                      ),
                    }),
                  }))
              )
            )
        ),
      // ReFetch user agents when user is saved
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [userId, collections, version]
    ),
    false
  );

  return userAgents;
}

/** Fetching user policies */
export function useUserPolicies(
  userResource: SpecifyResource<SpecifyUser>,
  collections: RA<SerializedResource<Collection>>,
  initialCollection: number | undefined
): readonly [
  userPolicies: IR<RA<Policy> | undefined> | undefined,
  setUserPolicies: (value: IR<RA<Policy> | undefined> | undefined) => void,
  initialPolicies: React.MutableRefObject<IR<RA<Policy> | undefined>>,
  hasChanges: boolean
] {
  const initialUserPolicies = React.useRef<IR<RA<Policy> | undefined>>({});
  const [userPolicies, setUserPolicies] = useAsyncState(
    React.useCallback(
      async () =>
        userResource.isNew()
          ? Object.fromEntries(
              collections.map(({ id }) => [
                id,
                id === initialCollection
                  ? [
                      {
                        resource: '/system/sp7/collection',
                        actions: ['access'],
                      },
                    ]
                  : [],
              ])
            )
          : Promise.all(
              collections.map(async (collection) =>
                ajax<IR<RA<string>>>(
                  `/permissions/user_policies/${collection.id}/${userResource.id}/`,
                  {
                    headers: { Accept: 'application/json' },
                  },
                  {
                    /*
                     * When looking at a different collection, it is not yet
                     * know if user has read permission. Instead of waiting for
                     * permission query to complete, query anyway and silently
                     * handle the permission denied error
                     */
                    expectedResponseCodes: [Http.OK, Http.FORBIDDEN],
                  }
                ).then(
                  ({ data, status }) =>
                    [
                      collection.id,
                      status === Http.FORBIDDEN
                        ? undefined
                        : processPolicies(data),
                    ] as const
                )
              )
            )
              .then((entries) => Object.fromEntries(entries))
              .then((policies) => {
                initialUserPolicies.current = policies;
                return policies;
              }),
      [userResource, collections, initialCollection]
    ),
    false
  );
  const changedPolices =
    typeof userPolicies === 'object' &&
    JSON.stringify(userPolicies) !==
      JSON.stringify(initialUserPolicies.current);

  return [userPolicies, setUserPolicies, initialUserPolicies, changedPolices];
}

/** Fetching user institutional policies */
export function useUserInstitutionalPolicies(
  userResource: SpecifyResource<SpecifyUser>
): readonly [
  institutionPolicies: RA<Policy> | undefined,
  setInstitutionPolicies: (value: RA<Policy>) => void,
  initialInstitutionPolicies: React.MutableRefObject<RA<Policy>>,
  hasChanges: boolean
] {
  const initialInstitutionPolicies = React.useRef<RA<Policy>>([]);
  const [institutionPolicies, setInstitutionPolicies] = useAsyncState(
    React.useCallback(
      async () =>
        userResource.isNew()
          ? []
          : hasDerivedPermission(
              '/permissions/institutional_policies/user',
              'read'
            )
          ? ajax<IR<RA<string>>>(
              `/permissions/user_policies/institution/${userResource.id}/`,
              {
                headers: { Accept: 'application/json' },
              }
            ).then(({ data }) => {
              const policies = processPolicies(data);
              initialInstitutionPolicies.current = policies;
              return policies;
            })
          : undefined,
      [userResource]
    ),
    false
  );
  const changedInstitutionPolicies =
    typeof institutionPolicies === 'object' &&
    JSON.stringify(initialInstitutionPolicies.current) !==
      JSON.stringify(institutionPolicies);

  return [
    institutionPolicies,
    setInstitutionPolicies,
    initialInstitutionPolicies,
    changedInstitutionPolicies,
  ];
}

/** Fetch User's OpenID Connect providers */
export function useUserProviders(
  userId: number | undefined
): IR<boolean> | undefined {
  const [providers] = useAsyncState<IR<boolean>>(
    React.useCallback(
      async () =>
        hasPermission('/admin/user/oic_providers', 'read')
          ? f
              .all({
                allProviders: ajax<
                  RA<{ readonly provider: string; readonly title: string }>
                >('/accounts/oic_providers/', {
                  method: 'GET',
                  headers: { Accept: 'application/json' },
                }).then(({ data }) => data),
                userProviders:
                  typeof userId === 'number'
                    ? ajax<
                        RA<{
                          readonly provider: string;
                          readonly title: string;
                        }>
                      >(`/accounts/oic_providers/${userId}/`, {
                        method: 'GET',
                        headers: { Accept: 'application/json' },
                      }).then(({ data }) => data)
                    : [],
              })
              .then(({ allProviders, userProviders }) =>
                Object.fromEntries(
                  allProviders
                    .map(({ title, provider }) => [
                      title,
                      userProviders.some(
                        (entry) => entry.provider === provider
                      ),
                    ])
                    .sort(sortFunction(([title]) => title))
                )
              )
          : undefined,
      [userId]
    ),
    false
  );
  return providers;
}
