import { useEffect, useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';

const MAPPING_TYPES = ['Primary', 'Secondary', 'Prereq', 'Skill'];

export default function KnowledgeGraphMappingDialog({
  open,
  onOpenChange,
  questions,
  nodes,
  onSaved
}) {
  const [questionId, setQuestionId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [mappingType, setMappingType] = useState('Primary');
  const [confidence, setConfidence] = useState('');
  const [saving, setSaving] = useState(false);

  const concepts = useMemo(() => nodes.filter((node) => (
    node.node_type_c === 'Concept' && node.status_c !== 'Retired'
  )), [nodes]);

  useEffect(() => {
    if (!open) return;
    setQuestionId('');
    setNodeId('');
    setMappingType('Primary');
    setConfidence('');
  }, [open]);

  async function save() {
    const question = questions.find((item) => String(item.Id) === String(questionId));
    const concept = concepts.find((item) => String(item.Id) === String(nodeId));
    if (!question || !concept) {
      toast.error('Choose an existing question and concept');
      return;
    }
    const score = confidence.trim() ? Number(confidence) : null;
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 1)) {
      toast.error('Confidence must be between 0 and 1');
      return;
    }

    const exists = await sdk.table('question_concept_mappings_c')
      .select(['Id', 'question_c', 'curriculum_node_c', 'mapping_type_c', 'status_c'])
      .limit(4000, 0).fetch();
    if (!exists.success) {
      toast.error(exists.message || 'Could not check for duplicate mappings');
      return;
    }
    const duplicate = (exists.data || []).some((item) => (
      String(item.question_c?.Id || item.question_c) === String(question.Id) &&
      String(item.curriculum_node_c?.Id || item.curriculum_node_c) === String(concept.Id) &&
      item.mapping_type_c === mappingType &&
      item.status_c !== 'Rejected'
    ));
    if (duplicate) {
      toast.error('This question-to-concept mapping already exists');
      return;
    }

    setSaving(true);
    try {
      const result = await sdk.table('question_concept_mappings_c').create({
        Name: (question.Name || 'Question ' + question.Id) + ' → ' + concept.Name + ' · ' + mappingType,
        question_c: question.Id,
        curriculum_node_c: concept.Id,
        mapping_type_c: mappingType,
        confidence_c: score,
        verified_c: false,
        status_c: 'Review'
      });
      if (!result.data?.length) {
        toast.error(result.messages?.join('; ') || result.message || 'Question mapping was not saved');
        return;
      }
      toast.success('Question mapping saved in Review');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Question mapping could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Map a question to a concept</DialogTitle>
          <DialogDescription>
            This creates a review-gated link between an existing question record and a Concept node. It does not change the question or mark the mapping verified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Question</Label>
            <Select value={questionId} onValueChange={setQuestionId}>
              <SelectTrigger><SelectValue placeholder="Choose a question" /></SelectTrigger>
              <SelectContent>
                {questions.map((question) => (
                  <SelectItem key={question.Id} value={String(question.Id)}>
                    {question.Name || 'Question ' + question.Id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Concept</Label>
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger><SelectValue placeholder="Choose a concept" /></SelectTrigger>
              <SelectContent>
                {concepts.map((node) => (
                  <SelectItem key={node.Id} value={String(node.Id)}>
                    {node.node_path_c || node.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mapping role</Label>
            <Select value={mappingType} onValueChange={setMappingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAPPING_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Confidence (optional, 0–1)</Label>
            <Input type="number" min="0" max="1" step="0.01" value={confidence} onChange={(event) => setConfidence(event.target.value)} placeholder="Leave blank until assessed" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !questions.length || !concepts.length}>
            {saving ? 'Saving…' : 'Save mapping in Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
