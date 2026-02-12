import Markdown from "react-markdown";

interface SkillContentRendererProps {
  content: string;
}

/** Renders skill markdown content with styled prose */
export function SkillContentRenderer({ content }: SkillContentRendererProps) {
  return (
    <div className="sx-prose">
      <Markdown>{content}</Markdown>
    </div>
  );
}
