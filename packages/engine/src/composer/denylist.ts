import { TEXTURE_EXAMPLES } from "./texture-examples.ts";

/**
 * Invariant 3: no composer or work names reach the composer. Prompts, the
 * conductor's output and Claude's own footer text are checked against this
 * list at runtime: well-known composers (with adjectival forms such as
 * "Chopinesque" or "Lisztian"), the texture examples' citations, well-known
 * titles, and opus numbers.
 */

const COMPOSERS = [
  "albeniz",
  "alkan",
  "bach",
  "balakirev",
  "bartok",
  "beethoven",
  "bellini",
  "berlioz",
  "bizet",
  "borodin",
  "brahms",
  "bruckner",
  "busoni",
  "chabrier",
  "chaminade",
  "chopin",
  "clementi",
  "couperin",
  "czerny",
  "debussy",
  "delius",
  "dukas",
  "dvorak",
  "elgar",
  "faure",
  "franck",
  "gershwin",
  "glazunov",
  "glinka",
  "godowsky",
  "gottschalk",
  "gounod",
  "granados",
  "grieg",
  "handel",
  "haydn",
  "heller",
  "hummel",
  "ives",
  "janacek",
  "kalkbrenner",
  "liszt",
  "lyadov",
  "liadov",
  "mahler",
  "massenet",
  "medtner",
  "mendelssohn",
  "moszkowski",
  "mozart",
  "mussorgsky",
  "paderewski",
  "puccini",
  "rachmaninoff",
  "rachmaninov",
  "rameau",
  "ravel",
  "reger",
  "rimsky-korsakov",
  "rossini",
  "rubinstein",
  "saint-saens",
  "satie",
  "scarlatti",
  "schubert",
  "schumann",
  "scriabin",
  "skryabin",
  "smetana",
  "sibelius",
  "strauss",
  "tchaikovsky",
  "verdi",
  "vivaldi",
  "wagner",
  "weber",
] as const;

/** Titles specific enough that naming them asks for imitation. */
const TITLES = [
  "kinderszenen",
  "von fremden landern und menschen",
  "traumerei",
  "fur elise",
  "moonlight sonata",
  "clair de lune",
  "gymnopedie",
  "liebestraum",
  "raindrop prelude",
  "minute waltz",
  "revolutionary etude",
  "songs without words",
  "lieder ohne worte",
  "nocturne in e-flat",
];

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const citedComposers = TEXTURE_EXAMPLES.flatMap((example) =>
  normalise(example.citation.composer).split(/\s+/).slice(-1),
);

const names = [...new Set([...COMPOSERS, ...citedComposers])];
const NAME_PATTERN = new RegExp(
  `\\b(${names.map(escape).join("|")})(?:esque|ian|ean|an|ish)?(?:'s)?\\b`,
  "g",
);
const TITLE_PATTERN = new RegExp(
  `\\b(${TITLES.map(escape).join("|")})\\b`,
  "g",
);
/** Any opus or catalogue number names a specific work. */
const OPUS_PATTERN =
  /\b(op\.?\s*\d+|opus\s*\d+|bwv\s*\d+|k\.?\s*\d{2,3}|d\.?\s*\d{3})\b/g;

/** Every denied name or title found in the text (normalised), in order of appearance. */
export function findDeniedNames(text: string): string[] {
  const plain = normalise(text);
  const found: { at: number; match: string }[] = [];
  for (const pattern of [NAME_PATTERN, TITLE_PATTERN, OPUS_PATTERN]) {
    for (const match of plain.matchAll(pattern))
      found.push({ at: match.index, match: match[0] });
  }
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.match);
}

export class DeniedNameError extends Error {
  constructor(
    readonly where: string,
    readonly names: string[],
  ) {
    super(
      `${where} names a composer or work (${names.join(", ")}), which the composer must never see.`,
    );
    this.name = "DeniedNameError";
  }
}

/** Throws if the text names a composer or work. */
export function assertNoDeniedNames(text: string, where: string): void {
  const found = findDeniedNames(text);
  if (found.length > 0) throw new DeniedNameError(where, found);
}
