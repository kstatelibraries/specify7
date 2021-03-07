import {
  upload_plan_to_mappings_tree,
  UploadPlan,
}                                       from './wbplanviewconverter';
import {
  array_to_tree,
  deep_merge_object,
  mappings_tree_to_array_of_mappings,
}                                       from './wbplanviewtreehelper';
import { State }                        from './statemanagement';
import schema                           from './schema';
import { Schema }                       from './legacy_types';
import icons                            from './icons';
import { get_name_from_tree_rank_name } from './wbplanviewmodelhelper';

// Specify 7 Workbench Upload Results
// Records results of uploading a data set

// If an UploadResult involves a tree record, this metadata indicates
// where in the tree the record resides
interface TreeInfo {
  rank: string,  // The tree rank a record relates to
  name: string,  // The name of the tree node a record relates to
}

// Records metadata about an UploadResult indicating the tables, data set
// columns, and any tree information involved
interface ReportInfo {
  tableName: string,  // The name of the table a record relates to
  columns: string[],  // The columns from the data set a record relates to
  treeInfo: TreeInfo | null
}

// Indicates that a value had to be added to a picklist during uploading
// a record
interface PicklistAddition {
  id: number,  // The new picklistitem id
  name: string,  // The name of the picklist receiving the new item
  value: string,  // The value of the new item
  caption: string,  // The data set column that produced the new item
}

// Indicates that a new row was added to the database
interface Uploaded extends State<'Uploaded'> {
  id: number,  // The database id of the added row
  picklistAdditions: PicklistAddition[],
  info: ReportInfo
}

// Indicates that an existing record in the database was matched
interface Matched extends State<'Matched'> {
  id: number,  // The id of the matched database row
  info: ReportInfo
}

// Indicates failure due to finding multiple matches to existing records
interface MatchedMultiple extends State<'MatchedMultiple'> {
  ids: number[],  // List of ids of the matching database records
  info: ReportInfo
}

// Indicates that no record was uploaded because all relevant columns in
// the data set are empty
interface NullRecord extends State<'NullRecord'> {
  info: ReportInfo
}

// Indicates a record didn't upload due to a business rule violation
interface FailedBusinessRule extends State<'FailedBusinessRule'> {
  // The error message generated by the business rule exception
  message: string,
  info: ReportInfo
}

// Indicates failure due to inability to find an expected existing
// matching record
interface NoMatch extends State<'NoMatch'> {
  info: ReportInfo
}

// Indicates one or more values were invalid, preventing a record
// from uploading
interface ParseFailures extends State<'ParseFailures'> {
  failures: [string, string][][]
}

// Indicates failure due to a failure to upload a related record
type PropagatedFailure = State<'PropagatedFailure'>

type RecordResultTypes = State<string> & ParseFailures
  | NoMatch
  | FailedBusinessRule
  | NullRecord
  | MatchedMultiple
  | Matched
  | Uploaded
  | PropagatedFailure;

// Records the specific result of attempting to upload a particular record
type RecordResult = {
  [record_result_type in RecordResultTypes[
    'type']]: Omit<Extract<RecordResultTypes,
    State<record_result_type>>,
    'type'>
}

interface UploadResult {
  UploadResult: {
    record_result: RecordResult,
    // Maps the names of -to-one relationships of the table to upload
    // results for each
    toOne: {parent: UploadResult},
    // Maps the names of -to-many relationships of the table to an
    // array of upload results for each
    toMany: Record<string, UploadResult[]>,
  }
}

export type UploadResults = UploadResult[]


interface UploadedColumn {
  readonly column_index: number,
  readonly row_index?: number,
  readonly record_id?: number,
  readonly cell_value?: string,
  readonly matched?: boolean,
  span_size?: number,
}

export interface UploadedRow {
  readonly record_id: number,
  readonly row_index: number,
  readonly columns: UploadedColumn[],
}

interface UploadedTreeRank {
  readonly record_id: number,
  readonly node_name: string,
  readonly parent_id?: number,
  readonly rank_name: string,
  readonly children: number[]
  readonly row_index: number,
  readonly columns: string[],
}

