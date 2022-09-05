import { f } from '../../utils/functools';
import type { IR, RA } from '../../utils/types';
import { defined, filterArray } from '../../utils/types';
import type { SpecifyModel } from '../DataModel/specifyModel';
import type { CellTypes, FormCellDefinition } from './cells';
import type { ParsedFormDefinition } from './index';

type LabelCell = CellTypes['Label'] & FormCellDefinition;

// TODO: split this function into smaller functions
/**
 * Unfortunately, not all cell definitions can be parsed by looking at just
 * one cell at a time.
 *
 * This method looks over all grid cells holistically and finishes parsing
 * them or fixes discovered issues.
 */
export function postProcessFormDef(
  rawColumns: RA<number | undefined>,
  rawRows: RA<RA<FormCellDefinition>>,
  model: SpecifyModel | undefined
): ParsedFormDefinition {
  const columns = fixColumns(rawColumns, rawRows);
  const isSingleColumn = columns.length === 1;
  const labelsPostProcessor = createLabelsPostProcessor(
    rawRows,
    model,
    isSingleColumn
  );
  const rows = rawRows.map<RA<FormCellDefinition>>((row, rowIndex) =>
    addBlankCell(
      row.map((cell, colIndex) =>
        labelsPostProcessor(cell, rowIndex, colIndex)
      ),
      columns.length
    )
  );

  const labelsForCells = indexLabels(rows);

  return {
    columns,
    rows: rows.map((row) =>
      row.map((cell) =>
        cell.id === undefined || typeof labelsForCells[cell.id] === 'object'
          ? removeRedundantLabel(cell)
          : addMissingLabel(cell, model)
      )
    ),
  };
}

function createLabelsPostProcessor(
  rows: RA<RA<FormCellDefinition>>,
  model: SpecifyModel | undefined,
  isSingleColumn: boolean
): (
  cell: FormCellDefinition,
  rowIndex: number,
  colIndex: number
) => FormCellDefinition {
  const initialLabelsForCells = indexLabels(rows);
  const fieldsById = indexFields(rows, model);
  return (cell, rowIndex: number, colIndex: number) => {
    if (cell.type !== 'Label') return cell;
    const bound = bindLooseLabels(
      cell,
      initialLabelsForCells,
      rows[rowIndex][colIndex + 1],
      isSingleColumn ? rows[rowIndex + 1]?.[0] : undefined
    );
    const processed = postProcessLabels(bound, isSingleColumn, fieldsById);
    const withTitle =
      typeof model === 'object' ? addLabelTitle(processed, model) : processed;
    return replaceBlankLabels(withTitle);
  };
}

type IndexedField = {
  readonly fieldName: string | undefined;
  readonly labelOverride: string | undefined;
  // An alternative label to use, only if label is missing
  readonly altLabel: string | undefined;
};

/** Index fieldNames and labelOverride for all cells by cellId */
const indexFields = (
  rows: RA<RA<FormCellDefinition>>,
  model: SpecifyModel | undefined
): IR<IndexedField> =>
  Object.fromEntries(
    filterArray(
      rows.flatMap((row) =>
        row
          .filter(
            (
              cell
            ): cell is CellTypes['Field'] &
              FormCellDefinition & { readonly id: string } =>
              cell.type === 'Field' && typeof cell.id === 'string'
          )
          .map((cell) =>
            typeof cell.id === 'string' && cell.type === 'Field'
              ? [
                  cell.id,
                  {
                    fieldName: cell.fieldName,
                    // Checkbox definition can contain a label
                    labelOverride:
                      cell.fieldDefinition.type === 'Checkbox'
                        ? cell.fieldDefinition.label
                        : undefined,
                    /*
                     * Default Accession view doesn't have a label for
                     * Division ComboBox for some reason
                     */
                    altLabel:
                      cell.fieldName === 'divisionCBX'
                        ? model?.getField('division')?.label
                        : undefined,
                  },
                ]
              : undefined
          )
      )
    )
  );

const indexLabels = (
  rows: RA<RA<FormCellDefinition>>
): IR<FormCellDefinition> =>
  Object.fromEntries(
    filterArray(
      rows
        .flat()
        .map((cell) =>
          cell.type === 'Label' && typeof cell.labelForCellId === 'string'
            ? [cell.labelForCellId, cell]
            : undefined
        )
    )
  );

/** If some row has extra columns, add new columns to the definition */
const fixColumns = (
  columns: RA<number | undefined>,
  rows: RA<RA<FormCellDefinition>>
): RA<number | undefined> => [
  ...columns,
  ...Array.from({
    length:
      Math.max(
        ...rows.map((row) => f.sum(row.map(({ colSpan }) => colSpan ?? 1)))
      ) - columns.length,
  }).fill(undefined),
];

/**
 * If a Label without a labelForCellId attribute precedes a field with an
 * ID, but no label, associate the label with that field
 */
