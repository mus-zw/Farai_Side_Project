/**
 * The CV facts shown on the landing page and on the About page, kept in one place so the two can
 * never disagree. Edit here, not in the pages.
 */

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
  focus: string;
  details: string;
}

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  type: string;
  points: string[];
}

export const EDUCATION: EducationEntry[] = [
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

export const EXPERIENCE: ExperienceEntry[] = [
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
