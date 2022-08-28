import React from 'react';
import type { State } from 'typesafe-reducer';

import type {
  Disposal,
  DisposalPreparation,
  ExchangeOut,
  Gift,
  GiftPreparation,
  Loan,
  LoanPreparation,
} from '../DataModel/types';
import { group, replaceItem } from '../../utils/utils';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { commonText } from '../../localization/common';
import { formsText } from '../../localization/forms';
import { getResourceApiUrl, getResourceViewUrl } from '../DataModel/resource';
import { getModel, schema } from '../DataModel/schema';
import type { Preparations } from '../../utils/ajax/specifyApi';
import { getInteractionsForPrepId } from '../../utils/ajax/specifyApi';
import type { Collection, SpecifyModel } from '../DataModel/specifyModel';
import { toTable } from '../DataModel/specifyModel';
import type { RA, RR } from '../../utils/types';
import { defined, filterArray } from '../../utils/types';
import { syncFieldFormat } from '../../utils/uiParse';
import { LoadingContext } from '../Core/Contexts';
import { useId, useLiveState } from '../../hooks/hooks';
import { Dialog } from '../Molecules/Dialog';
import { ResourceView } from '../Forms/ResourceView';
import { useNavigate } from 'react-router-dom';
import { serializeResource } from '../DataModel/helpers';
import { Button } from '../Atoms/Button';
import { Submit } from '../Atoms/Submit';
import { Form, Input } from '../Atoms/Form';

export function PrepDialog({
  onClose: handleClose,
  isReadOnly,
  preparations: rawPreparations,
  action,
  itemCollection,
}: {
  readonly onClose: () => void;
  readonly isReadOnly: boolean;
  readonly preparations: Preparations;
  readonly action: {
    readonly model: SpecifyModel<Disposal | Gift | Loan>;
    readonly name?: string;
  };
  readonly itemCollection?: Collection<
    DisposalPreparation | GiftPreparation | LoanPreparation
  >;
}): JSX.Element {
  const preparations = React.useMemo(() => {
    if (itemCollection === undefined) return rawPreparations;
    const mutatedPreparations = rawPreparations.map((item) =>
      Object.fromEntries(Object.entries(item))
    );
    const indexedPreparations = Object.fromEntries(
      group(
        mutatedPreparations.map((preparation) => [
          getResourceApiUrl('Preparation', preparation.preparationId),
          preparation,
        ])
      )
    );
    itemCollection.models.forEach((preparation) => {
      if (!preparation.isNew()) return;
      const preparationUrl = preparation.get('preparation');
      const indexed = indexedPreparations[preparationUrl ?? ''];
      if (indexed === undefined) return;
      const loanPreparation = toTable(preparation, 'LoanPreparation');
      if (loanPreparation === undefined) return;
      const resolved = loanPreparation.get('quantityResolved') ?? 0;
      // @ts-expect-error REFACTOR: make this algorithm immutable
      indexed[0].available -= loanPreparation.get('quantity') - resolved;
    });
    return mutatedPreparations as Preparations;
  }, [rawPreparations, itemCollection]);

  const [selected, setSelected] = useLiveState<RA<number>>(
    React.useCallback(
      () => Array.from({ length: preparations.length }).fill(0),
      [preparations.length]
    )
  );
  const canDeselect = selected.some((value) => value > 0);
  const canSelectAll = selected.some(
    (value, index) => value < preparations[index].available
  );

  const id = useId('prep-dialog');
  const navigate = useNavigate();

  return (
    <Dialog
      buttons={
        isReadOnly ? (
          commonText('close')
        ) : (
          <>
            <Button.DialogClose>{commonText('cancel')}</Button.DialogClose>
            <Button.Blue
              disabled={!canSelectAll}
              title={formsText('selectAllAvailablePreparations')}
              onClick={(): void =>
                setSelected(preparations.map(({ available }) => available))
              }
            >
              {formsText('selectAll')}
            </Button.Blue>
            <Button.Blue
              disabled={!canDeselect}
              title={commonText('clearAll')}
              onClick={(): void => setSelected(Array.from(selected).fill(0))}
            >
              {formsText('deselectAll')}
            </Button.Blue>
            <Submit.Green
              form={id('form')}
              title={
                typeof itemCollection === 'object'
                  ? formsText('addItems')
                  : formsText('createRecord', action.model.label)
              }
            >
              {commonText('apply')}
            </Submit.Green>
          </>
        )
      }
      header={formsText('preparationsDialogTitle')}
      onClose={handleClose}
    >
      <Form
        id={id('form')}
        onSubmit={(): void => {
          const itemModel = defined(
            getModel(`${action.model.name}Preparation`)
          ) as SpecifyModel<
            DisposalPreparation | GiftPreparation | LoanPreparation
          >;
          const items = filterArray(
            preparations.map((preparation, index) => {
              if (selected[index] === 0) return undefined;
              const result = new itemModel.Resource();
              result.set(
                'preparation',
                getResourceApiUrl('Preparation', preparation.preparationId)
              );
              result.set('quantity', selected[index]);
              const loanPreparation = toTable(result, 'LoanPreparation');
              loanPreparation?.set('quantityReturned', 0);
              loanPreparation?.set('quantityResolved', 0);
              return result;
            })
          );

          if (typeof itemCollection === 'object') {
            itemCollection.add(items);
            handleClose();
          } else {
            const interaction = new action.model.Resource();
            const loan = toTable(interaction, 'Loan');
            loan?.set(
              'loanPreparations',
              items as RA<SpecifyResource<LoanPreparation>>
            );
            loan?.set('isClosed', false);
            toTable(interaction, 'Gift')?.set(
              'giftPreparations',
              items as RA<SpecifyResource<GiftPreparation>>
            );
            toTable(interaction, 'Disposal')?.set(
              'disposalPreparations',
              items as RA<SpecifyResource<DisposalPreparation>>
            );
            navigate(getResourceViewUrl(action.model.name, undefined), {
              state: { resource: serializeResource(interaction) },
            });
          }
        }}
      >
        <table className="grid-table grid-cols-[min-content_repeat(6,auto)] gap-2">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{formsText('selectAll')}</span>
              </th>
              <th scope="col">
                {
                  defined(
                    schema.models.CollectionObject.getLiteralField(
                      'catalogNumber'
                    )
                  ).label
                }
              </th>
              <th scope="col">
                {
                  defined(schema.models.Determination.getRelationship('taxon'))
                    .label
                }
              </th>
              <th scope="col">
                {
                  defined(schema.models.Preparation.getRelationship('prepType'))
                    .label
                }
              </th>
              <th scope="col">{commonText('selected')}</th>
              <th scope="col">{formsText('available')}</th>
              <th scope="col">{formsText('unavailable')}</th>
            </tr>
          </thead>
          <tbody>
            {preparations.map((preparation, index) => (
              <Row
                key={index}
                preparation={preparation}
                selected={selected[index]}
                onChange={(newSelected): void =>
                  setSelected(replaceItem(selected, index, newSelected))
                }
              />
            ))}
          </tbody>
        </table>
      </Form>
    </Dialog>
  );
}

