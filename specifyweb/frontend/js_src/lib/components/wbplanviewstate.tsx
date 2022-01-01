import React from 'react';
import type { State } from 'typesafe-reducer';
import { generateReducer } from 'typesafe-reducer';

import ajax from '../ajax';
import commonText from '../localization/common';
import wbText from '../localization/workbench';
import type { IR, RA } from '../types';
import type { UploadPlan } from '../uploadplantomappingstree';
import dataModelStorage from '../wbplanviewmodel';
import type { WbPlanViewActions } from '../wbplanviewreducer';
import { goBack, savePlan } from '../wbplanviewutils';
import { closeDialog, LoadingScreen, ModalDialog } from './modaldialog';
import { WbsDialog } from './toolbar/wbsdialog';
import type { Dataset, WbPlanViewProps } from './wbplanview';
import { ListOfBaseTables } from './wbplanviewcomponents';
import type { MappingLine } from './wbplanviewmapper';
import WbPlanViewMapper from './wbplanviewmapper';

// States

type LoadingState = State<'LoadingState'>;

type BaseTableSelectionState = State<
  'BaseTableSelectionState',
  {
    showHiddenTables: boolean;
  }
>;

export type MappingState = State<
  'MappingState',
  {
    changesMade: boolean;
    baseTableName: string;
    lines: RA<MappingLine>;
    mustMatchPreferences: IR<boolean>;
  }
>;

type TemplateSelectionState = State<'TemplateSelectionState'>;

export type WbPlanViewStates =
  | LoadingState
  | BaseTableSelectionState
  | TemplateSelectionState
  | MappingState;

type WbPlanViewStatesWithParameters = WbPlanViewStates & {
  readonly dispatch: (action: WbPlanViewActions) => void;
  readonly props: WbPlanViewProps;
};

function TemplateSelection({
  headers,
  onClose: handleClose,
  onSelect: handleSelect,
}: {
  readonly headers: RA<string>;
  readonly onClose: () => void;
  readonly onSelect: (
    uploadPlan: UploadPlan | null,
    headers: RA<string>
  ) => void;
}): JSX.Element {
  const [isLoading, setIsLoading] = React.useState(false);

  return isLoading ? (
    <LoadingScreen />
  ) : (
    <WbsDialog
      showTemplates={true}
      onClose={handleClose}
      onDataSetSelect={(id: number): void => {
        setIsLoading(true);
        void ajax<Dataset>(`/api/workbench/dataset/${id}`, {
          headers: { Accept: 'application/json' },
        }).then(({ data: { uploadplan, columns, visualorder } }) =>
          handleSelect(
            uploadplan,
            headers.length === 0 && Array.isArray(visualorder)
              ? (visualorder as RA<number>).map(
                  (visualCol) => columns[visualCol]
                )
              : headers
          )
        );
      }}
    />
  );
}

export const stateReducer = generateReducer<
  JSX.Element,
  WbPlanViewStatesWithParameters
>({
  LoadingState: () => <LoadingScreen />,
  BaseTableSelectionState: ({ action: state }) => (
    <ModalDialog
      properties={{
        title: wbText('selectBaseTableDialogTitle'),
        height: 400,
        close: (): void => goBack(state.props.dataset.id),
        buttons: [
          {
            text: wbText('chooseExistingPlan'),
            click: (): void =>
              state.dispatch({
                type: 'UseTemplateAction',
                dispatch: state.dispatch,
              }),
          },
          {
            text: commonText('cancel'),
            click: closeDialog,
          },
        ],
      }}
    >
      <div className="wbplanview-base-table-selection">
        <ListOfBaseTables
          listOfTables={dataModelStorage.listOfBaseTables}
          showHiddenTables={state.showHiddenTables}
          handleChange={(baseTableName: string): void =>
            state.dispatch({
              type: 'SelectTableAction',
              baseTableName,
              headers: state.props.headers,
            })
          }
        />
        <label>
          <input
            type="checkbox"
            checked={state.showHiddenTables}
            onChange={(): void =>
              state.dispatch({
                type: 'ToggleHiddenTablesAction',
              })
            }
          />{' '}
          {wbText('showAdvancedTables')}
        </label>
      </div>
    </ModalDialog>
  ),
  TemplateSelectionState: ({ action: state }) => (
    <TemplateSelection
      headers={state.props.headers}
      onClose={(): void =>
        state.dispatch({
          type: 'OpenBaseTableSelectionAction',
          referrer: state.type,
        })
      }
      onSelect={(uploadPlan, headers): void =>
        state.dispatch({
          type: 'OpenMappingScreenAction',
          uploadPlan,
          headers,
          changesMade: true,
        })
      }
    />
  ),
  MappingState: ({ action: state }) => {
    return (
      <WbPlanViewMapper
        readonly={state.props.readonly}
        setUnloadProtect={state.props.setUnloadProtect}
        removeUnloadProtect={state.props.removeUnloadProtect}
        changesMade={state.changesMade}
        baseTableName={state.baseTableName}
        lines={state.lines}
        mustMatchPreferences={state.mustMatchPreferences}
        dataset={state.props.dataset}
        onChangeBaseTable={(): void =>
          state.dispatch({
            type: 'OpenBaseTableSelectionAction',
          })
        }
        onReRunAutoMapper={(): void =>
          state.dispatch({
            type: 'SelectTableAction',
            headers: state.lines.map(({ headerName }) => headerName),
            baseTableName: state.baseTableName,
          })
        }
        onSave={async (lines, mustMatchPreferences): Promise<void> => {
          state.props.removeUnloadProtect();
          return savePlan({
            dataset: state.props.dataset,
            baseTableName: state.baseTableName,
            lines,
            mustMatchPreferences,
          });
        }}
      />
    );
  },
});
