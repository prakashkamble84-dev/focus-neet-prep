import { sdk } from '@/services/sdk';

export async function fetchSourceAuthorities() {
  const result = await sdk.table('source_registry_c')
    .select(['Id', 'Name', 'source_code_c', 'organisation_name_c', 'organisation_type_c', 'official_domain_c', 'website_url_c', 'jurisdiction_c', 'authority_scope_c', 'is_authoritative_c', 'active_c', 'last_verified_at_c'])
    .limit(100, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load official authorities');
  return result.data ?? [];
}

export async function fetchSourceDocuments() {
  const result = await sdk.table('source_documents_c')
    .select(['Id', 'Name', 'examination_c', 'source_registry_c', 'source_category_c', 'document_type_c', 'official_url_c', 'published_date_c', 'effective_date_c', 'academic_year_c', 'document_version_c', 'rights_status_c', 'verification_status_c', 'ingestion_status_c', 'review_notes_c'])
    .limit(200, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load source documents');
  return result.data ?? [];
}

export async function fetchSourceVersions() {
  const result = await sdk.table('source_document_versions_c')
    .select(['Id', 'Name', 'source_document_c', 'source_registry_c', 'version_label_c', 'official_title_c', 'document_url_c', 'document_file_c', 'publication_date_c', 'effective_date_c', 'rights_status_c', 'rights_notes_c', 'ingestion_status_c', 'version_status_c', 'academic_year_c', 'change_summary_c'])
    .limit(200, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load source document versions');
  return result.data ?? [];
}
