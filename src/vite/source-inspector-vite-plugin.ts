import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  DEFAULT_BLAME_ENDPOINT,
  FALLBACK_LINE_NUMBER,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_METHOD_NOT_ALLOWED,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
  JSON_RESPONSE_SPACE_COUNT,
  MAX_REQUEST_BODY_BYTES,
  SOURCE_REFERENCE_MAX_LINE_NUMBER,
  SOURCE_REFERENCE_MIN_LINE_NUMBER,
} from "../constants.js";
import { resolveGitBlame } from "../server/git-blame.js";
import type {
  SourceBlameErrorResponse,
  SourceBlameRequest,
  SourceBlameResponse,
  SourceBlameVitePluginOptions,
} from "../types.js";

const DEFAULT_GIT_BINARY = "git";
const UTF8_ENCODING = "utf8";
const JSON_CONTENT_TYPE = "application/json";
const REQUEST_METHOD_POST = "POST";
const REQUEST_BODY_TOO_LARGE_ERROR = "Request body too large";
const SOURCE_LINE_SUFFIX_PATTERN = /:(\d+)(?::\d+)?$/;
const VITE_FS_PREFIX = "/@fs";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  return true;
};

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: SourceBlameResponse | SourceBlameErrorResponse,
): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", JSON_CONTENT_TYPE);
  response.end(JSON.stringify(body, null, JSON_RESPONSE_SPACE_COUNT));
};

const readBodyText = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new Error(REQUEST_BODY_TOO_LARGE_ERROR);
    }
    chunks.push(bufferChunk);
  }

  return Buffer.concat(chunks).toString(UTF8_ENCODING);
};

interface ParsedSourceReference {
  filePath: string;
  lineNumber: number | null;
}

const stripQueryAndHash = (value: string): string => {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const firstIndex = [queryIndex, hashIndex].filter((index) => index >= 0).sort((left, right) => left - right)[0];
  if (firstIndex === undefined) return value;
  return value.slice(0, firstIndex);
};

const parseLineNumber = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < SOURCE_REFERENCE_MIN_LINE_NUMBER) return SOURCE_REFERENCE_MIN_LINE_NUMBER;
  if (parsed > SOURCE_REFERENCE_MAX_LINE_NUMBER) return SOURCE_REFERENCE_MAX_LINE_NUMBER;
  return parsed;
};

const parseSourceReference = (rawFilePath: string, rawLineNumber: number | null): ParsedSourceReference => {
  const sanitizedPath = stripQueryAndHash(rawFilePath.trim());
  const lineMatch = sanitizedPath.match(SOURCE_LINE_SUFFIX_PATTERN);

  const lineFromPath = lineMatch ? parseLineNumber(lineMatch[1] ?? "") : null;
  const normalizedLineNumber =
    rawLineNumber === null || rawLineNumber === undefined ? lineFromPath : parseLineNumber(String(rawLineNumber));

  const pathWithoutLine = lineMatch
    ? sanitizedPath.slice(0, Math.max(0, sanitizedPath.length - lineMatch[0].length))
    : sanitizedPath;

  return {
    filePath: pathWithoutLine,
    lineNumber: normalizedLineNumber,
  };
};

const parseRequestBody = (bodyText: string): SourceBlameRequest | null => {
  try {
    const parsedValue: unknown = JSON.parse(bodyText);
    if (!isRecord(parsedValue)) return null;

    const filePath = parsedValue.filePath;
    if (typeof filePath !== "string") return null;

    const lineNumberCandidate = parsedValue.lineNumber;
    const lineNumber =
      lineNumberCandidate === undefined || lineNumberCandidate === null
        ? null
        : typeof lineNumberCandidate === "number"
          ? lineNumberCandidate
          : null;

    if (lineNumberCandidate !== undefined && lineNumberCandidate !== null && lineNumber === null) {
      return null;
    }

    return {
      filePath,
      lineNumber,
    };
  } catch {
    return null;
  }
};

