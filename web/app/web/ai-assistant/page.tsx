"use client";

import { useState } from "react";
import { apiVertexMeasurement } from "@/lib/api";

// ─── Knowledge base ────────────────────────────────────────────────────────────
type KnowledgeEntry = {
  category: string;
  question: string;
  answer: string;
};

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // FAQ
  {
    category: "FAQ",
    question: "How do I add a new lead?",
    answer:
      "Go to CRM → Lead Pipeline and click Add Lead. Fill in the customer name, contact info, address, and lead source. The status defaults to 'New'.",
  },
  {
    category: "FAQ",
    question: "How do I update a lead status?",
    answer:
      "In Lead Pipeline, click a lead row to open the Lead Profile panel. Use the 'Update Status' section to select the new status and click Save. Status changes are unrestricted — you can move to any stage at any time.",
  },
  {
    category: "FAQ",
    question: "What are the lead sources?",
    answer:
      "Supported lead sources are: Online, Canvaser, Rep, Referral, Other. Legacy values (website, phone call, advertisement) are mapped automatically when displayed.",
  },
  {
    category: "FAQ",
    question: "How do I create a work order?",
    answer:
      "Go to Active Jobs → Work Orders tab, or use the Work Orders page from the sidebar. Click Add Work Order and fill in the customer, schedule, crew, and notes.",
  },
  {
    category: "FAQ",
    question: "How do I connect QuickBooks?",
    answer:
      "Go to Integrations in the sidebar. Find the QuickBooks card and click Connect. You'll be redirected to QuickBooks to authorize the connection.",
  },
  {
    category: "FAQ",
    question: "How do I check invoice status?",
    answer:
      "Go to Invoices in the sidebar. You can filter by Draft, Sent, Paid, or Overdue. The QuickBooks sync column shows if the invoice is synced to QBO.",
  },
  // Best Practices
  {
    category: "Best Practices",
    question: "Best practices for managing leads",
    answer:
      "1. Log every customer interaction as a note in the Lead Profile.\n2. Update status after every meaningful touchpoint.\n3. Use 'On Hold' for leads that are interested but not ready.\n4. Always record the correct lead source so marketing attribution is accurate.",
  },
  {
    category: "Best Practices",
    question: "Best practices for estimates",
    answer:
      "1. Use the AI Satellite Measurement tool for fast linear footage estimates.\n2. Always confirm linear feet before finalizing pricing.\n3. Send the estimate to the customer promptly — response rates drop after 48 hours.\n4. If approved, confirm the job is scheduled within 3 business days.",
  },
  {
    category: "Best Practices",
    question: "Best practices for work orders",
    answer:
      "1. Assign a crew before marking the work order as Scheduled.\n2. Include an arrival window (e.g., 8am–12pm) in the notes.\n3. Take before/after photos and upload them to the job record.\n4. Mark the work order Completed promptly to trigger invoicing.",
  },
  // How to Handle Leads
  {
    category: "How to Handle Leads",
    question: "How to handle a new inbound lead",
    answer:
      "1. Add the lead immediately — same day if possible.\n2. Set status to 'New'.\n3. Call or text within 1 business hour.\n4. Log the contact attempt as a note.\n5. Update status to 'Contacted' after first outreach.\n6. Schedule an estimate appointment if interested.",
  },
  {
    category: "How to Handle Leads",
    question: "How to handle a lead that isn't responding",
    answer:
      "1. Attempt 3 contacts over 5 business days (call, text, email).\n2. Log each attempt as a note.\n3. After 3 unreturned attempts, set status to 'On Hold'.\n4. Set a follow-up reminder for 2 weeks out.\n5. If still no response after 30 days, mark as 'Lost' with a note explaining attempts.",
  },
  {
    category: "How to Handle Leads",
    question: "How to convert a lead to a won deal",
    answer:
      "1. Get verbal or written approval from the customer.\n2. Update lead status to 'Won'.\n3. Create an estimate if one doesn't exist.\n4. Approve the estimate — this creates a customer and job record automatically.\n5. Schedule the work order and assign a crew.",
  },
  // Sales Guidance
  {
    category: "Sales Guidance",
    question: "How to handle pricing objections",
    answer:
      "1. Acknowledge the concern — don't be defensive.\n2. Explain value: quality materials, warranty, licensed crew.\n3. Offer to review the estimate line by line.\n4. If the customer has a lower quote, ask to see it — often they're not comparing the same scope.\n5. Never drop price without understanding what changed in scope.",
  },
  {
    category: "Sales Guidance",
    question: "How to close more estimates",
    answer:
      "1. Follow up within 24 hours of sending an estimate.\n2. Ask directly: 'Does this work for you?' — don't wait for them to call.\n3. Create urgency: 'Our schedule fills up fast — we have an opening next week.'\n4. Offer a clear next step: 'If you're ready, I can get you on the schedule today.'\n5. Log all follow-up calls as notes in the lead profile.",
  },
  {
    category: "Sales Guidance",
    question: "What to say on a first call",
    answer:
      "1. Introduce yourself and the company.\n2. Confirm the customer's need: 'I see you're interested in gutter installation — can you tell me more?'\n3. Gather key info: property type, approximate linear footage, urgency.\n4. Set a specific appointment: 'I can have someone out Tuesday at 10am — does that work?'\n5. Send a confirmation text or email after the call.",
  },
];