function Row({
  preparation,
  selected,
  onChange: handleChange,
}: {
  readonly preparation: Preparations[number];
  readonly selected: number;
  readonly onChange: (newSelected: number) => void;
}): JSX.Element {
  const unavailableCount = preparation.countAmount - preparation.available;

  const available = Math.max(0, preparation.available);
  const checked = selected !== 0;
  const loading = React.useContext(LoadingContext);
  const [state, setState] = React.useState<
    | State<
        'ItemSelection',
        {
          readonly items: RR<
            'ExchangeOut' | 'Gift' | 'Loan',
            RA<{
              readonly id: number;
              readonly label: string;
            }>
          >;
        }
      >
    | State<
        'ResourceDialog',
        {
          readonly resource: SpecifyResource<ExchangeOut | Gift | Loan>;
        }
      >
    | State<'Main'>
  >({ type: 'Main' });

  return (
    <>
      <tr>
        <td>
          <Input.Checkbox
            aria-label={formsText('selectAll')}
            checked={checked}
            title={formsText('selectAll')}
            onValueChange={(): void => handleChange(checked ? 0 : available)}
          />
        </td>
        <td className="justify-end tabular-nums">
          {syncFieldFormat(
            schema.models.CollectionObject.getLiteralField('catalogNumber'),
            undefined,
            preparation.catalogNumber
          )}
        </td>
        <td>{preparation.taxon}</td>
        <td>{preparation.prepType}</td>
        <td>
          <Input.Number
            aria-label={formsText('selectedAmount')}
            max={preparation.available}
            min={0}
            title={formsText('selectedAmount')}
            value={selected}
            onValueChange={handleChange}
          />
        </td>
        <td className="justify-end tabular-nums">{preparation.available}</td>
        <td className="justify-end tabular-nums">
          {
            /* If unavailable items, link to related interactions */
            unavailableCount === 0 ? (
              0
            ) : (
              <Button.LikeLink
                onClick={(): void =>
                  state.type === 'Main'
                    ? loading(
                        getInteractionsForPrepId(
                          preparation.preparationId
                        ).then(([_id, ...rawItems]) => {
                          const [loans, gifts, exchangeOuts] = rawItems.map(
                            (preparations) =>
                              preparations
                                ?.split(',')
                                .map((object) => object.split('>|<'))
                                .map(([id, label]) => ({
                                  id: Number.parseInt(id),
                                  label,
                                })) ?? []
                          );
                          const count =
                            loans.length + gifts.length + exchangeOuts.length;

                          setState(
                            count === 1
                              ? {
                                  type: 'ResourceDialog',
                                  resource: new (loans.length === 1
                                    ? schema.models.Loan
                                    : gifts.length === 1
                                    ? schema.models.Gift
                                    : schema.models.ExchangeOut
                                  ).Resource({
                                    id: [...loans, ...gifts, ...exchangeOuts][0]
                                      .id,
                                  }),
                                }
                              : {
                                  type: 'ItemSelection',
                                  items: {
                                    Loan: loans,
                                    Gift: gifts,
                                    ExchangeOut: exchangeOuts,
                                  },
                                }
                          );
                        })
                      )
                    : setState({ type: 'Main' })
                }
              >
                {unavailableCount}
              </Button.LikeLink>
            )
          }
        </td>
      </tr>
      {state.type === 'ItemSelection' && (
        <tr>
          <td className="col-span-full">
            {Object.entries(state.items).map(([tableName, items]) =>
              items.map(({ id, label }) => (
                <Button.LikeLink
                  onClick={(): void =>
                    setState({
                      type: 'ResourceDialog',
                      resource: new schema.models[tableName].Resource({ id }),
                    })
                  }
                >{`${schema.models[tableName].label}: ${label}`}</Button.LikeLink>
              ))
            )}
          </td>
        </tr>
      )}
      {state.type === 'ResourceDialog' && (
        <ResourceView
          canAddAnother
          dialog="modal"
          isDependent={false}
          isSubForm={false}
          mode="edit"
          resource={state.resource}
          onClose={(): void => setState({ type: 'Main' })}
          onDeleted={undefined}
          onSaved={undefined}
        />
      )}
    </>
  );
}