interface UploadedTreeRankProcessed
  extends Omit<UploadedTreeRank, 'children'> {
  readonly children: Readonly<Record<number, UploadedTreeRankProcessed>>
}

interface UploadedTreeRankSpacedOut
  extends Partial<Omit<UploadedTreeRank & {matched?: boolean}, 'children'>> {
  readonly children: Readonly<Record<number,
    UploadedTreeRankSpacedOut | undefined>>,
}

type SpacedOutTree = Record<number, UploadedTreeRankSpacedOut | undefined>;

export interface UploadedRowsTable {
  readonly table_label: string,
  readonly column_names: string[],
  readonly table_icon: string,
  readonly get_record_view_url: (row_id: number) => string,
  readonly rows: UploadedRow[],
  readonly rows_count?: number,
}

export type UploadedRows = Readonly<Record<string, UploadedRowsTable>>

export interface UploadedPicklistItem {
  readonly picklist_value: string,
  readonly id: number,
  readonly row_index: number,
  readonly column_index: number,
}

export type UploadedPicklistItems = Record<string, UploadedPicklistItem[]>;


interface UploadedRowSorted extends Omit<UploadedRow, 'columns'> {
  columns: string[],
  tree_info: {
    rank_name: string,
    parent_id: number | undefined,
    children: number[]
  } | undefined,
  matched: boolean,
}


/*
* Recursively traverses upload results to extract new rows,
* tree nodes and picklist additions
* */
function handleUploadResult(
  uploadedPicklistItems: UploadedPicklistItems,
  uploadedRows: Record<string, UploadedRowSorted[]>,
  matchedRecordsNames: Record<string, Record<number, string>>,
  headers: string[],
  line: UploadResult,
  row_index: number,
) {
  const uploadResult = line.UploadResult;

  const upload_status =
    Object.keys(uploadResult.record_result)[0] as keyof RecordResult;

  // skip error statuses
  if (upload_status !== 'Uploaded' && upload_status !== 'Matched')
    return true;

  const {
    id,
    info: {tableName, columns, treeInfo},
    ...rest
  } = uploadResult.record_result[upload_status];
  const rank = treeInfo?.rank;
  const orderedColumns = getOrderedHeaders(headers, columns);

  if ('picklistAdditions' in rest) {
    const picklistAdditions = rest.picklistAdditions;
    picklistAdditions.forEach(({id, name, value: picklist_value, caption}) => {
      uploadedPicklistItems[name] ??= [];
      uploadedPicklistItems[name].push({
        row_index,
        id,
        picklist_value,
        column_index: headers.indexOf(caption) || -1,
      });
    });
  }

  const parent_upload_result = uploadResult.toOne.parent;
  const parent_base = parent_upload_result?.UploadResult.record_result;
  const parent_type = parent_base &&
    (
      'Matched' in parent_base ?
        'Matched' :
        'Uploaded' in parent_base ?
          'Uploaded' :
          undefined
    );
  const parent = parent_type && parent_base?.[parent_type];

  if (upload_status === 'Matched') {
    matchedRecordsNames[tableName] ??= {};
    matchedRecordsNames[tableName][id] = treeInfo?.name || '';
  }

  uploadedRows[tableName] ??= [];
  // don't upload same tree nodes multiple times
  if (!rank || uploadedRows[tableName].every(({record_id}) =>
    record_id !== id,
  ))
    uploadedRows[tableName].push({
      record_id: id,
      row_index,
      columns: orderedColumns,
      tree_info: rank ?
        {
          rank_name: rank,
          parent_id: parent?.id,
          children: [],
        } :
        undefined,
      matched: upload_status === 'Matched',
    });

  Object.values(uploadResult.toMany).forEach((lines: UploadResult[]) =>
    lines.forEach((line: UploadResult) => handleUploadResult(
      uploadedPicklistItems,
      uploadedRows,
      matchedRecordsNames,
      headers,
      line,
      row_index,
    )),
  );

  if (typeof parent_upload_result !== 'undefined')
    handleUploadResult(
      uploadedPicklistItems,
      uploadedRows,
      matchedRecordsNames,
      headers,
      parent_upload_result,
      row_index,
    );

  return true;
}

