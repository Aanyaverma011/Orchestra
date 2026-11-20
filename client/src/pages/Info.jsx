import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/atoms';
import SiteFooter, { LEGAL_LINKS } from '../components/SiteFooter';
import { useLightTheme } from '../hooks/useTheme';

// Change these to your own details before publishing.
const CONTACT_EMAIL = 'aanyav364@gmail.com';
const OWNER = 'Aanya Verma';

const year = new Date().getFullYear();

const PAGES = {
  privacy: {
    title: 'Privacy',
    body: (
      <>
        <p>This page explains what Orchestra stores about you and why.</p>
        <h2>What we store</h2>
        <ul>
          <li><b>Your account:</b> name, email address and a hashed password (bcrypt). We never store the password itself.</li>
          <li><b>Your jobs:</b> the job name, type, input data, progress, log lines, errors and results. Uploaded CSV files are kept on the server so a worker can read them.</li>
          <li><b>Browser storage:</b> a sign-in token and your display settings. See <i>Cookie Preferences</i> in the footer. There are no cookies, analytics or ad trackers.</li>
        </ul>
        <h2>Who can see it</h2>
        <p>You can see your own jobs. Administrators can see every job, so they can retry failed work and look after the workers. Nobody else can.</p>
        <h2>Failure explanations</h2>
        <p>If the server has a Groq API key set, the &quot;Explain this failure&quot; button sends the error message and log lines of that one job to Groq to write a short explanation. The job&apos;s input data is not sent. Without a key, the explanation is written by built-in rules and nothing leaves the server.</p>
        <h2>Removing your data</h2>
        <p>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will delete your account and jobs.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms of use',
    body: (
      <>
        <p>By creating an account or using the demo you agree to these terms.</p>
        <ul>
          <li>Use Orchestra for lawful work only. Do not upload data you have no right to share.</li>
          <li>Keep your sign-in details to yourself. You are responsible for jobs submitted from your account.</li>
          <li>Do not try to get around the rate limit or access other people&apos;s jobs.</li>
          <li>Demo accounts and their jobs can be reset at any time.</li>
          <li>We may suspend accounts that break these terms.</li>
        </ul>
        <p>The service is provided as described in the <Link to="/disclaimer">Disclaimer</Link>.</p>
      </>
    ),
  },
  'legal-disclosure': {
    title: 'Legal disclosure',
    body: (
      <>
        <p>Information about the operator of this site.</p>
        <dl className="info-dl">
          <dt>Operator</dt><dd>Aanya Verma</dd>
          <dt>Address</dt><dd>Lucknow, Uttar Pradesh, India</dd>
          <dt>Email</dt><dd><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd>
          
        </dl>
          </>
    ),
  },
  copyright: {
    title: 'Copyright',
    body: (
      <>
        <p>© {year} {OWNER}. The Orchestra code, text and logo are covered by copyright.</p>
        <p>Orchestra is built on open-source software, including React, Express, BullMQ, Mongoose, Socket.io, Recharts and Lucide icons. Each remains the property of its authors and is used under its own licence. The fonts are used under the SIL Open Font License.</p>
      </>
    ),
  },
  trademark: {
    title: 'Trademark',
    body: (
      <>
        <p>&quot;Orchestra&quot; and the calendar-and-clock mark are used as the name and logo of this project.</p>
        <p>Redis, MongoDB, Node.js, React and other product names mentioned on this site are trademarks of their owners. Mentioning them does not mean they endorse Orchestra.</p>
      </>
    ),
  },
  disclaimer: {
    title: 'Disclaimer',
    body: (
      <>
        <p>Orchestra is provided &quot;as is&quot;, without warranty of any kind. We do our best to keep it running and correct, but we are not liable for lost data, failed jobs or any damage from using it.</p>
        <p>In the default setup, emails are rendered on the server and not actually delivered. Reports and figures produced by the demo use sample data.</p>
        <p>Links to outside sites are provided for convenience. We are not responsible for their content.</p>
      </>
    ),
  },
  'api-policy': {
    title: 'API Policy',
    body: (
      <>
        <p>The dashboard uses the same REST API that you can call from your own code.</p>
        <h2>Authentication</h2>
        <p>Send <code>Authorization: Bearer &lt;token&gt;</code> with every request. Get a token from <code>POST /api/auth/login</code>. Tokens expire after 7 days. Never put a token in client-side code you publish.</p>
        <h2>Limits</h2>
        <ul>
          <li>Job submissions are limited per user per minute (20 by default). Going over returns <code>429 Too Many Requests</code>.</li>
          <li>JSON bodies up to 1 MB. CSV uploads up to 5 MB.</li>
          <li><code>Idempotency-Key</code> headers are up to 200 characters and are remembered for 24 hours.</li>
        </ul>
        <h2>Main endpoints</h2>
        <ul className="mono-list">
          <li>POST /api/jobs</li>
          <li>GET /api/jobs, GET /api/jobs/:id</li>
          <li>POST /api/jobs/:id/cancel</li>
          <li>POST /api/uploads/csv</li>
          <li>GET /api/stats</li>
        </ul>
        <p>Do not use the API to overload the service or to read other users&apos; data.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    body: (
      <>
        <p>Questions, bug reports or requests to delete your data:</p>
        <p className="info-big"><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>When reporting a problem with a job, include the job id shown in its details panel (for example <code>#518755</code>) and what you expected to happen.</p>
        <p>For setup questions, the <Link to="/help">Help portal</Link> may answer you faster.</p>
      </>
    ),
  },
  help: {
    title: 'Help portal',
    body: (
      <>
        <h2>Getting started</h2>
        <ol>
          <li>Open the <Link to="/login">sign-in page</Link> and choose <b>Member demo</b> or <b>Admin demo</b>, or create an account.</li>
          <li>Click <b>New job</b>, pick a type (email, report or CSV import) and submit.</li>
          <li>Watch it on <b>Jobs</b> or <b>Overview</b>. Click any job to see its log and result.</li>
        </ol>
        <h2>Common questions</h2>
        <h3>Sign-in says the API server is not running</h3>
        <p>Start the API (<code>cd server &amp;&amp; npm run dev</code>) and make sure MongoDB and Redis are running. The API uses port 5050, because port 5000 is taken by AirPlay on macOS.</p>
        <h3>My job stays &quot;Queued&quot;</h3>
        <p>No worker is running. Start one with <code>cd worker &amp;&amp; npm start</code>. Admins can check the <b>Workers</b> page.</p>
        <h3>A job ended up in Dead letters</h3>
        <p>It failed all 4 attempts. An admin can open <b>Dead letters</b>, read the error, correct the email address if that was the cause, and click <b>Retry</b>.</p>
        <h3>How do I cancel a job?</h3>
        <p>Open the job and click <b>Cancel job</b>. This works while it is queued, scheduled or waiting to retry, not once a worker is running it.</p>
        <p>Still stuck? <Link to="/contact">Contact us</Link>.</p>
      </>
    ),
  },
};

const SIDE = [...LEGAL_LINKS, ['Contact', '/contact'], ['Help portal', '/help']];

export default function Info({ page }) {
  useLightTheme();
  const info = PAGES[page];

  useEffect(() => {
    document.title = `${info.title} · Orchestra`;
    window.scrollTo(0, 0);
  }, [info.title]);

  return (
    <div className="lp info">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <Link to="/" className="lp-brand"><Logo size={22} />Orchestra</Link>
          <div className="lp-nav-actions">
            <Link to="/" className="lp-btn ghost"><ArrowLeft size={15} /> Home</Link>
            <Link to="/login" className="lp-btn primary">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="lp-wrap info-in">
        <nav className="info-side" aria-label="Help and legal pages">
          {SIDE.map(([label, to]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        </nav>
        <article className="info-body">
          <h1>{info.title}</h1>
          {info.body}
          <p className="info-updated">Last updated: November 2026</p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

export const INFO_PAGES = Object.keys(PAGES);
