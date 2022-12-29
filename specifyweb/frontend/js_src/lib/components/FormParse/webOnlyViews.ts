import {f} from '../../utils/functools';
import {
  autoGenerateViewDefinition,
  getFieldsForAutoView,
} from '../Forms/generateFormDefinition';
import type {ParsedFormDefinition} from './index';
import {schema} from '../DataModel/schema';
import type {IR} from '../../utils/types';

/**
 * Definitions for front-end form views.
 *
 * @remarks
 * If a view is missing, it would be autogenerated, unless a custom definition
 * is specified in this file:
 */
export const webOnlyViews = f.store(() =>
  ({
    ObjectAttachment: {
      columns: [undefined],
      rows: [
        [
          {
            id: undefined,
            type: 'Field',
            fieldNames: undefined,
            fieldDefinition: {
              isReadOnly: false,
              type: 'Plugin',
              pluginDefinition: {
                type: 'AttachmentPlugin',
              },
            },
            isRequired: false,
            colSpan: 1,
            align: 'left',
            visible: true,
            ariaLabel: undefined,
          },
        ],
      ],
    },
    SpecifyUser: autoGenerateViewDefinition(
      schema.models.SpecifyUser,
      'form',
      'edit',
      getFieldsForAutoView(schema.models.SpecifyUser, ['password', 'userType'])
    ),
    SpAppResource: autoGenerateViewDefinition(
      schema.models.SpAppResource,
      'form',
      'edit',
      getFieldsForAutoView(schema.models.SpAppResource, [
        'allPermissionLevel',
        'groupPermissionLevel',
        'level',
        'ownerPermissionLevel',
        'version',
        'group',
        'spAppResourceDir',
        'spAppResourceDatas',
        'spReports',
      ])
    ),
    [spAppResourceView]: autoGenerateViewDefinition(
      schema.models.SpAppResource,
      'form',
      'edit',
      ['name']
    ),
    [spViewSetNameView]: autoGenerateViewDefinition(
      schema.models.SpViewSetObj,
      'form',
      'edit',
      ['name']
    ),
    [recordSetView]: autoGenerateViewDefinition(
      schema.models.RecordSet,
      'form',
      'edit',
      ['name', 'remarks']
    ),
  } as const satisfies IR<ParsedFormDefinition>)
);

export const spAppResourceView = '_SpAppResourceView_name';
export const spViewSetNameView = '_SpViewSetObj_name';
export const recordSetView = '_RecordSet_name';