/*
* Formats list of rows for easier manipulation when reconstructing the tree
* */
function format_list_of_rows(
  list_of_rows: UploadedRowSorted[],
  data: string[][],
  mapped_ranks: Record<string, string>,
  matchedRecordsNames: Record<number, string>,
  headers: string[],
  treeRanks: string[],
) {
  const rows: [
    number,
    UploadedTreeRank
  ][] = list_of_rows.filter(({tree_info}) =>
    typeof tree_info !== 'undefined',
  ).map(({
      tree_info,
      ...row
    }) =>
      [
        row.record_id,
        {
          ...(
            tree_info as {
              rank_name: string,
              parent_id: number | undefined,
              children: number[]
            }
          ),
          ...row,
          node_name: data[row.row_index][headers.indexOf(
            mapped_ranks[tree_info!.rank_name],
            )] ||
            matchedRecordsNames[row.record_id],
        },
      ],
  );
  const rows_object = Object.fromEntries(
    rows as [number, UploadedTreeRank | undefined][],
  );

  rows.forEach(([node_id, rank_data]) =>
    typeof rank_data.parent_id !== 'undefined' &&
    rows_object[rank_data.parent_id]?.children.push(node_id),
  );

  const ranks_to_show = [...new Set(
    rows.map(([, {rank_name}]) =>
      rank_name,
    ),
  )];
  const sorted_ranks_to_show = treeRanks.filter(rank_name =>
    ranks_to_show.indexOf(rank_name) !== -1,
  );

  return [
    rows,
    rows_object,
    sorted_ranks_to_show,
  ] as [[number, UploadedTreeRank][], typeof rows_object, typeof ranks_to_show];
}

/*
* Finds the highest level rank among the newly added rows
* */
const get_min_node = (
  rows: [number, UploadedTreeRank][],
  treeRanks: Record<string, string[]>,
  rows_object: Record<string, UploadedTreeRank | undefined>,
  table_name: string,
) =>
  rows.reduce((
    [min_rank, min_node_id],
    [node_id, rank_data],
    ) => {

      const rank_index = treeRanks[table_name]?.indexOf(
        rank_data.rank_name || '',
      );

      return (
        typeof rows_object[node_id] !== 'undefined' &&
        rank_index !== -1 &&
        (
          min_rank === -1 ||
          rank_index < min_rank
        )
      ) ?
        [rank_index, node_id] :
        [min_rank, min_node_id];
    },
    [-1, -1],
  )[1];


/*
* Turns a list of nodes with children and parents into a tree
* */
function join_children(
  rows_object: Record<string, UploadedTreeRank | undefined>,
  node_id: number,
): UploadedTreeRankProcessed | undefined {
  if (typeof rows_object[node_id] === 'undefined')
    return undefined;

  const result = {
    ...rows_object[node_id],
    children: Object.fromEntries(
      (
        rows_object[node_id]?.children || []
      ).map(child_id => [
        child_id,
        join_children(rows_object, child_id),
      ]),
    ),
  };

  rows_object[node_id] = undefined;

  //@ts-ignore
  return result;
}

/*
* Introduces empty cells between values in a row
* */
const space_out_node = (
  uploadedTreeRank: UploadedTreeRankSpacedOut, levels: number,
): UploadedTreeRankSpacedOut =>
  levels <= 0 ?
    Object.values(uploadedTreeRank.children)[0]! :
    levels === 1 ?
      uploadedTreeRank :
      {
        children: {
          0: space_out_node(uploadedTreeRank, levels - 1),
        },
      };

