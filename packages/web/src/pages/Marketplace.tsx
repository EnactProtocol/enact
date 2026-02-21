import { useScrollReveal } from "@/hooks/useScrollReveal";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Marketplace.css";

// ── Data ──

const faviconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const PUBLISHERS = [
  {
    handle: "@stripe",
    name: "Stripe",
    skills: "14 skills · Payments & billing",
    badge: "verified",
    logo: faviconUrl("stripe.com"),
    hue: 250,
    color: "var(--mp-purple)",
  },
  {
    handle: "@twilio",
    name: "Twilio",
    skills: "9 skills · Communications",
    badge: "verified",
    logo: faviconUrl("twilio.com"),
    hue: 0,
    color: "var(--mp-red)",
  },
  {
    handle: "@enact",
    name: "Enact",
    skills: "22 skills · Core utilities",
    badge: "official",
    logo: faviconUrl("enact.dev"),
    hue: 39,
    color: "var(--mp-gold)",
  },
  {
    handle: "@cloudflare",
    name: "Cloudflare",
    skills: "11 skills · Web & security",
    badge: "verified",
    logo: faviconUrl("cloudflare.com"),
    hue: 25,
    color: "var(--mp-amber)",
  },
  {
    handle: "@snowflake",
    name: "Snowflake",
    skills: "7 skills · Data warehouse",
    badge: "verified",
    logo: faviconUrl("snowflake.com"),
    hue: 200,
    color: "var(--mp-blue)",
  },
  {
    handle: "@datadog",
    name: "Datadog",
    skills: "8 skills · Observability",
    badge: "verified",
    logo: faviconUrl("datadoghq.com"),
    hue: 270,
    color: "var(--mp-purple)",
  },
] as const;

interface Skill {
  icon: string;
  name: string;
  publisher: string;
  publisherMark: "verified" | "official";
  desc: string;
  tags: string[];
  runs: string;
}

const SKILLS: Skill[] = [
  {
    icon: "💳",
    name: "@stripe/create-charge",
    publisher: "@stripe",
    publisherMark: "verified",
    desc: "Create a payment charge via the Stripe API. Supports one-time payments, currency selection, and metadata. Returns charge ID and status.",
    tags: ["payments", "billing", "API"],
    runs: "19.7K runs/wk",
  },
  {
    icon: "🔍",
    name: "@enact/web-scraper",
    publisher: "@enact",
    publisherMark: "official",
    desc: "Scrape and extract structured data from any public URL. Returns clean markdown, tables, and metadata. Handles SPAs and JavaScript-rendered pages.",
    tags: ["scraping", "data", "web"],
    runs: "12.1K runs/wk",
  },
  {
    icon: "🛡️",
    name: "@cloudflare/dns-lookup",
    publisher: "@cloudflare",
    publisherMark: "verified",
    desc: "Query DNS records for any domain. Returns A, AAAA, CNAME, MX, TXT, and NS records with TTL and propagation status across global PoPs.",
    tags: ["DNS", "security", "network"],
    runs: "8.4K runs/wk",
  },
  {
    icon: "❄️",
    name: "@snowflake/query-warehouse",
    publisher: "@snowflake",
    publisherMark: "verified",
    desc: "Execute read-only SQL queries against a Snowflake data warehouse. Returns structured JSON results with column types and row counts.",
    tags: ["SQL", "data", "warehouse"],
    runs: "6.3K runs/wk",
  },
  {
    icon: "📱",
    name: "@twilio/send-sms",
    publisher: "@twilio",
    publisherMark: "verified",
    desc: "Send SMS or MMS messages via the Twilio API. Supports templates, media attachments, and delivery status webhooks. Secrets injected at runtime.",
    tags: ["SMS", "comms", "messaging"],
    runs: "11.8K runs/wk",
  },
  {
    icon: "📊",
    name: "@datadog/get-metrics",
    publisher: "@datadog",
    publisherMark: "verified",
    desc: "Query time-series metrics from Datadog. Supports custom date ranges, aggregation functions, and tag-based filtering. Returns JSON data points.",
    tags: ["monitoring", "metrics", "APM"],
    runs: "4.9K runs/wk",
  },
];

const SEARCH_PILLS = [
  { emoji: "💳", label: "charge a customer via Stripe" },
  { emoji: "🔍", label: "scrape data from a website" },
  { emoji: "📱", label: "send an SMS with Twilio" },
  { emoji: "❄️", label: "query Snowflake warehouse" },
];

const STATS = [
  { big: "1,240", label: "Published skills" },
  { big: "38", label: "Verified publishers" },
  { big: "94K", label: "Agent invocations this week" },
  { big: "0", label: "Unsigned skills in registry" },
];

