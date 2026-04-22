import path from 'node:path'
import { writeRepoFile } from '#utils/tools/repoTools.ts'
import config from '#constants'

type GenerateNextjsMarketingSiteArgs = {
    appDir: string
    brandName: string
    tagline: string
    description: string
    primaryCtaLabel?: string
    secondaryCtaLabel?: string
    styleDirection?: string
}

function rel(filePath: string) {
    return path.relative(config.repo_root, filePath)
}

export default async function generateNextjsMarketingSite(args: GenerateNextjsMarketingSiteArgs) {
    const appDir = args.appDir.replace(/^\/+|\/+$/g, '')
    const pagePath = path.join(appDir, 'src', 'app', 'page.tsx')
    const globalsPath = path.join(appDir, 'src', 'app', 'globals.css')
    const layoutPath = path.join(appDir, 'src', 'app', 'layout.tsx')
    const primaryCtaLabel = args.primaryCtaLabel || 'Book a Design Consult'
    const secondaryCtaLabel = args.secondaryCtaLabel || 'View Case Studies'

    const pageContent = `const services = [
  {
    title: "Private residences",
    description: "Ground-up homes and restorative renovations shaped around light, material warmth, and lived-in calm.",
  },
  {
    title: "Hospitality spaces",
    description: "Boutique interiors that turn circulation, texture, and atmosphere into a memorable guest experience.",
  },
  {
    title: "Spatial strategy",
    description: "Early-stage briefing, concept development, and design systems that keep every decision coherent.",
  },
]

const caseStudies = [
  {
    name: "Harbor House",
    summary: "A coastal retreat layered with pale oak, brushed stone, and sightlines that make the weather part of the experience.",
  },
  {
    name: "Atelier No. 8",
    summary: "A compact fashion showroom reworked into a sequence of gallery-like rooms with sculptural display moments.",
  },
  {
    name: "North Ridge Loft",
    summary: "A former warehouse residence transformed through soft partitions, tailored millwork, and deliberate restraint.",
  },
]

const testimonials = [
  {
    quote: "Northstar Atelier gave our home a sense of stillness and detail we had been missing for years.",
    author: "Mara and Elias, Harbor House",
  },
  {
    quote: "They balance vision and execution beautifully. Every room now feels considered rather than decorated.",
    author: "Selene Group, Atelier No. 8",
  },
]

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Boutique architecture studio</p>
          <h1>${args.brandName}</h1>
          <p className="hero-tagline">${args.tagline}</p>
          <p className="hero-description">${args.description}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#contact">${primaryCtaLabel}</a>
            <a className="button button-secondary" href="#case-studies">${secondaryCtaLabel}</a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-card">
            <span className="panel-label">Style direction</span>
            <p>${args.styleDirection || 'Quiet luxury, tactile materials, gallery-like composition, and editorial spacing.'}</p>
          </div>
          <div className="panel-card panel-card-accent">
            <span className="panel-label">Approach</span>
            <p>We shape spaces from atmosphere first, then sharpen every line until the experience feels inevitable.</p>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">What we design</p>
          <h2>Elegant spaces with a point of view.</h2>
        </div>
        <div className="card-grid">
          {services.map((service) => (
            <article key={service.title} className="info-card">
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-contrast" id="case-studies">
        <div className="section-heading">
          <p className="eyebrow">Selected work</p>
          <h2>Projects that turn constraints into atmosphere.</h2>
        </div>
        <div className="case-study-list">
          {caseStudies.map((study) => (
            <article key={study.name} className="case-study">
              <div>
                <p className="case-study-index">0{caseStudies.indexOf(study) + 1}</p>
                <h3>{study.name}</h3>
              </div>
              <p>{study.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="testimonials">
        <div className="section-heading">
          <p className="eyebrow">Client perspective</p>
          <h2>Spaces remembered for how they feel.</h2>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.author} className="testimonial">
              <p>“{testimonial.quote}”</p>
              <footer>{testimonial.author}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="section contact-strip" id="contact">
        <div>
          <p className="eyebrow">Start the conversation</p>
          <h2>Bring clarity, calm, and material confidence to your next space.</h2>
        </div>
        <a className="button button-primary" href="mailto:studio@northstaratelier.com">${primaryCtaLabel}</a>
      </section>
    </main>
  )
}
`

    const globalsContent = `@import "tailwindcss";

:root {
  --bg: #efe6dc;
  --surface: rgba(255, 252, 247, 0.72);
  --surface-strong: #fcf7f1;
  --text: #1d1711;
  --muted: #66584a;
  --line: rgba(29, 23, 17, 0.12);
  --accent: #a86f3d;
  --accent-deep: #6d4220;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.38), transparent 34%),
    linear-gradient(180deg, #f5ede4 0%, #ede2d7 100%);
  color: var(--text);
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.site-shell {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem;
}

.hero,
.section,
.contact-strip {
  border: 1px solid var(--line);
  border-radius: 2rem;
  background: var(--surface);
  backdrop-filter: blur(18px);
}

.hero {
  display: grid;
  gap: 2rem;
  padding: 2rem;
}

.hero-copy h1,
.section-heading h2,
.contact-strip h2 {
  margin: 0;
  line-height: 0.94;
  letter-spacing: -0.04em;
}

.hero-copy h1 {
  max-width: 10ch;
  font-size: clamp(3.8rem, 10vw, 8rem);
}

.hero-tagline {
  max-width: 34rem;
  margin: 1.5rem 0 0;
  font-size: clamp(1.15rem, 2vw, 1.5rem);
  color: var(--accent-deep);
}

.hero-description,
.info-card p,
.case-study p,
.testimonial p,
.panel-card p {
  color: var(--muted);
  line-height: 1.7;
  font-size: 1rem;
}

.eyebrow,
.panel-label,
.case-study-index {
  margin: 0 0 0.9rem;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 0.74rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  padding: 0.85rem 1.35rem;
  border-radius: 999px;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 0.95rem;
  transition: transform 160ms ease, background 160ms ease, color 160ms ease;
}

.button:hover {
  transform: translateY(-1px);
}

.button-primary {
  background: var(--text);
  color: #fff7ef;
}

.button-secondary {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.4);
}

.hero-panel {
  display: grid;
  gap: 1rem;
}

.panel-card,
.info-card,
.testimonial {
  border-radius: 1.5rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.44);
  padding: 1.35rem;
}

.panel-card-accent {
  background: linear-gradient(135deg, rgba(168, 111, 61, 0.14), rgba(255, 255, 255, 0.5));
}

.section {
  padding: 2rem;
}

.section-contrast {
  background: rgba(34, 27, 20, 0.94);
  color: #f4ebdf;
}

.section-contrast .eyebrow,
.section-contrast .case-study-index,
.section-contrast p {
  color: rgba(244, 235, 223, 0.74);
}

.section-heading {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.section-heading h2,
.contact-strip h2 {
  max-width: 12ch;
  font-size: clamp(2rem, 4.5vw, 4rem);
}

.card-grid,
.testimonial-grid {
  display: grid;
  gap: 1rem;
}

.info-card h3,
.case-study h3 {
  margin: 0 0 0.8rem;
  font-size: 1.45rem;
}

.case-study-list {
  display: grid;
  gap: 1rem;
}

.case-study {
  display: grid;
  gap: 1rem;
  padding: 1.4rem 0;
  border-top: 1px solid rgba(244, 235, 223, 0.16);
}

.case-study:first-child {
  border-top: 0;
  padding-top: 0;
}

.testimonial footer {
  margin-top: 1rem;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-deep);
}

.contact-strip {
  display: grid;
  gap: 1.5rem;
  padding: 2rem;
  align-items: center;
}

@media (min-width: 900px) {
  .site-shell {
    padding: 2rem;
  }

  .hero {
    grid-template-columns: minmax(0, 1.5fr) minmax(22rem, 0.85fr);
    align-items: end;
    min-height: calc(100vh - 4rem);
    padding: 2.5rem;
  }

  .card-grid,
  .testimonial-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .case-study {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
    align-items: start;
  }

  .contact-strip {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
`

    const layoutContent = `import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "${args.brandName}",
  description: "${args.description}",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`

    await writeRepoFile({ path: pagePath, content: pageContent })
    await writeRepoFile({ path: globalsPath, content: globalsContent })
    await writeRepoFile({ path: layoutPath, content: layoutContent })

    return {
        files: [rel(path.join(config.repo_root, pagePath)), rel(path.join(config.repo_root, globalsPath)), rel(path.join(config.repo_root, layoutPath))],
        brandName: args.brandName,
        appDir,
    }
}
