/**
 * Workbench Upload results side bar with table counts
 *
 * @module
 */

import '../../css/wbuploaded.css';

import React from 'react';

import commonText from '../localization/common';
import wbText from '../localization/workbench';
import type { IR } from '../types';
import dataModelStorage from '../wbplanviewmodel';
import { TableIcon } from './common';
import createBackboneView from './reactbackboneextend';

function TableResults({
  tableName,
  recordCount,
}: {
  readonly tableName: string;
  readonly recordCount: number;
}): JSX.Element {
  return (
    <li className="wb-uploaded-view-line">
      <TableIcon tableName={tableName.toLowerCase()} />
      <span>
        {`${dataModelStorage.tables[tableName].label}: ${recordCount}`}
      </span>
    </li>
  );
}

function WbUploadedView({
  recordCounts,
  onClose: handleClose,
  isUploaded,
}: {
  readonly recordCounts: IR<number>;
  readonly onClose: () => void;
  readonly isUploaded: boolean;
}): JSX.Element {
  return (
    <>
      <h2>
        {isUploaded
          ? wbText('uploadResults')
          : wbText('potentialUploadResults')}
      </h2>
      <p>
        {isUploaded
          ? wbText('wbUploadedDescription')
          : wbText('wbUploadedPotentialDescription')}
      </p>
      <ul>
        {Object.entries(recordCounts).map(([tableName, recordCount], index) => (
          <TableResults
            key={index}
            tableName={tableName}
            recordCount={recordCount}
          />
        ))}
      </ul>
      <button type="button" className="magic-button" onClick={handleClose}>
        {commonText('close')}
      </button>
    </>
  );
}

export default createBackboneView(WbUploadedView, {
  className: 'wb-uploaded-view',
});
