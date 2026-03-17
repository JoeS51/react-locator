import { type CSSProperties } from "react";
import { type ElementInfo } from "element-source";
import {
  BLAME_REQUEST_TIMEOUT_MS,
  INSPECTOR_HOVER_LABEL_MAX_WIDTH_PX,
  INSPECTOR_HOVER_LABEL_RESERVED_HEIGHT_PX,
  INSPECTOR_HOVER_LABEL_VIEWPORT_MARGIN_PX,
  UNIX_TIMESTAMP_TO_MS_MULTIPLIER,
} from "../constants.js";
import type {
  SourceBlameErrorResponse,
  SourceBlameRequest,
  SourceBlameResponse,
} from "../types.js";

export interface HoverBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  return true;
};

const isSourceBlameErrorResponse = (value: unknown): value is SourceBlameErrorResponse => {
  if (!isRecord(value)) return false;
  return typeof value.error === "string";
};

const isSourceBlameResponse = (value: unknown): value is SourceBlameResponse => {
  if (!isRecord(value)) return false;
  if (typeof value.commitSha !== "string") return false;
  if (typeof value.authorName !== "string") return false;
  if (typeof value.authorEmail !== "string") return false;
  if (typeof value.authorTimeUnix !== "number") return false;
  if (typeof value.summary !== "string") return false;
  if (value.commitUrl !== null && typeof value.commitUrl !== "string") return false;
  if (value.resolutionType !== "line" && value.resolutionType !== "file" && value.resolutionType !== "uncommitted") {
    return false;
  }
  return true;
};

export const areHoverBoundsEqual = (left: HoverBounds | null, right: HoverBounds): boolean => {
  if (!left) return false;
  if (left.top !== right.top) return false;
  if (left.left !== right.left) return false;
  if (left.width !== right.width) return false;
  if (left.height !== right.height) return false;
  return true;
};

export const formatAuthorTime = (authorTimeUnix: number): string => {
  if (!authorTimeUnix) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(authorTimeUnix * UNIX_TIMESTAMP_TO_MS_MULTIPLIER));
};

export const formatAuthorDate = (authorTimeUnix: number): string => {
  if (!authorTimeUnix) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(authorTimeUnix * UNIX_TIMESTAMP_TO_MS_MULTIPLIER));
};

export const getAuthorDisplayName = (blame: SourceBlameResponse): string => blame.authorName || "unknown";

export const isTypingContext = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  return false;
};

export const isInspectorToggleKeybinding = (event: KeyboardEvent): boolean => {
  if (event.code !== "KeyI") return false;
  if (!event.metaKey) return false;
  if (!event.altKey) return false;
  if (event.shiftKey) return false;
  if (event.ctrlKey) return false;
  return true;
};

export const isInspectorHelpKeybinding = (event: KeyboardEvent): boolean => {
  if (event.code !== "KeyH") return false;
  if (!event.metaKey) return false;
  if (!event.altKey) return false;
  if (event.shiftKey) return false;
  if (event.ctrlKey) return false;
  return true;
};

export const getBlameCacheKey = (sourceInfo: ElementInfo["source"] | null | undefined): string | null => {
  if (!sourceInfo?.filePath) return null;
  const lineNumber = sourceInfo.lineNumber ?? 1;
  return `${sourceInfo.filePath}:${lineNumber}`;
};

export const sanitizeSourceFilePath = (sourceFilePath: string): string => {
  const trimmedSourceFilePath = sourceFilePath.trim();
  if (trimmedSourceFilePath.startsWith("/@fs/")) {
    return trimmedSourceFilePath.slice("/@fs".length);
  }
  if (trimmedSourceFilePath.startsWith("file://")) {
    return decodeURIComponent(new URL(trimmedSourceFilePath).pathname);
  }
  if (trimmedSourceFilePath.startsWith("http://") || trimmedSourceFilePath.startsWith("https://")) {
    const pathname = decodeURIComponent(new URL(trimmedSourceFilePath).pathname);
    if (pathname.startsWith("/@fs/")) {
      return pathname.slice("/@fs".length);
    }
    return pathname;
  }
  return trimmedSourceFilePath;
};

export const getHoverLabel = (elementInfo: ElementInfo): string => {
  const componentName = elementInfo.componentName ?? "unknown";
  return componentName;
};

export const getIdeFileLink = (sourceFilePath: string, lineNumber: number | null | undefined): string => {
  const normalizedFilePath = sanitizeSourceFilePath(sourceFilePath);
  const encodedFilePath = encodeURI(normalizedFilePath);
  const resolvedLineNumber = lineNumber && lineNumber > 0 ? lineNumber : 1;
  return `cursor://file${encodedFilePath}:${resolvedLineNumber}:1`;
};

export const getHoverLabelStyle = (hoverBounds: HoverBounds): CSSProperties => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(INSPECTOR_HOVER_LABEL_VIEWPORT_MARGIN_PX, viewportWidth - INSPECTOR_HOVER_LABEL_MAX_WIDTH_PX);
  const left = Math.min(
    Math.max(hoverBounds.left, INSPECTOR_HOVER_LABEL_VIEWPORT_MARGIN_PX),
    maxLeft,
  );

  const hasRoomAbove = hoverBounds.top >= INSPECTOR_HOVER_LABEL_RESERVED_HEIGHT_PX;

  if (hasRoomAbove) {
    return {
      left,
      top: hoverBounds.top,
      transform: "translateY(-100%)",
    };
  }

  const maxTop = Math.max(
    INSPECTOR_HOVER_LABEL_VIEWPORT_MARGIN_PX,
    viewportHeight - INSPECTOR_HOVER_LABEL_RESERVED_HEIGHT_PX,
  );
  const top = Math.min(hoverBounds.top + hoverBounds.height, maxTop);

  return {
    left,
    top,
    transform: "none",
  };
};

export const isElementInInspectorOverlay = (target: Element, shellElement: HTMLDivElement | null): boolean => {
  if (shellElement?.contains(target)) return true;
  return Boolean(target.closest("[data-inspector-overlay='true']"));
};

export const fetchBlame = async (
  endpoint: string,
  sourceInfo: ElementInfo["source"],
): Promise<{ blame: SourceBlameResponse | null; error: string | null }> => {
  if (!sourceInfo?.filePath) {
    return { blame: null, error: "no source location found for this element" };
  }

  const requestPayload: SourceBlameRequest = {
    filePath: sourceInfo.filePath,
    lineNumber: sourceInfo.lineNumber,
  };

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), BLAME_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorPayload: unknown = await response.json().catch(() => null);
      const errorResponse = isSourceBlameErrorResponse(errorPayload) ? errorPayload : null;
      return {
        blame: null,
        error: errorResponse?.error ?? `Blame request failed with status ${response.status}`,
      };
    }

    const payload: unknown = await response.json();
    if (!isSourceBlameResponse(payload)) {
      return { blame: null, error: "invalid blame response shape" };
    }
    return { blame: payload, error: null };
  } catch {
    return { blame: null, error: "unable to fetch git blame data" };
  } finally {
    clearTimeout(timeoutHandle);
  }
};
