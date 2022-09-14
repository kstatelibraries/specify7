/**
 * Configuration for what schema tables and fields are accessible in the WB
 *
 * @remarks
 * Replaces the need for separate Workbench Schema like in Specify 6
 *
 * @module
 */

import type { Tables } from './types';
import { VALUE } from '../../utils/utils';
import type { IR, RR } from '../../utils/types';
import { TableFields } from './helperTypes';

export type TableConfigOverwrite =
  /*
   * Adds a table to the list of common base tables (shown on the base table
   *  selection screen even if "Show Advanced Tables" is not checked
   */
  | 'commonBaseTable'
  /*
   * Remove table from the list of base tables, but still make it available
   *  through relationships
   */
  | 'hidden'
  /*
   * Remove the table, all of it's fields/relationships and all
   *  fields/relationships from any table to this table
   */
  | 'system';

export type FieldConfigOverwrite =
  // Makes a required field optional
  | 'optional'
  | 'required'
  // Removes a field from the mapper (but not from Query Builder)
  | 'readOnly'
  // Hides a field. If it was required, it is made optional
  | 'hidden';

const tableOverwrites: Partial<RR<keyof Tables, TableConfigOverwrite>> = {
  Accession: 'commonBaseTable',
  Agent: 'commonBaseTable',
  Borrow: 'commonBaseTable',
  CollectingEvent: 'commonBaseTable',
  CollectionObject: 'commonBaseTable',
  ConservEvent: 'commonBaseTable',
  Container: 'commonBaseTable',
  Deaccession: 'commonBaseTable',
  Determination: 'commonBaseTable',
  DNASequence: 'commonBaseTable',
  ExchangeIn: 'commonBaseTable',
  ExchangeOut: 'commonBaseTable',
  Geography: 'commonBaseTable',
  Gift: 'commonBaseTable',
  Loan: 'commonBaseTable',
  Locality: 'commonBaseTable',
  Permit: 'commonBaseTable',
  Preparation: 'commonBaseTable',
  Storage: 'commonBaseTable',
  Taxon: 'commonBaseTable',
  TreatmentEvent: 'commonBaseTable',
  CollectingEventAttr: 'system',
  CollectionObjectAttr: 'system',
  LatLonPolygonPnt: 'system',
  Collection: 'system',
  Discipline: 'system',
  Division: 'system',
  Institution: 'system',
  Workbench: 'hidden',
  WorkbenchDataItem: 'hidden',
  WorkbenchRow: 'hidden',
  WorkbenchRowExportedRelationship: 'hidden',
  WorkbenchRowImage: 'hidden',
  WorkbenchTemplate: 'hidden',
  WorkbenchTemplateMappingItem: 'hidden',
  SpVisualQuery: 'hidden',
  SpSymbiotaInstance: 'hidden',
  GeographyTreeDef: 'system',
  GeographyTreeDefItem: 'system',
  GeologicTimePeriodTreeDef: 'system',
  GeologicTimePeriodTreeDefItem: 'system',
  LithoStratTreeDef: 'system',
  LithoStratTreeDefItem: 'system',
  StorageTreeDef: 'system',
  StorageTreeDefItem: 'system',
  TaxonTreeDef: 'system',
  TaxonTreeDefItem: 'system',
};

// These field overrides apply to entire front-end
const globalFieldOverrides: {
  readonly [TABLE_NAME in keyof Tables]?: {
    readonly [FIELD_NAME in TableFields<
      Tables[TABLE_NAME]
    >]?: FieldConfigOverwrite;
  };
} & {
  readonly common: IR<FieldConfigOverwrite>;
} = {
  // Common overwrites apply to fields in all tables
  common: {
    timestampCreated: 'readOnly',
  },
  Taxon: {
    parent: 'required',
    isAccepted: 'readOnly',
    acceptedTaxon: 'readOnly',
    fullName: 'readOnly',
  },
  Geography: {
    parent: 'required',
    isAccepted: 'readOnly',
    acceptedGeography: 'readOnly',
    fullName: 'readOnly',
  },
  LithoStrat: {
    parent: 'required',
    isAccepted: 'readOnly',
    acceptedLithoStrat: 'readOnly',
    fullName: 'readOnly',
  },
  GeologicTimePeriod: {
    parent: 'required',
    isAccepted: 'readOnly',
    acceptedGeologicTimePeriod: 'readOnly',
    fullName: 'readOnly',
  },
  Storage: {
    parent: 'required',
    isAccepted: 'readOnly',
    acceptedStorage: 'readOnly',
    fullName: 'readOnly',
  },
  SpecifyUser: {
    isAdmin: 'readOnly',
  },
};

/*
 * All required fields are unhidden, unless they are overwritten to "hidden".
 * ReadOnly relationships are removed.
 *
 * These apply to Query Builder, Workbench, Leaflet and Specify Network
 */
const fieldOverwrites: typeof globalFieldOverrides = {
  common: {
    timestampCreated: 'hidden',
    timestampModified: 'hidden',
    createdByAgent: 'hidden',
    modifiedByAgent: 'hidden',
    collectionMemberId: 'hidden',
    rankId: 'hidden',
    definition: 'hidden',
    definitionItem: 'hidden',
    orderNumber: 'hidden',
    isPrimary: 'hidden',
    isHybrid: 'hidden',
    isAccepted: 'hidden',
    fullName: 'readOnly',
  },
  Agent: {
    agentType: 'optional',
  },
  LoanPreparation: {
    isResolved: 'optional',
  },
  Locality: {
    srcLatLongUnit: 'optional',
  },
  PrepType: {
    isLoanable: 'readOnly',
  },
  Determination: {
    preferredTaxon: 'readOnly',
    isCurrent: 'hidden',
  },
  Taxon: {
    isAccepted: 'readOnly',
  },
};

/*
 * Same as fieldOverwrites, but matches with fieldName.endsWith(key),
 *  instead of fieldName===key.
 * endsWithFieldOverwrites are checked against fields in all tables.
 */
const endsWithFieldOverwrites: Partial<
  RR<keyof Tables | 'common', IR<FieldConfigOverwrite>>
> = {
  Attachment: {
    Attachments: 'hidden',
  },
};

// Overwrite SpecifyModel.view
export const modelViews: Partial<RR<keyof Tables, string>> = {
  SpQuery: 'Query',
};

export const getTableOverwrite = (
  tableName: keyof Tables
): TableConfigOverwrite | undefined => tableOverwrites[tableName];

export const getGlobalFieldOverwrite = (
  tableName: keyof Tables,
  fieldName: string
): FieldConfigOverwrite | undefined =>
  globalFieldOverrides[tableName as 'Accession']?.[fieldName as 'text1'] ??
  globalFieldOverrides.common?.[fieldName];

export const getFieldOverwrite = (
  tableName: keyof Tables,
  fieldName: string
): FieldConfigOverwrite | undefined =>
  fieldOverwrites[tableName as 'Accession']?.[fieldName as 'text1'] ??
  fieldOverwrites.common?.[fieldName] ??
  Object.entries(endsWithFieldOverwrites[tableName] ?? {}).find(([key]) =>
    fieldName.endsWith(key)
  )?.[VALUE] ??
  Object.entries(endsWithFieldOverwrites.common ?? {}).find(([key]) =>
    fieldName.endsWith(key)
  )?.[VALUE];
