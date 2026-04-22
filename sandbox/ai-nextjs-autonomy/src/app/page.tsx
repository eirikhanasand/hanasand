const services = [
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
          <h1>Northstar Atelier</h1>
          <p className="hero-tagline">Spaces that feel composed, calm, and enduring.</p>
          <p className="hero-description">Boutique architecture for private homes and hospitality environments, shaped with tactile materials and editorial restraint.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#contact">Book a Design Consult</a>
            <a className="button button-secondary" href="#case-studies">View Case Studies</a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-card">
            <span className="panel-label">Style direction</span>
            <p>Quiet luxury with tactile materials, warm neutrals, and editorial spacing.</p>
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
        <a className="button button-primary" href="mailto:studio@northstaratelier.com">Book a Design Consult</a>
      </section>
    </main>
  )
}
