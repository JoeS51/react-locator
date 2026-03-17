import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { resolveElementInfo, type ElementInfo } from "element-source";
import {
  DEFAULT_BLAME_ENDPOINT,
  DEFAULT_CLICK_CAPTURE_ENABLED,
  INSPECTOR_HOVER_PREFETCH_DELAY_MS,
  INSPECTOR_HOVER_MIN_SIZE_PX,
  INSPECTOR_HOVER_SEARCH_MAX_ANCESTORS,
  INSPECTOR_ACTION_MESSAGE_TIMEOUT_MS,
  INSPECTOR_MODE_INTRO_DURATION_MS,
} from "../constants.js";
import type {
  SourceBlamePanelData,
  SourceBlameResponse,
  SourceInspectorProps,
} from "../types.js";
import { getPanelStyle, styles } from "./source-inspector-styles.js";
import {
  areHoverBoundsEqual,
  fetchBlame,
  formatAuthorDate,
  formatAuthorTime,
  getAuthorDisplayName,
  getBlameCacheKey,
  getHoverLabel,
  getHoverLabelStyle,
  getIdeFileLink,
  isElementInInspectorOverlay,
  isInspectorHelpKeybinding,
  isInspectorToggleKeybinding,
  isTypingContext,
  sanitizeSourceFilePath,
  type HoverBounds,
} from "./source-inspector-utils.js";

interface HoverResolution {
  element: Element;
  elementInfo: ElementInfo;
}

const HELP_DEMO_STYLE_TEXT = `
@keyframes inspector-help-cursor-move {
  0% { transform: translate3d(86px, 64px, 0) scale(1); opacity: 1; }
  42% { transform: translate3d(86px, 64px, 0) scale(1); opacity: 1; }
  50% { transform: translate3d(86px, 64px, 0) scale(0.88); opacity: 1; }
  58% { transform: translate3d(266px, 62px, 0) scale(1); opacity: 1; }
  92% { transform: translate3d(266px, 62px, 0) scale(1); opacity: 1; }
  100% { transform: translate3d(86px, 64px, 0) scale(1); opacity: 1; }
}
@keyframes inspector-help-highlight-move {
  0% { transform: translate3d(0, 0, 0); width: 174px; height: 62px; }
  50% { transform: translate3d(0, 0, 0); width: 174px; height: 62px; }
  58% { transform: translate3d(192px, 6px, 0); width: 150px; height: 54px; }
  100% { transform: translate3d(192px, 6px, 0); width: 150px; height: 54px; }
}
@keyframes inspector-help-label-primary {
  0% { opacity: 1; }
  57% { opacity: 1; }
  58% { opacity: 0; }
  100% { opacity: 0; }
}
@keyframes inspector-help-label-secondary {
  0% { opacity: 0; }
  57% { opacity: 0; }
  58% { opacity: 1; }
  100% { opacity: 1; }
}
`;

