export function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  return (
    <pre className="overflow-x-auto rounded-input border border-surface-border bg-white/[0.02] p-4 text-xs text-content-secondary">
      <code data-language={language}>{code}</code>
    </pre>
  );
}
