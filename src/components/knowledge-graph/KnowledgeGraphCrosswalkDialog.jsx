import { useEffect, useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
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

const MAPPING_TYPES = ['Same', 'Modified', 'Split', 'Merge', 'Removed', 'Added', 'Related'];

function getId(value) {
  return value && typeof value === 'object' ? value.Id : value;
}

export default function KnowledgeGraphCrosswalkDialog({
  open,
  onOpenChange,
  syllabusVersions,
  nodes,
  onSaved
}) {
  const [sourceVersionId, setSourceVersionId] = useState('');
  const [targetVersionId, setTargetVersionId] = useState('');
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [mappingType, setMappingType] = useState('Same');
  const [confidence, setConfidence] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const sourceNodes = useMemo(() => nodes.filter((node) => (
    String(getId(node.syllabus_version_c)) === String(sourceVersionId)
  )), [nodes, sourceVersionId]);
  const sourceVersion = syllabusVersions.find((item) => String(item.Id) === String(sourceVersionId));
  const targetVersionOptions = useMemo(() => syllabusVersions.filter((item) => (
    sourceVersion &&
    String(getId(item.examination_c)) === String(getId(sourceVersion.examination_c)) &&
    String(item.Id) !== String(sourceVersion.Id) &&
    Number(item.academic_year_c || 0) >= Number(sourceVersion.academic_year_c || 0)
  )), [syllabusVersions, sourceVersion]);

  const targetNodes = useMemo(() => nodes.filter((node) => (
    String(getId(node.syllabus_version_c)) === String(targetVersionId)
  )), [nodes, targetVersionId]);

  useEffect(() => {
    if (!open) return;
    const ordered = [...syllabusVersions].sort((a, b) => Number(a.academic_year_c || 0) - Number(b.academic_year_c || 0));
    let pair = null;
    for (const source of ordered) {
      const target = ordered
        .filter((item) => (
          String(getId(item.examination_c)) === String(getId(source.examination_c)) &&
          String(item.Id) !== String(source.Id) &&
          Number(item.academic_year_c || 0) >= Number(source.academic_year_c || 0)
        ))
        .sort((a, b) => Number(b.academic_year_c || 0) - Number(a.academic_year_c || 0))[0];
      if (target) {
        pair = [source, target];
        break;
      }
    }
    setSourceVersionId(pair ? String(pair[0].Id) : '');
    setTargetVersionId(pair ? String(pair[1].Id) : '');
    setSourceNodeId('');
    setTargetNodeId('');
    setMappingType('Same');
    setConfidence('');
    setNotes('');
  }, [open, syllabusVersions]);

  async function save() {
    const source = syllabusVersions.find((item) => String(item.Id) === String(sourceVersionId));
    const target = syllabusVersions.find((item) => String(item.Id) === String(targetVersionId));
    if (!source || !target || sourceVersionId === targetVersionId) {
      toast.error('Choose two different syllabus versions');
      return;
    }
    if (String(getId(source.examination_c)) !== String(getId(target.examination_c))) {
      toast.error('Historical crosswalks compare versions of the same examination. Use concept relationships for cross-exam links.');
      return;
    }
    if (Number(source.academic_year_c || 0) > Number(target.academic_year_c || 0)) {
      toast.error('Choose an older/equal source version and a newer/equal target version');
      return;
    }
    const sourceNode = sourceNodeId
      ? sourceNodes.find((node) => String(node.Id) === String(sourceNodeId))
      : null;
    const targetNode = targetNodeId
      ? targetNodes.find((node) => String(node.Id) === String(targetNodeId))
      : null;

    if (mappingType === 'Removed' && !sourceNode) {
      toast.error('A Removed mapping needs a source node');
      return;
    }
    if (mappingType === 'Added' && !targetNode) {
      toast.error('An Added mapping needs a target node');
      return;
    }
    if (!['Removed', 'Added'].includes(mappingType) && (!sourceNode || !targetNode)) {
      toast.error('Choose both source and target nodes for this mapping type');
      return;
    }

    const score = confidence.trim() ? Number(confidence) : null;
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 1)) {
      toast.error('Confidence must be between 0 and 1');
      return;
    }
    if (!notes.trim()) {
      toast.error('Add evidence or reasoning for the historical mapping');
      return;
    }

    setSaving(true);
    try {
      const label = (sourceNode?.Name || 'No source node') + ' → ' + (targetNode?.Name || 'No target node');
      const result = await sdk.table('historical_syllabus_crosswalks_c').create({
        Name: label + ' · ' + mappingType,
        source_version_c: sourceVersionId,
        target_version_c: targetVersionId,
        source_node_c: sourceNode?.Id || null,
        target_node_c: targetNode?.Id || null,
        mapping_type_c: mappingType,
        confidence_c: score,
        status_c: 'Review',
        mapping_notes_c: notes.trim()
      });
      if (!result.data?.length) {
        toast.error(result.messages?.join('; ') || result.message || 'Historical crosswalk was not saved');
        return;
      }
      toast.success('Historical crosswalk created in Review');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Historical crosswalk could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Map a historical syllabus version</DialogTitle>
          <DialogDescription>
            Historical mappings stay separate from the current syllabus. New crosswalks begin in Review and do not make old topics current.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Source syllabus version</Label>
            <Select value={sourceVersionId} onValueChange={(value) => {
              setSourceVersionId(value);
              setSourceNodeId('');
            }}>
              <SelectTrigger><SelectValue placeholder="Older / source version" /></SelectTrigger>
              <SelectContent>
                {syllabusVersions.map((item) => (
                  <SelectItem key={item.Id} value={String(item.Id)}>
                    {item.version_label_c || item.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target syllabus version · same examination</Label>
            <Select value={targetVersionId} onValueChange={(value) => {
              setTargetVersionId(value);
              setTargetNodeId('');
            }}>
              <SelectTrigger><SelectValue placeholder="Newer / target version" /></SelectTrigger>
              <SelectContent>
                {targetVersionOptions.map((item) => (
                  <SelectItem key={item.Id} value={String(item.Id)}>
                    {item.version_label_c || item.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mapping type</Label>
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
          {mappingType !== 'Added' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Source syllabus node</Label>
              <Select value={sourceNodeId} onValueChange={setSourceNodeId}>
                <SelectTrigger><SelectValue placeholder="Choose source node" /></SelectTrigger>
                <SelectContent>
                  {sourceNodes.map((node) => (
                    <SelectItem key={node.Id} value={String(node.Id)}>
                      {node.node_path_c || node.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {mappingType !== 'Removed' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Target syllabus node</Label>
              <Select value={targetNodeId} onValueChange={setTargetNodeId}>
                <SelectTrigger><SelectValue placeholder="Choose target node" /></SelectTrigger>
                <SelectContent>
                  {targetNodes.map((node) => (
                    <SelectItem key={node.Id} value={String(node.Id)}>
                      {node.node_path_c || node.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Evidence / explanation</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Explain what changed between versions. Reference exact syllabus source pages where possible." />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || syllabusVersions.length < 2}>
            {saving ? 'Saving…' : 'Save crosswalk in Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
