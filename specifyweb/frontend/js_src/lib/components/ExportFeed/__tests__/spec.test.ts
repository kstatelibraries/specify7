import { ajax } from '../../../utils/ajax';
import { getAppResourceUrl } from '../../../utils/ajax/helpers';
import { xmlToSpec } from '../../Syncer/xmlUtils';
import { exportFeedSpec } from '../spec';

test('Export Feed is parsed correctly', async () =>
  expect(
    ajax<Element>(getAppResourceUrl('ExportFeed'), {
      headers: {
        Accept: 'text/xml',
      },
    }).then(({ data }) => xmlToSpec(data, exportFeedSpec()))
  ).resolves.toMatchInlineSnapshot(`
    {
      "description": "RSS feed for KUBI Ichthyology Voucher collections",
      "items": [
        {
          "collectionId": 4,
          "days": 7,
          "definition": "DwCA_FishCollection",
          "description": undefined,
          "fileName": "kui-dwca.zip",
          "guid": undefined,
          "id": "8f79c802-a58c-447f-99aa-1d6a0790825a",
          "metadata": "DwCA_Metadata",
          "notifyUserId": 2,
          "publish": true,
          "title": "KU Fish",
          "userId": 2,
        },
      ],
      "language": undefined,
      "title": "KUBI ichthyology RSS Feed",
    }
  `));
