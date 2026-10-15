import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Briefcase,
  BookOpen,
  Award,
  ExternalLink,
  Github,
  Mail,
  Linkedin,
  MapPin,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Target,
  FileText,
  Lightbulb,
  Compass,
  Wrench,
} from 'lucide-react';
import SkillsSection from '../components/SkillsSection';

export default function About() {
  const educationHistory = [
    {
      degree: 'MSc Computer Science',
      institution: 'Rhodes University, Grahamstown, South Africa',
      period: '2025 – Present',
      focus: 'Thesis: Small-object detection and domain adaptation in dense environments',
      details:
        'Focused on counting African penguins in dense aerial colony photos, addressing micro-target localization (~20px) under varying natural substrates, occlusions, and illumination.',
    },
    {
      degree: 'BSc Honours in Information Systems',
      institution: 'Rhodes University, Grahamstown, South Africa',
      period: '2024',
      focus: 'Distributed Architectures, Systems Optimization, Machine Learning Workflows',
      details:
        'Graduated with honours, analyzing high-throughput machine learning deployment, scalable backends, and pipeline resilience.',
    },
    {
      degree: 'BSc Computer Science & Information Systems',
      institution: 'Rhodes University, Grahamstown, South Africa',
      period: '2020 – 2023',
      focus: 'Data Structures, Algorithms, Software Engineering, Database Systems',
      details:
        'Double major in Computer Science and Information Systems, building strong foundational competencies in software development and database architectures.',
    },
  ];

  const workExperience = [
    {
      role: 'IT Technician',
      company: 'Rhodes University',
      period: 'Feb 2025 – Present',
      type: 'System Management & Infrastructure',
      points: [
        'Managing campus-wide IT systems, server infrastructure, and network services.',
        'Troubleshooting complex technical failures across multi-platform desktop, lab, and server environments.',
        'Collaborating with faculty and research staff to ensure uninterrupted compute access and reliable academic operations.',
      ],
    },
    {
      role: 'Teaching Assistant / Tutor',
      company: 'Department of Computer Science & Information Systems, Rhodes University',
      period: '2023 – 2024',
      type: 'Academic Instruction & Mentorship',
      points: [
        'Assisted with CS112 (Computer Science) and core Information Systems laboratory practicals.',
        'Mentored 50+ undergraduate students in Python, Java, object-oriented concepts, and computational logic.',
        'Graded coursework assignments and provided practical debugging support during laboratory sessions.',
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
      {/* 1. Header & Executive Summary */}
      <section className="space-y-6 max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#32FF00]/40 bg-[#16213E]/80 px-3.5 py-1 text-xs font-semibold text-[#32FF00]">
          <span className="h-2 w-2 rounded-full bg-[#32FF00] shadow-[0_0_8px_#32FF00]" />
          <span>Curriculum Vitae & Research Profile</span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Farai Bodias Musariri
        </h1>

        <p className="text-xl sm:text-2xl font-medium text-[#32FF00]">
          Computer Vision Researcher & Developer
        </p>

        {/* Authentic Summary */}
        <div className="rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/60 p-6 sm:p-8 space-y-4 shadow-xl lime-glow">
          <p className="text-base sm:text-lg text-white leading-relaxed font-normal">
            "I'm an MSc Computer Science candidate at Rhodes University, researching small-object detection and domain adaptation. My academic background spans computer science and information systems. I'm drawn to problems at the intersection of ML research and practical engineering."
          </p>
          <div className="flex flex-wrap gap-y-2 gap-x-6 text-xs text-[#CCCCCC] pt-2 border-t border-[#16213E]">
            <span className="flex items-center gap-1.5 text-white">
              <MapPin className="h-4 w-4 text-[#32FF00]" />
              Kempton Park & Grahamstown, South Africa
            </span>
            <span className="flex items-center gap-1.5 text-white">
              <GraduationCap className="h-4 w-4 text-[#32FF00]" />
              Rhodes University
            </span>
            <a
              href="mailto:fbmfari@gmail.com"
              className="flex items-center gap-1.5 text-white hover:text-[#32FF00] transition-colors"
            >
              <Mail className="h-4 w-4 text-[#32FF00]" />
              <span>fbmfari@gmail.com</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. Research Publications */}
      <section id="research" className="space-y-6 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#16213E] pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">
              Academic Contributions
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              Peer-Reviewed Research
            </h2>
          </div>
          <span className="text-xs font-mono text-[#32FF00] bg-[#32FF00]/10 px-3 py-1 rounded-full border border-[#32FF00]/30 w-fit">
            SATNAC 2024 · SACAIR 2024
          </span>
        </div>

        <div className="rounded-2xl border-l-4 border-[#32FF00] border-t border-b border-r border-[#16213E] bg-[#16213E]/50 p-6 sm:p-8 space-y-6 lime-border-hover">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-semibold text-[#32FF00] uppercase tracking-wider">
                Conference Papers · 2024
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-white mt-1">
                "NMS vs End-to-End Decoding for Small-Object Detection in Aerial Imagery"
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-lg bg-[#0F1419] border border-[#32FF00]/40 px-3 py-1.5 text-xs font-mono text-[#32FF00]">
                SATNAC 2024
              </span>
              <span className="rounded-lg bg-[#0F1419] border border-[#32FF00]/40 px-3 py-1.5 text-xs font-mono text-[#32FF00]">
                SACAIR 2024
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm text-[#CCCCCC] leading-relaxed">
            <p>
              <strong className="text-white">Problem Statement:</strong> Automated census and counting of endangered African penguins (<em>Spheniscus demersus</em>) in dense aerial drone surveys across natural coastal colonies.
            </p>
            <p>
              <strong className="text-white">Investigation:</strong> Compared conventional anchor-based and anchor-free one-stage detectors relying on Non-Maximum Suppression (NMS) against transformer-style end-to-end set prediction decoding (e.g. RT-DETR) under extreme cluster density, overlapping bounds, and small target footprints (~20 pixels).
            </p>
            <p>
              <strong className="text-white">Status & Direction:</strong> Ongoing research and continuous improvement towards self-supervised domain adaptation across distinct colony islands and shifting camera altitudes.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono">
            {['African Penguin Monitoring', 'NMS vs End-to-End', 'Aerial UAV Imagery', 'YOLOv8', 'RT-DETR', 'Small Object Recall'].map((tag) => (
              <span key={tag} className="rounded-md border border-[#16213E] bg-[#0F1419] px-2.5 py-1 text-[#CCCCCC]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Featured Project Spotlight */}
      <section id="project" className="space-y-6 scroll-mt-24">
        <div className="border-b border-[#16213E] pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">
            Flagship Engineering Project
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
            African Penguin Detection & Monitoring
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 rounded-2xl border-l-4 border-[#32FF00] border-t border-b border-r border-[#16213E] bg-[#16213E]/50 p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              <h3 className="font-display text-xl font-bold text-white">
                Domain-Adaptive Detection System for Wildlife Conservation
              </h3>
              <p className="text-sm text-[#CCCCCC] leading-relaxed">
                African penguins are an endangered seabird species whose populations have plummeted. Traditional manual ground counts are labor-intensive, disturb breeding nests, and struggle with colony scale. Aerial drone photography allows rapid coverage, but automating counts requires computer vision models capable of discerning tiny birds against complex granite rocks and shadowed sand.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-[#16213E] bg-[#0F1419] p-4 space-y-2">
                <span className="text-xs font-bold text-[#32FF00] uppercase tracking-wider">
                  Real-World Challenges
                </span>
                <ul className="text-xs text-[#CCCCCC] space-y-1.5 list-disc list-inside">
                  <li>Small objects: individual penguins span only ~20–30 pixels</li>
                  <li>Dense clustering and inter-object occlusions in huddles</li>
                  <li>Steep aerial perspective distortion</li>
                  <li>Severe domain shift between rocky vs sandy colonies</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#16213E] bg-[#0F1419] p-4 space-y-2">
                <span className="text-xs font-bold text-[#32FF00] uppercase tracking-wider">
                  Conservation Impact
                </span>
                <ul className="text-xs text-[#CCCCCC] space-y-1.5 list-disc list-inside">
                  <li>Reduces manual survey duration from days to minutes</li>
                  <li>Zero physical disturbance to vulnerable breeding birds</li>
                  <li>Auditable visual bounding box records for biologists</li>
                  <li>Repeatable population density tracking over seasons</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/demo?sample=african-penguins"
                className="btn-lime inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-md"
              >
                <span>Test African Penguin Sample In Demo</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Side Info Box */}
          <div className="lg:col-span-4 rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-6 space-y-4">
            <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#32FF00]" />
              Engineering Takeaway
            </h4>
            <p className="text-xs text-[#CCCCCC] leading-relaxed">
              "This project shows an understanding of real-world constraints. Benchmarking on standard COCO datasets is useful, but real deployment requires handling weather changes, camera altitude variations, and edge processing speed."
            </p>
            <div className="border-t border-[#16213E] pt-3 text-xs text-[#999999] font-mono space-y-1">
              <div>Domain: Remote Sensing & Ecology</div>
              <div>Framework: PyTorch / Ultralytics</div>
              <div>Primary Metric: F1-score @ IoU 0.5</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Technical Skills & Core Competencies */}
      <section id="skills" className="space-y-6 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#16213E] pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#32FF00]">
              Expertise & Tooling
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              Technical Skills & Competencies
            </h2>
          </div>
          <span className="text-xs font-mono text-[#32FF00] bg-[#32FF00]/10 px-3 py-1 rounded-full border border-[#32FF00]/30 w-fit">
            AI/ML · Polyglot Dev · Systems & IT
          </span>
        </div>

        <SkillsSection layout="comprehensive" showFilter={true} />
      </section>

      {/* 5. Education & Experience (Two-Column Layout) */}
      <section id="education" className="grid grid-cols-1 lg:grid-cols-2 gap-10 scroll-mt-24">
        {/* Education Column */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 border-b border-[#16213E] pb-3">
            <GraduationCap className="h-5 w-5 text-[#32FF00]" />
            <h2 className="font-display text-2xl font-bold text-white">Education</h2>
          </div>

          <div className="space-y-4">
            {educationHistory.map((edu, idx) => (
              <div
                key={idx}
                className="rounded-2xl border-l-4 border-[#32FF00] border-t border-b border-r border-[#16213E] bg-[#16213E]/40 p-5 space-y-2 hover:border-[#32FF00]/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="font-display text-base font-bold text-white">
                    {edu.degree}
                  </h3>
                  <span className="font-mono text-xs text-[#32FF00] bg-[#32FF00]/10 px-2 py-0.5 rounded border border-[#32FF00]/30 w-fit">
                    {edu.period}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#CCCCCC]">{edu.institution}</p>
                <p className="text-xs text-[#32FF00] font-mono">{edu.focus}</p>
                <p className="text-xs text-[#999999] leading-relaxed pt-1">{edu.details}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Column */}
        <div id="experience" className="space-y-6 scroll-mt-24">
          <div className="flex items-center gap-2.5 border-b border-[#16213E] pb-3">
            <Briefcase className="h-5 w-5 text-[#32FF00]" />
            <h2 className="font-display text-2xl font-bold text-white">Experience</h2>
          </div>

          <div className="space-y-4">
            {workExperience.map((exp, idx) => (
              <div
                key={idx}
                className="rounded-2xl border-l-4 border-[#32FF00] border-t border-b border-r border-[#16213E] bg-[#16213E]/40 p-5 space-y-2 hover:border-[#32FF00]/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="font-display text-base font-bold text-white">
                    {exp.role}
                  </h3>
                  <span className="font-mono text-xs text-[#32FF00] bg-[#32FF00]/10 px-2 py-0.5 rounded border border-[#32FF00]/30 w-fit">
                    {exp.period}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#CCCCCC]">{exp.company} · {exp.type}</p>
                <ul className="text-xs text-[#999999] space-y-1 list-disc list-inside pt-1">
                  {exp.points.map((pt, pIdx) => (
                    <li key={pIdx}>{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Personal Philosophy */}
      <section id="philosophy" className="rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/50 p-8 sm:p-10 shadow-xl lime-glow scroll-mt-24">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#32FF00]">
            <Compass className="h-4 w-4" />
            <span>Research & Engineering Philosophy</span>
          </div>

          <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Practical Rigor Over Corporate-Speak
          </h3>

          <p className="text-base sm:text-lg text-white font-medium leading-relaxed">
            "I believe the best ML systems are built with both rigor and practicality. Academic theory matters, but so does working code. I'm interested in problems that matter."
          </p>

          <p className="text-xs sm:text-sm text-[#CCCCCC] leading-relaxed">
            Whether building loss functions for tiny objects or ensuring a client's web app runs smoothly with low latency, I care about genuine utility. I prefer being honest about model limitations, failure cases, and real-world hurdles rather than overpromising.
          </p>
        </div>
      </section>

      {/* 6. Contact Invitation */}
      <section className="rounded-2xl border border-[#16213E] bg-[#0F1419] p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="font-display text-xl font-bold text-white">
            Looking for collaboration or technical inquiries?
          </h3>
          <p className="text-xs text-[#CCCCCC]">
            Reach out regarding computer vision research, machine learning engineering, or data science.
          </p>
        </div>
        <Link
          to="/contact"
          className="btn-lime min-h-[44px] shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-md"
        >
          <Mail className="h-4 w-4" />
          <span>Get In Touch</span>
        </Link>
      </section>
    </div>
  );
}
