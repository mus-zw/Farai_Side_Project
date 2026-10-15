import { Link } from 'react-router-dom';
import { Github, Linkedin, Mail, GraduationCap, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-[#16213E] bg-[#0A0E17] py-12 text-sm text-[#CCCCCC]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Column 1: Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#32FF00] shadow-[0_0_8px_#32FF00]" />
              <span className="font-display text-base font-bold text-white tracking-tight">
                Farai Bodias Musariri
              </span>
            </div>
            <p className="max-w-md text-[#CCCCCC] text-xs sm:text-sm leading-relaxed">
              MSc Computer Science candidate at Rhodes University specialising in small-object detection,
              aerial wildlife monitoring, and unsupervised domain adaptation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 text-xs text-[#999999] pt-1">
              <div className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-[#32FF00]" />
                <span>Rhodes University, South Africa</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#32FF00]" />
                <span>Kempton Park, South Africa</span>
              </div>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Navigation
            </span>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link to="/home" className="text-[#CCCCCC] hover:text-[#32FF00] transition-colors inline-block py-1">
                  Home & Overview
                </Link>
              </li>
              <li>
                <Link to="/about#research" className="text-[#CCCCCC] hover:text-[#32FF00] transition-colors inline-block py-1">
                  Research & Publications
                </Link>
              </li>
              <li>
                <Link to="/demo" className="text-[#CCCCCC] hover:text-[#32FF00] transition-colors inline-block py-1">
                  Interactive CV Suite
                </Link>
              </li>
              <li>
                <Link to="/about#skills" className="text-[#CCCCCC] hover:text-[#32FF00] transition-colors inline-block py-1">
                  Technical Skills & Stack
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-[#CCCCCC] hover:text-[#32FF00] transition-colors inline-block py-1">
                  About & Qualifications
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-[#CCCCCC] hover:text-[#32FF00] transition-colors inline-block py-1">
                  Contact & Collaborate
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Connect */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Connect
            </span>
            <div className="mt-3 flex flex-col space-y-2 text-xs">
              <a
                href="mailto:fbmfari@gmail.com"
                className="flex items-center gap-2 text-[#CCCCCC] hover:text-[#32FF00] transition-colors py-1"
              >
                <Mail className="h-4 w-4 text-[#32FF00]" />
                <span>fbmfari@gmail.com</span>
              </a>
              <a
                href="https://github.com/farai-musariri"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#CCCCCC] hover:text-[#32FF00] transition-colors py-1"
              >
                <Github className="h-4 w-4 text-[#32FF00]" />
                <span>github.com/farai-musariri</span>
              </a>
              <a
                href="https://linkedin.com/in/farai-musariri"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#CCCCCC] hover:text-[#32FF00] transition-colors py-1"
              >
                <Linkedin className="h-4 w-4 text-[#32FF00]" />
                <span>linkedin.com/in/farai-musariri</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 border-t border-[#16213E] pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#888888] gap-4">
          <p>© {new Date().getFullYear()} Farai Bodias Musariri. Built with React & Tailwind CSS.</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#32FF00]">MSc Research Edition</span>
            <span>·</span>
            <span>SATNAC & SACAIR 2024</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
