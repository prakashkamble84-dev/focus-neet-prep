import { useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { transitionHistoricalPaper } from '@/services/historicalPaperWorkflowService';
import ApperIcon from '@/components/ApperIcon';

export default function HistoricalPaperStatusAction({ paper, onSaved }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [saving, setSaving] = useState(false);

  const nextStatus = paper.status_c === 'Verified' ? 'Published' : 'Verified';
  if (!['New', 'Review', 'Verified'].includes(paper.status_c)) return null;
  const canVerify = profile === 'AcademicExpert_c';
  const canPublish = ['CEO', 'CEO_c', 'Manager', 'Manager_c'].includes(profile);
  if (nextStatus === 'Verified' && !canVerify) return null;
  if (nextStatus === 'Published' && !canPublish) return null;

  async function handleTransition() {
    setSaving(true);
    try {
      const result = await transitionHistoricalPaper(paper, nextStatus, user?.userId, profile);
      if (!result.success) {
        toast.error('Paper transition blocked', { description: result.message });
        return;
      }
      toast.success('Historical paper ' + nextStatus.toLowerCase() + '.');
      await onSaved?.();
    } catch (error) {
      toast.error('Paper transition failed', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleTransition}
      disabled={saving}
    >
      {saving ? (
        <ApperIcon name="LoaderCircle" size={14} className="mr-1.5 animate-spin" />
      ) : (
        <ApperIcon name={nextStatus === 'Published' ? 'Send' : 'ShieldCheck'} size={14} className="mr-1.5" />
      )}
      {saving ? 'Saving…' : nextStatus}
    </Button>
  );
}
