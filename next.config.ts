import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevents other sites from embedding the app in iframes (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing the content type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limits referrer information sent with outbound links.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features not needed by the app.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
