import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from '../components/ConsentProvider';
import { hasConsent } from '../utils/consent';
import { clearAllLocalData } from '../utils/localData';
import { CONTACT_EMAIL } from '../utils/site';
import { getApiBaseUrl } from '../services/apiClient';

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-8 text-base font-bold text-white">{children}</h2>;

/**
 * A plain-language privacy summary (written with POPIA and GDPR principles in
 * mind: minimisation, local processing, consent, access and deletion). It
 * describes what the code actually does; keep it in step with the code.
 */
export default function Privacy() {
  const { record, revoke } = useConsent();
  const [cleared, setCleared] = useState(false);
  const local = hasConsent(record, 'local');
  const upload = hasConsent(record, 'upload');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-[#CCCCCC] sm:px-6" data-testid="privacy-page">
      <h1 className="font-display text-2xl font-bold text-white">Privacy</h1>
      <p className="mt-2 text-neutral-400">
        A plain-language summary of how this site treats your data. It is built to keep your data on your device. This is a summary, not legal advice.
      </p>

      <H>The short version</H>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>The AI tools run in your browser. Your camera frames, video, body keypoints and photos are not uploaded when you use the in-browser mode.</li>
        <li>This site does not store video frames, keypoints or any biometric template, in your browser or anywhere else.</li>
        <li>What it does keep is on your device only, and you can delete all of it with one button below.</li>
        <li>Camera features need you to be 18 or older and to agree to a short disclaimer first.</li>
      </ul>

      <H>What runs where</H>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li><strong className="text-white">In this browser (default for the Form Coach and the in-browser detector):</strong> frames, the model&apos;s working numbers (WebGPU tensors) and keypoints exist only in your browser&apos;s memory while the feature runs, then they are discarded.</li>
        <li><strong className="text-white">Backend mode (Auto-Labeler only, if you choose it):</strong> the image or video you submit is uploaded to the analysis server{' '}<code className="rounded bg-neutral-800 px-1 text-xs">{getApiBaseUrl()}</code>. You are asked to confirm before a video is uploaded. How that server handles files is up to its operator.</li>
      </ul>

      <H>What is stored on your device</H>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>Fitness: your training log, meals, weigh-ins, plan and settings (IndexedDB).</li>
        <li>Your consent choice (two ticks and a date), your optional name and interests for the site, and your plan or unlock status (localStorage).</li>
        <li>Auto-Labeler preferences, and a small history of recent results (up to 24 thumbnails of images <em>you uploaded</em>, saved in localStorage).</li>
        <li><strong className="text-white">Never stored:</strong> video frames, camera images, body keypoints, or any template that could identify you.</li>
        <li>Files such as a snapshot, a label file or a backup are created only when you press the button, and are saved to your own downloads.</li>
      </ul>

      <H>What leaves your device</H>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>Normal page loads from the host, including the AI model and runtime files (downloads that carry none of your data).</li>
        <li>Fonts from Google Fonts, which means your IP address is visible to Google when a page loads.</li>
        <li>If you press a checkout link you go to the payment provider, and if you use a contact or intake form it opens your own email app. This site does not send those messages itself.</li>
      </ul>

      <H>Your rights</H>
      <p className="mt-2">
        Under POPIA (South Africa) and the GDPR (EU/UK) you can ask what is held about you, have it corrected or deleted, withdraw consent, and object to processing. Because this site holds no server-side record of you, the controls are on your device:
      </p>
      <div className="mt-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4" data-testid="privacy-controls">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Camera and video consent:{' '}
            <strong className="text-white" data-testid="consent-status">
              {local || upload ? `given (${[local && 'in-browser', upload && 'upload'].filter(Boolean).join(' + ')})` : 'not given'}
            </strong>
          </span>
          <button type="button" disabled={!record} onClick={revoke} className="min-h-[40px] rounded-lg border border-neutral-700 px-4 text-xs font-semibold text-neutral-200 hover:border-neutral-500 disabled:opacity-40" data-testid="withdraw-consent">
            Withdraw consent
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Delete everything this site stored on this device.</span>
          <button
            type="button"
            className="min-h-[40px] rounded-lg border border-rose-500/50 px-4 text-xs font-semibold text-rose-300 hover:border-rose-400"
            data-testid="delete-local-data"
            onClick={async () => {
              if (!window.confirm('Delete your fitness log, settings, consent and all other data this site stored in this browser? This cannot be undone.')) return;
              await clearAllLocalData();
              setCleared(true);
              window.setTimeout(() => window.location.assign('/'), 900);
            }}
          >
            Delete my data
          </button>
        </div>
        {cleared && <p className="text-xs text-[#32FF00]" role="status">Deleted. Reloading…</p>}
      </div>

      <H>Age</H>
      <p className="mt-2">The camera and video features are for people aged 18 and over, and you are asked to confirm this before they start.</p>

      <H>Contact</H>
      <p className="mt-2">
        Responsible party: Farai Bodias Musariri. Questions or requests:{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`} className="text-[#32FF00] underline-offset-2 hover:underline">
          {CONTACT_EMAIL}
        </a>
        . If you are in South Africa you may also contact the Information Regulator.
      </p>
      <p className="mt-8 text-xs text-neutral-500">
        <Link to="/" className="hover:underline">Back to the site</Link>
      </p>
    </div>
  );
}
