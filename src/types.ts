import type { ElementInfo } from "element-source";

export interface SourceBlameRequest {
  filePath: string;
  lineNumber: number | null;
}

export interface SourceBlameResponse {
  commitSha: string;
  authorName: string;
  authorEmail: string;
  authorTimeUnix: number;
  summary: string;
  commitUrl: string | null;
  resolutionType: "line" | "file" | "uncommitted";
}

export interface SourceBlameErrorResponse {
  error: string;
}

export interface SourceBlamePanelData {
  elementInfo: ElementInfo;
  blame: SourceBlameResponse | null;
  error: string | null;
}

export interface SourceInspectorProps {
  endpoint?: string;
  enabled?: boolean;
  className?: string;
}

export interface SourceBlameVitePluginOptions {
  endpoint?: string;
  projectRoot?: string;
  gitBinary?: string;
}

export interface ParsedGitBlame {
  commitSha: string;
  authorName: string;
  authorEmail: string;
  authorTimeUnix: number;
  summary: string;
}
