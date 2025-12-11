// https://github.com/randymized/www-authenticate/blob/master/lib/parsers.js

const ParseAuth= /(\w+)\s+(.*)/;  // -> scheme, params
const Separators= /([",=])/;

function parse_params(header: string): Record<string,string> {
  // This parser will definitely fail if there is more than one challenge
  let key: string | null = null;
  let value: string | null = null;
  let state= 0;   //0: token,
  const m= header.split(Separators)
  const parms: Record<string,string> = Object.create(null);
  for (let _i = 0, _len = m.length; _i < _len; _i++) {
    const tok = m[_i];
    if (!tok.length) continue;
    switch (state) {
      case 0: // token
        key= tok.trim();
        state= 1; // expect equals
        continue;
      case 1: // expect equals
        if ('=' != tok) throw new Error(`Invalid WWW-Authenticate header: Equal sign was expected after ${key}`);
        state= 2;
        continue;
      case 2: // expect value
        if ('"' == tok) {
          value= '';
          state= 3; // expect quoted
          continue;
        }
        else {
          parms[key as string]= value= tok.trim();
          state= 9; // expect comma or end
          continue;
        }
      case 3: // handling quoted string
        if ('"' == tok) {
          state= 8; // end quoted
          continue;
        }
        else {
          value+= tok;
          state= 3; // continue accumulating quoted string
          continue;
        }
      case 8: // end quote encountered
        if ('"' == tok) {
          // double quoted
          value+= '"';
          state= 3; // back to quoted string
          continue;
        }
        if (',' == tok) {
          parms[key as string]= value as string;
          state= 0;
          continue;
        }
        throw new Error(`Invalid WWW-Authenticate header: Unexpected token (${tok}) after ${value}`);
      case 9: // expect commma
        if (',' != tok) throw new Error(`Invalid WWW-Authenticate header: Comma expected after ${value}`);
        state= 0;
        continue;
    }
  }
  switch (state) {  // terminal state
    case 0:   // Empty or ignoring terminal comma
    case 9:   // Expecting comma or end of header
      return parms;
    case 8:   // Last token was end quote
      parms[key as string]= value as string;
      return parms;
    default:
      throw new Error(`Invalid WWW-Authenticate header: Unexpected end of www-authenticate value.`);
  }
}

/**
 * Parse a WWW-Authenticate header like this:
 *
 *      // JSSTYLED
 *      www-authenticate: Bearer realm="https://auth.docker.io/token",service="registry.docker.io"
 *      www-authenticate: Basic realm="registry456.example.com"
 *
 * into an object like this:
 *
 *      {
 *          scheme: 'Bearer',
 *          parms: {
 *              realm: 'https://auth.docker.io/token',
 *              service: 'registry.docker.io'
 *          }
 *      }
 *
 * Note: This doesn't handle *multiple* challenges. I've not seen a concrete
 * example of that.
 */
export function parseWWWAuthenticate(header: string) {
  const m = header.match(ParseAuth)!;
  return {
    scheme: m[1],
    parms: parse_params(m[2]),
  };
}

export function parseAuthenticationInfo(header: string) {
  return {
    scheme: 'Digest',
    parms: header,
  };
}
