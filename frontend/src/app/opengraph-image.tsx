import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f1ea",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            borderRadius: 32,
            padding: "40px 72px",
            border: "1px solid #e2d7ca",
            background: "rgba(255,255,255,0.96)",
            boxShadow:
              "0 26px 70px rgba(24,21,18,0.16), 0 1px 0 rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: "#181512",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f5f1ea",
              fontWeight: 700,
              fontSize: 32,
              boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
            }}
          >
            AV
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: 8,
                color: "#7f6e60",
                fontWeight: 600,
              }}
            >
              AgentVault
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 600,
                color: "#1b1714",
              }}
            >
              AgentVault
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}

