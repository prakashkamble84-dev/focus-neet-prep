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

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

function getId(value) {
  return value && typeof value === 'object' ? value.Id : value;
}

export default function KnowledgeGraphNodeDialog({
  open,
  onOpenChange,
  syllabusVersions,
  nodes,
  sourceVersions,
  onSaved
}) {
  const [name, setName] = useState('');
  const [syllabusId, setSyllabusId] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [parentId, setParentId] = useState('');
  const [nodeCode, setNodeCode] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [difficulty, setDifficulty] = useState('Moderate');
  const [sourceVersionId, setSourceVersionId] = useState('');
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [sourceExcerpt, setSourceExcerpt] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedSyllabus = syllabusVersions.find((item) => String(item.Id) === String(syllabusId));
  const parentOptions = useMemo(() => nodes.filter((node) => {
    const versionId = getId(node.syllabus_version_c);
    const sameVersion = !syllabusId || !versionId || String(versionId) === String(syllabusId);
    const canContain = ['Topic', 'Subtopic', 'Concept'].includes(node.node_type_c);
    return sameVersion && canContain && node.status_c !== 'Retired';
  }), [nodes, syllabusId]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSyllabusId(syllabusVersions[0] ? String(syllabusVersions[0].Id) : '');
    setSubject('Physics');
    setParentId('');
    setNodeCode('');
    setDescription('');
    setObjectives('');
    setDifficulty('Moderate');
    setSourceVersionId('');
    setPageStart('');
    setPageEnd('');
    setSourceExcerpt('');
  }, [open, syllabusVersions]);

  useEffect(() => {
    if (!name.trim() || !selectedSyllabus) {
      setNodeCode('');
      return;
    }
    const code = [
      slug(selectedSyllabus.version_label_c || selectedSyllabus.Name).slice(0, 24),
      slug(subject),
      slug(name).slice(0, 42)
    ].filter(Boolean).join('-');
    setNodeCode(code);
  }, [name, selectedSyllabus, subject]);

  async function save() {
    if (!selectedSyllabus) {
      toast.error('Register a syllabus version before adding syllabus-linked concepts');
      return;
    }
    if (!name.trim() || !subject || !nodeCode) {
      toast.error('Enter the concept name and subject');
      return;
    }
    if (!parentId) {
      toast.error('Choose the parent topic, subtopic or concept');
      return;
    }

    const parent = parentOptions.find((item) => String(item.Id) === String(parentId));
    if (!parent) {
      toast.error('The selected parent is no longer available');
      return;
    }
    if (parent.subject_c !== subject) {
      toast.error('A concept must inherit the subject of its parent node');
      return;
    }

    const duplicate = nodes.some((node) => (
      String(getId(node.syllabus_version_c)) === String(syllabusId) &&
      String(node.node_code_c || '').toLowerCase() === nodeCode.toLowerCase()
    ));
    if (duplicate) {
      toast.error('This stable node code already exists in the selected syllabus version');
      return;
    }

    const start = pageStart.trim() ? Number(pageStart) : null;
    const end = pageEnd.trim() ? Number(pageEnd) : null;
    if ((start !== null && (!Number.isInteger(start) || start < 1)) ||
        (end !== null && (!Number.isInteger(end) || end < 1)) ||
        (start !== null && end !== null && end < start)) {
      toast.error('Enter a valid one-based source page range');
      return;
    }

    setSaving(true);
    try {
      const sourceVersion = sourceVersionId
        ? sourceVersions.find((item) => String(item.Id) === String(sourceVersionId))
        : null;
      const resolvedSourceVersionId = sourceVersion?.Id || getId(selectedSyllabus.source_document_version_c) || undefined;
      const path = [parent.node_path_c || parent.Name, name.trim()].filter(Boolean).join(' / ');

      const result = await sdk.table('curriculum_nodes_c').create({
        Name: name.trim(),
        syllabus_version_c: selectedSyllabus.Id,
        node_code_c: nodeCode,
        node_type_c: 'Concept',
        subject_c: subject,
        parent_node_code_c: parent.node_code_c,
        node_path_c: path,
        description_c: description.trim(),
        learning_objectives_c: objectives.trim(),
        difficulty_c: difficulty,
        status_c: 'Review',
        sort_order_c: nodes.length + 1,
        verified_c: false,
        source_document_version_c: resolvedSourceVersionId,
        source_page_start_c: start,
        source_page_end_c: end,
        source_excerpt_c: sourceExcerpt.trim()
      });

      if (!result.data?.length) {
        toast.error(result.messages?.join('; ') || result.message || 'Concept node was not saved');
        return;
      }

      toast.success('Concept added to the graph in Review');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Concept could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a knowledge-graph concept</DialogTitle>
          <DialogDescription>
            New nodes are saved as Review and remain unpublished until an academic expert verifies their content and source evidence.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Concept name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Static friction" />
          </div>
          <div className="space-y-2">
            <Label>Syllabus version</Label>
            <Select value={syllabusId} onValueChange={setSyllabusId}>
              <SelectTrigger><SelectValue placeholder="Select syllabus" /></SelectTrigger>
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
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Physics', 'Chemistry', 'Maths', 'Biology'].map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Parent topic / subtopic / concept</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder="Choose the parent node" /></SelectTrigger>
              <SelectContent>
                {parentOptions.map((item) => (
                  <SelectItem key={item.Id} value={String(item.Id)}>
                    {item.node_path_c || item.Name} · {item.node_type_c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A child of another Concept is treated as a sub-concept in the hierarchy. The current database stores both at Concept node type.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Stable node code</Label>
            <Input value={nodeCode} onChange={(event) => setNodeCode(event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Concept definition</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="A source-grounded definition. Avoid adding unsupported syllabus claims." />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Learning objectives</Label>
            <Textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} rows={3} placeholder="Observable learning outcomes for this concept…" />
          </div>
          <div className="space-y-2">
            <Label>Difficulty band</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Basic', 'Moderate', 'Advanced'].map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source version (optional)</Label>
            <Select value={sourceVersionId} onValueChange={setSourceVersionId}>
              <SelectTrigger><SelectValue placeholder="Inherit syllabus source" /></SelectTrigger>
              <SelectContent>
                {sourceVersions.map((item) => (
                  <SelectItem key={item.Id} value={String(item.Id)}>
                    {item.official_title_c || item.Name} · {item.version_label_c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source page start</Label>
            <Input type="number" min="1" step="1" value={pageStart} onChange={(event) => setPageStart(event.target.value)} placeholder="1" />
          </div>
          <div className="space-y-2">
            <Label>Source page end</Label>
            <Input type="number" min="1" step="1" value={pageEnd} onChange={(event) => setPageEnd(event.target.value)} placeholder="1" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Verbatim source excerpt / evidence note</Label>
            <Textarea value={sourceExcerpt} onChange={(event) => setSourceExcerpt(event.target.value)} rows={3} placeholder="Record the relevant official wording or a precise evidence note with page reference." />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !syllabusVersions.length}>
            {saving ? 'Saving…' : 'Save concept in Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
