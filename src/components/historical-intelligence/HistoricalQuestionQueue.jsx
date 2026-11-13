import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import ApperIcon from '@/components/ApperIcon';

export default function HistoricalQuestionQueue({ questions = [], canEdit = false }) {
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions
      .filter((question) => question.source_type_c === 'Historical')
      .filter((question) => !query || [
        question.Name,
        question.historical_year_c,
        question.historical_session_c,
        question.historical_question_number_c,
        question.question_family_code_c,
        question.recurring_pattern_group_c,
        question.question_body_c
      ].some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => Number(b.historical_year_c || 0) - Number(a.historical_year_c || 0));
  }, [questions, search]);

  const reviewCount = rows.filter((question) => question.status_c === 'Review' || question.status_c === 'Draft').length;
  const answerPending = rows.filter((question) => question.answer_validation_status_c !== 'Verified').length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-lg font-semibold">Historical question DNA queue</h2>
          <p className="text-sm text-muted-foreground">
            Extracted questions remain in review until an academic reviewer classifies and validates them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{rows.length} historical question(s)</Badge>
          <Badge variant="outline">{reviewCount} in review</Badge>
          <Badge variant="outline">{answerPending} answer key(s) pending</Badge>
        </div>
      </div>

      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search question, year, session or family"
          aria-label="Search historical question queue"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Historical question</TableHead>
                <TableHead>Question DNA</TableHead>
                <TableHead>Extraction</TableHead>
                <TableHead>Answer key</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((question) => (
                <TableRow key={question.Id}>
                  <TableCell className="min-w-64">
                    <p className="font-medium">{question.Name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {question.question_body_c || 'Question body not available'}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {question.historical_year_c || 'Year unknown'} · {question.historical_session_c || 'Session unknown'} · Page {question.historical_page_number_c || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-44">
                    <p className="text-xs">{question.question_family_code_c || 'No family code'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{question.recurring_pattern_group_c || 'No pattern group'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{question.difficulty_c || 'Difficulty unrated'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={question.extraction_status_c === 'Verified' ? 'secondary' : 'outline'}>
                      {question.extraction_status_c || 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={question.answer_validation_status_c === 'Verified' ? 'secondary' : 'outline'}>
                      {question.answer_validation_status_c || 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={question.status_c === 'Published' ? 'default' : 'outline'}>
                      {question.status_c || 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={'/historical-intelligence/questions/' + question.Id}>
                          <ApperIcon name="ClipboardCheck" size={14} className="mr-1.5" />
                          Review question
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
            <ApperIcon name="ScanText" size={22} className="mb-3 text-muted-foreground" />
            <p className="font-medium">No historical question records match this search</p>
            <p className="mt-1 text-sm text-muted-foreground">Ingest a paper PDF to create reviewable page and question records.</p>
          </div>
        )}
      </div>
    </section>
  );
}
