const markdownIt = require('markdown-it');
const fs = require('node:fs');
const path = require('node:path');

function loadProjectOrder() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '_data', 'projectOrder.json'), 'utf8'),
  );
}

function projectSortIndex(slug, projectOrder, fallbackOrder = 0) {
  const index = projectOrder.indexOf(slug);
  if (index >= 0) return index;
  // Not listed yet — keep after ordered projects, stable via optional front matter order.
  return projectOrder.length + fallbackOrder;
}

function extractLeadingBlock(html) {
  const input = html.trimStart();
  const open = input.match(/^<([a-zA-Z0-9]+)(\s[^>]*)?>/);
  if (!open) return null;

  const tag = open[1].toLowerCase();
  const classAttr = (open[2] || '').match(/\bclass=["']([^"']+)["']/);
  const classes = classAttr?.[1] || '';
  const allowed =
    (tag === 'div' && /\bproject-(?:grid|embed)\b/.test(classes))
    || (tag === 'figure' && /\bproject-figure\b/.test(classes));
  if (!allowed) return null;

  let depth = 0;
  const token = new RegExp(`</?${tag}\\b[^>]*>`, 'gi');
  let match;
  while ((match = token.exec(input))) {
    const isClose = match[0][1] === '/';
    const isSelfClosing = /\/>$/.test(match[0]);
    if (isClose) depth -= 1;
    else if (!isSelfClosing) depth += 1;
    if (depth === 0) {
      const end = match.index + match[0].length;
      return {
        block: input.slice(0, end),
        rest: input.slice(end).trimStart(),
      };
    }
  }
  return null;
}

