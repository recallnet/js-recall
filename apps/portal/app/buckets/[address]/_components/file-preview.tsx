import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { JsonView } from 'react-json-view-lite';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import * as shiki from 'shiki';
import { Address } from 'viem';
import { getChain, getObjectApiUrl } from '@recallnet/chains';
import { useChainId } from 'wagmi';
import 'react-json-view-lite/dist/index.css';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@recallnet/ui/components/card";
import { Button } from "@recallnet/ui/components/button";
import { Input } from "@recallnet/ui/components/input";
import { cn } from "@recallnet/ui/lib/utils";
import { AlertCircle, Copy, Link, Download } from "lucide-react";

// Add custom styles for JSON View
import './json-preview.css';

interface Props {
  bucketAddress: Address;
  path: string;
  type?: string;
  className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

function getFileExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(type?: string, ext?: string): boolean {
  if (type?.startsWith('image/')) return true;
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
}

function isMarkdownFile(type?: string, ext?: string): boolean {
  if (type === 'text/markdown') return true;
  return ['md', 'markdown'].includes(ext || '');
}

function isJsonFile(type?: string, ext?: string): boolean {
  if (type === 'application/json') return true;
  return ['json'].includes(ext || '');
}

function isCodeFile(ext?: string): boolean {
  const codeExtensions = [
    'js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'sol',
    'html', 'css', 'scss', 'less', 'sh', 'bash',
    'yml', 'yaml', 'toml', 'ini', 'conf',
    'sql', 'graphql', 'prisma'
  ];
  return codeExtensions.includes(ext || '');
}

function isLogFile(type?: string, ext?: string): boolean {
  if (type === 'text/plain') return true;
  return ['log', 'txt'].includes(ext || '');
}

export default function FilePreview({ bucketAddress, path, type, className }: Props) {
  const [content, setContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedContent, setHighlightedContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fileSize, setFileSize] = useState<number>(0);
  const ext = getFileExtension(path);
  const chainId = useChainId();
  const chain = getChain(chainId);
  const objectApiUrl = getObjectApiUrl(chain);

  const fileUrl = `${objectApiUrl}/v1/objects/${bucketAddress}/${path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Add actions bar component for code and text files
  const ActionsBar = ({ showLineNumbers = true }) => (
    <div className="flex items-center justify-between px-6 py-2 bg-muted/50 border-b border-border/50">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {(fileSize / 1024).toFixed(1)}KB
        </span>
        {ext && <span className="text-sm text-muted-foreground">{ext.toUpperCase()}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(content)}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(fileUrl, '_blank')}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(window.location.href)}
        >
          <Link className="h-4 w-4 mr-2" />
          Copy Link
        </Button>
      </div>
    </div>
  );

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        // First, do a HEAD request to check file size
        const headResponse = await fetch(fileUrl, { method: 'HEAD' });
        if (!headResponse.ok) throw new Error('Failed to fetch file metadata');

        const contentLength = parseInt(headResponse.headers.get('content-length') || '0', 10);
        setFileSize(contentLength);

        if (contentLength > MAX_FILE_SIZE) {
          setError('File is too large to preview (max 5MB)');
          return;
        }

        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch file content');

        const data = await response.text();
        setContent(data);

        // If it's a code file, highlight it
        if (isCodeFile(ext)) {
          const highlighter = await shiki.createHighlighter({
            themes: ['github-dark'],
            langs: ['javascript', 'typescript', 'python', 'go', 'rust', 'solidity', 'html', 'css', 'sql']
          });

          const language = ext === 'js' ? 'javascript'
            : ext === 'ts' ? 'typescript'
            : ext === 'py' ? 'python'
            : ext === 'go' ? 'go'
            : ext === 'rs' ? 'rust'
            : ext === 'sol' ? 'solidity'
            : ext === 'html' ? 'html'
            : ext === 'css' ? 'css'
            : ext === 'sql' ? 'sql'
            : 'text';

          const highlighted = highlighter.codeToHtml(data, {
            lang: language as shiki.BundledLanguage,
            theme: 'github-dark'
          });
          setHighlightedContent(highlighted);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [bucketAddress, path, ext, fileUrl]);

  if (error) {
    return (
      <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Loading File
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Raw File
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Image Preview
  if (isImageFile(type, ext)) {
    return (
      <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Image Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TransformWrapper>
            <TransformComponent>
              <img
                src={fileUrl}
                alt="File preview"
                className="max-w-full h-auto rounded-b-lg"
              />
            </TransformComponent>
          </TransformWrapper>
        </CardContent>
      </Card>
    );
  }

  // Markdown Preview
  if (isMarkdownFile(type, ext)) {
    return (
      <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Markdown Preview</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none px-6 py-4 bg-muted/30 rounded-b-lg">
          <ReactMarkdown>{content}</ReactMarkdown>
        </CardContent>
      </Card>
    );
  }

  // JSON Preview
  if (isJsonFile(type, ext)) {
    try {
      const jsonData = JSON.parse(content);
      return (
        <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">JSON Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ActionsBar />
            <div className="overflow-auto rounded-b-lg">
              <div className="p-6 font-mono text-sm leading-relaxed bg-white dark:bg-slate-100">
                <JsonView
                  data={jsonData}
                  shouldExpandNode={() => true}
                  style={{ container: "json-preview" }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    } catch {
      // If JSON parsing fails, fall back to code preview
      return (
        <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">JSON Preview (Invalid JSON)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ActionsBar />
            <pre className="overflow-auto p-6 bg-muted/30 rounded-b-lg font-mono text-sm text-foreground">
              <code>{content}</code>
            </pre>
          </CardContent>
        </Card>
      );
    }
  }

  // Code Preview
  if (isCodeFile(ext)) {
    return (
      <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Code Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ActionsBar />
          <div
            className="overflow-auto rounded-b-lg [&>pre]:!rounded-t-none [&>pre]:!rounded-b-lg [&>pre]:!m-0 [&>pre]:!bg-muted/30 [&>pre]:!p-6"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        </CardContent>
      </Card>
    );
  }

  // Log/Text Preview
  if (isLogFile(type, ext)) {
    const lines = content.split('\n');
    const filteredLines = searchQuery
      ? lines.filter(line => line.toLowerCase().includes(searchQuery.toLowerCase()))
      : lines;

    return (
      <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
        <CardHeader className="space-y-3 pb-4">
          <CardTitle className="text-xl font-semibold">Log Preview</CardTitle>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                onClick={() => setSearchQuery('')}
                className="hover:bg-muted/60"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ActionsBar />
          <pre className="overflow-auto p-6 bg-muted/30 rounded-b-lg h-[500px] font-mono text-sm">
            {filteredLines.map((line, i) => (
              <div
                key={i}
                id={`L${i + 1}`}
                className={cn(
                  "leading-relaxed hover:bg-muted/40",
                  searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase())
                    ? "bg-yellow-500/20 -mx-6 px-6"
                    : ""
                )}
              >
                <a
                  href={`#L${i + 1}`}
                  className="select-none text-muted-foreground mr-4 text-right inline-block w-[3ch]"
                >
                  {i + 1}
                </a>
                {line}
              </div>
            ))}
          </pre>
        </CardContent>
      </Card>
    );
  }

  // Default Preview
  return (
    <Card className={cn("rounded-lg shadow-lg border-border/50", className)}>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-semibold">File Preview</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="overflow-auto p-6 bg-muted/30 rounded-b-lg font-mono text-sm">
          <code>{content}</code>
        </pre>
      </CardContent>
    </Card>
  );
}