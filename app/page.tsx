export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              🔒 Production Security Backend
            </div>
            <h1 className="mb-4 text-5xl font-bold tracking-tight">
              Android Anti-Leech Backend
            </h1>
            <p className="text-xl text-muted-foreground">
              Enterprise-grade verification system for Android apps with certificate pinning,
              replay protection, and comprehensive security logging.
            </p>
          </div>

          {/* Features Grid */}
          <div className="mb-12 grid gap-6 sm:grid-cols-2">
            <FeatureCard
              icon="🔐"
              title="HMAC-SHA256 Auth"
              description="Constant-time signature verification prevents timing attacks"
            />
            <FeatureCard
              icon="🔗"
              title="Certificate Pinning"
              description="Secure HTTPS with certificate validation support"
            />
            <FeatureCard
              icon="🔄"
              title="Replay Protection"
              description="Cryptographic nonce validation prevents request replay"
            />
            <FeatureCard
              icon="📝"
              title="Comprehensive Logging"
              description="Detailed audit trail of all verification requests"
            />
            <FeatureCard
              icon="⚡"
              title="Nonce Validation"
              description="One-time use enforcement with automatic expiry"
            />
            <FeatureCard
              icon="✅"
              title="Signature Verification"
              description="SHA-256 certificate hash validation against allowlist"
            />
          </div>

          {/* API Endpoints */}
          <div className="mb-12 rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-2xl font-bold">API Endpoints</h2>
            <div className="space-y-4">
              <EndpointCard
                method="POST"
                path="/api/verify"
                description="Verify Android app authenticity with HMAC, nonce, and timestamp validation"
              />
              <EndpointCard
                method="GET"
                path="/api/health"
                description="Health check endpoint for monitoring and load balancing"
              />
              <EndpointCard
                method="GET"
                path="/api/logs"
                description="Retrieve verification events (admin only, requires Bearer token)"
              />
            </div>
          </div>

          {/* Architecture */}
          <div className="mb-12 rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-2xl font-bold">Architecture</h2>
            <div className="space-y-3 font-mono text-sm">
              <div className="text-muted-foreground">
                Android App (Local Verification)
              </div>
              <div className="mx-4 text-primary">↓ HTTPS + Certificate Pinning</div>
              <div className="text-muted-foreground">
                Vercel Serverless Functions
              </div>
              <div className="mx-4 text-primary">↓ HMAC + Nonce + Timestamp</div>
              <div className="text-muted-foreground">
                Neon PostgreSQL (Encrypted)
              </div>
            </div>
          </div>

          {/* Security Checklist */}
          <div className="mb-12 rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-2xl font-bold">Security Features</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              <SecurityFeature text="HTTPS only communication" />
              <SecurityFeature text="HMAC-SHA256 authentication" />
              <SecurityFeature text="Nonce-based replay protection" />
              <SecurityFeature text="Timestamp validation (5-min window)" />
              <SecurityFeature text="Constant-time HMAC comparison" />
              <SecurityFeature text="SHA-256 signature verification" />
              <SecurityFeature text="Certificate signature allowlist" />
              <SecurityFeature text="Rate limiting per IP address" />
              <SecurityFeature text="Comprehensive request logging" />
              <SecurityFeature text="Admin-only logs endpoint" />
              <SecurityFeature text="Automated daily backups" />
              <SecurityFeature text="Database SSL/TLS encryption" />
            </ul>
          </div>

          {/* Documentation Links */}
          <div className="mb-12 rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-2xl font-bold">Documentation</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <DocLink
                href="/docs/API_SPEC.md"
                title="API Specification"
                description="Complete endpoint documentation and request/response formats"
              />
              <DocLink
                href="/docs/DEPLOYMENT.md"
                title="Deployment Guide"
                description="Production setup, monitoring, and security hardening"
              />
              <DocLink
                href="/docs/ANDROID_INTEGRATION.md"
                title="Android Integration"
                description="Client implementation with certificate pinning and HMAC"
              />
              <DocLink
                href="/docs/README.md"
                title="Project README"
                description="Overview, quick start, and troubleshooting"
              />
            </div>
          </div>

          {/* Status Section */}
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-4">
              Check the health endpoint to verify backend is running:
            </p>
            <code className="inline-block rounded-lg bg-muted px-4 py-2 text-xs font-mono">
              GET /api/health
            </code>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
        <p>Production-ready Android anti-leech / anti-tamper backend</p>
        <p className="mt-2">Built with Next.js, Neon PostgreSQL, and Vercel</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 text-2xl">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  return (
    <div className="rounded border bg-muted/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block rounded px-2 py-1 text-xs font-mono font-bold ${
            method === "POST"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {method}
        </span>
        <code className="font-mono font-semibold">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SecurityFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-green-600">✓</span>
      <span>{text}</span>
    </li>
  );
}

function DocLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-lg border bg-muted/50 p-4 transition-colors hover:bg-muted"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </a>
  );
}
