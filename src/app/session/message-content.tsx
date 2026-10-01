import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { PICTURE } from "@/lib/scraping/transcript";
import { sv } from "@/lib/sv";

const PICTURE_URL = "clarifai:picture";
const HIGHLIGHT_URL = "clarifai:highlight";

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

const components: Components = {
  h1: ({ children }) => (
    <h3 className="font-heading text-base leading-snug font-semibold">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="font-heading text-base leading-snug font-semibold">
      {children}
    </h3>
  ),
  h3: SmallHeading,
  h4: SmallHeading,
  h5: SmallHeading,
  h6: SmallHeading,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }) => (
    <code
      className={
        className
          ? `font-mono ${className}`
          : "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      }
    >
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b bg-muted px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b px-3 py-2 align-top last:border-b-0">{children}</td>
  ),
  a: ({ href, children }) =>
    href === HIGHLIGHT_URL ? (
      <mark className="rounded-sm bg-foreground/10 px-0.5 font-medium text-inherit">
        {children}
      </mark>
    ) : (
      <span className="underline decoration-dotted underline-offset-2">
        {children}
      </span>
    ),
  img: () => (
    <span
      role="img"
      aria-label={sv.session.transcriptImageRemoved}
      className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
    >
      <ImageIcon aria-hidden="true" className="size-4" />
      {sv.session.transcriptImageRemoved}
    </span>
  ),
  hr: () => <hr className="border-border" />,
};

export function MessageContent({
  text,
  highlight,
  className = "",
}: {
  text: string;
  highlight?: string | null;
  className?: string;
}) {
  const markdown = text.replaceAll(
    PICTURE,
    `![${sv.session.transcriptImageRemoved}](${PICTURE_URL})`,
  );
  const highlightPlugin = highlight ? createHighlightPlugin(highlight) : null;

  return (
    <div className={`min-w-0 space-y-2 break-words ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={
          highlightPlugin ? [remarkGfm, highlightPlugin] : [remarkGfm]
        }
        skipHtml
        urlTransform={(url) =>
          url === PICTURE_URL || url === HIGHLIGHT_URL ? url : ""
        }
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function SmallHeading({ children }: { children?: ReactNode }) {
  return (
    <h4 className="font-heading text-sm leading-snug font-semibold">
      {children}
    </h4>
  );
}

function createHighlightPlugin(excerpt: string) {
  return function highlightPlugin() {
    return function transform(tree: MarkdownNode) {
      highlightFirstTextMatch(tree, excerpt);
    };
  };
}

function highlightFirstTextMatch(node: MarkdownNode, excerpt: string): boolean {
  if (!node.children) return false;

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (child.type === "text" && typeof child.value === "string") {
      const match = flexibleMatch(child.value, excerpt);
      if (match) {
        const replacement: MarkdownNode[] = [];
        if (match.before)
          replacement.push({ type: "text", value: match.before });
        replacement.push({
          type: "link",
          url: HIGHLIGHT_URL,
          children: [{ type: "text", value: match.value }],
        });
        if (match.after) replacement.push({ type: "text", value: match.after });
        node.children.splice(index, 1, ...replacement);
        return true;
      }
    }
    if (highlightFirstTextMatch(child, excerpt)) return true;
  }
  return false;
}

function flexibleMatch(
  text: string,
  excerpt: string,
): { before: string; value: string; after: string } | null {
  const words = excerpt.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return null;
  const match = new RegExp(words.join("\\s+")).exec(text);
  if (!match) return null;
  return {
    before: text.slice(0, match.index),
    value: match[0],
    after: text.slice(match.index + match[0].length),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
