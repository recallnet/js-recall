/** @jsxRuntime classic */
import React from "react";

// Define styles here to keep the JSX clean
const styles = {
  mainBackground: {
    display: "flex",
    width: 1200,
    height: 675,
    backgroundColor: "#000000",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 48,
    width: 916,
  },
  title: {
    fontFamily: '"Inter"',
    fontSize: 72,
    fontWeight: 700,
    color: "#e5e5e5",
    lineHeight: "100%",
    textAlign: "center",
    width: 914,
  },
  infoContainer: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    width: 916,
    height: 212,
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: 452,
    height: 212,
  },
  amountCard: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    width: 451,
    height: 72,
    backgroundColor: "rgba(7, 7, 7, 0.4)",
    border: "1px solid #3D3D3D",
    borderRadius: 8,
    boxSizing: "border-box",
  },
  dateCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    width: 452,
    height: 128,
    backgroundColor: "rgba(7, 7, 7, 0.4)",
    border: "1px solid #3D3D3D",
    borderRadius: 8,
    boxSizing: "border-box",
    padding: "16px 12px",
  },
  amount: {
    fontFamily: '"Inter"',
    fontWeight: 400,
    fontSize: 40,
    color: "#E5E5E5",
    lineHeight: "100%",
  },
  description: {
    fontFamily: '"Inter"',
    fontWeight: 300,
    fontSize: 32,
    color: "#A7A7A7",
    lineHeight: "100%",
  },
  dateLabel: {
    fontFamily: '"Inter"',
    fontSize: 32,
    fontWeight: 400,
    color: "#A7A7A7",
    lineHeight: "100%",
  },
  dateValue: {
    fontFamily: '"Inter"',
    fontSize: 40,
    fontWeight: 400,
    color: "#E5E5E5",
    lineHeight: "100%",
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  url: {
    fontFamily: '"Space Mono"',
    fontSize: 32,
    fontWeight: 400,
    color: "#87B0D9",
    letterSpacing: "0.04em",
    lineHeight: "100%",
  },
};

/**
 * Renders the JSX element for the competition OG image.
 */
export const getCompetitionOgTemplate = ({
  backgroundImage,
  competitionName,
  recallSvgUrl,
  prizeAgents,
  prizeBoosters,
  duration,
  boostWindow,
  recallTextSvgUrl,
}) => {
  return (
    <div
      style={{
        ...styles.mainBackground,
        backgroundImage: `url(${backgroundImage})`,
      }}
    >
      <div style={styles.content}>
        <div style={styles.title}>{competitionName}</div>

        <div style={styles.infoContainer}>
          {/* Column 1 */}
          <div style={styles.infoSection}>
            <div style={styles.amountCard}>
              <img src={recallSvgUrl} style={{ width: 24, height: 24 }} />
              <span style={styles.amount}>{prizeAgents}</span>
              <span style={styles.description}>for Agents</span>
            </div>
            <div style={styles.dateCard}>
              <span style={styles.dateLabel}>Duration</span>
              <span style={styles.dateValue}>{duration}</span>
            </div>
          </div>

          {/* Column 2 */}
          <div style={styles.infoSection}>
            <div style={styles.amountCard}>
              <img src={recallSvgUrl} style={{ width: 24, height: 24 }} />
              <span style={styles.amount}>{prizeBoosters}</span>
              <span style={styles.description}>for Boosters</span>
            </div>
            <div style={styles.dateCard}>
              <span style={styles.dateLabel}>Boost Window</span>
              <span style={styles.dateValue}>{boostWindow}</span>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <img src={recallTextSvgUrl} style={{ height: 32 }} />
          <div style={styles.url}>https://app.recall.network</div>
        </div>
      </div>
    </div>
  );
};
