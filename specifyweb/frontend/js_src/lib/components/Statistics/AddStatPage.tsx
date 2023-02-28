import { CustomStat, DefaultStat, StatLayout } from './types';
import { Ul } from '../Atoms';
import { Categories } from './Categories';
import React from 'react';

export function AddStatPage({
  pageLabel,
  pageIndex,
  pageLayout,
  onClick: handleClick,
  onLoad: onLoad,
}: {
  readonly pageLabel: string;
  readonly pageIndex: number;
  readonly pageLayout: StatLayout | undefined;
  readonly onClick:
    | ((
        item: CustomStat | DefaultStat,
        categoryIndex?: number,
        itemIndex?: number
      ) => void)
    | ((item: CustomStat | DefaultStat) => void);
  readonly onLoad:
    | ((
        pageIndex: number,
        categoryIndex: number,
        itemIndex: number,
        value: number | string
      ) => void)
    | undefined;
}): JSX.Element {
  const onLoadPage = React.useCallback(
    (categoryIndex: number, itemIndex: number, value: number | string) => {
      onLoad?.(pageIndex, categoryIndex, itemIndex, value);
    },
    [onLoad, pageIndex]
  );
  return (
    <li key={pageIndex}>
      <h4 className="text-lg font-semibold">{pageLabel}</h4>
      <Ul className="flex flex-col gap-2">
        <Categories
          pageLayout={pageLayout}
          onClick={handleClick}
          onRemove={undefined}
          onCategoryRename={undefined}
          onRename={undefined}
          onAdd={undefined}
          onEdit={undefined}
          onLoad={onLoadPage}
        />
      </Ul>
    </li>
  );
}
