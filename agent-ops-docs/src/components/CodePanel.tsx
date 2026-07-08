import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import type { PageContent } from '../data/pages';

interface CodePanelProps {
  page: PageContent;
}

function CodeBlock({ code, language, onCopy, copied }: {
  code: string;
  language: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const langColors: Record<string, string> = {
    bash: '#22c55e',
    curl: '#22c55e',
    python: '#3b82f6',
    json: '#f59e0b',
    yaml: '#8b5cf6',
    typescript: '#06b6d4',
    javascript: '#f59e0b',
    toml: '#ec4899',
  };

  const langColor = langColors[language] || '#a1a1aa';

  return (
    <div style={{
      background: '#0a0a0b',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      {/* Code header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 14px',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border)',
        gap: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: langColor,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          {language}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onCopy}
          style={{
            background: copied ? 'var(--green-bg)' : 'var(--bg-hover)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            borderRadius: 5,
            padding: '3px 8px',
            color: copied ? 'var(--green)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-sans)',
            transition: 'all 0.15s',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code content */}
      <div style={{ overflowX: 'auto' }}>
        <pre style={{
          padding: '16px',
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: '#e5e7eb',
          fontFamily: 'var(--font-mono)',
          tabSize: 2,
        }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function CodePanel({ page }: CodePanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const examples = page.codeExamples || [];

  // activeTab is local index state that outlives page navigation (this
  // component never remounts as `page` changes) — without this reset,
  // navigating from a page with N example tabs (activeTab = N-1 selected)
  // to a page with fewer than N crashes CodeBlock on examples[activeTab]
  // being undefined.
  useEffect(() => {
    setActiveTab(0);
    setCopiedIndex(null);
  }, [page.route]);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (examples.length === 0) {
    return (
      <aside style={{
        width: 'var(--code-panel-width)',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <span style={{ fontSize: 20 }}>{'</>'}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
            Code examples will appear here
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: 'var(--code-panel-width)',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      overflowY: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>
          Code Examples
        </span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Tab switcher for multiple examples */}
        {examples.length > 1 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            background: 'var(--bg-tertiary)',
            borderRadius: 8,
            padding: 3,
            border: '1px solid var(--border)',
          }}>
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                style={{
                  flex: '1 0 auto',
                  padding: '5px 8px',
                  background: activeTab === i ? 'var(--bg-active)' : 'none',
                  border: 'none',
                  borderRadius: 5,
                  color: activeTab === i ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 11.5,
                  fontWeight: activeTab === i ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                }}
              >
                {ex.label || ex.language}
              </button>
            ))}
          </div>
        )}

        {/* Code blocks */}
        {examples.length === 1 ? (
          <div>
            {examples[0].label && (
              <p style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 8,
                letterSpacing: '0.3px',
              }}>
                {examples[0].label}
              </p>
            )}
            <CodeBlock
              code={examples[0].code}
              language={examples[0].language}
              onCopy={() => handleCopy(examples[0].code, 0)}
              copied={copiedIndex === 0}
            />
          </div>
        ) : (
          <CodeBlock
            code={(examples[activeTab] ?? examples[0]).code}
            language={(examples[activeTab] ?? examples[0]).language}
            onCopy={() => handleCopy((examples[activeTab] ?? examples[0]).code, activeTab)}
            copied={copiedIndex === activeTab}
          />
        )}
      </div>
    </aside>
  );
}