const normalizeResolvedPath = (projectRoot: string, filePath: string): string => {
  if (filePath.startsWith(`${VITE_FS_PREFIX}/`)) {
    return path.resolve(filePath.slice(VITE_FS_PREFIX.length));
  }

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const pathname = new URL(filePath).pathname;
    const decodedPathname = decodeURIComponent(pathname);
    if (decodedPathname.startsWith(`${VITE_FS_PREFIX}/`)) {
      return path.resolve(decodedPathname.slice(VITE_FS_PREFIX.length));
    }
    return path.resolve(projectRoot, decodedPathname.slice(1));
  }

  if (filePath.startsWith("file://")) {
    const pathname = decodeURIComponent(new URL(filePath).pathname);
    return path.resolve(pathname);
  }

  if (path.isAbsolute(filePath)) {
    const absolutePath = path.resolve(filePath);
    if (existsSync(absolutePath)) return absolutePath;
    return path.resolve(projectRoot, filePath.slice(1));
  }

  return path.resolve(projectRoot, filePath);
};

const isPathInsideRoot = (projectRoot: string, filePath: string): boolean => {
  const relative = path.relative(projectRoot, filePath);
  if (relative.startsWith("..")) return false;
  return !path.isAbsolute(relative);
};

const resolveLineNumber = (lineNumber: number | null): number => {
  if (lineNumber === null) return FALLBACK_LINE_NUMBER;
  if (lineNumber < FALLBACK_LINE_NUMBER) return FALLBACK_LINE_NUMBER;
  if (lineNumber > SOURCE_REFERENCE_MAX_LINE_NUMBER) return SOURCE_REFERENCE_MAX_LINE_NUMBER;
  return Math.floor(lineNumber);
};

const hasFile = async (absoluteFilePath: string): Promise<boolean> => {
  if (!existsSync(absoluteFilePath)) return false;
  try {
    await readFile(absoluteFilePath, UTF8_ENCODING);
    return true;
  } catch {
    return false;
  }
};

export const sourceInspectorVitePlugin = (
  options: SourceBlameVitePluginOptions = {},
): Plugin => {
  const endpoint = options.endpoint ?? DEFAULT_BLAME_ENDPOINT;
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const gitBinary = options.gitBinary ?? DEFAULT_GIT_BINARY;

  return {
    name: "react-source-inspector",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = request.url ?? "";
        const requestPath = stripQueryAndHash(requestUrl);
        if (requestPath !== endpoint) {
          next();
          return;
        }

        if (request.method !== REQUEST_METHOD_POST) {
          writeJson(response, HTTP_STATUS_METHOD_NOT_ALLOWED, {
            error: "Only POST is supported",
          });
          return;
        }

        try {
          const bodyText = await readBodyText(request);
          const payload = parseRequestBody(bodyText);
          if (!payload) {
            writeJson(response, HTTP_STATUS_BAD_REQUEST, {
              error: "Invalid payload. Expected filePath and optional lineNumber",
            });
            return;
          }

          const sourceReference = parseSourceReference(payload.filePath, payload.lineNumber);
          const absoluteFilePath = normalizeResolvedPath(projectRoot, sourceReference.filePath);
          if (!isPathInsideRoot(projectRoot, absoluteFilePath)) {
            writeJson(response, HTTP_STATUS_BAD_REQUEST, {
              error: "File path is outside the project root",
            });
            return;
          }

          const fileExists = await hasFile(absoluteFilePath);
          if (!fileExists) {
            writeJson(response, HTTP_STATUS_NOT_FOUND, {
              error: "File does not exist on disk",
            });
            return;
          }

          const blame = await resolveGitBlame(
            gitBinary,
            projectRoot,
            absoluteFilePath,
            resolveLineNumber(sourceReference.lineNumber),
          );

          if (!blame) {
            writeJson(response, HTTP_STATUS_NOT_FOUND, {
              error: "Unable to resolve git blame for this file and line",
            });
            return;
          }

          writeJson(response, HTTP_STATUS_OK, blame);
        } catch (error) {
          if (error instanceof Error && error.message === REQUEST_BODY_TOO_LARGE_ERROR) {
            writeJson(response, HTTP_STATUS_PAYLOAD_TOO_LARGE, {
              error: "Request body too large",
            });
            return;
          }

          writeJson(response, HTTP_STATUS_INTERNAL_SERVER_ERROR, {
            error: "Unexpected source inspector server error",
          });
        }
      });
    },
  };
};
