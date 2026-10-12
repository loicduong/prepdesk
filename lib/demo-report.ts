import type { Report } from "@/lib/report-schema";

// Deterministic stand-in for the Claude call, used when ANTHROPIC_API_KEY is not set.
const SKILLS = [
  "React", "Vue", "Nuxt", "Next.js", "Angular", "Svelte", "TypeScript", "JavaScript", "Node.js",
  "Python", "Django", "Flask", "Ruby on Rails", "PHP", "Laravel", "Java", "Kotlin", "Swift", "Golang",
  "Rust", "C#", ".NET", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD", "Tailwind", "Jest",
  "Playwright", "Cypress", "Stripe", "Figma", "Salesforce", "Excel", "SEO",
];
const MAX_SKILLS = 5;

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\/#]/g, "\\$&");
}

function findSkills(posting: string): string[] {
  return SKILLS.map((skill) => ({
    skill,
    index: posting.search(new RegExp(`(?<![A-Za-z0-9])${escape(skill)}(?![A-Za-z0-9])`)),
  }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_SKILLS)
    .map((match) => match.skill);
}

function findLevel(posting: string): string | null {
  const match = posting.match(/\b(senior|lead|principal|junior|mid-level|intern)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function listText(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildDemoReport(posting: string): Report {
  const text = posting.trim().replace(/\s+/g, " ");
  const title = text.split(/[.!?]/)[0].slice(0, 120).trim();
  const skills = findSkills(text);
  const level = findLevel(text);
  const remote = /\bremote\b/i.test(text);
  const focus = skills.length ? listText(skills) : "the responsibilities described in the posting";

  return {
    role_summary:
      `This role (${title}) centres on ${focus}. ` +
      (level ? `The posting asks for a ${level} candidate. ` : "") +
      "Expect the interview to probe hands-on experience with what the posting names.",
    likely_questions: [
      ...skills.map((skill) => `Walk me through a recent project where you used ${skill}. What would you do differently?`),
      "Tell me about yourself and why this role fits your experience.",
      "How do you handle unclear requirements or changing priorities?",
    ],
    star_stories: [
      ...skills.slice(0, 2).map((skill) => `A time you shipped a feature with ${skill} under a tight deadline.`),
      "A time you disagreed with a teammate and reached a decision together.",
      "A time you found and fixed a problem in production.",
    ],
    questions_to_ask: [
      "How is success measured in the first 90 days?",
      "What does a typical week look like for this role?",
      "What is the biggest challenge the team is facing right now?",
    ],
    watch_outs: [
      remote
        ? "Confirm time-zone overlap and meeting expectations for remote work."
        : "Confirm the work location and schedule.",
      ...(skills.length ? [] : ["The posting names few specific tools; ask which tools the team uses day to day."]),
    ],
  };
}
