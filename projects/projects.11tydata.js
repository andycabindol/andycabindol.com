const { projectDescription } = require('../_utils/project-seo');
const { isProjectVisible } = require('../_utils/project-visibility');

module.exports = {
  layout: 'layouts/project-redirect.njk',
  pageId: 'project',
  activeNav: 'work',
  eleventyComputed: {
    projectSlug: (data) => data.page.fileSlug,
    permalink: (data) => isProjectVisible(data) ? `/projects/${data.page.fileSlug}/index.html` : false,
    description: (data) => projectDescription(data),
    seoUrl: (data) => `https://andycabindol.com/case-studies/${data.page.fileSlug}/`,
  },
};
