import { useEffect, useState } from 'react';
import { sdk } from '@/services/sdk';
import { MASTERY_STAGES, getMasteryContractText, mergeMasteryContract } from '@/services/knowledgeGraphRules';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

export default function KnowledgeGraphMasteryDialog({ open, onOpenChange, node, onSaved }) {
  const [contract, setContract] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !node) return;
    setContract(getMasteryContractText(node.learning_objectives_c));
  }, [open, node?.Id]);

  async function save() {
    if (!node?.Id) return;
    const lines = contract.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < MASTERY_STAGES.length) {
      toast.error('Keep all seven mastery stages: M1 through M7');
      return;
    }
    const presentStages = new Set(lines.map((line) => line.slice(0, 2)));
    if (MASTERY_STAGES.some((stage) => !presentStages.has(stage.code))) {
      toast.error('The contract must include every stage from M1 to M7');
      return;
    }

    setSaving(true);
    try {
      const result = await sdk.table('curriculum_nodes_c').update({
        Id: node.Id,
        learning_objectives_c: mergeMasteryContract(node.learning_objectives_c, contract)
      });
      if (!result.data?.length) {
        toast.error(result.messages?.join('; ') || result.message || 'Mastery contract was not saved');
        return;
      }
      toast.success('Seven-stage mastery contract saved');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Mastery contract could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mastery contract · {node?.Name || 'Concept'}</DialogTitle>
          <DialogDescription>
            Define observable evidence of mastery. A checked chapter or one correct answer is not enough to declare a concept mastered.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {MASTERY_STAGES.map((stage) => (
              <div key={stage.code} className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm font-semibold">{stage.code} · {stage.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.criterion}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Concept-specific mastery evidence</Label>
            <Textarea value={contract} onChange={(event) => setContract(event.target.value)} rows={9} />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            The seven stages are M1 Explain, M2 Recognise, M3 Apply, M4 Transfer, M5 Integrate, M6 Timed and M7 Retain. No numeric pass threshold is assumed; subject experts define sufficient evidence through their review.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save mastery contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
