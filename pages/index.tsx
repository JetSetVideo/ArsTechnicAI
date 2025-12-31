import Head from "next/head";
import styles from "../styles/Home.module.css";

export default function Home() {
  return (
    <>
      <Head>
        <title>IntelArtiGenerator</title>
        <meta name="description" content="Next.js powered by Deno 2" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={`${styles.badge} ${styles.animateFadeInUp}`}>
              <span className={styles.badgeDot}></span>
              Powered by Deno 2
            </div>

            <h1 className={`${styles.title} ${styles.animateFadeInUp} ${styles.delay100}`}>
              <span className={styles.titleSerif}>Intelli</span>
              <span className={styles.titleAccent}>Arti</span>
              <span className={styles.titleSerif}>Generator</span>
            </h1>

            <p className={`${styles.subtitle} ${styles.animateFadeInUp} ${styles.delay200}`}>
              A blazing fast Next.js application running on the modern Deno 2 runtime.
              <br />
              Experience the future of JavaScript development.
            </p>

            <div className={`${styles.buttonGroup} ${styles.animateFadeInUp} ${styles.delay300}`}>
              <a href="https://nextjs.org/docs" className={styles.buttonPrimary}>
                Get Started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a href="https://deno.com" className={styles.buttonSecondary}>
                Learn Deno
              </a>
            </div>
          </div>

          {/* Floating Elements */}
          <div className={styles.floatingElements}>
            <div className={`${styles.floatingCard} ${styles.animateFloat}`}>
              <div className={styles.cardIcon}>⚡</div>
              <span>Lightning Fast</span>
            </div>
            <div className={`${styles.floatingCard} ${styles.floatingCard2} ${styles.animateFloat} ${styles.delay200}`}>
              <div className={styles.cardIcon}>🦕</div>
              <span>Deno Native</span>
            </div>
            <div className={`${styles.floatingCard} ${styles.floatingCard3} ${styles.animateFloat} ${styles.delay400}`}>
              <div className={styles.cardIcon}>🔒</div>
              <span>Secure by Default</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features}>
          <div className={styles.featuresGrid}>
            <article className={`${styles.featureCard} ${styles.animateFadeInUp}`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3>Zero Config</h3>
              <p>Start building immediately with sensible defaults. No complex setup required.</p>
            </article>

            <article className={`${styles.featureCard} ${styles.animateFadeInUp} ${styles.delay100}`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>TypeScript First</h3>
              <p>Native TypeScript support without additional configuration or transpilation.</p>
            </article>

            <article className={`${styles.featureCard} ${styles.animateFadeInUp} ${styles.delay200}`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Web Standards</h3>
              <p>Built on web platform APIs. Write code that works everywhere.</p>
            </article>

            <article className={`${styles.featureCard} ${styles.animateFadeInUp} ${styles.delay300}`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                </svg>
              </div>
              <h3>npm Compatible</h3>
              <p>Full npm compatibility. Use any package from the npm ecosystem seamlessly.</p>
            </article>
          </div>
        </section>

        {/* Code Preview */}
        <section className={styles.codeSection}>
          <div className={`${styles.codeWindow} ${styles.animateFadeInUp}`}>
            <div className={styles.codeHeader}>
              <div className={styles.codeDots}>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className={styles.codeFilename}>terminal</span>
            </div>
            <pre className={styles.codeContent}>
              <code>
                <span className={styles.codeComment}># Run development server</span>
                {"\n"}
                <span className={styles.codePrompt}>$</span> deno task dev
                {"\n\n"}
                <span className={styles.codeComment}># Build for production</span>
                {"\n"}
                <span className={styles.codePrompt}>$</span> deno task build
                {"\n\n"}
                <span className={styles.codeComment}># Start production server</span>
                {"\n"}
                <span className={styles.codePrompt}>$</span> deno task start
              </code>
            </pre>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <p>
              Built with <span className={styles.heart}>♥</span> using Next.js & Deno 2
            </p>
            <div className={styles.footerLinks}>
              <a href="https://github.com/denoland/deno">GitHub</a>
              <a href="https://deno.com/blog">Blog</a>
              <a href="https://discord.gg/deno">Discord</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

