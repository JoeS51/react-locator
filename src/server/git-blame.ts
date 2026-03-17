import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GIT_EXEC_TIMEOUT_MS } from "../constants.js";
import type { ParsedGitBlame, SourceBlameResponse } from "../types.js";

const execFileAsync = promisify(execFile);

const UNKNOWN_GIT_VALUE = "Unknown";
const GITHUB_HOST = "github.com";
const GITHUB_HTTPS_PREFIX = `https://${GITHUB_HOST}/`;
const GITHUB_SSH_PREFIX = `git@${GITHUB_HOST}:`;
const GIT_SSH_SUFFIX = ".git";
const GIT_BLAME_PORCELAIN_ARGS = ["blame", "--porcelain"];
const UTF8_ENCODING = "utf8";
const EMPTY_SHA_PATTERN = /^0+$/;
const UNKNOWN_AUTHOR_TIME_UNIX = 0;
const DECIMAL_RADIX = 10;
const GIT_LOG_FORMAT = "%H%n%an%n%ae%n%at%n%s";
const GIT_LOG_EXPECTED_LINE_COUNT = 5;
const WORKING_TREE_COMMIT_SHA = "working-tree";

const parseGitBlameOutput = (stdout: string): ParsedGitBlame | null => {
  const lines = stdout.split("\n");
  const header = lines[0]?.trim();
  if (!header) return null;

  const headerParts = header.split(" ");
  const commitSha = headerParts[0] ?? "";
  if (commitSha.length === 0) return null;

  let authorName = UNKNOWN_GIT_VALUE;
  let authorEmail = UNKNOWN_GIT_VALUE;
  let authorTimeUnix = UNKNOWN_AUTHOR_TIME_UNIX;
  let summary = UNKNOWN_GIT_VALUE;

  for (const line of lines) {
    if (line.startsWith("author ")) {
      authorName = line.slice("author ".length).trim();
      continue;
    }
    if (line.startsWith("author-mail ")) {
      authorEmail = line.slice("author-mail ".length).replace(/[<>]/g, "").trim();
      continue;
    }
    if (line.startsWith("author-time ")) {
      const value = Number.parseInt(line.slice("author-time ".length).trim(), DECIMAL_RADIX);
      authorTimeUnix = Number.isFinite(value) ? value : UNKNOWN_AUTHOR_TIME_UNIX;
      continue;
    }
    if (line.startsWith("summary ")) {
      summary = line.slice("summary ".length).trim();
    }
  }

  return {
    commitSha,
    authorName,
    authorEmail,
    authorTimeUnix,
    summary,
  };
};

const parseGithubRepoPath = (remoteUrl: string): string | null => {
  if (remoteUrl.startsWith(GITHUB_HTTPS_PREFIX)) {
    const repositoryPath = remoteUrl.slice(GITHUB_HTTPS_PREFIX.length);
    return repositoryPath.endsWith(GIT_SSH_SUFFIX)
      ? repositoryPath.slice(0, repositoryPath.length - GIT_SSH_SUFFIX.length)
      : repositoryPath;
  }

  if (remoteUrl.startsWith(GITHUB_SSH_PREFIX)) {
    const repositoryPath = remoteUrl.slice(GITHUB_SSH_PREFIX.length);
    return repositoryPath.endsWith(GIT_SSH_SUFFIX)
      ? repositoryPath.slice(0, repositoryPath.length - GIT_SSH_SUFFIX.length)
      : repositoryPath;
  }

  return null;
};

const getCommitUrl = async (
  gitBinary: string,
  projectRoot: string,
  commitSha: string,
): Promise<string | null> => {
  if (!commitSha || EMPTY_SHA_PATTERN.test(commitSha)) return null;

  try {
    const remote = (await execFileAsync(gitBinary, ["config", "--get", "remote.origin.url"], {
      cwd: projectRoot,
      timeout: GIT_EXEC_TIMEOUT_MS,
      encoding: UTF8_ENCODING,
    })).stdout;
    const repositoryPath = parseGithubRepoPath(remote.trim());
    if (!repositoryPath) return null;
    return `${GITHUB_HTTPS_PREFIX}${repositoryPath}/commit/${commitSha}`;
  } catch {
    return null;
  }
};

