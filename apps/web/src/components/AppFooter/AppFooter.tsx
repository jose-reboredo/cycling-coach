import { Container } from '../Container/Container';
import { BikeMark } from '../BikeMark/BikeMark';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { connectUrl } from '../../lib/connectUrl';
import { APP_VERSION } from '../../lib/version';
import styles from './AppFooter.module.css';

export function AppFooter() {
  return (
    <footer className={styles.foot}>
      <Container width="base">
        <div className={styles.footTop}>
          <div className={styles.footBrand}>
            <BikeMark size={28} />
            <div>
              <p className={styles.footName}>Cadence Club</p>
              <p className={styles.footTag}>
                A performance training brain. Built quietly,<br/>
                for cycling friends, with no investors.
              </p>
            </div>
          </div>
          <div className={styles.footCols}>
            <FootCol title="Product" links={[
              { href: '/dashboard', label: 'Dashboard' },
              { href: connectUrl(), label: 'Connect Strava' },
              { href: '/#what', label: 'What you get' },
              { href: '/whats-next', label: "What's next" },
            ]} />
            <FootCol title="Reference" links={[
              { href: '/how-it-works', label: 'How the numbers work' },
              { href: '/privacy', label: 'Privacy' },
            ]} />
            <FootCol title="Powered by" links={[
              { href: 'https://www.strava.com', label: 'Strava API', external: true },
              { href: 'https://www.anthropic.com', label: 'Anthropic Claude', external: true },
              { href: 'https://workers.cloudflare.com', label: 'Cloudflare Workers', external: true },
            ]} />
          </div>
        </div>
        <div className={styles.footBottom}>
          <span>{APP_VERSION}</span>
          <span>© Cadence Club · Strava® is a registered trademark of Strava, Inc.</span>
        </div>
      </Container>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: { href: string; label: string; external?: boolean }[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className={styles.footColList}>
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
            ) : (
              <a href={l.href}>{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
