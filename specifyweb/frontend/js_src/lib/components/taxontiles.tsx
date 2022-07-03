import React from 'react';

import { ajax } from '../ajax';
import { welcomeText } from '../localization/welcome';
import {
  getTitleGenerator,
  makeTreeMap,
  mergeNodes,
  pairNodes,
} from '../taxontileshelpers';
import { getTreeDefinitionItems, treeRanksPromise } from '../treedefinitions';
import type { RA } from '../types';
import { useAsyncState } from './hooks';

export function TaxonTiles(): JSX.Element {
  const [container, setContainer] = React.useState<SVGElement | null>(null);
  const genusRankId = useGenusRankId();
  const treeData = useTreeData();

  const [title, setTitle] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (
      container === null ||
      genusRankId === undefined ||
      treeData === undefined
    )
      return undefined;
    const genusId = typeof genusRankId === 'number' ? genusRankId : undefined;
    const titleGenerator = getTitleGenerator(genusId);
    const chart = makeTreeMap(container, treeData.root);
    chart
      .attr('title', titleGenerator)
      .on('mouseover', (_event, node) => setTitle(titleGenerator(node)));
    setTitle(treeData.root.name);
    return () => void chart.remove();
  }, [container, genusRankId, treeData]);

  return (
    <div className="h-[473px] w-full text-xl flex relative">
      <p
        className="top-3 left-3 dark:bg-black opacity-80 absolute z-10 px-2 py-0 bg-white border"
        title={
          typeof treeData === 'object'
            ? welcomeText('taxonTilesDescription', treeData.threshold)
            : undefined
        }
      >
        {welcomeText('taxonTiles')}
      </p>
      {typeof title === 'string' && (
        <p className="top-3 right-3 dark:bg-black opacity-80 absolute z-10 px-2 py-0 bg-white border">
          {title}
        </p>
      )}
      <svg
        ref={setContainer}
        className="dark:bg-neutral-700 flex-1 w-full bg-black"
      />
    </div>
  );
}

function useGenusRankId(): number | false | undefined {
  const [genusRankId] = useAsyncState(
    React.useCallback(
      async () =>
        treeRanksPromise.then(
          () =>
            getTreeDefinitionItems('Taxon', false)!.find(
              (item) => (item.name || item.title)?.toLowerCase() === 'genus'
            )?.rankId ?? false
        ),
      []
    ),
    false
  );
  return genusRankId;
}

function useTreeData(): ReturnType<typeof mergeNodes> | undefined {
  const [treeData] = useAsyncState(
    React.useCallback(
      async () =>
        ajax<
          RA<
            [
              id: number,
              rankId: number,
              parentId: number,
              name: string,
              count: number
            ]
          >
        >('/barvis/taxon_bar/', {
          headers: { Accept: 'application/json' },
        })
          .then(({ data }) =>
            data.map(([id, rankId, parentId, name, count]) => ({
              id,
              rankId,
              parentId,
              name,
              count,
            }))
          )
          .then(pairNodes)
          .then(mergeNodes),
      []
    ),
    false
  );
  return treeData;
}
