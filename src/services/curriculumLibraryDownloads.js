function csvCell(value) {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

export function downloadCurriculumRows(rows, fileName = 'northstar-curriculum.csv') {
  if (!rows.length) return;
  const headings = [
    'Exam', 'Academic year', 'Subject', 'Level', 'Curriculum item',
    'Parent item', 'Curriculum path', 'Source title', 'Source type',
    'Source URL', 'Source page start', 'Source page end',
    'Publication state', 'Expert verified'
  ];
  const values = rows.map((row) => [
    row.exam, row.year, row.subject, row.level, row.title, row.parentTitle,
    row.path, row.sourceTitle, row.sourceType, row.sourceUrl,
    row.pageStart, row.pageEnd, row.state, row.verified ? 'Yes' : 'No'
  ]);
  const csv = [headings, ...values].map((line) => line.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printCurriculumRows(rows, title) {
  if (!rows.length) return;
  const popup = window.open('', '_blank');
  if (!popup) return;
  const bodyRows = rows.map((row) => (
    '<tr><td>' + escapeHtml(row.exam) + ' · ' + escapeHtml(row.year) + '</td>' +
    '<td>' + escapeHtml(row.subject) + '</td>' +
    '<td>' + escapeHtml(row.level) + '</td>' +
    '<td><strong>' + escapeHtml(row.title) + '</strong><br><small>' + escapeHtml(row.path) + '</small></td>' +
    '<td>' + escapeHtml(row.sourceTitle) + '<br><small>' + escapeHtml(row.sourceUrl) + '</small></td>' +
    '<td>' + escapeHtml(row.state) + '</td></tr>'
  )).join('');

  popup.document.write(
    '<!doctype html><html><head><title>' + escapeHtml(title) + '</title>' +
    '<meta charset="utf-8"><style>body{font:12px Arial,sans-serif;padding:28px}h1{font-size:20px}p{line-height:1.5}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid currentColor;padding:8px;text-align:left;vertical-align:top}small{word-break:break-word}@media print{body{padding:0}}</style></head><body>' +
    '<h1>' + escapeHtml(title) + '</h1>' +
    '<p>Generated from Northstar curriculum records. Reference snapshots are distinguished from expert-verified published curriculum. Use the source URL for the issuing authority document.</p>' +
    '<table><thead><tr><th>Exam / year</th><th>Subject</th><th>Level</th><th>Curriculum item</th><th>Source</th><th>State</th></tr></thead><tbody>' + bodyRows + '</tbody></table>' +
    '</body></html>'
  );
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
}
