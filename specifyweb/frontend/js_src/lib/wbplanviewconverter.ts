/*
*
* Helper class for converting from upload plan to mapping path
* (internal structure used in wbplanview) and vice versa
*
* */

'use strict';

import data_model_storage         from './wbplanviewmodel';
import {
  format_reference_item,
  format_tree_rank,
  get_name_from_tree_rank_name,
  table_is_tree,
  value_is_reference_item,
  value_is_tree_rank,
}                                 from './wbplanviewmodelhelper';
import { MappingsTree }           from './wbplanviewtreehelper';
import { DataModelFieldWritable } from './wbplanviewmodelfetcher';
import { MappingType }            from './components/wbplanviewmapper';
import { get_mapping_line_data }  from './wbplanviewnavigator';

export type MatchBehaviours = Readonly<'ignoreWhenBlank'
  | 'ignoreAlways'
  | 'ignoreNever'>;

type UploadPlanUploadTableWbcols = Record<string,
  string |
  {
    column: string,
    matchBehaviour: MatchBehaviours,
    nullAllowed: boolean,
    default: string | null,
  }>

type UploadPlanUploadTableStatic =
  Record<string, string | boolean | number>

type UploadPlanUploadTableToOne = UploadPlanUploadable

type UploadPlanUploadTableToMany =
  Omit<UploadPlanUploadTableTable, 'toMany'>

type UploadPlanFieldGroupTypes =
  'wbcols'
  | 'static'
  | 'toOne' |
  'toMany'

type UploadPlanTableGroup<GROUP_NAME extends UploadPlanFieldGroupTypes> =
  GROUP_NAME extends 'wbcols' ? UploadPlanUploadTableWbcols :
    GROUP_NAME extends 'static' ? UploadPlanUploadTableStatic :
      GROUP_NAME extends 'toOne' ? UploadPlanUploadTableToOne :
        UploadPlanUploadTableToMany

interface UploadPlanUploadTableTable {
  wbcols: UploadPlanUploadTableWbcols,
  static: UploadPlanUploadTableStatic,
  toOne: UploadPlanUploadTableToOne,
  toMany: UploadPlanUploadTableToMany,
}

interface UploadPlanTreeRecord {
  ranks: UploadPlanTreeRecordRanks,
}

type UploadPlanTreeRecordRanks = Record<string,
  string | {
  treeNodeCols: Record<string, string>
}>

type UploadPlanUploadtableTypes = {
  [key in 'uploadTable'
    | 'oneToOneTable'
    | 'mustMatchTable']: UploadPlanUploadTableTable
};

type UploadPlanUploadable =
  UploadPlanUploadtableTypes |
  {treeRecord: UploadPlanTreeRecord}

export interface UploadPlan {
  baseTableName: string,
  uploadable: UploadPlanUploadable
}

export type FalsyUploadPlan = UploadPlan | false;


const upload_plan_processing_functions = (
  headers: string[],
  must_match_preferences: Record<string, boolean>,
  mapping_path: string[],
): {
  wbcols: (
    [key, value]: [string, string | MatchBehaviours],
  ) => [key: string, value: object],
  static: ([key, value]: [string, string]) => [key: string, value: object],
  toOne: (
    [key, value]: [string, UploadPlanUploadTableToOne],
  ) => [key: string, value: object],
  toMany: ([key, value]: [string, object]) => [key: string, value: object],
} => (
  {
    wbcols: ([key, value]) => [
      key,
      {
        [
          headers.indexOf(value) === -1 ?
            'new_column' :
            'existing_header'
          ]: value,
      },
    ],
    static: ([key, value]) => [
      key,
      {new_static_column: value},
    ],
    toOne: (
      [tableName, value],
    ) => [
      tableName,
      handle_uploadable(
        value,
        headers,
        must_match_preferences,
        [...mapping_path, tableName],
      ),
    ],
    toMany: ([tableName, mappings]) => [
      tableName,
      Object.fromEntries(
        Object.values(
          mappings,
        ).map((mapping, index) =>
          [
            format_reference_item(index + 1),
            handle_upload_table_table(
              mapping,
              headers,
              must_match_preferences,
              [...mapping_path, tableName],
            ),
          ],
        ),
      ),
    ],
  }
);

const handle_tree_rank_fields = (
  tree_rank_fields: Record<string, string>,
  headers: string[],
) => Object.fromEntries(
  Object.entries(tree_rank_fields).map(
    ([field_name, header_name]) =>
      upload_plan_processing_functions(
        headers,
        {},
        [],
      ).wbcols(
        [field_name, header_name],
      ),
  ),
);

