import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  Layers,
  Sparkles,
  Zap,
  Cpu,
  Target,
  FileText,
  ScanLine,
  CheckCircle2,
  Code2,
  Database,
  Terminal,
  ExternalLink,
  BookOpen,
  Award,
} from 'lucide-react';
import { SAMPLE_IMAGES } from '../utils/sampleData';
import SkillsSection from '../components/SkillsSection';

export default function Home() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const sample = SAMPLE_IMAGES[0]; // African Penguin Colony flagship sample

  return (
    <div className="space-y-24 py-8 md:py-16">
      {/* 1. Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#32FF00]/40 bg-[#16213E]/80 px-3.5 py-1 text-xs font-semibold text-[#32FF00]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#32FF00] animate-pulse shadow-[0_0_8px_#32FF00]" />
              <span>Rhodes University · MSc Computer Science</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] text-balance">
              Farai Bodias Musariri —{' '}
              <span className="text-[#32FF00] drop-shadow-[0_0_25px_rgba(50,255,0,0.3)]">
                Computer Vision & AI
              </span>
            </h1>

            <p className="text-lg sm:text-xl font-medium text-white leading-relaxed">
              Building smart systems that see and understand. MSc researcher in small-object detection and domain adaptation.
            </p>

            <div className="rounded-xl border-l-4 border-[#32FF00] bg-[#16213E]/60 p-4 text-sm text-[#CCCCCC]">
              <p className="font-medium text-white">
                "I design models that find tiny things in crowded pictures. Currently focused on African penguin monitoring."
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/demo"
                className="btn-lime min-h-[44px] inline-flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-bold shadow-[0_0_20px_rgba(50,255,0,0.3)]"
              >
                <span>Try the Demo Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about#research"
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#16213E] bg-[#16213E]/60 px-5 py-3 text-sm font-semibold text-white hover:border-[#32FF00]/60 hover:text-[#32FF00] transition-colors"
              >
                <BookOpen className="h-4 w-4 text-[#32FF00]" />
                <span>View Research & About</span>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#16213E]">
              <div>
                <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">~20px</span>
                <p className="text-xs text-[#CCCCCC] mt-1">Micro Target Detection</p>
              </div>
              <div>
                <span className="font-mono text-2xl sm:text-3xl font-bold text-[#32FF00] tabular-nums">2x</span>
                <p className="text-xs text-[#CCCCCC] mt-1">Peer Papers (2024)</p>
              </div>
              <div>
                <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">Real-Time</span>
                <p className="text-xs text-[#CCCCCC] mt-1">Inference Engine</p>
              </div>
            </div>
          </div>

          {/* Hero Right: Interactive Split Inspection with African Penguin Sample */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl border border-[#16213E] bg-[#16213E]/70 p-4 shadow-2xl backdrop-blur-sm lime-border-hover">
              <div className="flex items-center justify-between pb-3 text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <ScanLine className="h-4 w-4 text-[#32FF00]" />
                  Live Small-Object Detection
                </span>
                <span className="text-[#32FF00] font-mono text-[11px] bg-[#32FF00]/10 px-2 py-0.5 rounded-full border border-[#32FF00]/30">
                  African Penguin Colony (~20px)
                </span>
              </div>

              {/* Interactive Split Comparison */}
              <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-xl border border-[#16213E] select-none bg-[#0F1419]">
                {/* Annotated layer */}
                <div className="absolute inset-0">
                  <img
                    src={sample.dataUrl}
                    alt="African penguin colony aerial view"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Bounding box overlays */}
                  {sample.boxes.map((box) => (
                    <div
                      key={box.id}
                      className="absolute border-2 transition-transform"
                      style={{
                        left: `${box.bbox[0] * 100}%`,
                        top: `${box.bbox[1] * 100}%`,
                        width: `${box.bbox[2] * 100}%`,
                        height: `${box.bbox[3] * 100}%`,
                        borderColor: '#32FF00',
                        backgroundColor: 'rgba(50, 255, 0, 0.18)',
                        boxShadow: '0 0 8px rgba(50, 255, 0, 0.4)',
                      }}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-[#0F1419] border border-[#32FF00] px-1 text-[9px] font-bold text-[#32FF00] font-mono whitespace-nowrap">
                        {box.className} {Math.round(box.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Original raw image clipped by slider using pixel-perfect clipPath */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                  <img
                    src={sample.dataUrl}
                    alt="Raw aerial survey"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Vertical Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#32FF00] shadow-[0_0_12px_#32FF00] pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-[#0F1419] border-2 border-[#32FF00] flex items-center justify-center text-[#32FF00] shadow-[0_0_15px_rgba(50,255,0,0.6)]">
                    <span className="text-[10px] font-bold">⇄</span>
                  </div>
                </div>

                {/* Interactive range slider controller */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  aria-label="Comparison slider position"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                />

                {/* Labels */}
                <div className="absolute top-2 left-2 rounded-md bg-[#0F1419]/90 border border-[#16213E] px-2 py-0.5 text-[10px] font-mono text-[#CCCCCC]">
                  Raw Frame
                </div>
                <div className="absolute top-2 right-2 rounded-md bg-[#0F1419]/90 border border-[#32FF00]/50 px-2 py-0.5 text-[10px] font-mono text-[#32FF00]">
                  YOLOv8 Detection (12 micro-targets)
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-[#CCCCCC]">
                <span>Drag slider left/right to reveal bounding boxes</span>
                <Link
                  to="/demo"
                  className="text-xs font-semibold text-[#32FF00] hover:underline flex items-center gap-1"
                >
                  <span>Open Full Suite</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Researcher Bio Statement Section */}
      <section id="bio" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/40 p-8 sm:p-10 shadow-xl lime-glow">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="space-y-3 max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">
                About The Researcher
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Rigor Meets Working Code
              </h2>
              <p className="text-base sm:text-lg text-[#CCCCCC] leading-relaxed">
                "I'm a computer science researcher and developer based in South Africa, passionate about computer vision and machine learning. My work centers on detecting small objects in dense, challenging environments—think counting hundreds of penguins in aerial colony photos. I combine academic rigor with practical problem-solving."
              </p>
            </div>
            <div className="shrink-0 flex flex-col gap-2">
              <div className="rounded-xl border border-[#16213E] bg-[#0F1419] p-4 text-xs space-y-1.5 font-mono">
                <div className="text-[#32FF00] font-bold">Farai Bodias Musariri</div>
                <div className="text-white">MSc Candidate (2025)</div>
                <div className="text-[#999999]">Rhodes University, ZA</div>
                <div className="text-[#32FF00] text-[11px] pt-1">SATNAC & SACAIR Author</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Cards Section */}
      <section id="featured" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="space-y-3 text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">
            Featured Highlights
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Core Research & Applied Platforms
          </h2>
          <p className="text-sm text-[#CCCCCC]">
            Bridging fundamental theoretical models with interactive, deployment-ready software.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Featured Card 1: Small-Object Detection Research */}
          <div className="group rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/50 p-8 space-y-6 hover:bg-[#16213E]/80 transition-all duration-300 lime-border-hover">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#32FF00]/10 border border-[#32FF00]/40 text-[#32FF00]">
                <Target className="h-6 w-6" />
              </div>
              <span className="rounded-full border border-[#32FF00]/40 bg-[#32FF00]/10 px-3 py-1 text-xs font-mono font-semibold text-[#32FF00]">
                Published SATNAC & SACAIR 2024
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-white group-hover:text-[#32FF00] transition-colors">
                Small-Object Detection Research
              </h3>
              <p className="text-sm font-medium text-[#32FF00]">
                Domain-adaptive detection for African penguins
              </p>
              <p className="text-sm text-[#CCCCCC] leading-relaxed">
                Investigating Non-Maximum Suppression (NMS) vs End-to-End Decoding strategies for counting endangered African penguins in dense aerial colony surveys. Evaluates model robustness against extreme clustering, occlusions, and severe distribution shifts across coastal habitats.
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {['PyTorch', 'YOLOv8', 'Domain Adaptation', 'Aerial Imagery', 'NMS vs End-to-End'].map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-[#16213E] bg-[#0F1419] px-2.5 py-1 text-xs font-mono text-[#CCCCCC]"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-4 border-t border-[#16213E] flex items-center justify-between">
              <Link
                to="/about#research"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#32FF00] hover:underline"
              >
                <span>Read Full Research Details</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span className="text-xs text-[#888888] font-mono">Rhodes University</span>
            </div>
          </div>

          {/* Featured Card 2: Computer Vision Suite */}
          <div className="group rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/50 p-8 space-y-6 hover:bg-[#16213E]/80 transition-all duration-300 lime-border-hover">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#32FF00]/10 border border-[#32FF00]/40 text-[#32FF00]">
                <Layers className="h-6 w-6" />
              </div>
              <span className="rounded-full border border-[#32FF00]/40 bg-[#32FF00]/10 px-3 py-1 text-xs font-mono font-semibold text-[#32FF00]">
                Interactive Demo Engine
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-white group-hover:text-[#32FF00] transition-colors">
                Computer Vision Suite
              </h3>
              <p className="text-sm font-medium text-[#32FF00]">
                Interactive platform for detection and analysis
              </p>
              <p className="text-sm text-[#CCCCCC] leading-relaxed">
                Built to showcase CV capabilities and experiment with architectures. Features split before/after inspection, interactive dynamic confidence slider, multi-model side-by-side benchmarking, batch processing with ZIP packaging, and real-time video stream analysis.
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {['React', 'FastAPI', 'Real-time Inference', 'Video Suite', 'Client-side Fallback'].map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-[#16213E] bg-[#0F1419] px-2.5 py-1 text-xs font-mono text-[#CCCCCC]"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-4 border-t border-[#16213E] flex items-center justify-between">
              <Link
                to="/demo?sample=african-penguins"
                className="btn-lime inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-md"
              >
                <span>Launch Interactive Demo</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span className="text-xs text-[#888888] font-mono">Image & Video Modes</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Technical Skills Section */}
      <section id="skills" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24 space-y-10">
        <div className="space-y-3 text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">
            Proficiencies & Stack
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Technical Tooling & Competencies
          </h2>
          <p className="text-sm text-[#CCCCCC]">
            Production-grade capabilities across computer vision AI/ML, multi-paradigm programming, full-stack web, databases, and enterprise IT infrastructure.
          </p>
        </div>

        <SkillsSection layout="comprehensive" showFilter={true} />
      </section>

      {/* 5. Call to Action Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-gradient-to-r from-[#16213E] via-[#0F1419] to-[#16213E] p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl lime-glow">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Test Small-Object Detection In Real-Time
            </h3>
            <p className="text-sm text-[#CCCCCC] max-w-xl">
              Inspect African penguin colony drone captures, benchmark models side-by-side, or upload your own high-resolution aerial footage.
            </p>
          </div>
          <Link
            to="/demo"
            className="btn-lime min-h-[44px] shrink-0 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-lg"
          >
            <Eye className="h-4 w-4" />
            <span>Open CV Workbench</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