module.exports = function eleventyConfig(eleventy) {
  const md = markdownIt({ html: true, linkify: true, breaks: false });
  eleventy.setLibrary('md', md);

  eleventy.addPassthroughCopy('nav.css');
  eleventy.addPassthroughCopy('nav.js');
  eleventy.addPassthroughCopy('project.js');
  eleventy.addPassthroughCopy('project.css');
  eleventy.addPassthroughCopy('styles.css');
  eleventy.addPassthroughCopy('about.css');
  eleventy.addPassthroughCopy('about.js');
  eleventy.addPassthroughCopy({ about: 'about' });
  eleventy.addPassthroughCopy('script.js');
  eleventy.addPassthroughCopy('components');
  eleventy.addPassthroughCopy('logos');
  eleventy.addPassthroughCopy('scripts');
  eleventy.addPassthroughCopy('embeds');
  eleventy.addPassthroughCopy('media');
  eleventy.addPassthroughCopy('favicon.svg');
  eleventy.addPassthroughCopy('favicon.png');
  eleventy.addPassthroughCopy('preview.png');
  eleventy.addPassthroughCopy('CNAME');

  eleventy.ignores.add('index.html');
  eleventy.ignores.add('about.html');
  eleventy.ignores.add('project.html');
  eleventy.ignores.add('README.md');
  eleventy.ignores.add('projects/_template.md');
  eleventy.ignores.add('node_modules/**');
  eleventy.ignores.add('_site/**');

  eleventy.addWatchTarget('./_data/projectOrder.json');
  eleventy.addWatchTarget('./scripts/creamy-orb-source.js');
  eleventy.addWatchTarget('./scripts/work-gradients-source.js');
  // Bundled outputs must not retrigger --serve, or the page live-reloads forever.
  eleventy.watchIgnores.add('components/creamy-orb.js');
  eleventy.watchIgnores.add('components/work-gradients.js');

  eleventy.on('eleventy.before', async () => {
    const esbuild = require('esbuild');
    const bundles = [
      {
        entry: 'scripts/creamy-orb-source.js',
        outfile: path.join(__dirname, 'components', 'creamy-orb.js'),
      },
      {
        entry: 'scripts/work-gradients-source.js',
        outfile: path.join(__dirname, 'components', 'work-gradients.js'),
      },
    ];

    await Promise.all(
      bundles.map(async ({ entry, outfile }) => {
        const result = await esbuild.build({
          entryPoints: [entry],
          bundle: true,
          format: 'iife',
          write: false,
          minify: true,
          logLevel: 'silent',
        });
        const next = result.outputFiles[0].contents;
        const prev = fs.existsSync(outfile) ? fs.readFileSync(outfile) : null;
        if (!prev || !Buffer.from(next).equals(prev)) {
          fs.writeFileSync(outfile, next);
        }
      }),
    );
  });

  eleventy.addCollection('projects', (collectionApi) => {
    const projectOrder = loadProjectOrder();
    return collectionApi
      .getFilteredByGlob('projects/*.md')
      .filter((item) => !item.inputPath.includes('_template'))
      .filter((item) => projectOrder.includes(item.fileSlug))
      .sort((a, b) => {
        const aIndex = projectSortIndex(a.fileSlug, projectOrder, a.data.order ?? 0);
        const bIndex = projectSortIndex(b.fileSlug, projectOrder, b.data.order ?? 0);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.fileSlug.localeCompare(b.fileSlug);
      });
  });

  eleventy.addFilter('projectUrl', (slug) => `/projects/${slug}/`);

  eleventy.addFilter('isVideoSrc', (src) =>
    /\.(webm|mp4|mov)(\?|#|$)/i.test(String(src || '')),
  );

  eleventy.addFilter('cardLayoutClass', (layout) => {
    if (!layout || layout === 'default') return '';
    return `project-media--${layout}`;
  });

  eleventy.addFilter('neighborProject', (projects, slug, direction = 1) => {
    if (!projects?.length) return null;
    const index = projects.findIndex((item) => item.fileSlug === slug);
    const current = index >= 0 ? index : 0;
    const nextIndex = (current + direction + projects.length) % projects.length;
    return projects[nextIndex];
  });

  eleventy.addFilter('projectIndex', (projects, slug) => {
    const index = projects.findIndex((item) => item.fileSlug === slug);
    return index >= 0 ? index : 0;
  });

  eleventy.addFilter('projectFacts', (data = {}) => {
    if (Array.isArray(data.facts) && data.facts.length) {
      return data.facts.filter((fact) => fact && (fact.label || fact.value));
    }

    const fallback = [];
    if (data.company) fallback.push({ label: 'Company', value: data.company });
    if (data.role) fallback.push({ label: 'Role', value: data.role });
    if (data.year) fallback.push({ label: 'Year', value: data.year });
    return fallback;
  });

  eleventy.addPairedShortcode('projectSection', (content, label, image = '', imageAlt = '') => {
    const sectionId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let body = content.trim();
    const mediaParts = [];

    if (image) {
      mediaParts.push(
        `<figure class="project-figure project-section__media media-skeleton media-skeleton--fill"><img class="media-skeleton__media" src="${image}" alt="${imageAlt || label}" loading="lazy"></figure>`,
      );
    } else {
      // Hoist leading grids / figures / embeds above the section title.
      while (body) {
        const leading = extractLeadingBlock(body);
        if (!leading) break;
        mediaParts.push(leading.block);
        body = leading.rest.trim();
      }
    }

    const media = mediaParts.length
      ? `<div class="project-section__media">${mediaParts.join('\n')}</div>`
      : '';

    return `<section class="project-section" id="${sectionId}" data-section-label="${label}">
${media}
<h2 class="project-section__title">${label}</h2>
<div class="project-section__body">
${body}
</div>
</section>`;
  });

  eleventy.addPairedShortcode('projectGrid', (content, columns = 2) => {
    const cols = Math.max(1, Math.min(6, parseInt(columns, 10) || 2));
    return `<div class="project-grid project-grid--${cols}" style="--project-grid-cols: ${cols}">${content}</div>`;
  });

  eleventy.addPairedShortcode('projectMediaRow', (content) =>
    `<div class="project-grid project-grid--2" style="--project-grid-cols: 2">${content}</div>`,
  );

  eleventy.addPairedShortcode('projectMediaCell', (content) => {
    const trimmed = content.trim();
    if (/^<(?:figure|img|video|div)\b/i.test(trimmed)) {
      return trimmed;
    }
    return `<div class="project-media-cell">${content}</div>`;
  });

  eleventy.addShortcode('projectImage', (src, alt = '') =>
    `<figure class="project-figure media-skeleton media-skeleton--fill"><img class="media-skeleton__media" src="${src}" alt="${alt}" loading="lazy"></figure>`,
  );

  eleventy.addShortcode('projectGradient', (slug, variant = '') => {
    const safeSlug = String(slug || '').replace(/"/g, '');
    const safeVariant = String(variant || '').replace(/"/g, '');
    const variantAttr = safeVariant ? ` data-variant="${safeVariant}"` : '';
    // No media-skeleton here — WebGL gradients were getting stuck on the shine/grey state.
    return `<figure class="project-figure project-figure--gradient"><div class="project-placeholder project-placeholder--section" data-work-gradient data-slug="${safeSlug}"${variantAttr} aria-hidden="true"></div></figure>`;
  });

  eleventy.addShortcode('projectPlain', (tone = 'cream') => {
    const safeTone = String(tone || 'cream').replace(/[^a-z0-9-]/gi, '') || 'cream';
    return `<figure class="project-figure project-figure--plain project-figure--${safeTone}" aria-hidden="true"></figure>`;
  });

  eleventy.addShortcode('projectVideo', (src, poster = '') => {
    const posterAttr = poster ? ` poster="${poster}"` : '';
    return `<figure class="project-figure project-figure--video media-skeleton media-skeleton--fill"><video class="media-skeleton__media" src="${src}"${posterAttr} controls playsinline></video></figure>`;
  });

  eleventy.addShortcode('projectCover', (src, alt = '', slug = '', variant = 'hero') => {
    const safeSrc = src ? String(src) : '';
    const isVideo = /\.(webm|mp4|mov)(\?|#|$)/i.test(safeSrc);

    const overlay = safeSrc
      ? isVideo
        ? `<div class="project-cover__overlay"><video class="project-cover__overlay-media" src="${safeSrc}" muted autoplay loop playsinline preload="metadata" aria-label="${alt || ''}"></video></div>`
        : `<div class="project-cover__overlay"><img class="project-cover__overlay-media" src="${safeSrc}" alt="${alt}" loading="eager"></div>`
      : '';

    if (slug) {
      const safeSlug = String(slug).replace(/"/g, '');
      const safeVariant = String(variant || 'hero').replace(/"/g, '');
      return `<div class="project-cover project-cover--gradient"><div class="project-placeholder project-placeholder--cover" data-work-gradient data-slug="${safeSlug}" data-variant="${safeVariant}" aria-hidden="true"></div>${overlay}</div>`;
    }
    if (!safeSrc) {
      return `<div class="project-cover" aria-hidden="true"><span>Project media</span></div>`;
    }
    if (isVideo) {
      return `<div class="project-cover project-cover--video media-skeleton media-skeleton--fill"><video class="media-skeleton__media" src="${safeSrc}" muted autoplay loop playsinline preload="metadata" aria-label="${alt || ''}"></video></div>`;
    }
    return `<div class="project-cover media-skeleton media-skeleton--fill"><img class="media-skeleton__media" src="${safeSrc}" alt="${alt}" loading="eager"></div>`;
  });

  eleventy.addShortcode('projectEmbed', (name) => {
    const embedPath = path.join('_includes', 'embeds', `${name}.njk`);
    if (!fs.existsSync(embedPath)) {
      return `<!-- missing embed: ${name} -->`;
    }

    const html = fs.readFileSync(embedPath, 'utf8').trim();
    const cssPath = path.join('embeds', `${name}.css`);
    const jsPath = path.join('embeds', `${name}.js`);
    const cssTag = fs.existsSync(cssPath)
      ? `<link rel="stylesheet" href="/embeds/${name}.css">`
      : '';
    const jsTag = fs.existsSync(jsPath)
      ? `<script src="/embeds/${name}.js" defer></script>`
      : '';

    // Unwrap the file's outer project-embed so we own a single hoistable shell.
    // Strip blank lines so markdown-it won't break the HTML block.
    const inner = html
      .replace(/^<div class="project-embed"[^>]*>\s*/i, '')
      .replace(/\s*<\/div>\s*$/i, '')
      .replace(/\n\s*\n/g, '\n');

    return `<div class="project-embed" data-project-embed="${name}">
${cssTag}
${inner}
${jsTag}
</div>`.replace(/\n\s*\n/g, '\n');
  });

  return {
    dir: {
      input: '.',
      output: '_site',
      includes: '_includes',
      data: '_data',
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
