function factValue(data, label) {
  const fromFacts = data.facts?.find((fact) => fact.label === label)?.value;
  if (fromFacts) return fromFacts;
  if (label === 'Company') return data.company || '';
  if (label === 'Role') return data.role || '';
  if (label === 'Year') return data.year || '';
  return '';
}

function projectDescription(data = {}) {
  if (data.description) return data.description;
  if (data.summary) return data.summary;

  const company = factValue(data, 'Company');
  const role = factValue(data, 'Role');
  const tags = data.projectTags || '';
  const title = data.title || '';
  const parts = [title.endsWith('.') ? title : `${title}.`];

  if (company && role) {
    parts.push(`${role} at ${company}.`);
  } else if (role) {
    parts.push(`${role} — case study by Andy Cabindol.`);
  } else if (company) {
    parts.push(`Case study by Andy Cabindol at ${company}.`);
  } else {
    parts.push('Project case study by Andy Cabindol, UX motion designer.');
  }

  if (tags) {
    parts.push(tags);
  }

  return parts.join(' ');
}

function projectOgImage(data = {}, siteUrl = 'https://andycabindol.com') {
  const cover = data.cover || data.thumbnail || '';
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(String(cover))) {
    return `${siteUrl}${cover}`;
  }
  return `${siteUrl}/preview.png`;
}

function projectCanonical(slug, siteUrl = 'https://andycabindol.com') {
  return `${siteUrl}/case-studies/${slug}/`;
}

function projectJsonLd(data, slug, siteUrl = 'https://andycabindol.com') {
  const description = projectDescription(data);
  const year = factValue(data, 'Year');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: data.title,
    description,
    url: projectCanonical(slug, siteUrl),
    author: {
      '@type': 'Person',
      name: 'Andy Cabindol',
      url: siteUrl,
      jobTitle: 'UX Motion Designer',
    },
  };

  const image = projectOgImage(data, siteUrl);
  if (image !== `${siteUrl}/preview.png`) {
    jsonLd.image = image;
  }
  if (year) {
    jsonLd.dateCreated = year;
  }

  return jsonLd;
}

function projectOg(data, slug, siteUrl = 'https://andycabindol.com') {
  return {
    url: projectCanonical(slug, siteUrl),
    title: `${data.title} — Andy Cabindol`,
    description: projectDescription(data),
    image: projectOgImage(data, siteUrl),
    imageAlt: data.title,
  };
}

module.exports = {
  factValue,
  projectDescription,
  projectOgImage,
  projectCanonical,
  projectJsonLd,
  projectOg,
};
