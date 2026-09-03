const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap';
const { projectDescription, projectOg, projectJsonLd, projectCanonical } = require('./_utils/project-seo');

module.exports = {
  layout: 'layouts/case-study.njk',
  pageId: 'case-study',
  activeNav: 'work',
  stylesheet: 'case-study.css',
  fontUrl: FONT_URL,
  eleventyComputed: {
    title: (data) => data.project.data.title,
    summary: (data) => data.project.data.summary,
    projectTags: (data) => data.project.data.projectTags,
    company: (data) => data.project.data.company,
    role: (data) => data.project.data.role,
    year: (data) => data.project.data.year,
    facts: (data) => data.project.data.facts,
    cover: (data) => data.project.data.cover,
    thumbnail: (data) => data.project.data.thumbnail,
    coverGradient: (data) => data.project.data.coverGradient,
    coverVariant: (data) => data.project.data.coverVariant,
    cardLayout: (data) => data.project.data.cardLayout,
    projectSlug: (data) => data.project.fileSlug,
    pageTitle: (data) => `${data.project.data.title} — Andy Cabindol`,
    description: (data) => projectDescription(data.project.data),
    canonical: (data) => projectCanonical(data.project.fileSlug),
    og: (data) => projectOg(data.project.data, data.project.fileSlug),
    jsonLd: (data) => projectJsonLd(data.project.data, data.project.fileSlug),
  },
};
