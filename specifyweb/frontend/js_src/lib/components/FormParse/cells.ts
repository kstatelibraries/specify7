/**
 * Parse form cell XML into a JSON structure
 *
 * Documentation - https://github.com/specify/specify7/wiki/Form-System#cell-definition
 * On any modifications, please check if documentation needs to be updated.
 */

import type { LocalizedString } from 'typesafe-i18n';
import type { State } from 'typesafe-reducer';

import { f } from '../../utils/functools';
import type { IR, RA } from '../../utils/types';
import { filterArray } from '../../utils/types';
import { getTable } from '../DataModel/tables';
import type { SpecifyTable } from '../DataModel/specifyTable';
import type { Tables } from '../DataModel/types';
import {
  addContext,
  getLogContext,
  pushContext,
  setLogContext,
} from '../Errors/logContext';
import { legacyLocalize } from '../InitialContext/legacyUiLocalization';
import { toLargeSortConfig } from '../Molecules/Sorting';
import { hasPathPermission } from '../Permissions/helpers';
import type { SimpleXmlNode } from '../Syncer/xmlToJson';
import {
  getAttribute,
  getBooleanAttribute,
  getParsedAttribute,
} from '../Syncer/xmlUtils';
import type { CommandDefinition } from './commands';
import { parseUiCommand } from './commands';
import type { FormFieldDefinition } from './fields';
import { parseFormField } from './fields';
import type { FormType, ParsedFormDefinition } from './index';
import { parseFormDefinition } from './index';

// Parse column width definitions
export const processColumnDefinition = (
  columnDefinition: string
): RA<number | undefined> =>
  (columnDefinition.endsWith(',p:g')
    ? columnDefinition.slice(0, -1 * ',p:g'.length)
    : columnDefinition
  )
    .split(',')
    .filter((_, index) => index % 2 === 0)
    .map((definition) => /(\d+)px/u.exec(definition)?.[1] ?? '')
    .map(f.parseInt);

export const parseSpecifyProperties = (props = ''): IR<string> =>
  Object.fromEntries(
    filterArray(
      props.split(';').map((line) => /([^=]+)=(.+)/u.exec(line)?.slice(1, 3))
    ).map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
  );

export type CellTypes = {
  readonly Field: State<
    'Field',
    {
      readonly fieldNames: RA<string> | undefined;
      readonly fieldDefinition: FormFieldDefinition;
      readonly isRequired: boolean;
    }
  >;
  readonly Label: State<
    'Label',
    {
      readonly text: LocalizedString | undefined;
      readonly title: LocalizedString | undefined;
      readonly labelForCellId: string | undefined;
      readonly fieldNames: RA<string> | undefined;
    }
  >;
  readonly Separator: State<
    'Separator',
    {
      readonly label: LocalizedString | undefined;
      readonly icon: string | undefined;
      readonly forClass: keyof Tables | undefined;
    }
  >;
  readonly SubView: State<
    'SubView',
    {
      readonly fieldNames: RA<string> | undefined;
      readonly formType: FormType;
      readonly isButton: boolean;
      readonly icon: string | undefined;
      readonly viewName: string | undefined;
      readonly sortField: SubViewSortField | undefined;
    }
  >;
  readonly Panel: State<
    'Panel',
    ParsedFormDefinition & { readonly display: 'block' | 'inline' }
  >;
  readonly Command: State<
    'Command',
    {
      readonly commandDefinition: CommandDefinition;
    }
  >;
  readonly Unsupported: State<
    'Unsupported',
    {
      readonly cellType: string | undefined;
    }
  >;
  readonly Blank: State<'Blank'>;
};

export type SubViewSortField = {
  readonly direction: 'asc' | 'desc';
  readonly fieldNames: RA<string>;
};

export const cellAlign = ['left', 'center', 'right'] as const;

