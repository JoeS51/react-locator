import { type CSSProperties } from "react";
import {
  INSPECTOR_FONT_FAMILY,
  INSPECTOR_FONT_SIZE_SM_PX,
  INSPECTOR_FONT_SIZE_TITLE_PX,
  INSPECTOR_FONT_SIZE_XS_PX,
  INSPECTOR_FONT_WEIGHT_BOLD,
  INSPECTOR_FONT_WEIGHT_MEDIUM,
  INSPECTOR_HOVER_LABEL_MAX_WIDTH_PX,
  INSPECTOR_HOVER_LABEL_PADDING_X_PX,
  INSPECTOR_HOVER_LABEL_PADDING_Y_PX,
  INSPECTOR_HOVER_LABEL_TRANSITION_DURATION_MS,
  INSPECTOR_HOVER_OUTLINE_RADIUS_PX,
  INSPECTOR_HOVER_OUTLINE_WIDTH_PX,
  INSPECTOR_HOVER_TRANSITION_DURATION_MS,
  INSPECTOR_KEY_COLUMN_WIDTH_PX,
  INSPECTOR_LETTER_SPACING_EM,
  INSPECTOR_LINE_HEIGHT,
  INSPECTOR_LINE_HEIGHT_COMPACT,
  INSPECTOR_MODE_BANNER_GAP_PX,
  INSPECTOR_MODE_BANNER_PADDING_X_PX,
  INSPECTOR_MODE_BANNER_PADDING_Y_PX,
  INSPECTOR_MODE_BANNER_TOP_PX,
  INSPECTOR_MODE_FRAME_BORDER_WIDTH_PX,
  INSPECTOR_MODE_FRAME_INSET_PX,
  INSPECTOR_PANEL_PADDING_PX,
  INSPECTOR_RADIUS_PX,
  INSPECTOR_ROW_GAP_PX,
  INSPECTOR_ROW_MARGIN_BOTTOM_PX,
  INSPECTOR_SECTION_GAP_PX,
  INSPECTOR_SECTION_PADDING_PX,
  PANEL_Z_INDEX,
  INSPECTOR_POPUP_TRANSITION_DURATION_MS,
  INSPECTOR_POPUP_CLOSED_SCALE_RATIO,
} from "../constants.js";

export interface InlineStyles {
  shell: CSSProperties;
  modalBackdrop: CSSProperties;
  modalContainer: CSSProperties;
  panel: CSSProperties;
  actionBar: CSSProperties;
  actionButton: CSSProperties;
  actionMessage: CSSProperties;
  panelHeader: CSSProperties;
  panelTitle: CSSProperties;
  panelActions: CSSProperties;
  panelCloseButton: CSSProperties;
  helpPanel: CSSProperties;
  helpTitle: CSSProperties;
  helpDemo: CSSProperties;
  helpDemoCanvas: CSSProperties;
  helpDemoCardPrimary: CSSProperties;
  helpDemoCardSecondary: CSSProperties;
  helpDemoCardLine: CSSProperties;
  helpDemoHighlight: CSSProperties;
  helpDemoLabel: CSSProperties;
  helpDemoLabelPrimary: CSSProperties;
  helpDemoLabelSecondary: CSSProperties;
  helpDemoCursor: CSSProperties;
  helpList: CSSProperties;
  helpListItem: CSSProperties;
  helpFooter: CSSProperties;
  modeBanner: CSSProperties;
  modeBannerHover: CSSProperties;
  modeBannerAnalysis: CSSProperties;
  modeDot: CSSProperties;
  modeDotHover: CSSProperties;
  modeDotAnalysis: CSSProperties;
  modeText: CSSProperties;
  modeHint: CSSProperties;
  modeFrame: CSSProperties;
  section: CSSProperties;
  sectionTitle: CSSProperties;
  gitSummaryMeta: CSSProperties;
  gitSummaryText: CSSProperties;
  gitActions: CSSProperties;
  gitActionButton: CSSProperties;
  hoverOutline: CSSProperties;
  hoverLabel: CSSProperties;
  row: CSSProperties;
  rowValueInline: CSSProperties;
  iconButton: CSSProperties;
  iconSvg: CSSProperties;
  key: CSSProperties;
  value: CSSProperties;
  codeValue: CSSProperties;
  linkValue: CSSProperties;
}

export const POPUP_VIEWPORT_MARGIN_PX = 16;
export const POPUP_MAX_WIDTH_PX = 860;
export const HELP_POPUP_MAX_WIDTH_PX = 540;

