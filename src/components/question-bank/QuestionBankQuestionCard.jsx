import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import {
  canUseEditorialQuestionBank,
  fetchQuestionBankQuestionDetails,
  getLookupName
} from '@/services/questionBankService';

function QuestionMeta({ label, value }) {
  if (!value) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>
      {value}
    </span>
  );
}

export default function QuestionBankQuestionCard({ question, profile }) {
  const [expanded, setExpanded] = useState(false);
  const isEditorial = canUseEditorialQuestionBank(profile);
  const canShowCorrectness = isEditorial && question.answer_validation_status_c === 'Verified';
  const {
    data: details,
    loading,
    error,
    run
  } = useFetch(
    () => expanded
      ? fetchQuestionBankQuestionDetails(question.Id, profile)
      : Promise.resolve(null),
    [expanded, question.Id, profile]
  );

  const options = (details?.options || []).filter((option) => option.status_c !== 'Retired');
  const mappings = details?.mappings || [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base leading-6">{question.Name || 'Untitled question'}</CardTitle>
            <CardDescription>
              {getLookupName(question.examination_c) || 'Examination not linked'}
              {question.historical_year_c ? ' · ' + question.historical_year_c : ''}
              {question.historical_session_c ? ' · ' + question.historical_session_c : ''}
              {question.historical_question_number_c ? ' · Q' + question.historical_question_number_c : ''}
            </CardDescription>
          </div>
          <Badge variant={question.status_c === 'Published' ? 'default' : 'outline'}>
            {question.status_c || 'Unstatused'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <QuestionMeta label="Format" value={question.question_type_c} />
          <QuestionMeta label="Difficulty" value={question.difficulty_c} />
          <QuestionMeta label="Source" value={question.source_type_c} />
          <QuestionMeta label="Marks" value={question.maximum_marks_c ?? null} />
          {question.rights_status_c && <QuestionMeta label="Rights" value={question.rights_status_c} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-6">
          {question.question_body_c || 'No question text has been recorded.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            <ApperIcon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="mr-1" />
            {expanded ? 'Hide answer choices and concepts' : 'Show answer choices and concepts'}
          </Button>

          {isEditorial && question.source_type_c === 'Historical' && (
            <Link
              to={'/historical-intelligence/questions/' + question.Id}
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-primary hover:bg-accent"
            >
              Review question
              <ApperIcon name="ArrowUpRight" size={14} />
            </Link>
          )}
        </div>

        {expanded && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/15 p-4">
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {error && (
              <div className="space-y-2 text-sm text-destructive">
                <p>{error}</p>
                <Button type="button" size="sm" variant="outline" onClick={run}>Retry</Button>
              </div>
            )}

            {!loading && !error && (
              <>
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Answer choices</h3>
                    {canShowCorrectness
                      ? <Badge variant="secondary">Validated answer indicators</Badge>
                      : <Badge variant="outline">Correctness not shown</Badge>}
                  </div>

                  {options.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options.map((option) => (
                        <div key={option.Id} className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm">
                          <span className="font-mono font-semibold">{option.option_key_c || '•'}.</span>
                          <span className="min-w-0 flex-1 whitespace-pre-wrap">{option.option_text_c}</span>
                          {canShowCorrectness && option.is_correct_c === true && (
                            <Badge variant="secondary">Correct</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No published answer options are available for this question.</p>
                  )}

                  {!canShowCorrectness && (
                    <p className="text-xs text-muted-foreground">
                      The answer key is withheld here. It becomes available only through a validated assessment or an authorised editorial review.
                    </p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verified concept mappings</h3>
                  {mappings.length ? (
                    <div className="flex flex-wrap gap-2">
                      {mappings.map((mapping) => (
                        <span key={mapping.Id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                          <span className="font-semibold">{getLookupName(mapping.curriculum_node_c) || 'Concept'}</span>
                          <span className="text-muted-foreground"> · {mapping.mapping_type_c}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No verified concept mapping is linked yet.</p>
                  )}
                </section>

                <section className="grid gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>Primary concept: {getLookupName(question.curriculum_node_c) || 'Not assigned'}</p>
                  <p>Historical page: {question.historical_page_number_c || 'Not recorded'}</p>
                  <p>Extraction: {question.extraction_status_c || 'Not reviewed'}</p>
                  <p>Answer validation: {question.answer_validation_status_c || 'Not validated'}</p>
                  {question.historical_paper_c && (
                    <p>Paper: {getLookupName(question.historical_paper_c) || 'Linked'}</p>
                  )}
                  {question.source_document_c && (
                    <p>Source: {getLookupName(question.source_document_c) || 'Linked'}</p>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