const processCellType: {
  readonly [KEY in keyof CellTypes]: (props: {
    readonly cell: SimpleXmlNode;
    readonly table: SpecifyTable;
    readonly getProperty: (name: string) => string | undefined;
  }) => CellTypes[KEY | 'Blank'];
} = {
  Field({ cell, table, getProperty }) {
    const rawFieldName = getParsedAttribute(cell, 'name');
    const fields = table?.getFields(rawFieldName ?? '');
    const fieldNames = fields?.map(({ name }) => name);
    const fieldsString = fieldNames?.join('.');

    addContext({ field: fieldsString ?? rawFieldName });

    const fieldDefinition = parseFormField({
      cell,
      getProperty,
      table,
      fields,
    });

    /*
     * Some plugins overwrite the fieldName. In such cases, the [name] attribute
     * is commonly "this"
     */
    const resolvedFields =
      (fieldDefinition.type === 'Plugin' &&
      fieldDefinition.pluginDefinition.type === 'PartialDateUI'
        ? table.getFields(fieldDefinition.pluginDefinition.dateFields.join('.'))
        : undefined) ?? fields;

    if (
      resolvedFields === undefined &&
      (fieldDefinition.type !== 'Plugin' ||
        fieldDefinition.pluginDefinition.type === 'PartialDateUI')
    )
      console.error(`Unknown field: ${rawFieldName ?? '(null)'}`);

    const hasAccess =
      resolvedFields === undefined || hasPathPermission(resolvedFields, 'read');

    return hasAccess && fieldDefinition.type !== 'Blank'
      ? {
          type: 'Field',
          fieldNames: resolvedFields?.map(({ name }) => name),
          fieldDefinition,
          isRequired:
            (getBooleanAttribute(cell, 'isRequired') ?? false) ||
            (fields?.at(-1)?.localization.isrequired ?? false),
        }
      : { type: 'Blank' };
  },
  Label: ({ cell }) => ({
    type: 'Label',
    // This may be overwritten in postProcessRows
    text: f.maybe(getParsedAttribute(cell, 'label'), legacyLocalize),
    // This would be set in postProcessRows
    title: undefined,
    labelForCellId: getParsedAttribute(cell, 'labelFor'),
    // This would be set in postProcessRows
    fieldNames: undefined,
  }),
  Separator: ({ cell }) => ({
    type: 'Separator',
    label: f.maybe(getParsedAttribute(cell, 'label'), legacyLocalize),
    icon: getParsedAttribute(cell, 'icon'),
    forClass: f.maybe(
      getParsedAttribute(cell, 'forClass'),
      (forClass) => getTable(forClass)?.name
    ),
  }),
  SubView({ cell, table, getProperty }) {
    const rawFieldName = getParsedAttribute(cell, 'name');
    const fields = table.getFields(rawFieldName ?? '');
    if (fields === undefined) {
      console.error(
        `Unknown field ${rawFieldName ?? '(null)'} when parsing form SubView`,
        {
          cell,
          table,
        }
      );
      return { type: 'Blank' };
    }
    const relationship = fields.at(-1);
    if (relationship?.isRelationship === false) {
      console.error('SubView can only be used to display a relationship');
      return { type: 'Blank' };
    } else if (fields.at(-1)?.type === 'many-to-many') {
      // ResourceApi does not support .rget() on a many-to-many
      console.error('Many-to-many relationships are not supported');
      return { type: 'Blank' };
    }

    const hasAccess = hasPathPermission(fields, 'read');
    if (!hasAccess) return { type: 'Blank' };

    const rawSortField = getProperty('sortField');
    const parsedSort = f.maybe(rawSortField, toLargeSortConfig);
    const sortFields = relationship!.relatedTable.getFields(
      parsedSort?.fieldNames.join('.') ?? ''
    );
    const formType = getParsedAttribute(cell, 'defaultType') ?? '';
    return {
      type: 'SubView',
      formType: formType?.toLowerCase() === 'table' ? 'formTable' : 'form',
      fieldNames: fields?.map(({ name }) => name),
      viewName: getParsedAttribute(cell, 'viewName'),
      isButton: getProperty('btn')?.toLowerCase() === 'true',
      icon: getProperty('icon'),
      sortField:
        sortFields === undefined
          ? undefined
          : {
              direction: parsedSort?.direction ?? 'asc',
              fieldNames: sortFields.map(({ name }) => name),
            },
    };
  },
  Panel: ({ cell, table }) => {
    const oldContext = getLogContext();
    pushContext({ type: 'Child', tagName: 'Panel' });
    const definition = parseFormDefinition(cell, table);
    setLogContext(oldContext);

    return {
      type: 'Panel',
      ...definition,
      display:
        getParsedAttribute(cell, 'panelType')?.toLowerCase() === 'buttonbar'
          ? 'inline'
          : 'block',
    };
  },
  Command: ({ cell, table }) => ({
    type: 'Command',
    commandDefinition: parseUiCommand(cell, table),
  }),
  /**
   * This function never actually gets called
   * Blank cell type is used by postProcessRows if row definition has fewer
   * cells than defined columns
   */
  Blank: () => ({ type: 'Blank' }),
  Unsupported: ({ cell }) => {
    console.warn(
      `Unsupported cell type: ${getParsedAttribute(cell, 'type') ?? '(null)'}`
    );
    return {
      type: 'Unsupported',
      cellType: getAttribute(cell, 'type'),
    };
  },
};