const parseGitLogOutput = (stdout: string): ParsedGitBlame | null => {
  const lines = stdout.trim().split("\n");
  if (lines.length < GIT_LOG_EXPECTED_LINE_COUNT) return null;

  const commitSha = (lines[0] ?? "").trim();
  if (!commitSha) return null;

  const authorName = (lines[1] ?? UNKNOWN_GIT_VALUE).trim();
  const authorEmail = (lines[2] ?? UNKNOWN_GIT_VALUE).trim();
  const authorTimeUnix = Number.parseInt((lines[3] ?? "0").trim(), DECIMAL_RADIX);
  const summary = lines.slice(4).join("\n").trim() || UNKNOWN_GIT_VALUE;

  return {
    commitSha,
    authorName,
    authorEmail,
    authorTimeUnix: Number.isFinite(authorTimeUnix) ? authorTimeUnix : UNKNOWN_AUTHOR_TIME_UNIX,
    summary,
  };
};

const resolveLatestFileCommit = async (
  gitBinary: string,
  projectRoot: string,
  absoluteFilePath: string,
): Promise<ParsedGitBlame | null> => {
  try {
    const result = await execFileAsync(
      gitBinary,
      ["log", "-1", `--format=${GIT_LOG_FORMAT}`, "--", absoluteFilePath],
      {
        cwd: projectRoot,
        timeout: GIT_EXEC_TIMEOUT_MS,
        encoding: UTF8_ENCODING,
      },
    );
    return parseGitLogOutput(result.stdout);
  } catch {
    return null;
  }
};

const toSourceBlameResponse = async (
  gitBinary: string,
  projectRoot: string,
  parsedGitBlame: ParsedGitBlame,
  resolutionType: SourceBlameResponse["resolutionType"],
): Promise<SourceBlameResponse> => {
  const commitUrl = await getCommitUrl(gitBinary, projectRoot, parsedGitBlame.commitSha);
  return {
    ...parsedGitBlame,
    commitUrl,
    resolutionType,
  };
};

const resolveUncommittedFallback = async (
  gitBinary: string,
  projectRoot: string,
  absoluteFilePath: string,
): Promise<SourceBlameResponse | null> => {
  const latestFileCommit = await resolveLatestFileCommit(gitBinary, projectRoot, absoluteFilePath);
  if (latestFileCommit) {
    return toSourceBlameResponse(gitBinary, projectRoot, latestFileCommit, "uncommitted");
  }

  return {
    commitSha: WORKING_TREE_COMMIT_SHA,
    authorName: "uncommitted changes",
    authorEmail: "",
    authorTimeUnix: UNKNOWN_AUTHOR_TIME_UNIX,
    summary: "line has local uncommitted changes",
    commitUrl: null,
    resolutionType: "uncommitted",
  };
};

export const resolveGitBlame = async (
  gitBinary: string,
  projectRoot: string,
  absoluteFilePath: string,
  lineNumber: number,
): Promise<SourceBlameResponse | null> => {
  const blameArgs = [
    ...GIT_BLAME_PORCELAIN_ARGS,
    "-L",
    `${lineNumber},${lineNumber}`,
    "--",
    absoluteFilePath,
  ];

  try {
    const result = await execFileAsync(gitBinary, blameArgs, {
      cwd: projectRoot,
      timeout: GIT_EXEC_TIMEOUT_MS,
      encoding: UTF8_ENCODING,
    });

    const parsed = parseGitBlameOutput(result.stdout);
    if (parsed && !EMPTY_SHA_PATTERN.test(parsed.commitSha)) {
      return toSourceBlameResponse(gitBinary, projectRoot, parsed, "line");
    }

    if (parsed && EMPTY_SHA_PATTERN.test(parsed.commitSha)) {
      return resolveUncommittedFallback(gitBinary, projectRoot, absoluteFilePath);
    }
  } catch {
    const latestFileCommit = await resolveLatestFileCommit(gitBinary, projectRoot, absoluteFilePath);
    if (!latestFileCommit) return null;
    return toSourceBlameResponse(gitBinary, projectRoot, latestFileCommit, "file");
  }

  const latestFileCommit = await resolveLatestFileCommit(gitBinary, projectRoot, absoluteFilePath);
  if (!latestFileCommit) return null;
  return toSourceBlameResponse(gitBinary, projectRoot, latestFileCommit, "file");
};