export const SourceInspector = ({
  endpoint = DEFAULT_BLAME_ENDPOINT,
  enabled = DEFAULT_CLICK_CAPTURE_ENABLED,
  className,
}: SourceInspectorProps) => {
  const [inspecting, setInspecting] = useState(false);
  const [hoverElementInfo, setHoverElementInfo] = useState<ElementInfo | null>(null);
  const [hoverBounds, setHoverBounds] = useState<HoverBounds | null>(null);
  const [data, setData] = useState<SourceBlamePanelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isGitDetailsVisible, setIsGitDetailsVisible] = useState(false);
  const [isModeIntroVisible, setIsModeIntroVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const shellElementRef = useRef<HTMLDivElement | null>(null);
  const hoveredElementRef = useRef<Element | null>(null);
  const resolvedHoverElementRef = useRef<Element | null>(null);
  const latestHoverTargetRef = useRef<Element | null>(null);
  const isHoverResolutionInFlightRef = useRef(false);
  const latestHoverBoundsRef = useRef<HoverBounds | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const actionMessageTimeoutRef = useRef<number | null>(null);
  const modeIntroTimeoutRef = useRef<number | null>(null);
  const hoverPrefetchTimeoutRef = useRef<number | null>(null);
  const elementInfoCacheRef = useRef<WeakMap<Element, ElementInfo>>(new WeakMap());
  const blameCacheRef = useRef<Map<string, { blame: SourceBlameResponse | null; error: string | null }>>(
    new Map(),
  );
  const isSelectionLocked = Boolean(data) && !isLoading;

  const setTransientActionMessage = useCallback((message: string) => {
    if (actionMessageTimeoutRef.current !== null) {
      window.clearTimeout(actionMessageTimeoutRef.current);
    }
    setActionMessage(message);
    actionMessageTimeoutRef.current = window.setTimeout(() => {
      setActionMessage(null);
      actionMessageTimeoutRef.current = null;
    }, INSPECTOR_ACTION_MESSAGE_TIMEOUT_MS);
  }, []);

  const resumeHoverMode = useCallback(() => {
    if (hoverPrefetchTimeoutRef.current !== null) {
      window.clearTimeout(hoverPrefetchTimeoutRef.current);
      hoverPrefetchTimeoutRef.current = null;
    }
    setIsPopupVisible(false);
    setData(null);
    setIsLoading(false);
    setActionMessage(null);
    hoveredElementRef.current = null;
    resolvedHoverElementRef.current = null;
    latestHoverTargetRef.current = null;
    latestHoverBoundsRef.current = null;
    setHoverElementInfo(null);
    setHoverBounds(null);
    setIsGitDetailsVisible(false);
    setIsModeIntroVisible(false);
  }, []);

  const resolveElementInfoCached = useCallback(async (target: Element): Promise<ElementInfo> => {
    const cached = elementInfoCacheRef.current.get(target);
    if (cached) return cached;
    const elementInfo = await resolveElementInfo(target);
    elementInfoCacheRef.current.set(target, elementInfo);
    return elementInfo;
  }, []);

  const resolveHoverCandidate = useCallback(
    async (target: Element): Promise<HoverResolution> => {
      let currentElement: Element | null = target;
      let depth = 0;
      let nearestWithSource: HoverResolution | null = null;

      while (currentElement && depth < INSPECTOR_HOVER_SEARCH_MAX_ANCESTORS) {
        if (isElementInInspectorOverlay(currentElement, shellElementRef.current)) break;

        const currentElementInfo = await resolveElementInfoCached(currentElement);
        if (currentElementInfo.source?.filePath) {
          nearestWithSource = {
            element: currentElement,
            elementInfo: currentElementInfo,
          };
          break;
        }

        currentElement = currentElement.parentElement;
        depth += 1;
      }

      if (!nearestWithSource) {
        return {
          element: target,
          elementInfo: await resolveElementInfoCached(target),
        };
      }

      return nearestWithSource;
    },
    [resolveElementInfoCached],
  );

  const applyHoverResolution = useCallback((hoverResolution: HoverResolution) => {
    const bounds = hoverResolution.element.getBoundingClientRect();
    const nextBounds: HoverBounds = {
      top: Math.round(bounds.top),
      left: Math.round(bounds.left),
      width: Math.max(Math.round(bounds.width), INSPECTOR_HOVER_MIN_SIZE_PX),
      height: Math.max(Math.round(bounds.height), INSPECTOR_HOVER_MIN_SIZE_PX),
    };

    const isSameResolvedElement = resolvedHoverElementRef.current === hoverResolution.element;
    const isSameBounds = areHoverBoundsEqual(latestHoverBoundsRef.current, nextBounds);

    resolvedHoverElementRef.current = hoverResolution.element;
    latestHoverBoundsRef.current = nextBounds;

    if (!isSameResolvedElement) {
      setHoverElementInfo(hoverResolution.elementInfo);
    }

    if (!isSameBounds) {
      setHoverBounds(nextBounds);
    }
  }, []);

  const processLatestHoverTarget = useCallback(async () => {
    if (isHoverResolutionInFlightRef.current) return;
    if (!inspecting || isHelpVisible || isSelectionLocked) return;

    isHoverResolutionInFlightRef.current = true;
    try {
      while (latestHoverTargetRef.current) {
        const target = latestHoverTargetRef.current;
        latestHoverTargetRef.current = null;
        const hoverResolution = await resolveHoverCandidate(target);

        if (latestHoverTargetRef.current) {
          continue;
        }

        applyHoverResolution(hoverResolution);
      }
    } finally {
      isHoverResolutionInFlightRef.current = false;
      if (latestHoverTargetRef.current) {
        void processLatestHoverTarget();
      }
    }
  }, [applyHoverResolution, inspecting, isHelpVisible, isSelectionLocked, resolveHoverCandidate]);

  const handleDocumentMove = useCallback(
    (event: MouseEvent) => {
      if (!inspecting) return;
      if (isHelpVisible) return;
      if (isSelectionLocked) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (isElementInInspectorOverlay(target, shellElementRef.current)) return;
      if (hoveredElementRef.current === target) return;

      hoveredElementRef.current = target;
      latestHoverTargetRef.current = target;
      if (moveFrameRef.current !== null) {
        cancelAnimationFrame(moveFrameRef.current);
      }
      moveFrameRef.current = requestAnimationFrame(() => {
        void processLatestHoverTarget();
      });
    },
    [inspecting, isHelpVisible, isSelectionLocked, processLatestHoverTarget],
  );

  const handleDocumentClick = useCallback(
    async (event: MouseEvent) => {
      if (!inspecting) return;
      if (isHelpVisible) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (isElementInInspectorOverlay(target, shellElementRef.current)) return;

      if (!event.altKey) return;

      event.preventDefault();
      event.stopPropagation();

      if (isSelectionLocked) return;

      setIsLoading(true);
      const hoverResolution = await resolveHoverCandidate(target);
      const bounds = hoverResolution.element.getBoundingClientRect();
      const nextBounds: HoverBounds = {
        top: Math.round(bounds.top),
        left: Math.round(bounds.left),
        width: Math.max(Math.round(bounds.width), INSPECTOR_HOVER_MIN_SIZE_PX),
        height: Math.max(Math.round(bounds.height), INSPECTOR_HOVER_MIN_SIZE_PX),
      };
      resolvedHoverElementRef.current = hoverResolution.element;
      latestHoverBoundsRef.current = nextBounds;
      latestHoverTargetRef.current = null;
      setHoverBounds(nextBounds);
      setHoverElementInfo(hoverResolution.elementInfo);

      const cacheKey = getBlameCacheKey(hoverResolution.elementInfo.source);
      const cached = cacheKey ? blameCacheRef.current.get(cacheKey) : null;
      const { blame, error } = cached ?? (await fetchBlame(endpoint, hoverResolution.elementInfo.source));
      if (cacheKey && !cached) {
        blameCacheRef.current.set(cacheKey, { blame, error });
      }
      setData({ elementInfo: hoverResolution.elementInfo, blame, error });
      setIsLoading(false);
    },
    [endpoint, inspecting, isHelpVisible, isSelectionLocked, resolveHoverCandidate],
  );

  useEffect(() => {
    if (!enabled || !inspecting) return;
    document.addEventListener("mousemove", handleDocumentMove, true);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("mousemove", handleDocumentMove, true);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [enabled, handleDocumentClick, handleDocumentMove, inspecting]);

  useEffect(() => {
    if (inspecting) return;
    setIsPopupVisible(false);
    setHoverElementInfo(null);
    setHoverBounds(null);
    hoveredElementRef.current = null;
    resolvedHoverElementRef.current = null;
    latestHoverTargetRef.current = null;
    latestHoverBoundsRef.current = null;
    if (moveFrameRef.current !== null) {
      cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
  }, [inspecting]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (isTypingContext(event.target)) return;

      if (isInspectorToggleKeybinding(event)) {
        event.preventDefault();
        setInspecting((previous) => {
          const nextValue = !previous;
          if (!nextValue) {
            setIsPopupVisible(false);
            setIsHelpVisible(false);
            setIsGitDetailsVisible(false);
            setIsModeIntroVisible(false);
            setHoverElementInfo(null);
            setHoverBounds(null);
            setData(null);
            setIsLoading(false);
          }
          return nextValue;
        });
        return;
      }

      if (isInspectorHelpKeybinding(event)) {
        event.preventDefault();
        setIsHelpVisible((previous) => !previous);
        return;
      }

      if (event.key !== "Escape") return;
      if (isHelpVisible) {
        setIsHelpVisible(false);
        return;
      }
      setInspecting(false);
      setIsPopupVisible(false);
      setIsHelpVisible(false);
      setIsGitDetailsVisible(false);
      setIsModeIntroVisible(false);
      setHoverElementInfo(null);
      setHoverBounds(null);
      setData(null);
      setIsLoading(false);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [enabled, isHelpVisible]);

  useEffect(() => {
    if (!enabled) return;
    if (!inspecting) {
      document.body.style.cursor = "";
      setIsModeIntroVisible(false);
      if (modeIntroTimeoutRef.current !== null) {
        window.clearTimeout(modeIntroTimeoutRef.current);
        modeIntroTimeoutRef.current = null;
      }
      return;
    }
    document.body.style.cursor = "crosshair";
    setIsModeIntroVisible(true);
    if (modeIntroTimeoutRef.current !== null) {
      window.clearTimeout(modeIntroTimeoutRef.current);
    }
    modeIntroTimeoutRef.current = window.setTimeout(() => {
      setIsModeIntroVisible(false);
      modeIntroTimeoutRef.current = null;
    }, INSPECTOR_MODE_INTRO_DURATION_MS);
    return () => {
      document.body.style.cursor = "";
      if (modeIntroTimeoutRef.current !== null) {
        window.clearTimeout(modeIntroTimeoutRef.current);
        modeIntroTimeoutRef.current = null;
      }
    };
  }, [enabled, inspecting]);

  useEffect(() => {
    if (!(isLoading || data)) {
      setIsPopupVisible(false);
      return;
    }
    setIsGitDetailsVisible(false);
    setIsPopupVisible(false);
    const frameRequest = requestAnimationFrame(() => {
      setIsPopupVisible(true);
    });
    return () => {
      cancelAnimationFrame(frameRequest);
    };
  }, [data, isLoading]);

  useEffect(() => {
    if (!(isLoading || data || isHelpVisible)) return;

    const blockBackgroundPointerEvent = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (isElementInInspectorOverlay(target, shellElementRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("mousedown", blockBackgroundPointerEvent, true);
    document.addEventListener("click", blockBackgroundPointerEvent, true);
    return () => {
      document.removeEventListener("mousedown", blockBackgroundPointerEvent, true);
      document.removeEventListener("click", blockBackgroundPointerEvent, true);
    };
  }, [data, isHelpVisible, isLoading]);

  useEffect(() => {
    if (!inspecting || isSelectionLocked || isLoading || isHelpVisible) return;
    const cacheKey = getBlameCacheKey(hoverElementInfo?.source ?? null);
    if (!cacheKey) return;
    if (blameCacheRef.current.has(cacheKey)) return;

    if (hoverPrefetchTimeoutRef.current !== null) {
      window.clearTimeout(hoverPrefetchTimeoutRef.current);
    }

    hoverPrefetchTimeoutRef.current = window.setTimeout(() => {
      void fetchBlame(endpoint, hoverElementInfo?.source ?? null).then((result) => {
        blameCacheRef.current.set(cacheKey, result);
      });
      hoverPrefetchTimeoutRef.current = null;
    }, INSPECTOR_HOVER_PREFETCH_DELAY_MS);

    return () => {
      if (hoverPrefetchTimeoutRef.current !== null) {
        window.clearTimeout(hoverPrefetchTimeoutRef.current);
        hoverPrefetchTimeoutRef.current = null;
      }
    };
  }, [endpoint, hoverElementInfo?.source, inspecting, isHelpVisible, isLoading, isSelectionLocked]);

  useEffect(() => {
    return () => {
      if (moveFrameRef.current !== null) {
        cancelAnimationFrame(moveFrameRef.current);
      }
      if (actionMessageTimeoutRef.current !== null) {
        window.clearTimeout(actionMessageTimeoutRef.current);
      }
      if (hoverPrefetchTimeoutRef.current !== null) {
        window.clearTimeout(hoverPrefetchTimeoutRef.current);
      }
      if (modeIntroTimeoutRef.current !== null) {
        window.clearTimeout(modeIntroTimeoutRef.current);
      }
      latestHoverTargetRef.current = null;
      isHoverResolutionInFlightRef.current = false;
    };
  }, []);

  const panelStyle = getPanelStyle(isPopupVisible);

  const stopOverlayPropagation = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const blockOverlayBackgroundEvent = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const copyToClipboard = useCallback(
    async (value: string, successMessage: string) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setTransientActionMessage(successMessage);
      } catch {
        setTransientActionMessage("clipboard access failed");
      }
    },
    [setTransientActionMessage],
  );

  const sourceFilePath = data?.elementInfo.source?.filePath ?? null;
  const sourceLineNumber = data?.elementInfo.source?.lineNumber ?? null;
  const ideFileLink = sourceFilePath ? getIdeFileLink(sourceFilePath, sourceLineNumber) : null;
  const analysisTitle = data?.elementInfo.componentName ?? (isLoading ? "Analyzing..." : "Unknown Component");

  if (!enabled) return null;

  return (
    <div ref={shellElementRef} className={className} style={styles.shell} data-inspector-overlay="true">
      {inspecting && (
        <>
          <div style={styles.modeFrame} />
          <div
            style={{
              ...styles.modeIntroOverlay,
              opacity: isModeIntroVisible ? 1 : 0,
              visibility: isModeIntroVisible ? "visible" : "hidden",
            }}
          >
            <div style={styles.modeIntroCard}>
              <p style={styles.modeIntroTitle}>inspector enabled</p>
              <p style={styles.modeIntroHint}>hover components · option + click to analyze · esc to exit</p>
            </div>
          </div>
        </>
      )}

      {inspecting && !isHelpVisible && hoverBounds && (
        <div
          style={{
            ...styles.hoverOutline,
            top: hoverBounds.top,
            left: hoverBounds.left,
            width: hoverBounds.width,
            height: hoverBounds.height,
          }}
        />
      )}

      {inspecting && !isHelpVisible && !isSelectionLocked && !isLoading && hoverBounds && hoverElementInfo && (
        <div
          style={{
            ...styles.hoverLabel,
            ...getHoverLabelStyle(hoverBounds),
          }}
        >
          {getHoverLabel(hoverElementInfo)}
        </div>
      )}

      {(isLoading || data) && (
        <>
          <div
            style={{ ...styles.modalBackdrop, opacity: isPopupVisible ? 1 : 0 }}
            onMouseDown={blockOverlayBackgroundEvent}
            onClick={blockOverlayBackgroundEvent}
          />
          <div style={styles.modalContainer}>
            <div style={panelStyle} onMouseDown={stopOverlayPropagation} onClick={stopOverlayPropagation}>
              <div style={styles.panelHeader}>
                <h3 style={styles.panelTitle}>{analysisTitle}</h3>
                <div style={styles.panelActions}>
                  <button type="button" style={styles.panelCloseButton} onClick={resumeHoverMode}>
                    x
                  </button>
                </div>
              </div>

              {data && (
                <div style={styles.actionBar}>
                  <button
                    type="button"
                    style={styles.actionButton}
                    onClick={() => {
                      if (!ideFileLink) {
                        setTransientActionMessage("source path unavailable");
                        return;
                      }
                      window.open(ideFileLink, "_self");
                    }}
                  >
                    open in IDE
                  </button>
                  {actionMessage ? <span style={styles.actionMessage}>{actionMessage}</span> : null}
                </div>
              )}

              {data && (
                <>
                  <div style={styles.section}>
                    <p style={styles.sectionTitle}>source location</p>
                    <div style={styles.row}>
                      <span style={styles.key}>file</span>
                      <div style={styles.rowValueInline}>
                        {data.elementInfo.source?.filePath ? (
                          <a
                            href={getIdeFileLink(
                              data.elementInfo.source.filePath,
                              data.elementInfo.source.lineNumber,
                            )}
                            style={styles.linkValue}
                          >
                            {data.elementInfo.source.filePath}
                          </a>
                        ) : (
                          <code style={styles.codeValue}>n/a</code>
                        )}
                        <button
                          type="button"
                          style={styles.iconButton}
                          aria-label="Copy source path"
                          title="Copy source path"
                          onClick={() => {
                            const sourcePath = data.elementInfo.source?.filePath;
                            if (!sourcePath) {
                              setTransientActionMessage("source path unavailable");
                              return;
                            }
                            void copyToClipboard(sanitizeSourceFilePath(sourcePath), "source path copied");
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.iconSvg}>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div style={styles.row}>
                      <span style={styles.key}>line</span>
                      <code style={styles.codeValue}>{data.elementInfo.source?.lineNumber ?? "n/a"}</code>
                    </div>
                  </div>

                  {data.error ? (
                    <div style={styles.section}>
                      <p style={styles.sectionTitle}>error</p>
                      <div style={styles.row}>
                        <span style={styles.key}>message</span>
                        <span style={styles.value}>{data.error}</span>
                      </div>
                    </div>
                  ) : null}

                  {data.blame && (
                    <div style={styles.section}>
                    <p style={styles.sectionTitle}>git</p>
                      <p style={styles.gitSummaryMeta}>
                        {getAuthorDisplayName(data.blame)} • {formatAuthorDate(data.blame.authorTimeUnix)}
                      </p>
                      <p style={styles.gitSummaryText}>{data.blame.summary || "no summary"}</p>
                      <div style={styles.gitActions}>
                        {data.blame.commitUrl ? (
                          <a
                            href={data.blame.commitUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.gitActionButton}
                          >
                            [ View commit ]
                          </a>
                        ) : (
                          <span style={styles.value}>commit url unavailable</span>
                        )}
                        <button
                          type="button"
                          style={styles.gitActionButton}
                          onClick={() => {
                            setIsGitDetailsVisible((previous) => !previous);
                          }}
                        >
                          {isGitDetailsVisible ? "▲ Less details" : "▼ More details"}
                        </button>
                      </div>

                      {isGitDetailsVisible && (
                        <>
                          <div style={styles.row}>
                            <span style={styles.key}>commit</span>
                            <code style={styles.codeValue}>{data.blame.commitSha}</code>
                          </div>

                          <div style={styles.row}>
                            <span style={styles.key}>email</span>
                            <span style={styles.value}>{data.blame.authorEmail || "unknown"}</span>
                          </div>

                          <div style={styles.row}>
                            <span style={styles.key}>date</span>
                            <span style={styles.value}>{formatAuthorTime(data.blame.authorTimeUnix)}</span>
                          </div>

                          <div style={styles.row}>
                            <span style={styles.key}>url</span>
                            {data.blame.commitUrl ? (
                              <a
                                href={data.blame.commitUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.linkValue}
                              >
                                {data.blame.commitUrl}
                              </a>
                            ) : (
                              <span style={styles.value}>n/a</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {isHelpVisible && (
        <>
          <div
            style={{ ...styles.modalBackdrop, opacity: 1 }}
            onMouseDown={blockOverlayBackgroundEvent}
            onClick={blockOverlayBackgroundEvent}
          />
          <div style={styles.modalContainer}>
            <div style={styles.helpPanel} onMouseDown={stopOverlayPropagation} onClick={stopOverlayPropagation}>
              <style>{HELP_DEMO_STYLE_TEXT}</style>
              <div style={styles.panelHeader}>
                <h3 style={styles.helpTitle}>quick guide</h3>
                <button type="button" style={styles.panelCloseButton} onClick={() => setIsHelpVisible(false)}>
                  x
                </button>
              </div>
              <div style={styles.helpDemo}>
                <div style={styles.helpDemoCanvas}>
                  <div style={styles.helpDemoCardPrimary}>
                    <div style={{ ...styles.helpDemoCardLine, width: "70%" }} />
                    <div style={{ ...styles.helpDemoCardLine, width: "48%", marginBottom: 0 }} />
                  </div>
                  <div style={styles.helpDemoCardSecondary}>
                    <div style={{ ...styles.helpDemoCardLine, width: "62%" }} />
                    <div style={{ ...styles.helpDemoCardLine, width: "42%", marginBottom: 0 }} />
                  </div>
                </div>
                <div style={styles.helpDemoHighlight} />
                <div style={{ ...styles.helpDemoLabel, ...styles.helpDemoLabelPrimary }}>Component 1</div>
                <div style={{ ...styles.helpDemoLabel, ...styles.helpDemoLabelSecondary }}>Component 2</div>
                <div style={styles.helpDemoCursor} />
              </div>
              <ul style={styles.helpList}>
                <li style={styles.helpListItem}>`cmd + option + i` toggles element source mode</li>
                <li style={styles.helpListItem}>move the cursor to preview component boundaries</li>
                <li style={styles.helpListItem}>`option + click` captures the selection and opens analysis</li>
                <li style={styles.helpListItem}>use the action button to open the selected component in your IDE</li>
                <li style={styles.helpListItem}>`esc` exits analysis mode at any time</li>
              </ul>
              <p style={styles.helpFooter}>tip: press `cmd + option + h` anytime to reopen this guide</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
