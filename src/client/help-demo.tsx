import { styles } from "./source-inspector-styles.js";

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

export const HelpDemo = () => {
  return (
    <>
      <style>{HELP_DEMO_STYLE_TEXT}</style>
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
    </>
  );
};
