import { evaluateIndependentSourceVerification } from '@/services/sourceVerificationService';
import { evaluateSyllabusPublication } from '@/services/syllabusPublicationService';

export function runSourceLifecycleSelfTests() {
  const modifiedAt = '2026-11-13T09:00:00.000Z';
  const firstPassAt = '2026-11-13T10:00:00.000Z';
  const independentAt = '2026-11-13T11:00:00.000Z';
  const version = {
    Id: 'VERSION-1',
    ModifiedOn: modifiedAt,
    source_document_c: 'DOCUMENT-1',
    source_registry_c: 'AUTHORITY-1',
    document_file_c: [{ Name: 'official-syllabus.pdf' }],
    document_url_c: 'https://nta.ac.in/documents/syllabus.pdf',
    rights_status_c: 'Public',
    ingestion_status_c: 'Retrieved'
  };
  const document = {
    Id: 'DOCUMENT-1',
    source_registry_c: 'AUTHORITY-1',
    official_url_c: 'https://nta.ac.in/documents/syllabus.pdf',
    rights_status_c: 'Public',
    verification_status_c: 'Review',
    ingestion_status_c: 'Extracted'
  };
  const authority = {
    Id: 'AUTHORITY-1',
    official_domain_c: 'nta.ac.in',
    is_authoritative_c: true,
    active_c: true
  };
  const firstPass = ['Rights', 'Authority', 'Metadata'].map((type) => ({
    Id: 'FIRST-' + type,
    document_version_c: 'VERSION-1',
    verification_type_c: type,
    decision_c: 'Verified',
    reviewer_user_c: 'REVIEWER-A',
    verified_at_c: firstPassAt,
    independent_check_c: false
  }));
  const independent = ['Rights', 'Authority', 'Metadata'].map((type) => ({
    Id: 'SECOND-' + type,
    document_version_c: 'VERSION-1',
    verification_type_c: type,
    decision_c: 'Verified',
    reviewer_user_c: 'REVIEWER-B',
    verified_at_c: independentAt,
    independent_check_c: true
  }));
  const checks = {
    authority: true,
    metadata: true,
    rights: true,
    pdfIntegrity: true,
    officialOriginConfirmed: false,
    notes: 'Verified against the official NTA document listing and PDF.'
  };
  const tests = [];
  const assert = (name, condition, detail) => tests.push({ name, passed: Boolean(condition), detail });

  const validIndependent = evaluateIndependentSourceVerification({
    version,
    document,
    authority,
    verifications: firstPass,
    reviewerId: 'REVIEWER-B',
    checks
  });
  assert(
    'Allows a distinct second reviewer with complete first-pass evidence',
    validIndependent.valid,
    'All three first-pass checks, stored PDF, permitted rights and official URL are present.'
  );
  assert(
    'Blocks first reviewer from independently verifying',
    !evaluateIndependentSourceVerification({
      version, document, authority, verifications: firstPass,
      reviewerId: 'REVIEWER-A', checks
    }).valid,
    'The first-pass reviewer cannot independently approve their own source.'
  );
  assert(
    'Blocks missing private PDF',
    !evaluateIndependentSourceVerification({
      version: { ...version, document_file_c: [] }, document, authority,
      verifications: firstPass, reviewerId: 'REVIEWER-B', checks
    }).valid,
    'A URL alone is not a stored, reviewed source artifact.'
  );
  assert(
    'Blocks mismatched rights decisions',
    !evaluateIndependentSourceVerification({
      version, document: { ...document, rights_status_c: 'Licensed' }, authority,
      verifications: firstPass, reviewerId: 'REVIEWER-B', checks
    }).valid,
    'The document and version must agree on Public or Licensed use.'
  );
  assert(
    'Blocks inactive or non-authoritative issuers',
    !evaluateIndependentSourceVerification({
      version, document, authority: { ...authority, active_c: false },
      verifications: firstPass, reviewerId: 'REVIEWER-B', checks
    }).valid,
    'An inactive authority cannot pass the source verification gate.'
  );
  assert(
    'Blocks stale first-pass reviews after a source edit',
    !evaluateIndependentSourceVerification({
      version: { ...version, ModifiedOn: '2026-11-13T12:00:00.000Z' },
      document, authority, verifications: firstPass,
      reviewerId: 'REVIEWER-B', checks
    }).valid,
    'A source version edited after the first-pass review must be reviewed again.'
  );
  assert(
    'Requires official-origin confirmation for a CDN-hosted PDF',
    !evaluateIndependentSourceVerification({
      version: { ...version, document_url_c: 'https://cdn.example.net/syllabus.pdf' },
      document, authority, verifications: firstPass, reviewerId: 'REVIEWER-B', checks
    }).valid,
    'A non-authority CDN URL needs explicit confirmation that the official site links to it.'
  );
  assert(
    'Allows CDN hosting only after official-origin confirmation',
    evaluateIndependentSourceVerification({
      version: { ...version, document_url_c: 'https://cdn.example.net/syllabus.pdf' },
      document, authority, verifications: firstPass, reviewerId: 'REVIEWER-B',
      checks: { ...checks, officialOriginConfirmed: true }
    }).valid,
    'A CDN can be accepted only with a recorded official-site provenance confirmation.'
  );
  assert(
    'Blocks unreviewed first-pass metadata',
    !evaluateIndependentSourceVerification({
      version, document, authority,
      verifications: firstPass.map((row) => row.verification_type_c === 'Metadata' ? { ...row, decision_c: 'NeedsFix' } : row),
      reviewerId: 'REVIEWER-B', checks
    }).valid,
    'Every latest first-pass rights, authority and metadata check must be Verified.'
  );

  const syllabus = {
    Id: 'SYLLABUS-1',
    source_document_c: 'DOCUMENT-1',
    source_document_version_c: 'VERSION-1',
    status_c: 'Review'
  };
  const publishedSourceVersion = {
    ...version,
    ModifiedOn: '2026-11-13T10:30:00.000Z',
    source_document_c: 'DOCUMENT-1',
    ingestion_status_c: 'Verified'
  };
  const publishedDocument = {
    ...document,
    rights_status_c: 'Public',
    verification_status_c: 'Verified',
    ingestion_status_c: 'Complete'
  };
  const publicationVerifications = [...firstPass, ...independent];
  const evaluatePublication = (overrides = {}) => evaluateSyllabusPublication({
    syllabus,
    sourceVersion: publishedSourceVersion,
    sourceDocument: publishedDocument,
    authority,
    verifications: publicationVerifications,
    reviewerId: 'REVIEWER-B',
    ...overrides
  });

  assert(
    'Allows an academic publisher after independent two-person verification',
    evaluatePublication({ reviewerId: 'REVIEWER-C' }).valid,
    'The first-pass reviewer, independent checker and authorised publisher may be three distinct people.'
  );
  assert(
    'Allows the independent reviewer to publish when authorised',
    evaluatePublication({ reviewerId: 'REVIEWER-B' }).valid,
    'An independent reviewer may also publish when their profile has syllabus update permission.'
  );
  assert(
    'Blocks first-pass reviewer from publishing',
    !evaluatePublication({ reviewerId: 'REVIEWER-A' }).valid,
    'The source reviewer cannot publish the syllabus.'
  );
  assert(
    'Blocks missing approval evidence or a private PDF',
    !evaluatePublication({
      sourceVersion: { ...publishedSourceVersion, document_file_c: [] }
    }).valid,
    'Syllabus publication requires an attached, privately stored PDF.'
  );
  assert(
    'Blocks mismatched source document linkage',
    !evaluatePublication({
      syllabus: { ...syllabus, source_document_c: 'OTHER-DOCUMENT' }
    }).valid,
    'The syllabus, source version and parent document must match.'
  );
  assert(
    'Blocks independent checks that predate a later source-version edit',
    !evaluatePublication({
      sourceVersion: { ...publishedSourceVersion, ModifiedOn: '2026-11-13T12:00:00.000Z' }
    }).valid,
    'The latest second-person verification must be newer than the final source-version edit.'
  );
  assert(
    'Blocks a changed issuing-authority link',
    !evaluatePublication({
      sourceDocument: { ...publishedDocument, source_registry_c: 'OTHER-AUTHORITY' }
    }).valid,
    'An independent check cannot be reused after the document is relinked to a different issuing authority.'
  );

  return {
    passed: tests.filter((test) => test.passed).length,
    failed: tests.filter((test) => !test.passed).length,
    tests
  };
}