// ─── Chat message type ─────────────────────────────────────────────────────────
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isKb?: boolean; // knowledge base answer
};

// ─── Simple keyword matcher ────────────────────────────────────────────────────
const findKbAnswer = (query: string): KnowledgeEntry | null => {
  const q = query.toLowerCase();
  // Score each entry by keyword overlap
  let best: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    const combined = `${entry.question} ${entry.category} ${entry.answer}`.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const score = words.reduce((acc, word) => acc + (combined.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  // Only return if there's a meaningful match
  return bestScore >= 1 ? best : null;
};

const CATEGORIES = ["All", "FAQ", "Best Practices", "How to Handle Leads", "Sales Guidance"];

export default function AiAssistantPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm the GA Gutter Guys AI Assistant. I can answer questions about leads, estimates, work orders, sales best practices, and how to use the portal. What can I help you with?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedKb, setExpandedKb] = useState<string | null>(null);

  // AI live query (Vertex AI)
  const [aiAddress, setAiAddress] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filteredKb =
    activeCategory === "All"
      ? KNOWLEDGE_BASE
      : KNOWLEDGE_BASE.filter((entry) => entry.category === activeCategory);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatInput("");
    setChatLoading(true);

    // Look for a knowledge base answer first
    const kbMatch = findKbAnswer(text);
    if (kbMatch) {
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `**${kbMatch.question}**\n\n${kbMatch.answer}`,
            isKb: true,
          },
        ]);
        setChatLoading(false);
      }, 400);
      return;
    }

    // Fallback response
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I don't have a specific answer for that question in my knowledge base. Try browsing the FAQ topics below, or contact your manager for guidance. You can also use the Satellite Measurement tool for address-based estimates.",
        },
      ]);
      setChatLoading(false);
    }, 400);
  };

  const handleAiMeasurement = async () => {
    if (!aiAddress.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);

    try {
      const result = await apiVertexMeasurement({ address: aiAddress, responseFormat: "json" });
      setAiResult(typeof result === "string" ? result : JSON.stringify(result, null, 2));
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "AI measurement unavailable. Check Vertex AI configuration."
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">AI Assistant</h1>
        <p className="mt-1 text-sm text-slate-400">
          Internal knowledge base, sales guidance, and AI-powered tools.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Left column — chat + KB */}
        <div className="space-y-6">
          {/* Chat */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-base font-semibold text-white">Ask the Assistant</h2>

            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-500/30 text-white"
                        : "border border-white/10 bg-white/5 text-slate-200"
                    }`}
                  >
                    {msg.content}
                    {msg.isKb ? (
                      <p className="mt-1 text-[11px] text-slate-500">— Knowledge Base</p>
                    ) : null}
                  </div>
                </div>
              ))}
              {chatLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                    Thinking...
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleChatSend();
                  }
                }}
                placeholder="Ask about leads, estimates, work orders..."
                className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => void handleChatSend()}
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </section>

          {/* Knowledge Base */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-base font-semibold text-white">Knowledge Base</h2>

            {/* Category filter */}
            <div className="mb-4 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeCategory === cat
                      ? "bg-indigo-500 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredKb.map((entry) => {
                const key = `${entry.category}:${entry.question}`;
                const isOpen = expandedKb === key;
                return (
                  <div key={key} className="rounded-xl border border-white/10 bg-white/5">
                    <button
                      type="button"
                      onClick={() => setExpandedKb(isOpen ? null : key)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-xs text-slate-500">{entry.category}</p>
                        <p className="mt-0.5 text-sm font-medium text-white">{entry.question}</p>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen ? (
                      <div className="border-t border-white/10 px-4 pb-4 pt-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                          {entry.answer}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column — Satellite Measurement */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-2 text-base font-semibold text-white">Satellite Measurement</h2>
            <p className="mb-4 text-xs text-slate-400">
              Enter a property address to get an AI-powered linear footage estimate using Vertex AI satellite data.
            </p>

            <input
              type="text"
              value={aiAddress}
              onChange={(e) => setAiAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAiMeasurement();
              }}
              placeholder="123 Main St, Atlanta, GA"
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />

            <button
              type="button"
              onClick={() => void handleAiMeasurement()}
              disabled={aiLoading || !aiAddress.trim()}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {aiLoading ? "Measuring..." : "Run AI Measurement"}
            </button>

            {aiError ? (
              <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                {aiError}
              </div>
            ) : null}

            {aiResult ? (
              <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                <p className="mb-1 text-xs text-emerald-400">Result</p>
                <pre className="overflow-x-auto text-xs text-slate-200">{aiResult}</pre>
              </div>
            ) : null}
          </section>

          {/* Quick links */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-base font-semibold text-white">Quick Links</h2>
            <div className="space-y-2">
              {[
                { href: "/web/crm", label: "Lead Pipeline" },
                { href: "/web/active-jobs", label: "Active Jobs" },
                { href: "/web/estimator", label: "Estimator" },
                { href: "/web/integrations", label: "Integrations" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <span>{link.label}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-slate-500">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
