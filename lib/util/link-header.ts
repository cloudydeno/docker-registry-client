type Link = {
  rel: string;
  url: string;
  params: Record<string,string>;
};

const linkRegex = /^<([^>]+)>(?:\s*;\s*(.+))?$/;
export function parseLinkHeader(rawHeader: string | null): Link[] {
  if (!rawHeader) return [];
  return rawHeader
    .split(',')
    .slice(0, 5) // Arbitrary limit to how many links we are willing to parse
    .flatMap<Link>(piece => {
      const matches = piece.trim().match(linkRegex);
      if (!matches) return [];

      const {rel, ...params} = matches[2]?.split(';')
        .map(param => param.trim().split('='))
        .reduce<Record<string, string>>((acc, [key, value]) => {
          if (!value) return acc;
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          acc[key] = value;
          return acc;
        }, {}) ?? {};

      if (!rel) return [];
      return [{
        rel,
        url: matches[1],
        params,
      }];
    });
}
