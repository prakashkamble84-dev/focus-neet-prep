import { useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { publishSyllabusVersion } from '@/services/syllabusPublicationService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';

function Status({ value }) {
  const tone = ['Published', 'Verified', 'Approved'].includes(value)
    ? 'border-success/30 bg-success/10 text-success'
    : value === 'Rejected'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-warning/30 bg-warning/10 text-warning-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

export default function CurriculumSyllabusVersionRow({ syllabus, nodeCount, canPublish, onRefresh }) {
  const { user } = useAuth();
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    setPublishing(true);
    try {
      const result = await publishSyllabusVersion(syllabus.Id, user?.userId);
      if (!result.success) {
        toast.warning('Syllabus publication is blocked', {
          description: (result.issues || []).join('\n')
        });
        return;
      }
      toast.success(result.alreadyPublished ? 'Syllabus is already published' : 'Syllabus published', {
        description: result.message
      });
      await onRefresh?.();
    } catch (error) {
      toast.error('Syllabus publication failed', { description: error.message });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{syllabus.version_label_c || syllabus.Name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {syllabus.examination_c?.Name || 'Examination'} · Academic year {syllabus.academic_year_c || 'not set'}
        </p>
        {syllabus.change_summary_c && <p className="mt-1 text-xs leading-5 text-muted-foreground">{syllabus.change_summary_c}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">{nodeCount} nodes</span>
        <Status value={syllabus.status_c} />
        {canPublish && syllabus.status_c !== 'Published' && (
          <Button size="sm" onClick={publish} disabled={publishing}>
            <ApperIcon name="ShieldCheck" size={14} />
            {publishing ? 'Checking evidence…' : 'Publish syllabus'}
          </Button>
        )}
      </div>
    </div>
  );
}