/*
* Walk though the tree and offsets starting position of rows that share
* common parents
* */
const space_out_children = (
  tree: SpacedOutTree,
  ranks_to_show: string[],
  parent_rank_name: string | undefined = undefined,
): SpacedOutTree =>
  Object.fromEntries(
    Object.entries(tree).filter(([, node_data]) =>
      typeof node_data !== 'undefined',
    ).map(([node_id, node_data]) => [
      ~~node_id,
      space_out_node(
        {
          children: {
            0: {
              ...node_data,
              children: space_out_children(
                node_data!.children,
                ranks_to_show,
                node_data!.rank_name,
              ),
            },
          },
        },
        Object.values(ranks_to_show).indexOf(node_data!.rank_name || '') -
        (
          typeof parent_rank_name === 'undefined' ?
            0 :
            Object.values(ranks_to_show).indexOf(
              parent_rank_name || '',
            ) + 1
        ),
      ),
    ]),
  );

/*
* Value to use for an empty cell
* */
const empty_cell = (column_index: number): UploadedColumn => (
  {
    column_index,
    cell_value: '',
  }
);

/*
* Turns a tree of new nodes back into rows that are readable by `wbuploadedview`
* */
const compile_rows = (
  mapped_ranks: Record<string, string>,
  ranks_to_show: string[],
  headers: string[],
  spaced_out_tree: SpacedOutTree,
  parent_columns: UploadedColumn[] = [],
): UploadedRow[] =>
  Object.entries(spaced_out_tree).flatMap((
    [node_id, node_data],
    index,
  ) => {

    if (typeof node_data === 'undefined')
      return [];

    const columns: UploadedColumn[] = [
      ...(
        index === 0 ?
          parent_columns :
          Array<UploadedColumn>(parent_columns.length).fill(empty_cell(-1))
      ),
      typeof node_data.rank_name === 'undefined' ?
        empty_cell(-3) :
        {
          column_index:
            headers.indexOf(mapped_ranks[node_data.rank_name]) === -1 ?
              -3 :
              headers.indexOf(mapped_ranks[node_data.rank_name]),
          row_index: node_data.row_index,
          record_id: ~~node_id,
          cell_value: node_data.node_name || undefined,
          matched: node_data.matched,
        },
    ];

    if (Object.keys(node_data.children).length === 0)
      return [
        {
          row_index: -1,
          record_id: -1,
          columns: [
            ...columns,
            ...Array<UploadedColumn>(
              ranks_to_show.length - columns.length > 0 ?
                ranks_to_show.length - columns.length :
                0,
            ).fill(empty_cell(-2)),
          ],
        },
      ];
    else
      return compile_rows(
        mapped_ranks,
        ranks_to_show,
        headers,
        node_data.children,
        columns,
      );

  });


/*
* Replaces empty cells with colspan
* */
function join_rows(final_rows: UploadedRow[]) {
  if (final_rows.length === 0)
    return [];
  const span_size: number[] =
    Array<number>(final_rows[0].columns.length).fill(1);
  return final_rows.reverse().map(row => (
    {
      ...row,
      columns: row.columns.reduce<UploadedColumn[]>((
        new_columns,
        column,
        index,
      ) => {
        if (column.column_index === -1)
          span_size[index]++;
        else {
          if (span_size[index] !== 1) {
            column.span_size = span_size[index];
            span_size[index] = 1;
          }
          new_columns.push(column);
        }
        return new_columns;
      }, []),
    }
  )).reverse();
}

const getOrderedHeaders = (
  headers: string[],
  headersSubset: string[],
) =>
  headers.filter(header =>
    headersSubset.indexOf(header) !== -1,
  );