const handle_tree_record = (
  upload_plan: UploadPlanTreeRecord,
  headers: string[],
) =>
  Object.fromEntries(
    Object.entries((
      (
        upload_plan
      ).ranks
    )).map(([
        rank_name,
        rank_data,
      ]) =>
        [
          format_tree_rank(rank_name),
          handle_tree_rank_fields(
            typeof rank_data === 'string' ?
              {
                name: rank_data,
              } :
              rank_data.treeNodeCols,
            headers,
          ),
        ],
    ),
  );


const handle_upload_table_table = (
  upload_plan: UploadPlanUploadTableTable,
  headers: string[],
  must_match_preferences: Record<string, boolean>,
  mapping_path: string[],
) =>
  Object.fromEntries(Object.entries(upload_plan).reduce(
    // @ts-ignore
    (
      results,
      [
        plan_node_name,
        plan_node_data,
      ]: [
        UploadPlanFieldGroupTypes,
        UploadPlanTableGroup<UploadPlanFieldGroupTypes>
      ],
    ) =>
      [
        ...results,
        ...Object.entries(plan_node_data).map(
          upload_plan_processing_functions(
            headers,
            must_match_preferences,
            mapping_path,
          )[plan_node_name],
        ),
      ],
    [],
  ));

function handle_uploadable_types(
  upload_plan: UploadPlanUploadtableTypes,
  headers: string[],
  must_match_preferences: Record<string, boolean>,
  mapping_path: string[],
) {

  if ('mustMatchTable' in upload_plan) {
    const table_name = get_mapping_line_data({
      base_table_name: mapping_path[0],
      mapping_path: mapping_path.slice(1),
      iterate: false,
      custom_select_type: 'opened_list',
    })[0].table_name;
    must_match_preferences[table_name || mapping_path.slice(-1)[0]] = true;
  }

  return handle_upload_table_table(
    Object.values(upload_plan)[0],
    headers,
    must_match_preferences,
    mapping_path,
  );

}

const handle_uploadable = (
  upload_plan: UploadPlanUploadable,
  headers: string[],
  must_match_preferences: Record<string, boolean>,
  mapping_path: string[],
): MappingsTree =>
  'treeRecord' in upload_plan ?
    handle_tree_record(
      upload_plan.treeRecord,
      headers,
    ) :
    handle_uploadable_types(
      upload_plan,
      headers,
      must_match_preferences,
      mapping_path,
    );

/*
* Converts upload plan to mappings tree
* Inverse of mappings_tree_to_upload_plan
* */
export function upload_plan_to_mappings_tree(
  headers: string[],
  upload_plan: UploadPlan,  // upload plan
): {
  base_table_name: string,
  mappings_tree: MappingsTree,
  must_match_preferences: Record<string, boolean>
} {

  if (typeof upload_plan.baseTableName === 'undefined')
    throw new Error('Upload plan should contain `baseTableName`'
      + ' as a root node');

  const must_match_preferences: Record<string, boolean> = {};

  return {
    base_table_name: upload_plan.baseTableName,
    mappings_tree: handle_uploadable(
      upload_plan.uploadable,
      headers,
      must_match_preferences,
      [upload_plan.baseTableName],
    ),
    must_match_preferences,
  };
}

export function upload_plan_string_to_object(
  upload_plan_string: string,
): FalsyUploadPlan {
  let upload_plan: FalsyUploadPlan;

  try {
    upload_plan = JSON.parse(upload_plan_string) as UploadPlan;
  }
  catch (exception) {

    if (!(
      exception instanceof SyntaxError
    ))//only catch JSON parse errors
      throw exception;

    upload_plan = false;

  }

  if (
    typeof upload_plan !== 'object' ||
    upload_plan === null ||
    typeof upload_plan['baseTableName'] === 'undefined'
  )
    return false;
  else
    return upload_plan;
}


//TODO: make these functions type safe

interface UploadPlanNode
  extends Record<string, string | boolean | UploadPlanNode> {
}

