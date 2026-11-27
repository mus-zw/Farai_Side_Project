import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Target, Briefcase, GraduationCap, ScanLine } from 'lucide-react';
import SkillsSection from '../components/SkillsSection';
import EngineeringSection from '../components/hub/EngineeringSection';
import CaseStudies from '../components/hub/CaseStudies';
import WorkWithMe from '../components/hub/WorkWithMe';
import { EDUCATION, EXPERIENCE } from '../data/cv';
import { PREVIEW_ITEMS } from '../data/demoPreview';

/**
 * The portfolio landing page, in the order a visitor wants it: who I am, my background and
 * experience, my research, what I have actually built, how it is built, my skills, and how to work
 * with me. Interactive tools are reached from the Projects section, not scattered through the page.
 */
export default function Home() {
  // A real result from my in-browser detector (saved from the app, not mocked up). If the file is
  // missing the card simply drops out instead of showing a broken image.
  const showcase = PREVIEW_ITEMS[0];
  const [showcaseOk, setShowcaseOk] = useState(true);

  return (
    <div className="space-y-24 py-8 md:py-16">
      {/* 1. Hero */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#32FF00]/40 bg-[#16213E]/80 px-3.5 py-1 text-xs font-semibold text-[#32FF00]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#32FF00]" />
              <span>Rhodes University · MSc Computer Science</span>
            </div>

            <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Farai B Musariri — <span className="text-[#32FF00]">Computer Vision & AI</span>
            </h1>

            <p className="text-lg font-medium leading-relaxed text-white sm:text-xl">
              Building smart systems that see and understand. MSc researcher in small-object detection and domain adaptation.
            </p>

            <div className="rounded-xl border-l-4 border-[#32FF00] bg-[#16213E]/60 p-4 text-sm text-[#CCCCCC]">
              <p className="font-medium text-white">
                "I design models that find tiny things in crowded pictures. Currently focused on African penguin monitoring."
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/home#projects" className="btn-solid inline-flex min-h-[44px] items-center gap-2 rounded-xl px-6 py-3 text-sm" data-testid="hero-projects">
                View projects
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/home#cv"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-500 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white"
                data-testid="hero-cv"
              >
                Experience & education
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 border-t border-[#16213E] pt-6">
              <div>
                <span className="font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">~20px</span>
                <p className="mt-1 text-xs text-[#CCCCCC]">Micro Target Detection</p>
              </div>
              <div>
                <span className="font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">2x</span>
                <p className="mt-1 text-xs text-[#CCCCCC]">Peer Papers (2024)</p>
              </div>
              <div>
                <span className="font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">Real-Time</span>
                <p className="mt-1 text-xs text-[#CCCCCC]">Inference Engine</p>
              </div>
            </div>
          </div>

          {showcaseOk && (
            <div className="lg:col-span-5">
              <figure className="rounded-2xl border border-[#16213E] bg-[#16213E]/70 p-4 shadow-2xl">
                <figcaption className="flex items-center justify-between pb-3 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <ScanLine className="h-4 w-4 text-[#32FF00]" aria-hidden="true" />
                    Detector output
                  </span>
                  <span className="whitespace-nowrap rounded-full border border-slate-500 bg-slate-800 px-2.5 py-1 font-mono text-[11px] text-white">26 objects detected</span>
                </figcaption>
                <div className="h-64 w-full overflow-hidden rounded-xl border border-[#16213E] bg-[#0F1419] sm:h-80">
                  <img src={showcase.after} alt={`Object detector output: ${showcase.headline}`} className="h-full w-full object-cover" onError={() => setShowcaseOk(false)} />
                </div>
                <p className="mt-3 text-xs text-[#CCCCCC]">Real output from my in-browser detector (YOLO11n), run on a sample photo.</p>
              </figure>
            </div>
          )}
        </div>
      </section>

      {/* 2. Background */}
      <section id="bio" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#16213E] border-l-4 border-l-[#32FF00] bg-[#16213E]/40 p-8 shadow-xl sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-3xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">About The Researcher</span>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Rigor Meets Working Code</h2>
              <p className="text-base leading-relaxed text-[#CCCCCC] sm:text-lg">
                "I'm a computer science researcher and developer based in South Africa, passionate about computer vision and machine learning. My work centers on detecting small objects in dense, challenging environments—think counting hundreds of penguins in aerial colony photos. I combine academic rigor with practical problem-solving."
              </p>
            </div>
            <div className="shrink-0 space-y-1.5 rounded-xl border border-[#16213E] bg-[#0F1419] p-4 font-mono text-xs">
              <div className="font-bold text-white">Farai B Musariri</div>
              <div className="text-white">MSc Candidate (2025)</div>
              <div className="text-[#CCCCCC]">Rhodes University, ZA</div>
              <div className="pt-1 text-[11px] text-[#32FF00]">SATNAC & SACAIR Author</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Experience and education (from the same data as the About page) */}
      <section id="cv" className="mx-auto max-w-7xl scroll-mt-24 space-y-8 px-4 sm:px-6 lg:px-8" data-testid="cv-section">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">Background</span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white">Experience & education</h2>
          </div>
          <Link to="/about#experience" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 hover:underline">
            Full CV & research <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
              <Briefcase className="h-4 w-4 text-[#32FF00]" aria-hidden="true" /> Experience
            </h3>
            {EXPERIENCE.map((e) => (
              <article key={`${e.role}-${e.period}`} className="rounded-xl border border-[#16213E] bg-[#16213E]/40 p-5" data-testid="cv-experience">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h4 className="font-display text-base font-bold text-white">{e.role}</h4>
                  <span className="font-mono text-xs text-[#CCCCCC]">{e.period}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#CCCCCC]">{e.company}</p>
                <p className="mt-2 text-sm text-[#CCCCCC]">{e.points[0]}</p>
              </article>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
              <GraduationCap className="h-4 w-4 text-[#32FF00]" aria-hidden="true" /> Education
            </h3>
            {EDUCATION.map((e) => (
              <article key={`${e.degree}-${e.period}`} className="rounded-xl border border-[#16213E] bg-[#16213E]/40 p-5" data-testid="cv-education">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h4 className="font-display text-base font-bold text-white">{e.degree}</h4>
                  <span className="font-mono text-xs text-[#CCCCCC]">{e.period}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#CCCCCC]">{e.institution}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Research */}
      <section id="research" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-[#16213E] border-l-4 border-l-[#32FF00] bg-[#16213E]/50 p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#32FF00]/40 bg-[#32FF00]/10 text-[#32FF00]">
              <Target className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="rounded-full border border-slate-500 bg-slate-800 px-3 py-1 font-mono text-xs font-semibold text-white">Published SATNAC & SACAIR 2024</span>
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-white">Small-Object Detection Research</h2>
            <p className="text-sm font-medium text-[#32FF00]">Domain-adaptive detection for African penguins</p>
            <p className="text-sm leading-relaxed text-[#CCCCCC]">
              Investigating Non-Maximum Suppression (NMS) vs End-to-End Decoding strategies for counting endangered African penguins in dense aerial colony surveys. Evaluates model robustness against extreme clustering, occlusions, and severe distribution shifts across coastal habitats.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['PyTorch', 'YOLOv8', 'Domain Adaptation', 'Aerial Imagery', 'NMS vs End-to-End'].map((t) => (
              <span key={t} className="rounded-lg border border-[#16213E] bg-[#0F1419] px-2.5 py-1 font-mono text-xs text-[#CCCCCC]">
                {t}
              </span>
            ))}
          </div>
          <Link to="/about#research" className="inline-flex items-center gap-1.5 text-sm font-bold text-white underline-offset-4 hover:underline">
            Read the full research details <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* 5. What I have built */}
      <CaseStudies />

      {/* 6. How it is built */}
      <EngineeringSection />

      {/* 7. Skills (the full, filterable list is on the About page) */}
      <section id="skills" className="mx-auto max-w-7xl scroll-mt-24 space-y-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">Proficiencies & Stack</span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Technical tooling & competencies</h2>
          <p className="text-sm text-[#CCCCCC]">
            Computer vision AI/ML, multi-paradigm programming, full-stack web, databases, and enterprise IT infrastructure.
          </p>
        </div>
        <SkillsSection layout="comprehensive" showFilter={false} />
      </section>

      {/* 8. Work with me */}
      <WorkWithMe />
    </div>
  );
}