export const styles: InlineStyles = {
  shell: {
    position: "fixed",
    inset: 0,
    zIndex: PANEL_Z_INDEX,
    width: "100%",
    maxWidth: "100%",
    fontFamily: INSPECTOR_FONT_FAMILY,
    pointerEvents: "none",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(9, 9, 8, 0.56)",
    backdropFilter: "blur(1px)",
    pointerEvents: "auto",
    zIndex: PANEL_Z_INDEX,
    transitionProperty: "opacity",
    transitionDuration: "220ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  modalContainer: {
    position: "fixed",
    inset: 0,
    zIndex: PANEL_Z_INDEX,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    padding: POPUP_VIEWPORT_MARGIN_PX,
    boxSizing: "border-box",
  },
  panel: {
    borderRadius: INSPECTOR_RADIUS_PX,
    border: "1px solid #4a4a42",
    background: "#0a0a08",
    color: "#e8e6d7",
    padding: INSPECTOR_PANEL_PADDING_PX,
    fontSize: INSPECTOR_FONT_SIZE_SM_PX,
    lineHeight: INSPECTOR_LINE_HEIGHT,
    pointerEvents: "auto",
    maxHeight: "min(70vh, 560px)",
    overflowY: "auto",
    transitionProperty: "opacity, transform",
    transitionDuration: `${INSPECTOR_POPUP_TRANSITION_DURATION_MS}ms`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    boxShadow: "0 24px 40px -28px rgba(2, 6, 23, 0.95)",
    transformOrigin: "center",
    willChange: "opacity, transform",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: INSPECTOR_ROW_GAP_PX,
    marginBottom: INSPECTOR_SECTION_GAP_PX,
  },
  actionButton: {
    border: "1px solid #4a4a42",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#171714",
    color: "#efedd8",
    cursor: "pointer",
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_MEDIUM,
    padding: "5px 10px",
    lineHeight: INSPECTOR_LINE_HEIGHT_COMPACT,
  },
  actionMessage: {
    color: "#b5b4a6",
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    marginLeft: "auto",
    textTransform: "lowercase",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: INSPECTOR_SECTION_GAP_PX,
    gap: INSPECTOR_ROW_GAP_PX,
  },
  panelTitle: {
    margin: 0,
    color: "#efedd8",
    fontSize: INSPECTOR_FONT_SIZE_TITLE_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_BOLD,
    letterSpacing: `${INSPECTOR_LETTER_SPACING_EM}px`,
  },
  panelActions: {
    display: "flex",
    alignItems: "center",
    gap: INSPECTOR_ROW_GAP_PX,
  },
  panelCloseButton: {
    border: "1px solid #4a4a42",
    borderRadius: INSPECTOR_RADIUS_PX,
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1a1a17",
    color: "#d7d5c5",
    cursor: "pointer",
    fontSize: INSPECTOR_FONT_SIZE_SM_PX,
    lineHeight: INSPECTOR_LINE_HEIGHT_COMPACT,
  },
  helpPanel: {
    borderRadius: INSPECTOR_RADIUS_PX,
    border: "1px solid #4a4a42",
    background: "#0a0a08",
    color: "#e8e6d7",
    padding: INSPECTOR_PANEL_PADDING_PX,
    width: `min(${HELP_POPUP_MAX_WIDTH_PX}px, calc(100vw - ${POPUP_VIEWPORT_MARGIN_PX * 2}px))`,
    pointerEvents: "auto",
    boxShadow: "0 24px 40px -28px rgba(2, 6, 23, 0.95)",
  },
  helpTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: INSPECTOR_FONT_WEIGHT_BOLD,
    color: "#efedd8",
  },
  helpDemo: {
    position: "relative",
    height: 140,
    border: "1px solid #3f3f38",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "linear-gradient(160deg, #12120f 0%, #0d0d0b 100%)",
    marginBottom: INSPECTOR_SECTION_GAP_PX,
    overflow: "hidden",
  },
  helpDemoCanvas: {
    position: "absolute",
    inset: 0,
    padding: 14,
  },
  helpDemoCardPrimary: {
    position: "absolute",
    top: 28,
    left: 20,
    width: 174,
    height: 62,
    border: "1px solid #2e2e29",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#171714",
    boxShadow: "0 10px 20px -16px rgba(0, 0, 0, 0.8)",
    padding: 10,
    boxSizing: "border-box",
  },
  helpDemoCardSecondary: {
    position: "absolute",
    top: 34,
    left: 214,
    width: 150,
    height: 54,
    border: "1px solid #2e2e29",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#171714",
    boxShadow: "0 10px 20px -16px rgba(0, 0, 0, 0.8)",
    padding: 10,
    boxSizing: "border-box",
  },
  helpDemoCardLine: {
    height: 6,
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#292925",
    marginBottom: 8,
  },
  helpDemoHighlight: {
    position: "absolute",
    top: 28,
    left: 22,
    width: 174,
    height: 62,
    border: "2px solid rgba(0, 0, 0, 0.72)",
    background: "rgba(120, 120, 120, 0.18)",
    boxSizing: "border-box",
    animation: "inspector-help-highlight-move 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite",
  },
  helpDemoLabel: {
    position: "absolute",
    border: "1px solid #4a4a42",
    background: "rgba(10, 10, 8, 0.96)",
    color: "#efedd8",
    padding: "4px 8px",
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_MEDIUM,
  },
  helpDemoLabelPrimary: {
    top: 2,
    left: 22,
    animation: "inspector-help-label-primary 2.4s steps(1, end) infinite",
  },
  helpDemoLabelSecondary: {
    top: 8,
    left: 214,
    animation: "inspector-help-label-secondary 2.4s steps(1, end) infinite",
  },
  helpDemoCursor: {
    position: "absolute",
    width: 12,
    height: 18,
    borderRadius: 2,
    background: "#f3f2e6",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.45)",
    animation: "inspector-help-cursor-move 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite",
  },
  helpList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: INSPECTOR_ROW_GAP_PX,
  },
  helpListItem: {
    border: "1px solid #34342f",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#11110f",
    padding: "10px 12px",
    fontSize: INSPECTOR_FONT_SIZE_SM_PX,
    color: "#e8e6d7",
  },
  helpFooter: {
    marginTop: INSPECTOR_SECTION_GAP_PX,
    color: "#8c8b7f",
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    textTransform: "lowercase",
  },
  modeBanner: {
    position: "fixed",
    bottom: INSPECTOR_MODE_BANNER_TOP_PX,
    left: "50%",
    transform: "translateX(-50%)",
    border: "1px solid #4a4a42",
    borderRadius: INSPECTOR_RADIUS_PX,
    padding: `${INSPECTOR_MODE_BANNER_PADDING_Y_PX}px ${INSPECTOR_MODE_BANNER_PADDING_X_PX}px`,
    background: "#161614",
    color: "#ebe9db",
    zIndex: PANEL_Z_INDEX,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    gap: INSPECTOR_MODE_BANNER_GAP_PX,
    boxShadow: "0 8px 20px -16px rgba(0, 0, 0, 0.85)",
  },
  modeBannerHover: {
    borderColor: "#4a4a42",
    background: "#161614",
  },
  modeBannerAnalysis: {
    borderColor: "#b4b298",
    background: "#1e1e1a",
  },
  modeDot: {
    width: INSPECTOR_FONT_SIZE_XS_PX,
    height: INSPECTOR_FONT_SIZE_XS_PX,
    borderRadius: "50%",
    background: "#787769",
    boxShadow: "0 0 0 2px rgba(120, 119, 105, 0.3)",
    flexShrink: 0,
  },
  modeDotHover: {
    background: "#787769",
    boxShadow: "0 0 0 2px rgba(120, 119, 105, 0.3)",
  },
  modeDotAnalysis: {
    background: "#efeccf",
    boxShadow: "0 0 0 2px rgba(239, 236, 207, 0.25)",
  },
  modeText: {
    fontSize: INSPECTOR_FONT_SIZE_SM_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_BOLD,
    letterSpacing: `${INSPECTOR_LETTER_SPACING_EM}px`,
    textTransform: "lowercase",
  },
  modeHint: {
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    color: "#b5b4a6",
    textTransform: "lowercase",
  },
  modeFrame: {
    position: "fixed",
    inset: INSPECTOR_MODE_FRAME_INSET_PX,
    border: `${INSPECTOR_MODE_FRAME_BORDER_WIDTH_PX}px solid rgba(120, 119, 105, 0.16)`,
    borderRadius: INSPECTOR_RADIUS_PX,
    pointerEvents: "none",
    zIndex: PANEL_Z_INDEX,
  },
  section: {
    border: "1px solid #34342f",
    borderRadius: INSPECTOR_RADIUS_PX,
    padding: INSPECTOR_SECTION_PADDING_PX,
    background: "#11110f",
    marginBottom: INSPECTOR_SECTION_GAP_PX,
  },
  sectionTitle: {
    margin: `0 0 ${INSPECTOR_ROW_GAP_PX}px`,
    color: "#ecead2",
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_BOLD,
    letterSpacing: `${INSPECTOR_LETTER_SPACING_EM}px`,
    textTransform: "lowercase",
  },
  gitSummaryMeta: {
    color: "#d5d3c1",
    fontSize: INSPECTOR_FONT_SIZE_SM_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_MEDIUM,
    marginBottom: INSPECTOR_ROW_GAP_PX,
  },
  gitSummaryText: {
    color: "#efedd8",
    marginBottom: INSPECTOR_ROW_GAP_PX,
    lineHeight: INSPECTOR_LINE_HEIGHT,
  },
  gitActions: {
    display: "flex",
    alignItems: "center",
    gap: INSPECTOR_ROW_GAP_PX,
    marginBottom: INSPECTOR_ROW_GAP_PX,
  },
  gitActionButton: {
    border: "1px solid #4a4a42",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#171714",
    color: "#efedd8",
    cursor: "pointer",
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_MEDIUM,
    padding: "4px 8px",
    lineHeight: INSPECTOR_LINE_HEIGHT_COMPACT,
    textDecoration: "none",
  },
  hoverOutline: {
    position: "fixed",
    border: `${INSPECTOR_HOVER_OUTLINE_WIDTH_PX}px solid rgba(0, 0, 0, 0.72)`,
    boxSizing: "border-box",
    borderRadius: INSPECTOR_HOVER_OUTLINE_RADIUS_PX,
    background: "rgba(120, 120, 120, 0.18)",
    pointerEvents: "none",
    zIndex: PANEL_Z_INDEX,
    transitionProperty: "top, left, width, height, background-color, border-color",
    transitionDuration: `${INSPECTOR_HOVER_TRANSITION_DURATION_MS}ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
  hoverLabel: {
    position: "fixed",
    border: "1px solid #4a4a42",
    borderRadius: 0,
    background: "rgba(10, 10, 8, 0.96)",
    color: "#efedd8",
    padding: `${INSPECTOR_HOVER_LABEL_PADDING_Y_PX}px ${INSPECTOR_HOVER_LABEL_PADDING_X_PX}px`,
    fontSize: INSPECTOR_FONT_SIZE_SM_PX,
    fontWeight: INSPECTOR_FONT_WEIGHT_MEDIUM,
    fontFamily: INSPECTOR_FONT_FAMILY,
    pointerEvents: "none",
    zIndex: PANEL_Z_INDEX,
    maxWidth: INSPECTOR_HOVER_LABEL_MAX_WIDTH_PX,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transitionProperty: "top, left, transform, opacity",
    transitionDuration: `${INSPECTOR_HOVER_LABEL_TRANSITION_DURATION_MS}ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
  row: {
    display: "grid",
    gridTemplateColumns: `${INSPECTOR_KEY_COLUMN_WIDTH_PX}px 1fr`,
    gap: INSPECTOR_ROW_GAP_PX,
    marginBottom: INSPECTOR_ROW_MARGIN_BOTTOM_PX,
    alignItems: "start",
  },
  rowValueInline: {
    display: "flex",
    alignItems: "center",
    gap: INSPECTOR_ROW_GAP_PX,
    minWidth: 0,
  },
  iconButton: {
    border: "1px solid #4a4a42",
    borderRadius: INSPECTOR_RADIUS_PX,
    background: "#171714",
    color: "#d7d5c5",
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    lineHeight: INSPECTOR_LINE_HEIGHT_COMPACT,
    flexShrink: 0,
  },
  iconSvg: {
    width: 12,
    height: 12,
    display: "block",
  },
  key: {
    color: "#8c8b7f",
    fontWeight: INSPECTOR_FONT_WEIGHT_MEDIUM,
    fontSize: INSPECTOR_FONT_SIZE_XS_PX,
  },
  value: {
    color: "#d5d3c1",
    wordBreak: "break-word",
  },
  codeValue: {
    color: "#f2f0da",
    wordBreak: "break-word",
    fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
  },
  linkValue: {
    color: "#efeccf",
    textDecoration: "underline",
    wordBreak: "break-word",
    fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
  },
};

export const getPanelStyle = (isPopupVisible: boolean): CSSProperties => ({
  ...styles.panel,
  width: `min(${POPUP_MAX_WIDTH_PX}px, calc(100vw - ${POPUP_VIEWPORT_MARGIN_PX * 2}px))`,
  opacity: isPopupVisible ? 1 : 0,
  transform: isPopupVisible ? "scale(1)" : `scale(${INSPECTOR_POPUP_CLOSED_SCALE_RATIO})`,
});
