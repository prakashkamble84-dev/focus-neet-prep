import { useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { useAuth } from '@/layouts/RootLayout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import IndependentSourceVerificationDialog from '@/components/sources/IndependentSourceVerificationDialog';
import {
  completeIndependentSourceVerification
} from '@/services/sourceVerificationService';

const { eq } = window.ApperSDK.CoreSDK;

const VERIFICATION_FIELDS = [
  'Id',
  'Name',
  'document_version_c',
  'verification_type_c',
  'decision_c',
  'reviewer_user_c',
  'verified_at_c',
  'verification_notes_c',
  'independent_check_c'
];

export default function SourceIndependentVerificationController({
  version,
  document,
  authority,
  onCompleted
}) {
  const { user } = useAuth();
  const reviewerId = user?.userId;
  const [open, setOpen] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifications, setVerifications] = useState([]);

  const independentlyVerified = version?.ingestion_status_c === 'Verified' &&
    document?.verification_status_c === 'Verified' &&
    document?.ingestion_status_c === 'Complete';

  const primaryReviewerIds = useMemo(() => (
    [...new Set(verifications
      .filter((row) => ['Rights', 'Authority', 'Metadata'].includes(row.verification_type_c) &&
        row.decision_c === 'Verified' && row.independent_check_c !== true)
      .map((row) => row.reviewer_user_c?.Id || row.reviewer_user_c)
      .filter(Boolean)
      .map(String))]
  ), [verifications]);

  async function openReview() {
    if (!version?.Id || !document?.Id || !authority?.Id) {
      toast.error('The source version, parent document and issuing authority must all be linked before verification.');
      return;
    }
    setLoadingRecords(true);
    try {
      const result = await sdk.table('source_verification_records_c')
        .select(VERIFICATION_FIELDS)
        .where(eq('document_version_c', version.Id))
        .limit(200, 0)
        .fetch();
      if (!result.success) {
        toast.error(result.message || 'Could not load the first-pass verification history');
        return;
      }
      setVerifications(result.data || []);
      setOpen(true);
    } catch (error) {
      toast.error('Could not open independent verification', { description: error.message });
    } finally {
      setLoadingRecords(false);
    }
  }

  async function save(checks) {
    setSaving(true);
    try {
      const result = await completeIndependentSourceVerification({
        version,
        document,
        authority,
        verifications,
        reviewerId,
        checks
      });
      if (!result.success) {
        toast.error('Independent verification is blocked', {
          description: (result.issues || []).join('\n')
        });
        return;
      }
      toast.success(result.alreadyVerified
        ? 'Source version is already independently verified'
        : 'Independent source verification completed', {
        description: 'The source version and parent document are now marked Verified.'
      });
      setOpen(false);
      await onCompleted?.();
    } catch (error) {
      toast.error('Independent source verification failed', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {independentlyVerified ? (
        <span className="text-xs font-semibold text-success">Independently verified</span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openReview}
          disabled={loadingRecords || !reviewerId}
        >
          {loadingRecords ? 'Loading review history…' : 'Independent verification'}
        </Button>
      )}
      <IndependentSourceVerificationDialog
        open={open}
        onOpenChange={setOpen}
        version={version}
        document={document}
        authorityRecord={authority}
        verifications={verifications}
        reviewerId={reviewerId}
        saving={saving}
        onSave={save}
      />
      {primaryReviewerIds.length === 0 && !independentlyVerified && (
        <span className="basis-full text-xs text-muted-foreground">
          Complete first-pass rights, authority and metadata review before requesting independent verification.
        </span>
      )}
    </>
  );
}
