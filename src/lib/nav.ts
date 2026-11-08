/** The site's sections, shared by the header menu and the footer: [path, dictionary key for the label]. */
export const NAV = [
  ['/', 'nav.timeline'], ['/entries/', 'nav.entries'], ['/makers/', 'nav.makers'], ['/formats/', 'nav.formats'],
  ['/physics/', 'nav.physics'], ['/landmarks/', 'nav.landmarks'], ['/glossary/', 'nav.glossary'], ['/sources/', 'nav.sources'],
] as const;

export const REPO = 'https://github.com/sconetto/photography-history-timeline';
export const KO_FI = 'https://ko-fi.com/sconetto';
export const INSPIRATION = { author: 'petrogko', profile: 'https://github.com/petrogko', repo: 'https://github.com/petrogko/politics-history-timeline' };
