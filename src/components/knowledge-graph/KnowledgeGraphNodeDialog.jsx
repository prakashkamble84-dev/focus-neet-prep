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

const NODE_TYPES = ['Subject', 'Unit', 'Chapter', 'Topic', 'Subtopic', 'Concept'];

const ALLOWED_PARENTS = {
  Subject: [],
  Unit: ['Subject'],
  Chapter: ['Unit'],
  Topic: ['Chapter', 'Unit'],
  Subtopic: ['Topic'],
  Concept: ['Topic', 'Subtopic', 'Concept']
};

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
  const [nodeType, setNodeType] = useState('Subject');
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

  const isKnowledgeCore = syllabusId === '__knowledge_core__';
  const selectedSyllabus = syllabusVersions.find((item) => String(item.Id) === String(syllabusId));
  const allowedParents = ALLOWED_PARENTS[nodeType] || [];

  const parentOptions = useMemo(() => nodes.filter((node) => {
    const versionId = getId(node.syllabus_version_c);
    const sameVersion = isKnowledgeCore
      ? !versionId
      : !versionId || String(versionId) === String(syllabusId);
    return sameVersion &&
      allowedParents.includes(node.node_type_c) &&
      node.status_c !== 'Retired';
  }), [nodes, syllabusId, nodeType, isKnowledgeCore, allowedParents.join('|')]);

  useEffect(() => {
    if (!open) return;
    const firstSyllabus = syllabusVersions[0];
    const defaultSyllabusId = firstSyllabus ? String(firstSyllabus.Id) : '__knowledge_core__';
    const existingSubjects = nodes.some((node) => (
      String(getId(node.syllabus_version_c) || 'KNOWLEDGE_CORE') ===
        String(firstSyllabus?.Id || 'KNOWLEDGE_CORE') &&
      node.node_type_c === 'Subject' &&
      node.status_c !== 'Retired'
    ));
    setName('');
    setSyllabusId(defaultSyllabusId);
    setNodeType(existingSubjects ? 'Chapter' : 'Subject');
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
  }, [open, syllabusVersions, nodes]);

  useEffect(() => {
    if (!name.trim() || (!selectedSyllabus && !isKnowledgeCore)) {
      setNodeCode('');
      return;
    }
    const code = [
      slug(selectedSyllabus?.version_label_c || selectedSyllabus?.Name || 'KNOWLEDGE-CORE').slice(0, 24),
      slug(subject),
      slug(nodeType),
      slug(name).slice(0, 36)
    ].filter(Boolean).join('-');
    setNodeCode(code);
  }, [name, selectedSyllabus, subject, nodeType, isKnowledgeCore]);

  function selectParent(value) {
    setParentId(value);
    const parent = parentOptions.find((item) => String(item.Id) === String(value));
    if (parent?.subject_c) setSubject(parent.subject_c);
  }

  async function save() {
    if (!selectedSyllabus && !isKnowledgeCore) {
      toast.error('Choose a syllabus version or the shared Knowledge Core layer');
      return;
    }
    if (!name.trim() || !subject || !nodeCode) {
      toast.error('Enter the node name and subject');
      return;
    }

    const rootNode = nodeType === 'Subject';
    const parent = parentId
      ? parentOptions.find((item) => String(item.Id) === String(parentId))
      : null;
    if (!rootNode && !parent) {
      toast.error('Choose a valid parent node for ' + nodeType);
      return;
    }
    if (parent && parent.subject_c !== subject) {
      toast.error('A child node must inherit the subject of its parent');
      return;
    }

    const versionKey = String(selectedSyllabus?.Id || 'KNOWLEDGE_CORE');
    const duplicate = nodes.some((node) => (
      String(getId(node.syllabus_version_c) || 'KNOWLEDGE_CORE') === versionKey &&
      String(node.node_code_c || '').toLowerCase() === nodeCode.toLowerCase()
    ));
    if (duplicate) {
      toast.error('This stable node code already exists in the selected layer');
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
      const resolvedSourceVersionId = sourceVersion?.Id ||
        getId(selectedSyllabus?.source_document_version_c) ||
        undefined;
      const path = parent
        ? [parent.node_path_c || parent.Name, name.trim()].filter(Boolean).join(' / ')
        : name.trim();

      const result = await sdk.table('curriculum_nodes_c').create({
        Name: name.trim(),
        syllabus_version_c: selectedSyllabus?.Id,
        node_code_c: nodeCode,
        node_type_c: nodeType,
        subject_c: subject,
        parent_node_code_c: parent?.node_code_c || '',
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
        toast.error(result.messages?.join('; ') || result.message || 'Graph node was not saved');
        return;
      }

      toast.success(nodeType + ' node added in Review');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Graph node could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a knowledge-graph node</DialogTitle>
          <DialogDescription>
            Build the hierarchy from Subject through Concept. New nodes are saved as Review and are never student-visible until academically verified and published.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Node name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Static friction" />
          </div>

          <div className="space-y-2">
            <Label>Layer / syllabus version</Label>
            <Select value={syllabusId} onValueChange={(value) => {
              setSyllabusId(value);
              setParentId('');
            }}>
              <SelectTrigger><SelectValue placeholder="Select syllabus layer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__knowledge_core__">Knowledge Core · cross-exam concept</SelectItem>
                {syllabusVersions.map((item) => (
                  <SelectItem key={item.Id} value={String(item.Id)}>
                    {item.version_label_c || item.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Node type</Label>
            <Select value={nodeType} onValueChange={(value) => {
              setNodeType(value);
              setParentId('');
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NODE_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject} disabled={Boolean(parentId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Physics', 'Chemistry', 'Maths', 'Biology'].map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {nodeType !== 'Subject' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Parent node · {allowedParents.join(' / ')}</Label>
              <Select value={parentId} onValueChange={selectParent}>
                <SelectTrigger><SelectValue placeholder="Choose the parent node" /></SelectTrigger>
                <SelectContent>
                  {parentOptions.map((item) => (
                    <SelectItem key={item.Id} value={String(item.Id)}>
                      {item.node_path_c || item.Name} · {item.node_type_c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {parentOptions.length === 0 && (
                <p className="text-xs text-warning-foreground">
                  No valid parent exists in this layer yet. Add its parent level first, or select Knowledge Core for a shared concept hierarchy.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label>Stable node code</Label>
            <Input value={nodeCode} onChange={(event) => setNodeCode(event.target.value)} placeholder="Generated from version, subject, type and name" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Definition / scope</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Write a source-grounded description. Avoid unsupported syllabus claims." />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Learning objectives</Label>
            <Textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} rows={3} placeholder="Observable learning outcomes for this node…" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Source version (optional until review)</Label>
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
            <Textarea value={sourceExcerpt} onChange={(event) => setSourceExcerpt(event.target.value)} rows={3} placeholder="Record the relevant source wording or a precise evidence note." />
          </div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          The existing database represents Sub-concepts as a Concept node whose parent is another Concept. No extra schema has been added.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || (nodeType !== 'Subject' && parentOptions.length === 0)}>
            {saving ? 'Saving…' : 'Save node in Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
