import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/sources', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Academic sources', icon: 'FileCheck2', group: 'Research', order: 110 };

export default function Sources() {
  return (
    <ModuleWorkspace
      eyebrow="Provenance and verification"
      title="Official academic source registry"
      summary="Keep a traceable record of the authorities, documents, versions, effective dates, and page references behind the platform's academic content."
      phase="Phase 2"
      status="Registry not configured"
      statusTone="review"
      capabilities={[
        'NTA, JEE Advanced, NMC, NCERT, and Ministry source records',
        'Official PDFs, bulletins, answer keys, sample papers, and notices',
        'Document versioning and page-level extraction provenance',
        'OCR confidence and mathematical or diagram extraction review',
        'Rights and permitted-use tracking',
        'Human verification and superseded-source history'
      ]}
      prerequisites={['Source schema', 'Document storage', 'OCR and extraction pipeline', 'Academic reviewers']}
      nextPath="/curriculum"
      nextLabel="Open curriculum workspace"
      note="Public availability is not the same as permission to redistribute. Rights metadata and content-use decisions must be recorded before publishing material."
    />
  );
}
