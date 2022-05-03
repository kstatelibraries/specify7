/**
 * Generic React Components
 *
 * @module
 *
 */

import React from 'react';
import ReactDOM from 'react-dom';

import { spanNumber } from '../helpers';
import { getIcon } from '../icons';
import { commonText } from '../localization/common';
import { getModel } from '../schema';
import { icons } from './icons';
import { compareStrings } from './internationalization';
import { useTitle } from './hooks';
import { className } from './basic';

const MAX_HUE = 360;

/**
 * Convert first 2 characters of a table name to a number [0,255] corresponding
 * to color hue.
 *
 * Used for autogenerated table icons if table icon image is missing.
 */
const getHue = spanNumber(
  // eslint-disable-next-line unicorn/prefer-code-point
  'a'.charCodeAt(0) * 2,
  // eslint-disable-next-line unicorn/prefer-code-point
  'z'.charCodeAt(0) * 2,
  0,
  MAX_HUE
);

/**
 * Renders a table icon or autogenerates a new one
 */
export function TableIcon({
  name,
  tableLabel,
  /*
   * It is highly recommended to use the same icon size everywhere, as that
   * improves consistency, thus, this should be overwritten only if it is
   * strictly necessary.
   */
  className = 'w-table-icon h-table-icon',
}: {
  readonly name: string;
  readonly tableLabel?: string | false;
  readonly className?: string;
}): JSX.Element {
  const tableIconSource = getIcon(name);
  const resolvedTableLabel =
    tableLabel === false
      ? undefined
      : tableLabel ?? getModel(name)?.label ?? '';
  const role = typeof resolvedTableLabel === 'string' ? 'img' : undefined;
  const ariaHidden = typeof resolvedTableLabel === 'undefined';
  if (typeof tableIconSource === 'string')
    return (
      <span
        className={`${className} bg-center bg-no-repeat bg-contain`}
        role={role}
        style={{ backgroundImage: `url('${tableIconSource}')` }}
        title={resolvedTableLabel}
        aria-label={resolvedTableLabel}
        aria-hidden={ariaHidden}
      />
    );

  // eslint-disable-next-line unicorn/prefer-code-point
  const colorHue = getHue(name.charCodeAt(0) + name.charCodeAt(0));
  const color = `hsl(${colorHue}, 70%, 50%)`;
  // If icon is missing, show an autogenerated one:
  return (
    <span
      style={{ backgroundColor: color }}
      role={role}
      className={`w-table-icon h-table-icon flex items-center justify-center
        text-white rounded text-sm`}
      title={resolvedTableLabel}
      aria-label={resolvedTableLabel}
      aria-hidden={ariaHidden}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export const tableIconUndefined = (
  <span
    className="w-table-icon h-table-icon flex items-center justify-center font-bold text-red-600"
    aria-label={commonText('unmapped')}
    role="img"
  >
    {icons.ban}
  </span>
);

export const tableIconSelected = (
  <span
    className="w-table-icon h-table-icon flex items-center justify-center font-bold text-green-500"
    aria-label={commonText('mapped')}
    role="img"
  >
    {icons.check}
  </span>
);

export const tableIconEmpty = (
  <span className="w-table-icon h-table-icon" aria-hidden={true} />
);

/** Internationalized bi-directional string comparison function */
export const compareValues = (
  ascending: boolean,
  valueLeft: string | undefined,
  valueRight: string | undefined
): number =>
  compareStrings(valueLeft ?? '', valueRight ?? '') * (ascending ? -1 : 1);

export type SortConfig<FIELD_NAMES extends string> = {
  readonly sortField: FIELD_NAMES;
  readonly ascending: boolean;
};

export function SortIndicator<FIELD_NAMES extends string>({
  fieldName,
  sortConfig,
}: {
  readonly fieldName: string;
  readonly sortConfig: SortConfig<FIELD_NAMES>;
}): JSX.Element {
  const isSorted = sortConfig.sortField === fieldName;
  return (
    <span
      className="text-brand-300"
      aria-label={
        isSorted
          ? sortConfig.ascending
            ? commonText('ascending')
            : commonText('descending')
          : undefined
      }
    >
      {isSorted
        ? sortConfig.ascending
          ? icons.chevronUp
          : icons.chevronDown
        : undefined}
    </span>
  );
}

/**
 * A React Portal wrapper
 *
 * @remarks
 * Based on https://blog.logrocket.com/learn-react-portals-by-example/
 *
 * Used when an elements needs to be renreded outside of the bounds of
 * the container that has overflow:hidden
 */
export function Portal({
  children,
}: {
  readonly children: JSX.Element;
}): JSX.Element {
  const element = React.useMemo(() => document.createElement('div'), []);

  React.useEffect(() => {
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot === null) throw new Error('Portal root was not found');
    portalRoot.append(element);
    return (): void => element.remove();
  }, [element]);

  return ReactDOM.createPortal(children, element);
}

export function AppTitle({ title }: { readonly title: string }): null {
  useTitle(title);
  return null;
}

export function AutoGrowTextArea({
  value,
  children,
}: {
  readonly value: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <div className="grid">
      {/*
       * Shadow a textarea with a div, allowing it to autoGrow. Source:
       * https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/
       */}
      <div
        className={`textarea-shadow print:hidden invisible
                  whitespace-pre-wrap [grid-area:1/1/2/2] ${className.textArea}`}
      >
        {`${value} `}
      </div>
      {children}
    </div>
  );
}
