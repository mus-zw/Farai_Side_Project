import React, { useState } from 'react';
import {
  Mail,
  Github,
  Linkedin,
  Send,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Sparkles,
  RefreshCw,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface ContactProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export default function Contact({ onNotify }: ContactProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Email validation regex (RFC 5322 compatible)
  const validateEmail = (val: string): boolean => {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(val.trim());
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Please provide your full name.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }

    if (!email.trim()) {
      newErrors.email = 'Please provide your email address.';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address (e.g. name@domain.com).';
    }

    if (!message.trim()) {
      newErrors.message = 'Please provide a message or project overview.';
    } else if (message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters long.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (errors.message) {
      setErrors((prev) => ({ ...prev, message: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      onNotify('error', 'Please resolve the highlighted form errors.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate network dispatch with realistic latency
      await new Promise((resolve) => setTimeout(resolve, 800));

      setIsSuccess(true);
      onNotify(
        'success',
        `Thank you ${name.trim()}! Your message has been dispatched successfully.`
      );
      setName('');
      setEmail('');
      setMessage('');
      setErrors({});
    } catch {
      onNotify('error', 'Failed to dispatch message. Please try again or email directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* 1. Header & Opportunity Statement */}
      <section className="space-y-4 max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#32FF00]/40 bg-[#16213E]/80 px-3.5 py-1 text-xs font-semibold text-[#32FF00]">
          <span className="h-2 w-2 rounded-full bg-[#32FF00] shadow-[0_0_8px_#32FF00]" />
          <span>Opportunities & Collaborations</span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Get In Touch
        </h1>

        {/* Personalized Message from User Brief */}
        <div className="rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/60 p-6 sm:p-8 space-y-3 shadow-xl lime-glow">
          <p className="text-base sm:text-lg text-white font-medium leading-relaxed">
            "I'm interested in opportunities in computer vision, machine learning, and data science. Whether it's research, development, or production systems—I'm keen to explore projects involving real-world problem-solving."
          </p>
          <p className="text-xs text-[#CCCCCC]">
            Currently based in Kempton Park, South Africa. Open to remote, hybrid, and collaborative technical roles.
          </p>
        </div>
      </section>

      {/* 2. Main Content Grid (Contact Info + Form) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Direct Channels & Credentials */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border-l-4 border-[#32FF00] border-t border-b border-r border-[#16213E] bg-[#16213E]/50 p-6 space-y-5 lime-border-hover">
            <h2 className="font-display text-lg font-bold text-white">
              Direct Contact Information
            </h2>

            <div className="space-y-4 text-xs">
              {/* Email */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0F1419] border border-[#16213E]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#32FF00]/10 text-[#32FF00]">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                    Primary Email
                  </span>
                  <div>
                    <a
                      href="mailto:fbmfari@gmail.com"
                      className="font-mono text-white hover:text-[#32FF00] transition-colors"
                    >
                      fbmfari@gmail.com
                    </a>
                  </div>
                  <div className="text-[11px] text-[#888888]">Direct response within 24 hours</div>
                </div>
              </div>

              {/* LinkedIn */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0F1419] border border-[#16213E]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#32FF00]/10 text-[#32FF00]">
                  <Linkedin className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                    Professional Network
                  </span>
                  <div>
                    <a
                      href="https://linkedin.com/in/farai-musariri"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-white hover:text-[#32FF00] transition-colors"
                    >
                      linkedin.com/in/farai-musariri
                    </a>
                  </div>
                  <div className="text-[11px] text-[#888888]">Connect for academic & career updates</div>
                </div>
              </div>

              {/* GitHub */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0F1419] border border-[#16213E]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#32FF00]/10 text-[#32FF00]">
                  <Github className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                    Code & Repositories
                  </span>
                  <div>
                    <a
                      href="https://github.com/farai-musariri"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-white hover:text-[#32FF00] transition-colors"
                    >
                      github.com/farai-musariri
                    </a>
                  </div>
                  <div className="text-[11px] text-[#888888]">Open-source prototypes and experiments</div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0F1419] border border-[#16213E]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#32FF00]/10 text-[#32FF00]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                    Location
                  </span>
                  <div className="font-mono text-white">
                    Kempton Park, South Africa
                  </div>
                  <div className="text-[11px] text-[#888888]">South Africa Standard Time (UTC+2)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Technical Scope Card */}
          <div className="rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-5 space-y-3 text-xs">
            <span className="font-bold text-[#32FF00] uppercase tracking-wider text-[11px]">
              Areas of Discussion
            </span>
            <ul className="text-[#CCCCCC] space-y-1.5 list-disc list-inside">
              <li>Computer vision model evaluation (YOLO, DETR, Mask R-CNN)</li>
              <li>Small-object localization in aerial drone surveys</li>
              <li>Domain adaptation across camera altitudes & natural habitats</li>
              <li>Production inference pipelines (FastAPI, ONNX, Docker)</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Interactive Contact Form */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border-l-4 border-t border-b border-r border-[#32FF00] bg-[#16213E]/50 p-6 sm:p-8 space-y-6 shadow-xl lime-glow">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-white">
                Send a Message
              </h2>
              <p className="text-xs text-[#CCCCCC]">
                Fill out the form below to initiate discussion regarding projects, hiring, or research questions.
              </p>
            </div>

            {isSuccess && (
              <div className="rounded-xl border border-[#32FF00]/50 bg-[#32FF00]/10 p-4 text-xs text-white space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-[#32FF00] font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Message Received!</span>
                </div>
                <p className="text-[#CCCCCC]">
                  Thank you for reaching out. Farai will review your inquiry and follow up via email shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSuccess(false)}
                  className="mt-2 text-xs font-semibold text-[#32FF00] hover:underline"
                >
                  Send another message
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Full Name <span className="text-[#32FF00]">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={handleNameChange}
                  placeholder="e.g. Dr. Jane Smith or Alex Miller"
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-[#0F1419] px-4 py-3 text-sm text-white placeholder-[#666666] focus:outline-none transition-colors ${
                    errors.name
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-[#16213E] focus:border-[#32FF00] focus:shadow-[0_0_10px_rgba(50,255,0,0.3)]'
                  }`}
                />
                {errors.name && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 pt-0.5">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Email Address <span className="text-[#32FF00]">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="name@organization.com"
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-[#0F1419] px-4 py-3 text-sm text-white placeholder-[#666666] focus:outline-none transition-colors ${
                    errors.email
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-[#16213E] focus:border-[#32FF00] focus:shadow-[0_0_10px_rgba(50,255,0,0.3)]'
                  }`}
                />
                {errors.email && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 pt-0.5">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Message / Project Overview <span className="text-[#32FF00]">*</span>
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="Describe your project, research question, or role requirements..."
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-[#0F1419] px-4 py-3 text-sm text-white placeholder-[#666666] focus:outline-none transition-colors resize-y ${
                    errors.message
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-[#16213E] focus:border-[#32FF00] focus:shadow-[0_0_10px_rgba(50,255,0,0.3)]'
                  }`}
                />
                {errors.message && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 pt-0.5">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.message}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-lime min-h-[48px] w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-[#0F1419]" />
                    <span>Sending Transmission...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
