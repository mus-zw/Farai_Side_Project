export interface SkillCategory {
  id: string;
  title: string;
  subtitle: string;
  iconName: 'code' | 'web' | 'database' | 'tools' | 'it' | 'ai' | 'soft';
  skills: string[];
  description?: string;
  badge?: string;
}

export const TECHNICAL_SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: 'ai-ml',
    title: 'AI / Machine Learning & Computer Vision',
    subtitle: 'Production-ready model architectures, evaluation & deep learning',
    iconName: 'ai',
    badge: 'Core Specialization',
    skills: [
      'PyTorch',
      'TensorFlow',
      'Computer Vision',
      'Transfer Learning',
      'YOLOv8',
      'RT-DETR',
      'Object Detection',
      'Model Evaluation',
    ],
    description: 'Background in building, training, and evaluating production-ready computer vision and deep learning models for complex real-world deployment.',
  },
  {
    id: 'programming-languages',
    title: 'Programming Languages',
    subtitle: 'Multi-paradigm systems, scientific computing & enterprise development',
    iconName: 'code',
    badge: 'Polyglot',
    skills: ['Python', 'Java', 'JavaScript', 'PHP', 'SQL', 'C++', 'C#', 'F#'],
    description: 'Proficiency spanning dynamic scripting, memory-managed OOP, typed functional programming, and relational data query languages.',
  },
  {
    id: 'web-fullstack',
    title: 'Web & Full-Stack Development',
    subtitle: 'Responsive user interfaces, server-side APIs & microservices',
    iconName: 'web',
    skills: ['HTML5', 'CSS3', 'JavaScript', 'PHP', 'REST APIs', 'React', 'FastAPI'],
    description: 'End-to-end full-stack development with semantic accessible markups, robust styling frameworks, and clean RESTful API integration.',
  },
  {
    id: 'databases-data',
    title: 'Databases & Data Engineering',
    subtitle: 'Relational data modeling, schema architecture & analysis',
    iconName: 'database',
    skills: ['SQL Server', 'MySQL', 'Database Design', 'Data Modelling', 'EDA (Exploratory Data Analysis)'],
    description: 'Designing normalized relational databases, crafting optimized queries, data profiling, and statistical exploratory data analysis.',
  },
  {
    id: 'dev-tools',
    title: 'Development Tools & DevOps',
    subtitle: 'Version control, containerization & collaborative methodologies',
    iconName: 'tools',
    skills: ['Git', 'GitHub', 'Docker', 'Agile/Scrum', 'VS Code', 'Linux'],
    description: 'Standard version control workflows, containerized environments, test setups, and agile sprint collaboration.',
  },
  {
    id: 'it-support',
    title: 'IT Support & Systems Engineering',
    subtitle: 'Enterprise hardware, network diagnostics & systems administration',
    iconName: 'it',
    skills: [
      'Hardware/software troubleshooting',
      'OS installation',
      'Network diagnostics',
      'User account management',
      'Ticketing systems',
    ],
    description: 'Hands-on IT infrastructure support covering workstation troubleshooting, multi-OS configuration, enterprise user provisioning, and SLA ticket resolution.',
  },
  {
    id: 'soft-skills',
    title: 'Professional & Soft Skills',
    subtitle: 'Communication, project self-management & leadership',
    iconName: 'soft',
    badge: 'Core Competencies',
    skills: [
      'Independent self-management',
      'Clear technical communication',
      'Mentoring',
      'Client-facing support',
      'Team collaboration',
    ],
    description: 'Proven ability to work autonomously, translate intricate engineering concepts for non-technical stakeholders, and mentor team members.',
  },
];
