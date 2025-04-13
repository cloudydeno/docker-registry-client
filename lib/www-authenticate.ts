// https://github.com/randymized/www-authenticate/blob/master/lib/parsers.js

const ParseAuth= /(\w+)\s+(.*)/  // -> scheme, params
  , Separators= /([",=])/
  ;

class Parser {
  constructor(public scheme: string) {}
  parms: Record<string,string> = Object.create(null);
  err?: string;

  parse_params (header: string) {
    // This parser will definitely fail if there is more than one challenge
    let key: string | null = null;
    let value: string | null = null;
    let state= 0;   //0: token,
    const m= header.split(Separators)
    for (let _i = 0, _len = m.length; _i < _len; _i++) {
      const tok = m[_i];
      if (!tok.length) continue;
      switch (state) {
        case 0: // token
          key= tok.trim();
          state= 1; // expect equals
          continue;
        case 1: // expect equals
          if ('=' != tok) return 'Equal sign was expected after '+key;
          state= 2;
          continue;
        case 2: // expect value
          if ('"' == tok) {
            value= '';
            state= 3; // expect quoted
            continue;
          }
          else {
            this.parms[key as string]= value= tok.trim();
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
            this.parms[key as string]= value as string;
            state= 0;
            continue;
          }
          return 'Unexpected token ('+tok+') after '+value+'"';
        case 9: // expect commma
          if (',' != tok) return 'Comma expected after '+value;
          state= 0;
          continue;
      }
    }
    switch (state) {  // terminal state
      case 0:   // Empty or ignoring terminal comma
      case 9:   // Expecting comma or end of header
        return;
      case 8:   // Last token was end quote
        this.parms[key as string]= value as string;
        return;
      default:
        return 'Unexpected end of www-authenticate value.';
    }
  }
}

export class Parse_WWW_Authenticate extends Parser {
  constructor(to_parse: string) {
    const m= to_parse.match(ParseAuth)!;
    super(m[1]);
    const err= this.parse_params(m[2]);
    if (err) {
      this.scheme= '';
      this.parms= {};
      this.err= err;
    }
  }
}

export class Parse_Authentication_Info extends Parser {
  constructor(to_parse: string) {
    super('Digest');
    const err= this.parse_params(to_parse);
    if (err) {
      this.scheme= '';
      this.parms= {};
      this.err= err;
    }
  }
}
