import { useEffect, useState } from 'react';
import { sdk } from '@/services/sdk';
import { validateProposedRelationship } from '@/services/knowledgeGraphRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const TYPES = [
  { value: 'Prereq', label: 'Prerequisite' },
  { value: 'Related', label: 'Related concept' },
  { value: 'Extends', label: 'Extends / deepens' },
  { value: 'Applies', label: 'Applied in' },
  { value: 'Confused', label: 'Commonly confused with' }
];

export default function KnowledgeGraphRelationshipDialog({
  open,
  onOpenChange,
  nodes,
  relationships,
  onSaved
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [type, setType] = useState('Prereq');
  const [confidence, setConfidence] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const concepts = nodes.filter((node) => node.node_type_c === 'Concept' && node.status_c !== 'Retired');

  useEffect(() => {
    if (!open) return;
    setFromId('');
    setToId('');
    setType('Prereq');
    setConfidence('');
    setNotes('');
  }, [open]);

  async function save() {
    const validation = validateProposedRelationship(nodes, relationships, fromId, toId, type);
    if (!validation.valid) {
      toast.error(validation.reason);
      return;
    }
    const value = confidence.trim() ? Number(confidence) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
      toast.error('Confidence must be between 0 and 1');
      return;
    }

    const fromNode = concepts.find((node) => String(node.Id) === String(fromId));
    const toNode = concepts.find((node) => String(node.Id) === String(toId));
    if (fromNode.subject_c !== toNode.subject_c && type === 'Prereq') {
      toast.error('Cross-subject prerequisite edges need an explicit academic review. Use Related or Extends until reviewed.');
      return;
    }

    setSaving(true);
    try {
      const direction = ['Related', 'Confused'].includes(type) ? 'Symmetric' : 'Forward';
      const result = await sdk.table('concept_relationships_c').create({
        Name: fromNode.Name + ' → ' + toNode.Name + ' · ' + type,
        from_node_c: fromNode.Id,
        to_node_c: toNode.Id,
        relationship_type_c: type,
        direction_c: direction,
        confidence_c: value,
        status_c: 'Review',
        review_notes_c: notes.trim() || 'Proposed relationship; independent academic verification required.'
      });
      if (!result.data?.length) {
        toast.error(result.messages?.join('; ') || result.message || 'Relationship was not saved');
        return;
      }
      toast.success(type === 'Prereq'
        ? 'Prerequisite saved in Review. Direction is prerequisite → dependent concept.'
        : 'Concept relationship saved in Review.');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Relationship could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect two concepts</DialogTitle>
          <DialogDescription>
            New edges are stored in Review. A prerequisite edge points from the prerequisite to the concept that requires it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Relationship type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{type === 'Prereq' ? 'Prerequisite concept (from)' : 'From concept'}</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger><SelectValue placeholder="Select first concept" /></SelectTrigger>
              <SelectContent>
                {concepts.map((node) => (
                  <SelectItem key={node.Id} value={String(node.Id)}>{node.node_path_c || node.Name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{type === 'Prereq' ? 'Dependent concept (to)' : 'To concept'}</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger><SelectValue placeholder="Select second concept" /></SelectTrigger>
              <SelectContent>
                {concepts.map((node) => (
                  <SelectItem key={node.Id} value={String(node.Id)}>{node.node_path_c || node.Name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Confidence (optional, 0–1)</Label>
            <Input type="number" min="0" max="1" step="0.01" value={confidence} onChange={(event) => setConfidence(event.target.value)} placeholder="Leave blank until assessed" />
          </div>
          <div className="space-y-2">
            <Label>Academic rationale / evidence</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Explain why the dependency or relationship exists and cite evidence where possible." />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || concepts.length < 2}>
            {saving ? 'Saving…' : 'Save relationship in Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
