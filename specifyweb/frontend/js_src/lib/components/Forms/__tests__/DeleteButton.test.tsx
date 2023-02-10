import { overrideAjax } from '../../../tests/ajax';
import { fetchBlockers } from '../DeleteButton';
import { schema } from '../../DataModel/schema';
import { mockTime, requireContext } from '../../../tests/helpers';

requireContext();
mockTime();

const agentId = 2;
const loanAgentId = 1;
const loanId = 3;
overrideAjax(`/api/delete_blockers/agent/${agentId}/`, [
  {
    table: 'LoanAgent',
    field: 'agent',
    ids: [loanAgentId],
  },
  {
    table: 'CollectionObject',
    field: 'createdByAgent',
    ids: [2, 3, 4],
  },
]);

overrideAjax(
  '/stored_query/ephemeral/',
  {
    results: [[loanAgentId, loanId]],
  },
  {
    method: 'POST',
    body: {
      _tablename: 'SpQuery',
      contextname: 'LoanAgent',
      contexttableid: 53,
      countonly: false,
      createdbyagent: null,
      fields: [
        {
          _tablename: 'SpQueryField',
          allownulls: null,
          alwaysfilter: null,
          columnalias: null,
          contexttableident: null,
          createdbyagent: null,
          endvalue: null,
          fieldname: 'loanAgentId',
          formatname: null,
          isdisplay: false,
          isnot: false,
          isprompt: null,
          isrelfld: false,
          modifiedbyagent: null,
          operend: null,
          operstart: 10,
          position: 0,
          query: null,
          sorttype: 0,
          startvalue: '1',
          stringid: '53.loanagent.loanAgentId',
          tablelist: '53',
          timestampcreated: '2022-08-31',
          timestampmodified: null,
          version: 1,
        },
        {
          _tablename: 'SpQueryField',
          allownulls: null,
          alwaysfilter: null,
          columnalias: null,
          contexttableident: null,
          createdbyagent: null,
          endvalue: null,
          fieldname: 'loanId',
          formatname: null,
          isdisplay: true,
          isnot: false,
          isprompt: null,
          isrelfld: false,
          modifiedbyagent: null,
          operend: null,
          operstart: 8,
          position: 0,
          query: null,
          sorttype: 0,
          startvalue: '',
          stringid: '53,52.loan.loanId',
          tablelist: '53,52',
          timestampcreated: '2022-08-31',
          timestampmodified: null,
          version: 1,
        },
      ],
      formatauditrecids: false,
      isfavorite: true,
      limit: 0,
      modifiedbyagent: null,
      name: 'Delete blockers',
      ordinal: 32767,
      remarks: null,
      searchsynonymy: null,
      selectdistinct: false,
      smushed: null,
      specifyuser: '/api/specify/specifyuser/2/',
      sqlstr: null,
      timestampcreated: '2022-08-31',
      timestampmodified: null,
      version: 1,
    },
  }
);

test('fetchBlockers', async () => {
  const resource = new schema.models.Agent.Resource({ id: agentId });
  const resources = await fetchBlockers(resource);

  expect(JSON.parse(JSON.stringify(resources))).toEqual([
    {
      blockers: [
        {
          directRelationship: '[relationship agent]',
          ids: [
            {
              direct: 1,
              parent: 3,
            },
          ],
          parentRelationship: '[relationship loan]',
        },
      ],
      table: '[table Loan]',
    },
    {
      blockers: [
        {
          directRelationship: '[relationship createdByAgent]',
          ids: [
            {
              direct: 2,
            },
            {
              direct: 3,
            },
            {
              direct: 4,
            },
          ],
        },
      ],
      table: '[table CollectionObject]',
    },
  ]);
});
