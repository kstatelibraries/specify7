import type { RA } from '../components/wbplanview';
import { createDictionary, createHeader } from './utils';

// Refer to "Guidelines for Programmers" in ./utils.tsx before editing this file

const queryText = createDictionary({
  queryBoxDescription: (fieldNames: RA<string>) =>
    `Searches: ${fieldNames.join(', ')}`,
  fieldIsRequired: 'Field is required',
  selectFields: 'Select Field...',
  treeRankAuthor: (rankName: string) => `${rankName} Author`,
  selectOp: 'Select Op...',
  any: 'any',
  addValuesHint: 'Add values one by one, or as comma-separated list:',
  saveQueryDialogTitle: 'Save query as...',
  savingQueryDialogTitle: 'Saving...',
  saveQueryDialogMessage: 'Enter a name for the new query.',
  saveQueryDialogHeader: createHeader(''),
  saveClonedQueryDialogHeader: createHeader(''),
  saveClonedQueryDialogMessage: `
    The query will be saved with a new name leaving the current query
    unchanged.`,
  queryName: 'Query Name:',
  queryDeleteIncompleteDialogTitle: 'Incomplete fields',
  queryDeleteIncompleteDialogHeader: createHeader(''),
  queryDeleteIncompleteDialogMessage: `
    There are uncompleted fields in the query definition. Do you want to
    remove them?`,
  queryUnloadProtectDialogMessage: 'This query definition has not been saved.',
  recordSetToQueryDialogTitle: 'Record Set from Query',
  recordSetToQueryDialogHeader: createHeader(''),
  recordSetToQueryDialogMessage: 'Generating record set.',
  openNewlyCreatedRecordSet: 'Open newly created record set now?',
  unableToExportAsKmlDialogTitle: 'Unable to Export',
  unableToExportAsKmlDialogHeader: createHeader(''),
  unableToExportAsKmlDialogMessage:
    'Please add latitude and longitude fields to the query.',
  queryExportStartedDialogTitle: 'Query Started',
  queryExportStartedDialogHeader: createHeader(''),
  queryExportStartedDialogMessage: (exportFileType: string) => `
    The query has begun executing. You will receive a notification when the
    results ${exportFileType} file is ready for download.`,
  invalidPicklistValue: (value: string) => `${value} (current, invalid value)`,
  missingRequiredPicklistValue: 'Invalid null selection',

  // QueryTask
  queryTaskTitle: (queryName: string) => `Query: ${queryName}`,
  new: 'New',
  newButtonDescription: 'New Field',
  countOnly: 'Count',
  distinct: 'Distinct',
  format: 'Format',
  query: 'Query',
  createCsv: 'Create CSV',
  createKml: 'Create KML',
  makeRecordSet: 'Make Record Set',
  abandonChanges: 'Abandon Changes',
  saveAs: 'Save As',

  // QueryField
  expand: 'Expand',
  expandButtonDescription: 'Field is valid and will be saved. Click to expand',
  sort: 'Sort',
  moveUp: 'Move up',
  moveDown: 'Move down',
  showButtonDescription: 'Show in results',

  // QueryResultsTable
  results: 'Results:',
});

export default queryText;