const TRUST_ITEMS = [
  { icon: "🔏", text: "Every skill", bold: "cryptographically signed", after: "via Sigstore" },
  { icon: "📋", text: "Immutable provenance in the", bold: "Rekor transparency log", after: "" },
  { icon: "🆔", text: "Publisher identity verified with", bold: "OIDC", after: "" },
  { icon: "📦", text: "Runs in", bold: "isolated containers", after: "— no secret leakage" },
];

const CHAIN_STEPS = [
  {
    color: "var(--mp-accent)",
    label: "Publisher Identity",
    value: "stripe-integrations@stripe.com",
    sub: "verified via GitHub OIDC · 2025-11-03",
    showLine: true,
  },
  {
    color: "var(--mp-blue)",
    label: "Skill Package",
    value: "@stripe/create-charge@2.1.4",
    sub: "sha256:a3f9b1c4e7…",
    showLine: true,
  },
  {
    color: "var(--mp-purple)",
    label: "Sigstore Signature",
    value: "",
    sub: "MEYCIQDx4b9f…UzPq+QmNw==",
    showLine: true,
  },
  {
    color: "var(--mp-gold)",
    label: "Rekor Log Entry",
    value: "Entry #28471930",
    sub: "Immutable · Publicly auditable",
    showLine: false,
  },
];

// ── Canvas Animation ──

const TRAIL_COLORS = [
  "hsl(15, 63%, 59%)",
  "hsl(251, 40%, 54%)",
  "hsl(210, 70%, 51%)",
  "hsl(39, 80%, 52%)",
];

function useCanvasAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W: number;
    let H: number;
    let animId: number;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    const config = {
      shrinkRate: 1.2,
      trailDecay: 0.008,
      trailInterval: 5,
    };

    class TrailParticle {
      x: number;
      y: number;
      radius: number;
      color: string;
      alpha: number;
      constructor(x: number, y: number, radius: number, color: string) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.alpha = 0.7;
      }
      update(dt: number) {
        this.alpha -= config.trailDecay * dt;
      }
      draw() {
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, this.alpha);
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx!.fillStyle = this.color;
        ctx!.fill();
        ctx!.restore();
      }
    }

    class Dot {
      dotSize = 11;
      tick = 0;
      isDead = false;
      opacity = 1;
      phase: "wave" | "spiral" = "wave";
      trailColor = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
      x = 0;
      y = 0;
      centerY = 0;
      speed = 0;
      sineAmp = 0;
      sineFreq = 0;
      sinePhase = 0;
      peakTarget = 0;
      peakCount = 0;
      prevCosSign = 0;
      spiralRadius = 0;
      spawnAt = 0;
      cx = 0;
      cy = 0;
      sAngle = 0;
      sRadius = 0;

      constructor() {
        this.reset();
      }

      reset() {
        this.dotSize = 11;
        this.tick = 0;
        this.isDead = false;
        this.opacity = 1;
        this.phase = "wave";
        this.trailColor = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
        this.speed = 4 + Math.random() * 3;
        this.sineAmp = 70 + Math.random() * 90;
        this.sineFreq = 0.008 + Math.random() * 0.005;
        this.sinePhase = Math.random() * Math.PI * 2;
        this.x = Math.random() * W;
        this.centerY = Math.random() * (H * 0.55) + H * 0.2;
        this.y = this.centerY + this.sineAmp * Math.sin(this.sineFreq * this.x + this.sinePhase);
        this.peakTarget = Math.floor(Math.random() * 2) + 1;
        this.peakCount = 0;
        this.prevCosSign = Math.sign(Math.cos(this.sineFreq * this.x + this.sinePhase));
        this.spiralRadius = Math.min(W, H) * 0.38;
        this.spawnAt = 0;
      }

      update(dt: number) {
        if (this.isDead) return;
        this.tick += dt;
        if (this.phase === "wave") {
          this.x += this.speed * dt;
          this.y = this.centerY + this.sineAmp * Math.sin(this.sineFreq * this.x + this.sinePhase);
          const cosSign = Math.sign(Math.cos(this.sineFreq * this.x + this.sinePhase));
          if (this.prevCosSign > 0 && cosSign <= 0) {
            this.peakCount++;
            if (this.peakCount >= this.peakTarget) {
              this.cx = this.x;
              this.cy = this.y - this.spiralRadius;
              this.sAngle = Math.PI / 2;
              this.sRadius = this.spiralRadius;
              this.phase = "spiral";
            }
          }
          this.prevCosSign = cosSign;
          if (this.x > W + 20) this.isDead = true;
        } else {
          this.sAngle -= (this.speed / this.sRadius) * dt;
          this.sRadius -= config.shrinkRate * dt;
          this.x = this.cx + Math.cos(this.sAngle) * this.sRadius;
          this.y = this.cy + Math.sin(this.sAngle) * this.sRadius;
          if (this.sRadius < 30) this.opacity -= 0.04 * dt;
          if (this.sRadius <= 0 || this.opacity <= 0) this.isDead = true;
        }
        if (
          Math.floor(this.tick / config.trailInterval) >
            Math.floor((this.tick - dt) / config.trailInterval) &&
          !this.isDead
        ) {
          trails.push(new TrailParticle(this.x, this.y, this.dotSize * 0.8, this.trailColor));
        }
      }

      draw() {
        if (this.isDead) return;
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, this.opacity) * 0.85;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.dotSize, 0, Math.PI * 2);
        ctx!.fillStyle = this.trailColor;
        ctx!.shadowBlur = 12;
        ctx!.shadowColor = this.trailColor;
        ctx!.fill();
        ctx!.restore();
      }
    }

    const dots = [new Dot()];
    const trails: TrailParticle[] = [];
    let lastTime: number | null = null;

    function animate(now: number) {
      animId = requestAnimationFrame(animate);
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / (1000 / 60), 3);
      lastTime = now;
      ctx!.clearRect(0, 0, W, H);

      for (let i = trails.length - 1; i >= 0; i--) {
        trails[i].update(dt);
        trails[i].draw();
        if (trails[i].alpha <= 0) trails.splice(i, 1);
      }

      for (const d of dots) {
        if (d.isDead) {
          if (!d.spawnAt) d.spawnAt = now + (2 + Math.random() * 6) * 1000;
          if (now < d.spawnAt) continue;
          d.reset();
        }
        d.update(dt);
        d.draw();
      }
    }

    animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [canvasRef]);
}

