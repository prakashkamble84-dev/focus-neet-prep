import { useState } from 'react';
import { toast } from 'sonner';
import { useFetch } from '@/hooks/useFetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import {
  fetchQuestionBankGovernance,
  getLookupId,
  getLookupName
} from '@/services/questionBankService';
import {
  createQuestionConceptMapping,
  verifyQuestionConceptMapping
} from '@/services/questionMappingService';

const ACADEMIC_EDITORS = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];

function readSnapshot(snapshotJson) {
  try {
    return JSON.parse(snapshotJson || '{}');
  } catch {
    return null;
  }
}

function MappingStatus({ mapping }) {
  if (mapping.status_c === 'Verified' && mapping.verified_c === true) {
    return <Badge variant="secondary">Verified</Badge>;
  }

  if (mapping.status_c === 'Rejected') {
    return <Badge variant="destructive">Rejected</Badge>;
  }

  return <Badge variant="outline">{mapping.status_c || 'Review'}</Badge>;
}

export default function QuestionBankGovernancePanel({
  question,
  profile,
  userId,
  refreshKey = 0
}) {
  const canEditMappings = ACADEMIC_EDITORS.includes(profile) &&
    ['Draft', 'Review'].includes(question?.status_c);
  const canVerifyMappings = profile === 'AcademicExpert_c' &&
    ['Draft', 'Review'].includes(question?.status_c);
  const [nodeId, setNodeId] = useState('');
  const [mappingType, setMappingType] = useState('Primary');
  const [confidence, setConfidence] = useState('0.8');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeMappingId, setActiveMappingId] = useState('');

  const {
    data,
    loading,
    error,
    run
  } = useFetch(
    () => fetchQuestionBankGovernance(question.Id),
    [question.Id, refreshKey]
  );

  const nodes = data?.nodes || [];
  const mappings = data?.mappings || [];
  const versions = data?.versions || [];
  const nodeNames = new Map(nodes.map((node) => [String(node.Id), node.Name]));

  async function proposeMapping() {
    if (!nodeId || !reason.trim()) {
      toast.error('Choose a verified concept and explain the mapping.');
      return;
    }

    setSaving(true);
    setActiveMappingId('new');
    try {
      const result = await createQuestionConceptMapping({
        questionId: question.Id,
        nodeId,
        mappingType,
        confidence,
        reason,
        reviewerId: userId,
        reviewerProfile: profile
      });

      if (!result.success) {
        toast.error('Concept mapping was not saved', { description: result.message });
        return;
      }

      toast.success(result.message);
      if (result.warning) {
        toast.warning('Version snapshot needs attention', { description: result.warning });
      }
      setReason('');
      setNodeId('');
      await run();
    } catch (mappingError) {
      toast.error('Concept mapping failed', { description: mappingError.message });
    } finally {
      setSaving(false);
      setActiveMappingId('');
    }
  }

  async function verifyMapping(mapping) {
    if (!reason.trim()) {
      toast.error('Add a note describing the independent concept check.');
      return;
    }

    setSaving(true);
    setActiveMappingId(String(mapping.Id));
    try {
      const result = await verifyQuestionConceptMapping({
        questionId: question.Id,
        mappingId: mapping.Id,
        reviewerId: userId,
        reviewerProfile: profile,
        notes: reason
      });

      if (!result.success) {
        toast.error('Mapping verification was blocked', { description: result.message });
        return;
      }

      toast.success(result.message);
      if (result.warning) {
        toast.warning('Version snapshot needs attention', { description: result.warning });
      }
      setReason('');
      await run();
    } catch (mappingError) {
      toast.error('Mapping verification failed', { description: mappingError.message });
    } finally {
      setSaving(false);
      setActiveMappingId('');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-base">Question bank governance</CardTitle>
        <CardDescription>
          Question edits are captured as version snapshots. Concept mappings are separate records and remain unusable for verified analytics until an Academic Expert checks them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={run}>Retry governance data</Button>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Version history</h3>
                  <p className="text-xs text-muted-foreground">Committed snapshots only. Pending or abandoned writes are not presented as committed versions.</p>
                </div>
                <Badge variant="outline">{versions.length} version(s)</Badge>
              </div>

              {versions.length ? (
                <div className="space-y-2">
                  {versions.map((version) => {
                    const snapshot = readSnapshot(version.snapshot_json_c);
                    const priorQuestion = snapshot?.question || {};
                    const answerText = priorQuestion.answer_key_c
                      ? 'Answer key: ' + priorQuestion.answer_key_c
                      : 'Answer key not yet recorded';

                    return (
                      <details key={version.Id} className="rounded-md border border-border bg-background p-3">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            v{version.version_number_c} · {version.change_kind_c}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {version.CreatedOn ? new Date(version.CreatedOn).toLocaleString() : 'Date unavailable'}
                          </span>
                        </summary>
                        <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                          <p className="font-medium text-foreground">{version.change_reason_c}</p>
                          <p>Prior status: {priorQuestion.status_c || 'Not recorded'} · Prior difficulty: {priorQuestion.difficulty_c || 'Not recorded'}</p>
                          <p>{answerText}</p>
                          <p>Prior options: {snapshot?.options?.length ?? 0} · Prior concept mappings: {snapshot?.mappings?.length ?? 0}</p>
                          {priorQuestion.question_body_c && (
                            <p className="whitespace-pre-wrap rounded bg-muted/40 p-2">{priorQuestion.question_body_c}</p>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No committed question versions yet. The first editorial change will create a baseline snapshot.
                </p>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Concept mappings</h3>
                  <p className="text-xs text-muted-foreground">Only mappings linked to a Published, verified Concept node can be approved.</p>
                </div>
                <Badge variant="outline">{mappings.length} mapping(s)</Badge>
              </div>

              {mappings.length ? (
                <div className="space-y-2">
                  {mappings.map((mapping) => {
                    const targetId = getLookupId(mapping.curriculum_node_c);
                    const targetName = getLookupName(mapping.curriculum_node_c) ||
                      nodeNames.get(String(targetId)) ||
                      'Concept record unavailable';

                    return (
                      <div key={mapping.Id} className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold">{targetName}</p>
                          <p className="text-xs text-muted-foreground">
                            {mapping.mapping_type_c || 'Unclassified'} · Confidence {Number(mapping.confidence_c ?? 0).toFixed(2)} · {mapping.verified_c === true ? 'Verified mapping' : 'Not verified'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <MappingStatus mapping={mapping} />
                          {canVerifyMappings && ['Draft', 'Review'].includes(mapping.status_c) && mapping.verified_c !== true && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => verifyMapping(mapping)}
                              disabled={saving}
                            >
                              {saving && activeMappingId === String(mapping.Id) ? 'Verifying…' : 'Verify'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No concept mappings have been linked to this question.</p>
              )}
            </section>

            {canEditMappings && (
              <section className="space-y-3 rounded-md border border-border bg-muted/15 p-4">
                <div>
                  <h3 className="font-semibold">Propose a concept mapping</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Select a Published and expert-verified Concept node. Proposed mappings enter Review and do not affect learning analytics until independently verified.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="question-mapping-node">Verified concept</Label>
                    <select
                      id="question-mapping-node"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={nodeId}
                      onChange={(event) => setNodeId(event.target.value)}
                      disabled={saving}
                    >
                      <option value="">Choose a concept</option>
                      {nodes.map((node) => (
                        <option key={node.Id} value={node.Id}>
                          {node.subject_c ? node.subject_c + ' · ' : ''}{node.node_path_c || node.Name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="question-mapping-type">Mapping type</Label>
                    <select
                      id="question-mapping-type"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={mappingType}
                      onChange={(event) => setMappingType(event.target.value)}
                      disabled={saving}
                    >
                      <option value="Primary">Primary</option>
                      <option value="Secondary">Secondary</option>
                      <option value="Prereq">Prerequisite</option>
                      <option value="Skill">Skill</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="question-mapping-confidence">Confidence (0–1)</Label>
                    <input
                      id="question-mapping-confidence"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={confidence}
                      onChange={(event) => setConfidence(event.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="question-mapping-reason">Evidence and rationale</Label>
                    <textarea
                      id="question-mapping-reason"
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Explain which concepts, principles or syllabus outcomes this question tests."
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Mapping proposal creates a version snapshot and an audit review event.</p>
                  <Button type="button" onClick={proposeMapping} disabled={saving || !nodeId || !reason.trim()}>
                    {saving && activeMappingId === 'new'
                      ? <ApperIcon name="LoaderCircle" size={14} className="mr-2 animate-spin" />
                      : <ApperIcon name="Plus" size={14} className="mr-2" />}
                    Save mapping proposal
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