export function parseUploadResults(
  uploadResults: UploadResults,
  headers: string[],
  data: string[][],
  treeRanks: Record<string, string[]>,
  plan: UploadPlan | null,
): [UploadedRows, UploadedPicklistItems] {

  if (plan === null)
    throw new Error('Upload plan is invalid');

  const {base_table_name, mappings_tree} = upload_plan_to_mappings_tree(
    headers,
    plan,
  );
  const array_of_mappings = mappings_tree_to_array_of_mappings(mappings_tree);
  const mapped_ranks_tree = array_of_mappings.filter(full_mapping_path =>
    full_mapping_path.length >= 4 &&
    full_mapping_path[full_mapping_path.length - 3] === 'name',
  ).map(full_mapping_path =>
    array_to_tree([
      ...(
        full_mapping_path.length === 4 ?
          [base_table_name] :
          [full_mapping_path.slice(-5, -4)[0]]
      ),
      get_name_from_tree_rank_name(full_mapping_path.slice(-4, -3)[0]),
      full_mapping_path.slice(-1)[0],
    ], true),
  ).reduce(deep_merge_object, {}) as Record<string, Record<string, string>>;

  const uploadedRows: Record<string, UploadedRowSorted[]> = {};
  const uploadedPicklistItems: UploadedPicklistItems = {};
  const matchedRecordsNames: Record<string, Record<number, string>> = {};

  uploadResults.forEach(
    handleUploadResult.bind(
      null,
      uploadedPicklistItems,
      uploadedRows,
      matchedRecordsNames,
      headers,
    ));

  const tree_tables: Record<string,
    Omit<UploadedRowsTable,
      'get_record_view_url'
      | 'table_label'
      | 'table_icon'>> = Object.fromEntries(
    Object.entries(uploadedRows).filter(([table_name]) =>
      typeof treeRanks[table_name.toLowerCase()] !== 'undefined',
    ).map(([original_table_name, list_of_rows]) => {

      const table_name = original_table_name.toLowerCase();
      const mapped_ranks = mapped_ranks_tree[table_name];

      const [rows, rows_object, ranks_to_show] = format_list_of_rows(
        list_of_rows,
        data,
        mapped_ranks,
        matchedRecordsNames[original_table_name],
        headers,
        treeRanks[table_name],
      );

      const tree: Record<number, UploadedTreeRankProcessed | undefined> = {};
      let min_node_id: number;

      while ((
        min_node_id = get_min_node(rows, treeRanks, rows_object, table_name)
      ) !== -1)
        tree[min_node_id] = join_children(rows_object, min_node_id);

      const spaced_out_tree: SpacedOutTree =
        space_out_children(tree, ranks_to_show);

      const compiled_rows: UploadedRow[] = compile_rows(
        mapped_ranks,
        ranks_to_show,
        headers,
        spaced_out_tree,
      );

      const joined_rows: UploadedRow[] = join_rows(compiled_rows);

      return [
        original_table_name,
        {
          rows: joined_rows,
          column_names: ranks_to_show,
          rows_count: Object.entries(list_of_rows).filter(([, {matched}]) =>
            !matched,
          ).length,
        },
      ];

    }),
  );

  const normal_table_names = Object.keys((
    schema as unknown as Schema
  ).models);
  const lowercase_table_names = normal_table_names.map(table_name =>
    table_name.toLowerCase(),
  );
  const schema_models = Object.values((
    schema as unknown as Schema
  ).models);

  let column_names: string[];
  return [
    Object.fromEntries(
      Object.entries(uploadedRows).map(([table_name, table_records]) => [
        table_name,
        {
          table_label:
            schema_models[lowercase_table_names.indexOf(
              table_name.toLowerCase(),
            )].getLocalizedName(),
          table_icon: icons.getIcon(
            normal_table_names[lowercase_table_names.indexOf(
              table_name.toLowerCase(),
            )],
          ),
          get_record_view_url: (record_id: number) =>
            `/specify/view/${table_name}/${record_id}/`,
          ...(
            table_name in tree_tables ?
              tree_tables[table_name] :
              {
                column_names: (
                  column_names = getOrderedHeaders(
                    headers,
                    [ // save list of column indexes to `column_indexes`
                      ...new Set(  // make the list unique
                        table_records.flatMap(({columns}) =>
                          Object.values(columns),  // get column names
                        ),
                      ),
                    ],
                  )
                ),
                rows: table_records.map(({record_id, row_index, columns}) => (
                    {
                      record_id,
                      row_index,
                      columns: column_names.filter(column_name =>
                        columns.indexOf(column_name) !== -1,
                      ).map(column_name =>
                        headers.indexOf(column_name),
                      ).map(column_index => (
                        {
                          column_index,
                          cell_value: data[row_index][column_index] ?? '',
                        }
                      )),
                    }
                  ),
                ),
              }
          ),
        },
      ]),
    ),
    uploadedPicklistItems,
  ];


}