// ── Component ──

export default function Marketplace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAnimation(canvasRef);
  const reveal = useScrollReveal();

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string)?.trim();
    if (q) {
      window.location.href = `/browse?q=${encodeURIComponent(q)}`;
    }
  }, []);

  return (
    <div className="marketplace-page">
      {/* Background layers */}
      <canvas ref={canvasRef} className="mp-canvas" />
      <div className="mp-ambient-blobs">
        <div className="mp-blob mp-blob-1" />
        <div className="mp-blob mp-blob-2" />
        <div className="mp-blob mp-blob-3" />
        <div className="mp-blob mp-blob-4" />
      </div>

      <div className="mp-content">
        {/* Hero */}
        <div className="mp-hero">
          <div ref={reveal("fade-down")} className="mp-hero-eyebrow">
            The Agent Skills Registry
          </div>
          <h1 ref={reveal("fade-up", 100)}>
            Find skills your agent
            <br />
            can <em>actually trust</em>
          </h1>
          <p ref={reveal("fade-up", 200)} className="mp-hero-sub">
            Signed, verified, and ready to run. Search by intent — our agent reads the docs so yours
            doesn't have to.
          </p>

          <form onSubmit={handleSearchSubmit}>
            <div ref={reveal("fade-up", 300)} className="mp-search-wrap">
              <span className="mp-search-icon">⌕</span>
              <input
                className="mp-search-box"
                type="text"
                name="q"
                placeholder='Search for a skill, like "lookup wallet transaction history"…'
              />
              <button type="submit" className="mp-search-submit">
                Ask Agent
              </button>
            </div>
          </form>

          <div ref={reveal("fade-up", 400)} className="mp-search-examples">
            <span>Try:</span>
            {SEARCH_PILLS.map((pill) => (
              <Link
                key={pill.label}
                to={`/browse?q=${encodeURIComponent(pill.label)}`}
                className="mp-search-pill"
              >
                {pill.emoji} {pill.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mp-section" style={{ paddingBottom: 0 }}>
          <div ref={reveal("fade-up")} className="mp-stats-row">
            {STATS.map((stat) => (
              <div key={stat.label} className="mp-stat-cell">
                <div className="mp-stat-big">{stat.big}</div>
                <div className="mp-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Verified Publishers */}
        <div className="mp-section">
          <div ref={reveal("fade-up")} className="mp-section-header">
            <div>
              <div className="mp-section-title">Verified Publishers</div>
              <div className="mp-section-heading">Trusted sources for agent tools</div>
            </div>
            <Link to="/browse" className="mp-section-link">
              View all →
            </Link>
          </div>
          <div ref={reveal("fade-up", 150)} className="mp-publishers-row">
            {PUBLISHERS.map((pub) => (
              <div key={pub.handle} className="mp-publisher-card">
                <div
                  className="mp-publisher-logo"
                  style={{
                    background: `linear-gradient(135deg, var(--mp-surface), hsl(${pub.hue} 50% 14%))`,
                    border: `1px solid hsl(${pub.hue} 50% 50% / 0.2)`,
                  }}
                >
                  <img src={pub.logo} alt={pub.name} className="mp-publisher-logo-img" />
                </div>
                <div className="mp-publisher-name">{pub.handle}</div>
                <div className="mp-publisher-skills">{pub.skills}</div>
                <div
                  className={`mp-badge ${pub.badge === "official" ? "mp-badge-official" : "mp-badge-verified"}`}
                >
                  {pub.badge === "official" ? "✦ Official" : "✓ Verified"}
                </div>
              </div>
            ))}
            {/* Placeholder card */}
            <div
              className="mp-publisher-card"
              style={{ borderStyle: "dashed", cursor: "default", opacity: 0.5 }}
            >
              <div
                className="mp-publisher-logo"
                style={{
                  background: "var(--mp-surface-3)",
                  color: "var(--mp-muted)",
                  border: "1px solid var(--mp-border)",
                }}
              >
                +
              </div>
              <div className="mp-publisher-name" style={{ color: "var(--mp-muted)" }}>
                Your company
              </div>
              <div className="mp-publisher-skills">Apply to publish →</div>
              <div className="mp-badge mp-badge-community">· · ·</div>
            </div>
          </div>
        </div>

        {/* Featured Skills */}
        <div className="mp-section" style={{ paddingTop: 0 }}>
          <div ref={reveal("fade-up")} className="mp-section-header">
            <div>
              <div className="mp-section-title">Featured Skills</div>
              <div className="mp-section-heading">Curated. Verified. Ready to invoke.</div>
            </div>
            <Link to="/browse" className="mp-section-link">
              Browse all →
            </Link>
          </div>
          <div ref={reveal("fade-up", 150)} className="mp-skills-grid">
            {SKILLS.map((skill) => (
              <div key={skill.name} className="mp-skill-card">
                <div className="mp-skill-card-top">
                  <div className="mp-skill-icon">{skill.icon}</div>
                  <div className="mp-skill-name-wrap">
                    <div className="mp-skill-name">{skill.name}</div>
                    <div className="mp-skill-publisher">
                      <span
                        className={skill.publisherMark === "official" ? "mp-o-mark" : "mp-v-mark"}
                      >
                        {skill.publisherMark === "official" ? "✦" : "✓"}
                      </span>
                      {skill.publisher}
                    </div>
                  </div>
                  <div
                    className={`mp-badge ${skill.publisherMark === "official" ? "mp-badge-official" : "mp-badge-verified"}`}
                  >
                    {skill.publisherMark === "official" ? "✦" : "✓"}
                  </div>
                </div>
                <div className="mp-skill-desc">{skill.desc}</div>
                <div className="mp-skill-footer">
                  <div className="mp-skill-tags">
                    {skill.tags.map((t) => (
                      <span key={t} className="mp-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mp-skill-stats">
                    <span className="mp-pulse-dot" />
                    {skill.runs}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Bar */}
        <div ref={reveal("fade")} className="mp-trust-bar">
          <div className="mp-trust-bar-inner">
            {TRUST_ITEMS.map((item, i) => (
              <span key={item.bold} style={{ display: "contents" }}>
                {i > 0 && <div className="mp-trust-divider" />}
                <div className="mp-trust-item">
                  <span>{item.icon}</span>
                  <span>
                    {item.text} <strong>{item.bold}</strong>
                    {item.after ? ` ${item.after}` : ""}
                  </span>
                </div>
              </span>
            ))}
          </div>
        </div>

        {/* Provenance Banner */}
        <div className="mp-section" style={{ paddingTop: 0 }}>
          <div ref={reveal("fade-up")} className="mp-provenance-banner">
            <div>
              <h2>
                Every skill has a
                <br />
                <strong>verifiable paper trail</strong>
              </h2>
              <p className="mp-prov-desc">
                Before your agent runs anything from the registry, you can verify exactly who built
                it, when it was signed, and that it hasn't been tampered with since — using the open
                Sigstore infrastructure.
              </p>
              <div className="mp-sigstore-badge">🔏 Signed with Sigstore · Logged in Rekor</div>
            </div>

            <div className="mp-chain-graphic">
              {CHAIN_STEPS.map((step) => (
                <div key={step.label} className="mp-chain-row">
                  <div className="mp-chain-left">
                    <div className="mp-chain-dot" style={{ background: step.color }} />
                    {step.showLine && (
                      <div
                        className="mp-chain-line"
                        style={{
                          background: `linear-gradient(${step.color.includes("accent") ? "var(--mp-accent-mid)" : "var(--mp-border-2)"}, var(--mp-border-2))`,
                        }}
                      />
                    )}
                  </div>
                  <div className="mp-chain-content">
                    <div className="mp-chain-label" style={{ color: step.color }}>
                      {step.label}
                    </div>
                    {step.value && (
                      <div className="mp-chain-value" style={{ color: "var(--mp-fg)" }}>
                        {step.value}
                      </div>
                    )}
                    <div
                      className="mp-chain-value"
                      style={{ color: "var(--mp-muted)", fontSize: 11 }}
                    >
                      {step.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
