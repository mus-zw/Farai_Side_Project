import { useState } from 'react';
import {
  Code2,
  Globe,
  Database,
  Wrench,
  Server,
  Cpu,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { TECHNICAL_SKILL_CATEGORIES, SkillCategory } from '../utils/skillsData';

interface SkillsSectionProps {
  layout?: 'compact' | 'comprehensive';
  showFilter?: boolean;
}

export default function SkillsSection({
  layout = 'comprehensive',
  showFilter = true,
}: SkillsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const getCategoryIcon = (iconName: SkillCategory['iconName']) => {
    switch (iconName) {
      case 'ai':
        return <Cpu className="h-5 w-5 text-[#32FF00]" />;
      case 'code':
        return <Code2 className="h-5 w-5 text-[#32FF00]" />;
      case 'web':
        return <Globe className="h-5 w-5 text-[#32FF00]" />;
      case 'database':
        return <Database className="h-5 w-5 text-[#32FF00]" />;
      case 'tools':
        return <Wrench className="h-5 w-5 text-[#32FF00]" />;
      case 'it':
        return <Server className="h-5 w-5 text-[#32FF00]" />;
      case 'soft':
        return <Users className="h-5 w-5 text-[#32FF00]" />;
      default:
        return <Sparkles className="h-5 w-5 text-[#32FF00]" />;
    }
  };

  const filteredCategories =
    activeCategory === 'all'
      ? TECHNICAL_SKILL_CATEGORIES
      : TECHNICAL_SKILL_CATEGORIES.filter((c) => c.id === activeCategory);

  return (
    <div className="space-y-8">
      {/* Category Filter Pills (Optional) */}
      {showFilter && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_12px_rgba(50,255,0,0.35)]'
                : 'bg-[#16213E]/60 text-[#CCCCCC] hover:text-white hover:bg-[#16213E] border border-[#16213E]'
            }`}
          >
            All Skills ({TECHNICAL_SKILL_CATEGORIES.length})
          </button>
          {TECHNICAL_SKILL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_12px_rgba(50,255,0,0.35)]'
                  : 'bg-[#16213E]/60 text-[#CCCCCC] hover:text-white hover:bg-[#16213E] border border-[#16213E]'
              }`}
            >
              {cat.title.split('&')[0].trim()}
            </button>
          ))}
        </div>
      )}

      {/* Grid of Skill Category Cards */}
      <div
        className={`grid gap-6 ${
          layout === 'compact'
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className="group rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-6 space-y-4 hover:border-[#32FF00]/50 hover:bg-[#16213E]/70 transition-all duration-200 flex flex-col justify-between shadow-lg relative overflow-hidden"
          >
            {/* Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#32FF00]/60 to-transparent group-hover:via-[#32FF00] transition-colors" />

            <div className="space-y-3">
              {/* Category Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F1419] border border-[#16213E] group-hover:border-[#32FF00]/40 group-hover:shadow-[0_0_10px_rgba(50,255,0,0.2)] transition-all">
                    {getCategoryIcon(cat.iconName)}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white group-hover:text-[#32FF00] transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-[11px] text-[#999999] leading-tight mt-0.5">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>

                {cat.badge && (
                  <span className="shrink-0 rounded-full border border-[#32FF00]/40 bg-[#32FF00]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#32FF00]">
                    {cat.badge}
                  </span>
                )}
              </div>

              {/* Description */}
              {cat.description && (
                <p className="text-xs text-[#CCCCCC] leading-relaxed pt-1">
                  {cat.description}
                </p>
              )}
            </div>

            {/* Skills Badges */}
            <div className="pt-2 border-t border-[#16213E]/80">
              <div className="flex flex-wrap gap-1.5">
                {cat.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0F1419] border border-[#16213E] px-2.5 py-1 text-xs font-mono text-[#CCCCCC] group-hover:border-[#32FF00]/30 hover:!border-[#32FF00] hover:!text-white hover:bg-[#16213E] transition-colors"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 text-[#32FF00] shrink-0 opacity-80" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
