/**
 * Specify form PickList
 */

import React from 'react';

import { useAsyncState } from '../../hooks/useAsyncState';
import { useLiveState } from '../../hooks/useLiveState';
import { commonText } from '../../localization/common';
import type { RA } from '../../utils/types';
import { Input } from '../Atoms/Form';
import { isResourceOfType } from '../DataModel/helpers';
import type { AnySchema } from '../DataModel/helperTypes';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { schema } from '../DataModel/schema';
import type { LiteralField, Relationship } from '../DataModel/specifyField';
import type { PickList } from '../DataModel/types';
import type { FormMode, FormType } from '../FormParse';
import { hasToolPermission } from '../Permissions/helpers';
import { PickListComboBox } from '../PickLists';
import { PickListTypes } from '../PickLists/definitions';
import { fetchPickList, getPickListItems } from '../PickLists/fetch';
import { FieldsPickList } from '../PickLists/FieldsPickList';
import { FormattersPickList } from '../PickLists/FormattersPickList';
import { TablesPickList } from '../PickLists/TablesPickList';
import { TreeLevelComboBox } from '../PickLists/TreeLevelPickList';
import { UiField } from './Field';
import { QueryComboBox } from './QueryComboBox';

export type DefaultComboBoxProps = {
  readonly id: string | undefined;
  readonly model: SpecifyResource<AnySchema>;
  readonly resource: SpecifyResource<AnySchema>;
  readonly field: LiteralField | Relationship;
  readonly pickListName: string | undefined;
  readonly defaultValue: string | undefined;
  readonly mode: FormMode;
  readonly isRequired: boolean;
  readonly isDisabled: boolean;
  readonly formType: FormType;
};

export type PickListItemSimple = {
  readonly value: string;
  readonly title: string;
};

function DefaultComboBox(props: DefaultComboBoxProps): JSX.Element | null {
  const [pickList] = useAsyncState<SpecifyResource<PickList>>(
    React.useCallback(
      () =>
        typeof props.pickListName === 'string'
          ? fetchPickList(props.pickListName).then((pickList) => {
              if (pickList === undefined)
                console.error('Unable to find pick list', props);
              return pickList;
            })
          : undefined,
      [props.pickListName]
    ),
    false
  );

  const [items, setItems] = useLiveState<RA<PickListItemSimple> | undefined>(
    React.useCallback(
      () =>
        typeof pickList === 'object' ? getPickListItems(pickList) : undefined,
      [pickList]
    )
  );

  /*
   * TEST: test if can add items to PickListTypes.FIELD
   * FEATURE: make other pick list types editable
   */
  const mode =
    // Only PickListTypes.ITEMS pick lists are editable
    pickList?.get('type') !== PickListTypes.ITEMS || pickList?.get('isSystem')
      ? 'view'
      : props.mode;

  return typeof pickList === 'object' && Array.isArray(items) ? (
    <PickListComboBox
      {...props}
      items={items}
      mode={props.mode}
      pickList={pickList}
      onAdd={
        mode === 'view'
          ? undefined
          : (value): void =>
              setItems([
                ...items,
                {
                  title: value,
                  value,
                },
              ])
      }
    />
  ) : (
    <Input.Text
      disabled
      required={props.isRequired}
      // BUG: required has no effect while disabled. Need a better solution
      value={commonText('loading')}
    />
  );
}

export function Combobox({
  fieldName,
  ...props
}: Omit<DefaultComboBoxProps, 'field'> & {
  readonly field: LiteralField | Relationship | undefined;
  readonly fieldName: string | undefined;
}): JSX.Element | null {
  const { resource, field, model, id, mode, formType, isRequired } = props;

  if (isResourceOfType(resource, 'PickList') && fieldName === 'fieldsCBX')
    return (
      <FieldsPickList
        {...props}
        field={schema.models.PickList.strictGetLiteralField('fieldName')}
      />
    );
  else if (
    isResourceOfType(resource, 'PickList') &&
    fieldName === 'formatterCBX'
  )
    return (
      <FormattersPickList
        {...props}
        field={schema.models.PickList.strictGetLiteralField(
          'fieldNameformatter'
        )}
      />
    );
  else if (isResourceOfType(resource, 'PickList') && fieldName === 'tablesCBX')
    return (
      <TablesPickList
        {...props}
        field={schema.models.PickList.strictGetLiteralField('tableName')}
      />
    );
  else if (fieldName === 'definitionItem')
    return (
      <TreeLevelComboBox
        {...props}
        field={model.specifyModel.strictGetRelationship('definitionItem')}
      />
    );
  else if (fieldName === 'divisionCBX') {
    const field = resource.specifyModel.strictGetRelationship('division');
    return (
      <QueryComboBox
        fieldName={field.name}
        forceCollection={undefined}
        formType={formType}
        id={id}
        isRequired={isRequired}
        mode={mode}
        relatedModel={undefined}
        resource={resource}
        typeSearch={undefined}
      />
    );
  }

  const resolvedField =
    isResourceOfType(resource, 'PickList') && fieldName === 'typesCBX'
      ? schema.models.PickList.strictGetLiteralField('type')
      : field;

  if (typeof resolvedField !== 'object') {
    console.error(
      `can't setup picklist for unknown field ${model.specifyModel.name}.${fieldName}`
    );
    return null;
  }

  const pickListName = props.pickListName ?? resolvedField.getPickList();

  if (typeof pickListName === 'string')
    return hasToolPermission('pickLists', 'read') ? (
      <DefaultComboBox
        {...props}
        field={resolvedField}
        pickListName={pickListName}
      />
    ) : (
      <UiField
        fieldName={resolvedField.name}
        id={props.id}
        mode="view"
        resource={props.resource}
      />
    );
  else {
    console.error(
      `Unable to resolve a pick list for ${model.specifyModel.name}.${fieldName}`
    );
    return (
      <UiField
        fieldName={resolvedField.name}
        id={props.id}
        mode={props.mode}
        resource={props.resource}
      />
    );
  }
}