function mappings_tree_to_upload_plan_table(
  table_data: object,
  table_name: string | undefined,
  must_match_preferences: Record<string, boolean>,
  wrap_it = true,
  is_root = false,
) {

  if (typeof table_name !== 'undefined' && table_is_tree(table_name))
    return mappings_tree_to_upload_table(
      table_data as MappingsTree,
      table_name,
      must_match_preferences,
    );

  let table_plan: {
    wbcols: UploadPlanNode,
    static: UploadPlanNode,
    toOne: UploadPlanNode,
    toMany?: UploadPlanNode
  } = {
    wbcols: {},
    static: {},
    toOne: {},
  };

  if (wrap_it)
    table_plan.toMany = {};

  let is_to_many = false;

  table_plan = Object.entries(
    table_data,
  ).reduce((
    original_table_plan,
    [
      field_name,
      field_data,
    ],
  ) => {

    let table_plan = original_table_plan;

    if (value_is_reference_item(field_name)) {
      if (!is_to_many) {
        is_to_many = true;
        //@ts-ignore
        table_plan = [];
      }

      //@ts-ignore
      table_plan.push(
        mappings_tree_to_upload_plan_table(
          field_data,
          table_name,
          must_match_preferences,
          false,
        ),
      );

    }
    else if (value_is_tree_rank(field_name))
      //@ts-ignore
      table_plan = mappings_tree_to_upload_plan_table(
        table_data,
        table_name,
        must_match_preferences,
        false,
      );

    else if (
      typeof data_model_storage.tables[
      table_name || ''
        ]?.fields[field_name] !== 'undefined' &&
      typeof table_plan !== 'undefined'
    ) {

      const field = data_model_storage.tables[
      table_name || ''
        ]?.fields[field_name];

      if (field.is_relationship)
        handle_relationship_field(
          field_data,
          field,
          field_name,
          table_plan,
          must_match_preferences,
        );
      else
        table_plan[
          Object.entries(
            field_data,
          )[0][0] === 'new_static_column' ?
            'static' :
            'wbcols'
          ][field_name] = extract_header_name_from_header_structure(
          field_data,
        );
    }


    return table_plan;

  }, table_plan);


  if (Array.isArray(table_plan) || !wrap_it)
    return table_plan;

  if (value_is_reference_item(Object.keys(table_data)[0]))
    return table_plan;

  return {
    [
      !is_root && must_match_preferences[table_name || ''] ?
        'mustMatchTable' :
        'uploadTable'
      ]: table_plan,
  };

}

function handle_relationship_field(
  field_data: object,
  field: DataModelFieldWritable,
  field_name: string,
  table_plan: {
    wbcols: UploadPlanNode,
    static: UploadPlanNode,
    toOne: UploadPlanNode,
    toMany?: UploadPlanNode | undefined
  },
  must_match_preferences: Record<string, boolean>,
) {
  const mapping_table = field.table_name;
  if (typeof mapping_table === 'undefined')
    throw new Error('Mapping Table is not defined');

  const is_to_one =
    field.type === 'one-to-one' ||
    field.type === 'many-to-one';

  if (
    is_to_one &&
    typeof table_plan.toOne[field_name] === 'undefined'
  )
    table_plan.toOne[field_name] =
      mappings_tree_to_upload_plan_table(
        field_data,
        mapping_table,
        must_match_preferences,
      ) as UploadPlanNode;

  else {
    table_plan.toMany ??= {};
    table_plan.toMany[field_name] ??=
      mappings_tree_to_upload_plan_table(
        field_data,
        mapping_table,
        must_match_preferences,
        false,
      ) as UploadPlanNode;
  }
}


const extract_header_name_from_header_structure = (
  header_structure: Record<MappingType, string>,
) => Object.keys(
  Object.values(
    header_structure,
  )[0],
)[0];

const rank_mapped_fields_to_tree_record_ranks = (
  rank_mapped_fields: Record<string, Record<MappingType, string>>,
): Record<string, string> => Object.fromEntries(
  Object.entries(rank_mapped_fields).map(([
    field_name, header_mapping_structure,
  ]) => [
    field_name,
    extract_header_name_from_header_structure(
      header_mapping_structure,
    ),
  ]),
);

const mappings_tree_to_upload_plan_tree = (
  mappings_tree: MappingsTree,
): UploadPlanTreeRecordRanks => Object.fromEntries(
  Object.entries(mappings_tree).map(([
    full_rank_name, rank_mapped_fields,
  ]) => [
    get_name_from_tree_rank_name(full_rank_name),
    {
      treeNodeCols: rank_mapped_fields_to_tree_record_ranks(
        rank_mapped_fields as Record<string,
          Record<MappingType, string>>,
      ),
    },
  ]),
);

/*const mappings_tree_to_upload_table_table = (
  mappings_tree: MappingsTree,
  table_name: string,
): UploadPlanUploadTableTable => (
  {}
);*/

const mappings_tree_to_upload_table = (
  mappings_tree: MappingsTree,
  table_name: string,
  must_match_preferences: Record<string, boolean>,
  is_root = false,
): UploadPlanUploadable => table_is_tree(table_name) ?
  {
    treeRecord: {
      ranks: mappings_tree_to_upload_plan_tree(
        mappings_tree,
      ),
    },
  } :
  mappings_tree_to_upload_plan_table(
    mappings_tree,
    table_name,
    must_match_preferences,
    true,
    is_root,
  ) as UploadPlanUploadable;

/*
* Converts mappings tree to upload plan
* Inverse of upload_plan_to_mappings_tree
* */
export const mappings_tree_to_upload_plan = (
  base_table_name: string,
  mappings_tree: MappingsTree,
  must_match_preferences: Record<string, boolean>,
): UploadPlan => (
  {
    baseTableName: base_table_name,
    uploadable: mappings_tree_to_upload_table(
      mappings_tree,
      base_table_name,
      must_match_preferences,
      true,
    ),
  }
);