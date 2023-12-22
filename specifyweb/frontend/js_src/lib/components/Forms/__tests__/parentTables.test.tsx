import { requireContext } from '../../../tests/helpers';
import { parentTableRelationship } from '../parentTables';

requireContext();

test('Parent table relationships are calculated properly', () =>
  expect(parentTableRelationship()).toMatchInlineSnapshot(`
    {
      "AccessionAgent": "[relationship AccessionAgent.accession]",
      "AccessionAttachment": "[relationship AccessionAttachment.accession]",
      "AccessionAuthorization": "[relationship AccessionAuthorization.accession]",
      "AccessionCitation": "[relationship AccessionCitation.accession]",
      "Address": "[relationship Address.agent]",
      "AgentAttachment": "[relationship AgentAttachment.agent]",
      "AgentGeography": "[relationship AgentGeography.agent]",
      "AgentIdentifier": "[relationship AgentIdentifier.agent]",
      "AgentSpecialty": "[relationship AgentSpecialty.agent]",
      "AgentVariant": "[relationship AgentVariant.agent]",
      "AttachmentMetadata": "[relationship AttachmentMetadata.attachment]",
      "AttachmentTag": "[relationship AttachmentTag.attachment]",
      "Author": "[relationship Author.referenceWork]",
      "BorrowAgent": "[relationship BorrowAgent.borrow]",
      "BorrowAttachment": "[relationship BorrowAttachment.borrow]",
      "BorrowMaterial": "[relationship BorrowMaterial.borrow]",
      "BorrowReturnMaterial": "[relationship BorrowReturnMaterial.borrowMaterial]",
      "CollectingEventAttachment": "[relationship CollectingEventAttachment.collectingEvent]",
      "CollectingEventAttr": "[relationship CollectingEventAttr.collectingEvent]",
      "CollectingEventAuthorization": "[relationship CollectingEventAuthorization.collectingEvent]",
      "CollectingTripAttachment": "[relationship CollectingTripAttachment.collectingTrip]",
      "CollectingTripAuthorization": "[relationship CollectingTripAuthorization.collectingTrip]",
      "CollectionObjectAttachment": "[relationship CollectionObjectAttachment.collectionObject]",
      "CollectionObjectAttr": "[relationship CollectionObjectAttr.collectionObject]",
      "CollectionObjectCitation": "[relationship CollectionObjectCitation.collectionObject]",
      "CollectionObjectProperty": "[relationship CollectionObjectProperty.collectionObject]",
      "Collector": "[relationship Collector.collectingEvent]",
      "CommonNameTx": "[relationship CommonNameTx.taxon]",
      "CommonNameTxCitation": "[relationship CommonNameTxCitation.commonNameTx]",
      "ConservDescriptionAttachment": "[relationship ConservDescriptionAttachment.conservDescription]",
      "ConservEventAttachment": "[relationship ConservEventAttachment.conservEvent]",
      "DNASequenceAttachment": "[relationship DNASequenceAttachment.dnaSequence]",
      "DNASequencingRun": "[relationship DNASequencingRun.dnaSequence]",
      "DNASequencingRunAttachment": "[relationship DNASequencingRunAttachment.dnaSequencingRun]",
      "DNASequencingRunCitation": "[relationship DNASequencingRunCitation.sequencingRun]",
      "DeaccessionAgent": "[relationship DeaccessionAgent.deaccession]",
      "DeaccessionAttachment": "[relationship DeaccessionAttachment.deaccession]",
      "DeterminationCitation": "[relationship DeterminationCitation.determination]",
      "Determiner": "[relationship Determiner.determination]",
      "DisposalAgent": "[relationship DisposalAgent.disposal]",
      "DisposalAttachment": "[relationship DisposalAttachment.disposal]",
      "DisposalPreparation": "[relationship DisposalPreparation.disposal]",
      "ExchangeInAttachment": "[relationship ExchangeInAttachment.exchangeIn]",
      "ExchangeInPrep": "[relationship ExchangeInPrep.exchangeIn]",
      "ExchangeOutAttachment": "[relationship ExchangeOutAttachment.exchangeOut]",
      "ExchangeOutPrep": "[relationship ExchangeOutPrep.exchangeOut]",
      "Exsiccata": "[relationship Exsiccata.referenceWork]",
      "ExsiccataItem": "[relationship ExsiccataItem.exsiccata]",
      "Extractor": "[relationship Extractor.dnaSequence]",
      "FieldNotebookAttachment": "[relationship FieldNotebookAttachment.fieldNotebook]",
      "FieldNotebookPage": "[relationship FieldNotebookPage.pageSet]",
      "FieldNotebookPageAttachment": "[relationship FieldNotebookPageAttachment.fieldNotebookPage]",
      "FieldNotebookPageSet": "[relationship FieldNotebookPageSet.fieldNotebook]",
      "FieldNotebookPageSetAttachment": "[relationship FieldNotebookPageSetAttachment.fieldNotebookPageSet]",
      "GeographyTreeDefItem": "[relationship GeographyTreeDefItem.treeDef]",
      "GeologicTimePeriodTreeDefItem": "[relationship GeologicTimePeriodTreeDefItem.treeDef]",
      "GiftAgent": "[relationship GiftAgent.gift]",
      "GiftAttachment": "[relationship GiftAttachment.gift]",
      "GiftPreparation": "[relationship GiftPreparation.gift]",
      "LatLonPolygon": "[relationship LatLonPolygon.locality]",
      "LatLonPolygonPnt": "[relationship LatLonPolygonPnt.latLonPolygon]",
      "LithoStratTreeDefItem": "[relationship LithoStratTreeDefItem.treeDef]",
      "LoanAgent": "[relationship LoanAgent.loan]",
      "LoanAttachment": "[relationship LoanAttachment.loan]",
      "LoanPreparation": "[relationship LoanPreparation.loan]",
      "LoanReturnPreparation": "[relationship LoanReturnPreparation.loanPreparation]",
      "LocalityAttachment": "[relationship LocalityAttachment.locality]",
      "LocalityCitation": "[relationship LocalityCitation.locality]",
      "LocalityDetail": "[relationship LocalityDetail.locality]",
      "MaterialSample": "[relationship MaterialSample.preparation]",
      "PcrPerson": "[relationship PcrPerson.dnaSequence]",
      "PermitAttachment": "[relationship PermitAttachment.permit]",
      "PickListItem": "[relationship PickListItem.pickList]",
      "PreparationAttachment": "[relationship PreparationAttachment.preparation]",
      "PreparationAttr": "[relationship PreparationAttr.preparation]",
      "PreparationProperty": "[relationship PreparationProperty.preparation]",
      "RecordSetItem": "[relationship RecordSetItem.recordSet]",
      "ReferenceWorkAttachment": "[relationship ReferenceWorkAttachment.referenceWork]",
      "RepositoryAgreementAttachment": "[relationship RepositoryAgreementAttachment.repositoryAgreement]",
      "SpAppResourceData": "[relationship SpAppResourceData.spAppResource]",
      "SpAuditLogField": "[relationship SpAuditLogField.spAuditLog]",
      "SpExportSchemaItem": "[relationship SpExportSchemaItem.spExportSchema]",
      "SpExportSchemaItemMapping": "[relationship SpExportSchemaItemMapping.exportSchemaItem]",
      "SpLocaleContainerItem": "[relationship SpLocaleContainerItem.container]",
      "SpQueryField": "[relationship SpQueryField.query]",
      "StorageAttachment": "[relationship StorageAttachment.storage]",
      "StorageTreeDefItem": "[relationship StorageTreeDefItem.treeDef]",
      "TaxonAttachment": "[relationship TaxonAttachment.taxon]",
      "TaxonCitation": "[relationship TaxonCitation.taxon]",
      "TaxonTreeDefItem": "[relationship TaxonTreeDefItem.treeDef]",
      "TreatmentEventAttachment": "[relationship TreatmentEventAttachment.treatmentEvent]",
      "WorkbenchRow": "[relationship WorkbenchRow.workbench]",
      "WorkbenchRowImage": "[relationship WorkbenchRowImage.workbenchRow]",
    }
  `));
