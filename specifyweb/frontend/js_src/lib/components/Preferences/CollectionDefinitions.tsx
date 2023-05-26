import { preferencesText } from '../../localization/preferences';
import { specifyNetworkText } from '../../localization/specifyNetwork';
import { statsText } from '../../localization/stats';
import { f } from '../../utils/functools';
import type { RA } from '../../utils/types';
import { ensure, localized } from '../../utils/types';
import type { StatLayout } from '../Statistics/types';
import type { GenericPreferences } from './types';
import { definePref } from './types';

export const collectionPreferenceDefinitions = {
  statistics: {
    title: statsText.statistics(),
    subCategories: {
      appearance: {
        title: preferencesText.appearance(),
        items: {
          layout: definePref<RA<StatLayout> | undefined>({
            title: localized('_Defines the layout of the stats page'),
            requiresReload: false,
            visible: false,
            defaultValue: undefined,
            renderer: f.never,
            container: 'label',
          }),
          showTotal: definePref<boolean>({
            title: localized('_Defines if preparation stats include total'),
            requiresReload: false,
            visible: false,
            defaultValue: false,
            renderer: f.never,
            container: 'label',
            type: 'java.lang.Boolean',
          }),
          refreshRate: definePref<number>({
            title: localized('_Defines the rate of auto refresh in hours'),
            requiresReload: false,
            visible: false,
            defaultValue: 24,
            renderer: f.never,
            container: 'label',
            type: 'java.lang.Float',
          }),
        },
      },
      specifyNetwork: {
        title: specifyNetworkText.specifyNetwork(),
        items: {
          publishingOrganization: definePref<string | undefined>({
            title: localized('_Stores GBIF\'s "publishingOrgKey"'),
            requiresReload: false,
            visible: false,
            defaultValue: undefined,
            renderer: f.never,
            container: 'label',
          }),
          collectionKey: definePref<string | undefined>({
            title: localized('_Stores GBIF\'s "dataSetKey"'),
            requiresReload: false,
            visible: false,
            defaultValue: undefined,
            renderer: f.never,
            container: 'label',
          }),
        },
      },
    },
  },
} as const;

ensure<GenericPreferences>()(collectionPreferenceDefinitions);
