import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECTS = [
  { slug: 'lens-usage', cardLayout: 'wide', title: 'Increased Lens usage by 3%', tags: 'UX Design · Visual Design', company: 'Google', role: 'UX Designer', year: '2025', challenge: 'Make Lens easier to discover without adding noise to an already dense search experience.', contribution: 'Mapped the existing journey, explored interaction and visual directions, prototyped key states, and partnered with product and engineering through refinement.', outcome: 'The shipped experience increased Lens usage by 3% while preserving the familiarity of the core search flow.' },
  { slug: 'privacy-transparency', cardLayout: 'tall', title: 'Shipped privacy transparency for feedback form', tags: 'UX Design', company: 'Google', role: 'UX Designer', year: '2025', challenge: 'Communicate privacy details at the moment they matter without interrupting the feedback flow.', contribution: 'Simplified the information hierarchy, explored progressive disclosure patterns, and aligned the final interaction with established product conventions.', outcome: 'The final design shipped with clearer privacy expectations and a more trustworthy submission experience.' },
  { slug: 'google-branding', cardLayout: 'square', title: 'Google Branding Assets', tags: 'Motion Design', company: 'Google', role: 'Motion Designer', year: '2025', challenge: 'Create expressive assets that still feel coherent, useful, and unmistakably Google across different formats.', contribution: 'Developed motion studies, visual systems, and production-ready assets in close collaboration with brand partners.', outcome: 'Delivered a reusable asset set that supported multiple launches and communication surfaces.' },
  { slug: 'ai-mode', cardLayout: 'wide', title: "Connected Google's homepage to AI Mode", tags: 'UX Design · Prototyping', company: 'Google', role: 'UX Designer', year: '2025', challenge: 'Introduce AI Mode from one of the web’s most familiar surfaces without disrupting existing search habits.', contribution: 'Explored entry points, transition behaviors, and high-fidelity prototypes to evaluate clarity and momentum.', outcome: 'The selected direction created a direct, understandable bridge from the homepage into AI Mode.' },
  { slug: 'voice-search', cardLayout: 'portrait', title: 'Increased voice search queries by 3%', tags: 'UX Design · Motion Design', company: 'Google', role: 'UX Designer', year: '2025', challenge: 'Encourage voice interaction while keeping the search interface calm and immediately recognizable.', contribution: 'Designed interaction states, motion behavior, and polished prototypes used to align product and engineering.', outcome: 'The shipped update increased voice search queries by 3%.' },
  { slug: 'youtube-ai-brand', cardLayout: 'default', title: 'Designed YouTube AI brand', tags: 'Motion Design · Brand Design', company: 'YouTube', role: 'Motion & Brand Designer', year: '2025', challenge: 'Give emerging AI experiences a distinct expression while keeping them native to the YouTube brand.', contribution: 'Explored visual territories, motion principles, and practical applications across product and marketing moments.', outcome: 'Established a cohesive direction that made AI features feel expressive, understandable, and connected to YouTube.' },
  { slug: 'chirper', cardLayout: 'tall', title: 'Built bird song trimmer', tags: 'Product Design · 0→1', company: 'Independent', role: 'Product Designer', year: '2024', challenge: 'Turn a technical audio-editing task into a lightweight flow that works for non-experts.', contribution: 'Defined the product, mapped the workflow, designed the interface, and built an interactive prototype.', outcome: 'Created a functional end-to-end concept that makes editing field recordings faster and more approachable.' },
  { slug: 'music-remix', cardLayout: 'square', title: 'Designed music remix page', tags: 'UX Design · Product · 0→1', company: 'Baton', role: 'Product Designer', year: '2024', challenge: 'Make remix lineage and creative possibilities understandable without overwhelming the listening experience.', contribution: 'Designed the information model, page hierarchy, interaction states, and high-fidelity prototype.', outcome: 'Created a clear foundation for discovery, attribution, and continued collaboration.' },
  { slug: 'peer-payment', cardLayout: 'tall', title: 'Shipped peer-to-peer payment', tags: 'UX Design · Product · 0→1', company: 'Baton', role: 'Product Designer', year: '2024', challenge: 'Make sending money feel simple and trustworthy while covering financial edge cases and accountability.', contribution: 'Defined the flow, designed core and edge states, and collaborated across product, legal, and engineering.', outcome: 'Shipped Baton’s first peer-to-peer payment flow.' },
  { slug: 'baton-branding', cardLayout: 'wide', title: 'Baton branding & product surfaces', tags: 'Brand · Product · Motion', company: 'Baton', role: 'Product & Visual Designer', year: '2024', challenge: 'Give Baton a coherent brand and product language across marketing, acquisition, and the everyday creator experience.', contribution: 'Owned brand-facing surfaces and shipping product UI: landing page, App Store cards, studio empty states, menus, ratings, onboarding, and Wrapped.', outcome: 'Shipped a cohesive set of brand and product surfaces that made Baton clearer at first glance and more usable day to day.' },
  { slug: 'paywall', cardLayout: 'portrait', title: 'Increased subscribers by 50% by designing new paywall', tags: 'UX Design · Product', company: 'Prof G Media', role: 'Product Designer', year: '2023', challenge: 'Improve conversion without making the reading experience feel aggressive or transactional.', contribution: 'Analyzed the existing journey, reframed the value proposition, and designed responsive paywall variants.', outcome: 'The redesigned paywall increased subscribers by 50%.' },
];

function yaml(value) {
  return JSON.stringify(value);
}

function buildProjectFile(project) {
  const frontMatter = `---
title: ${yaml(project.title)}
facts:
  - label: Company
    value: ${yaml(project.company)}
  - label: Role
    value: ${yaml(project.role)}
  - label: Year
    value: ${yaml(project.year)}
projectTags: ${yaml(project.tags)}
cardLayout: ${project.cardLayout}
---`;

  const body = `
{% projectSection "Challenge" %}
${project.challenge}
{% endprojectSection %}

{% projectSection "Contribution" %}
${project.contribution}
{% endprojectSection %}

{% projectMediaRow %}
{% projectMediaCell %}
<span>Process media</span>
{% endprojectMediaCell %}
{% projectMediaCell %}
<span>Detail media</span>
{% endprojectMediaCell %}
{% endprojectMediaRow %}

{% projectSection "Outcome" %}
${project.outcome}
{% endprojectSection %}
`;

  return `${frontMatter}\n${body.trim()}\n`;
}

const template = `---
title: Your project title
summary: Short line under the title on the work grid.
facts:
  - label: Year
    value: "2025"
projectTags: UX Design · Motion Design
cardLayout: wide
cover: /media/your-project-slug/cover.jpg
---

{# Each section: picture(s) first, then title, then description #}
{% projectSection "Challenge", "/media/your-project-slug/challenge.jpg", "Challenge visual" %}
What problem were you solving?
{% endprojectSection %}

{% projectSection "Contribution" %}
{% projectGrid 2 %}
{% projectImage "/media/your-project-slug/a.jpg", "A" %}
{% projectImage "/media/your-project-slug/b.jpg", "B" %}
{% endprojectGrid %}

What did you do?
{% endprojectSection %}

{% projectSection "Outcome" %}
What changed? (image optional — omit media if you don't need one)
{% endprojectSection %}
`;

async function main() {
  const projectsDir = path.resolve('projects');
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.writeFile(path.join(projectsDir, '_template.md'), template);

  for (const project of PROJECTS) {
    const filePath = path.join(projectsDir, `${project.slug}.md`);
    await fs.writeFile(filePath, buildProjectFile(project));
  }

  console.log(`Wrote ${PROJECTS.length} project files to projects/`);
}

main();
