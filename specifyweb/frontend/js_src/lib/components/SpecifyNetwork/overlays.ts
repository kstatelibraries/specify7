import React from 'react';

import { useAsyncState } from '../../hooks/useAsyncState';
import { specifyNetworkText } from '../../localization/specifyNetwork';
import { ajax } from '../../utils/ajax';
import { f } from '../../utils/functools';
import type { IR, RA } from '../../utils/types';
import { keysToLowerCase } from '../../utils/utils';
import { schema } from '../DataModel/schema';
import { userInformation } from '../InitialContext/userInformation';
import L from '../Leaflet/extend';
import type { BrokerRecord } from './fetchers';
import { extractBrokerField } from './fetchers';

export type BrokerOverlay = {
  readonly layers: IR<L.TileLayer>;
  readonly description: JSX.Element | string;
};

export function getGbifLayers(
  name: RA<BrokerRecord>
): BrokerOverlay | undefined {
  const taxonKey = extractBrokerField(name, 'gbif', 's2n:gbif_taxon_key');
  if (taxonKey === undefined) return undefined;

  return {
    layers: {
      [`GBIF ${legendGradient}`]: L.tileLayer(
        'https://api.gbif.org/v2/map/occurrence/{source}/{z}/{x}/{y}{format}?{params}',
        {
          attribution: '',
          // @ts-expect-error
          source: 'density',
          format: '@1x.png',
          className: 'saturate-150',
          params: Object.entries({
            srs: 'EPSG:3857',
            style: 'classic.poly',
            bin: 'hex',
            hexPerTile: 20,
            taxonKey,
          })
            .map(([key, value]) => `${key}=${value}`)

            .join('&'),
        }
      ),
    },
    description: specifyNetworkText.gbifDescription(),
  };
}

const legendGradient = `<span
  aria-hidden="true"
  class="flex justify-between flex-1 p-1 bg-gradient-to-r from-yellow-400 to-red-400"
>
  <span>0</span>
  <span>100+</span>
</span>`;

const getIdbLayer = async (
  scientificName: string,
  collectionCode: string | undefined,
  layerName: string,
  className: string = 'saturate-200 brightness-125'
): Promise<IR<L.TileLayer>> =>
  ajax<{
    readonly itemCount: number;
    readonly tiles: string;
  }>(
    'https://search.idigbio.org/v2/mapping/',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: {
        rq: keysToLowerCase({
          scientificName,
          collectionCode,
        }),
        type: 'auto',
        threshold: 100_000,
      },
    },
    { strict: false }
  )
    .then(({ data }) =>
      data.itemCount === 0
        ? {}
        : {
            [layerName]: L.tileLayer(data.tiles, {
              attribution: 'iDigBio and the user community',
              className,
            }),
          }
    )
    .catch(() => ({}));

export function useIdbLayers(
  occurrence: RA<BrokerRecord> | undefined,
  scientificName: string | undefined
): BrokerOverlay | undefined {
  const [layers] = useAsyncState<BrokerOverlay>(
    React.useCallback(() => {
      const idbScientificName =
        extractBrokerField(occurrence ?? [], 'idb', 'dwc:scientificName') ??
        scientificName;
      const collectionCode =
        extractBrokerField(occurrence ?? [], 'idb', 'dwc:collectionCode') ??
        userInformation.availableCollections.find(
          ({ id }) => id === schema.domainLevelIds.collection
        )?.code ??
        undefined;
      if (idbScientificName === undefined) return undefined;
      return f
        .all({
          global: getIdbLayer(
            idbScientificName,
            undefined,
            `iDigBio ${legendPoint('bg-emerald-500')}`
          ),
          collection: getIdbLayer(
            idbScientificName,
            collectionCode,
            `iDigBio (${
              collectionCode ?? 'collection'
            } points only) ${legendPoint('bg-rose-500')}`,
            'hue-rotate-180 saturate-150 brightness-125'
          ),
        })
        .then(({ global, collection }) => ({
          layers: {
            ...global,
            ...collection,
          },
          description: specifyNetworkText.iDigBioDescription(),
        }));
    }, [occurrence, scientificName]),
    false
  );
  return layers;
}

const legendPoint = (color: string): string => `<div
  aria-hidden="true"
  class="w-4 h-4 ${color} rounded-full"
></div>`;
