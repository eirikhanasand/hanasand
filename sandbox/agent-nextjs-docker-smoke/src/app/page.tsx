const cards = [
  "Next.js App Router starter",
  "Dockerfile + docker-compose ready",
  "Prepared for browser verification and iteration",
]

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Hanasand AI starter</p>
        <h1>agent-nextjs-docker-smoke</h1>
        <p className="hero-copy">
          A Dockerized Next.js app scaffolded for autonomous iteration, browser checks, and deployment testing.
        </p>
      </section>
      <section className="card-grid">
        {cards.map((card) => (
          <article key={card} className="card">
            <h2>{card}</h2>
            <p>Extend this workspace with product logic, APIs, dashboards, and deployment steps.</p>
          </article>
        ))}
      </section>
    </main>
  )
}
