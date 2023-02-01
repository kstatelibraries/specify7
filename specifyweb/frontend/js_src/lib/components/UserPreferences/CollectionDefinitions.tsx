import React from 'react';

import { preferencesText } from '../../localization/preferences';
import { statsText } from '../../localization/stats';
import { ensure } from '../../utils/types';
import { error } from '../Errors/assert';
import type { StatLayout } from '../Statistics/types';
import type { GenericPreferences } from './UserDefinitions';
import { definePref } from './UserDefinitions';

export const collectionPreferenceDefinitions = {
  statistics: {
    title: statsText.statistics(),
    subCategories: {
      appearance: {
        title: preferencesText.appearance(),
        items: {
          layout: definePref<StatLayout | undefined>({
            title: 'Defines the layout of the stats page',
            requiresReload: false,
            visible: false,
            defaultValue: undefined,
            renderer: () => <>{error('This should not get called')}</>,
          }),
          defaultLayout: definePref<StatLayout | undefined>({
            title: 'Defines the default layout of the stats page',
            requiresReload: false,
            visible: false,
            defaultValue: undefined,
            renderer: () => <>{error('This should not get called')}</>,
          }),
        },
      },
    },
  },
} as const;

ensure<GenericPreferences>()(collectionPreferenceDefinitions);