export type FormCellDefinition = CellTypes[keyof CellTypes] & {
  readonly id: string | undefined;
  readonly align: typeof cellAlign[number];
  readonly colSpan: number;
  readonly visible: boolean;
  readonly ariaLabel: LocalizedString | undefined;
};

const cellTypeTranslation: IR<keyof CellTypes> = {
  field: 'Field',
  label: 'Label',
  separator: 'Separator',
  subview: 'SubView',
  panel: 'Panel',
  command: 'Command',
  blank: 'Blank',
};

/**
 * Parse form cell XML into a JSON structure
 *
 * Does not depend on FormMode, FormType
 */
export function parseFormCell(
  table: SpecifyTable,
  cellNode: SimpleXmlNode
): FormCellDefinition {
  const cellClass = getParsedAttribute(cellNode, 'type') ?? '';
  const cellType = cellTypeTranslation[cellClass.toLowerCase()];

  // FEATURE: warn on IDs that include spaces and other unsupported characters
  const id = getParsedAttribute(cellNode, 'id');
  addContext({ id, type: cellType });

  const parsedCell = processCellType[cellType] ?? processCellType.Unsupported;
  const properties = parseSpecifyProperties(
    getAttribute(cellNode, 'initialize') ?? ''
  );
  const getProperty = (name: string): string | undefined =>
    properties[name.toLowerCase()];
  const colSpan = f.parseInt(getParsedAttribute(cellNode, 'colSpan'));
  const align = getProperty('align')?.toLowerCase();

  return {
    id,
    colSpan: typeof colSpan === 'number' ? Math.ceil(colSpan / 2) : 1,
    align: f.includes(cellAlign, align)
      ? align
      : cellType === 'Label'
      ? 'right'
      : 'left',
    /*
     * Specify 6 has `initialize="visible=false"` and
     * `initialize="vis=false"` attributes for some cell definitions.
     * vis=false doesn't seem to be implemented at all. visible=false seems to
     * be implemented for buttons and panels only, but from tests we did, it
     * does not seem to work either.
     * Specify 7.6.1 and prior ignored both of these attributes.
     * Specify 7.7.0 was going to respect visible=false for all cell types,
     * but it ran into problem: "Generate Label on Save" checkbox and
     * "Generate Label" buttons on the default Collection Object form have
     * visible=false. Adding support for that attribute in Specify 7 would mean
     * this checkbox and button would disappear from forms in Specify 7 when
     * users update to 7.7.0.
     * To mitigate the above issues, Specify 7 form definitions are using
     * "invisible=true" instead of "visible=false" for making fields invisible
     */
    visible:
      getBooleanAttribute(cellNode, 'invisible') !== true ||
      parsedCell === processCellType.Unsupported,
    ...parsedCell({ cell: cellNode, table, getProperty }),
    // This may get filled out in postProcessRows or parseFormTableDefinition
    ariaLabel: undefined,
  };
}