function bindLooseLabels(
  cell: LabelCell,
  initialLabelsForCells: IR<FormCellDefinition>,
  siblingCell: FormCellDefinition | undefined,
  nextRowCell: FormCellDefinition | undefined
): LabelCell {
  if (typeof cell.labelForCellId === 'string') return cell;
  if (typeof siblingCell?.id === 'string') {
    const hasLabel =
      initialLabelsForCells[defined(siblingCell.id)] !== undefined;
    if (!hasLabel && canAutoBind(cell))
      return {
        // Assocate label with a field that follows it
        ...cell,
        labelForCellId: siblingCell.id,
      };
  }
  return {
    ...cell,
    /*
     * Similar, but associate label with cell in next row, if
     * there is only one column
     */
    labelForCellId:
      typeof nextRowCell?.id === 'string' &&
      initialLabelsForCells[defined(nextRowCell.id)] === undefined &&
      canAutoBind(nextRowCell)
        ? nextRowCell.id
        : cell.labelForCellId,
  };
}

/**
 * Check if the cell of this type is eligible to be auto-bound to an adjacent
 * label
 * Don't do this for plugins, as they may already have a label.
 * Don't do this for checkboxes because of this issue:
 * https://github.com/specify/specify7/issues/1780
 */
const canAutoBind = (cell: FormCellDefinition): boolean =>
  cell.type !== 'Field' ||
  !['Plugin', 'Checkbox'].includes(cell.fieldDefinition.type);

const postProcessLabels = (
  cell: LabelCell,
  isSingleColumn: boolean,
  fieldsById: IR<IndexedField>
): LabelCell => ({
  ...cell,
  ...(typeof cell.labelForCellId === 'string'
    ? {
        // Let some fields overwrite their label
        text:
          fieldsById[cell.labelForCellId]?.labelOverride ??
          cell.text ??
          fieldsById[cell.labelForCellId]?.altLabel,
        // Get label fieldName from its field
        fieldName: fieldsById[cell.labelForCellId]?.fieldName,
      }
    : {}),
  // Don't right align labels if there is only one column
  align: isSingleColumn ? 'left' : cell.align,
});

function addLabelTitle(cell: LabelCell, model: SpecifyModel): LabelCell {
  const field = model.getField(cell.fieldName ?? '');
  return {
    ...cell,
    text:
      cell.text ??
      field?.label ??
      /*
       * Default Accession view doesn't have a label for
       * Division ComboBox for some reason
       */
      (cell.id === 'divLabel'
        ? model.getField('division')?.label
        : undefined) ??
      (cell.fieldName?.toLowerCase() === 'this' ? undefined : cell.fieldName) ??
      '',
    title: field?.getLocalizedDesc(),
  };
}

/** Replace labels without text with blank cells */
const replaceBlankLabels = (cell: LabelCell): FormCellDefinition =>
  (cell.text ?? '').length === 0
    ? ({
        type: 'Blank',
        id: cell.id,
        align: 'left',
        colSpan: cell.colSpan,
        visible: false,
        ariaLabel: undefined,
      } as const)
    : cell;

/**
 * Add a necessary number of blank cells at the end so that the
 * grid is not off when some row has fewer columns than in the definition.
 */
function addBlankCell(
  row: RA<FormCellDefinition>,
  columnCount: number
): RA<FormCellDefinition> {
  const totalColumns = f.sum(row.map(({ colSpan = 1 }) => colSpan));
  const needBlankCells = columnCount - totalColumns > 0;
  return needBlankCells
    ? [
        ...row,
        {
          type: 'Blank',
          id: undefined,
          align: 'left',
          colSpan: columnCount - totalColumns,
          visible: false,
          ariaLabel: undefined,
        },
      ]
    : row;
}

/**
 * Call this function only on cells that have an associated label
 *
 * Remove label from the checkbox field, if it already has an
 * associated label
 */
const removeRedundantLabel = (cell: FormCellDefinition): FormCellDefinition =>
  cell.type === 'Field' && cell.fieldDefinition.type === 'Checkbox'
    ? {
        ...cell,
        fieldDefinition: {
          ...cell.fieldDefinition,
          label: undefined,
        },
      }
    : cell;

const addMissingLabel = (
  cell: FormCellDefinition,
  model: SpecifyModel | undefined
): FormCellDefinition => ({
  ...cell,
  ...(cell.type === 'Field' && cell.fieldDefinition.type === 'Checkbox'
    ? {
        fieldDefinition: {
          ...cell.fieldDefinition,
          /*
           * If checkbox does not have a label in a separate cell,
           * Get its label from the fieldName
           */
          label:
            cell.fieldDefinition.label ??
            model?.getField(cell.fieldName ?? '')?.label ??
            cell.ariaLabel,
        },
      }
    : {}),
  // If cell has a fieldName, but no associated label, set ariaLabel
  ariaLabel:
    // Don't add aria-label to checkboxes as they would already have a label
    cell.type === 'Field' && cell.fieldDefinition.type === 'Checkbox'
      ? undefined
      : cell.ariaLabel ??
        (cell.type === 'Field' || cell.type === 'SubView'
          ? model?.getField(cell.fieldName ?? '')?.label
          : undefined),
});
