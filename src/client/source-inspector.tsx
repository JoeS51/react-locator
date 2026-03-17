import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { resolveElementInfo, type ElementInfo } from "element-source";
import {
  DEFAULT_BLAME_ENDPOINT,
  DEFAULT_CLICK_CAPTURE_ENABLED,
  INSPECTOR_HOVER_PREFETCH_DELAY_MS,
  INSPECTOR_HOVER_MIN_SIZE_PX,
  INSPECTOR_HOVER_SEARCH_MAX_ANCESTORS,
  INSPECTOR_ACTION_MESSAGE_TIMEOUT_MS,
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
  const [isElementDetailsVisible, setIsElementDetailsVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const shellElementRef = useRef<HTMLDivElement | null>(null);
  const hoveredElementRef = useRef<Element | null>(null);
  const resolvedHoverElementRef = useRef<Element | null>(null);
  const latestHoverTargetRef = useRef<Element | null>(null);
  const isHoverResolutionInFlightRef = useRef(false);
  const latestHoverBoundsRef = useRef<HoverBounds | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const actionMessageTimeoutRef = useRef<number | null>(null);
  const hoverPrefetchTimeoutRef = useRef<number | null>(null);
  const elementInfoCacheRef = useRef<WeakMap<Element, ElementInfo>>(new WeakMap());
  const blameCacheRef = useRef<Map<string, { blame: SourceBlameResponse | null; error: string | null }>>(
    new Map(),
  );
  const isSelectionLocked = Boolean(data) && !isLoading;
  const inspectorModeTitle = isSelectionLocked || isLoading ? "analysis mode" : "hover mode";
  const inspectorModeHint = "";

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
    setIsElementDetailsVisible(false);
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
            setIsElementDetailsVisible(false);
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
      setIsElementDetailsVisible(false);
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
      return;
    }
    document.body.style.cursor = "crosshair";
    return () => {
      document.body.style.cursor = "";
    };
  }, [enabled, inspecting]);

  useEffect(() => {
    if (!(isLoading || data)) {
      setIsPopupVisible(false);
      return;
    }
    setIsGitDetailsVisible(false);
    setIsElementDetailsVisible(false);
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

  const sourceFilePath = data?.elementInfo.source?.filePath ?? null;
  const sourceLineNumber = data?.elementInfo.source?.lineNumber ?? null;
  const ideFileLink = sourceFilePath ? getIdeFileLink(sourceFilePath, sourceLineNumber) : null;
  const analysisTitle = data?.elementInfo.componentName ?? (isLoading ? "Analyzing..." : "Unknown Component");
  const normalizedSourceFilePath = sourceFilePath ? sanitizeSourceFilePath(sourceFilePath) : null;
  const sourceFileName = normalizedSourceFilePath ? normalizedSourceFilePath.split("/").filter(Boolean).at(-1) : null;
  const sourcePrimaryLabel = sourceFileName
    ? `${sourceFileName}:${sourceLineNumber ?? "n/a"}`
    : "source file unavailable";

  if (!enabled) return null;

  return (
    <div ref={shellElementRef} className={className} style={styles.shell} data-inspector-overlay="true">
      {inspecting && (
        <>
          <div style={styles.modeFrame} />
          <div
            style={{
              ...styles.modeBanner,
              ...(isSelectionLocked || isLoading ? styles.modeBannerAnalysis : styles.modeBannerHover),
            }}
          >
            <span
              style={{
                ...styles.modeDot,
                ...(isSelectionLocked || isLoading ? styles.modeDotAnalysis : styles.modeDotHover),
              }}
            />
            <span style={styles.modeText}>{inspectorModeTitle}</span>
            {inspectorModeHint ? <span style={styles.modeHint}>{inspectorModeHint}</span> : null}
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
                    🚀 Open in IDE
                  </button>
                  {actionMessage ? <span style={styles.actionMessage}>{actionMessage}</span> : null}
                </div>
              )}

              {data && (
                <>
                  <div style={styles.fileMetaBlock}>
                    <p style={styles.fileMetaPrimary}>📄 {sourcePrimaryLabel}</p>
                    <p style={styles.fileMetaSecondary}>{normalizedSourceFilePath ?? "n/a"}</p>
                  </div>

                  <button
                    type="button"
                    style={styles.inlineDetailsButton}
                    onClick={() => {
                      setIsElementDetailsVisible((previous) => !previous);
                    }}
                  >
                    {isElementDetailsVisible ? "▲ Element details" : "▼ Element details"}
                  </button>

                  {isElementDetailsVisible && (
                    <div style={styles.row}>
                      <span style={styles.key}>tag</span>
                      <code style={styles.codeValue}>{data.elementInfo.tagName || "n/a"}</code>
                    </div>
                  )}

                  {isElementDetailsVisible && (
                    <div style={styles.row}>
                      <span style={styles.key}>component</span>
                      <code style={styles.codeValue}>{data.elementInfo.componentName ?? "n/a"}</code>
                    </div>
                  )}

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
                    <div style={styles.gitBlock}>
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
              <div style={styles.panelHeader}>
                <h3 style={styles.helpTitle}>quick guide</h3>
                <button type="button" style={styles.panelCloseButton} onClick={() => setIsHelpVisible(false)}>
                  x
                </button>
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
