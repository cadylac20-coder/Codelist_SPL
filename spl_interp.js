// A Shakespeare Programming Language (SPL) interpreter -- JS port.
// Mirrors spl_core.py / file_parser.py exactly (same vocabulary, same grammar).

const NICE_NOUNS = new Set(["flower","rose","hero","day","angel","king","queen","summer"]);
const DIRTY_NOUNS = new Set(["pig","devil","hog","toad","rat","codpiece"]);
const NOUNS = new Set([...NICE_NOUNS, ...DIRTY_NOUNS]);
const ADJECTIVES = new Set(["happy","beautiful","small","big","little","good","bad",
  "fat","lovely","sweet","proud","gentle","fair"]);
const POSSESSIVES = new Set(["my","your","his","her","thy","our","their","its"]);
const BE_VERBS = new Set(["are","art","is","be"]);
const SECOND_PERSON = new Set(["you","thou","thee"]);
const FIRST_PERSON = new Set(["i","me"]);
const REFLEXIVE_2ND = new Set(["yourself","thyself"]);
const REFLEXIVE_1ST = new Set(["myself"]);

const RECOGNIZED_NAMES = new Set([
  "Romeo","Juliet","Hamlet","Othello","Macbeth","Lady Macbeth",
  "Ophelia","Puck","Ajax","Achilles","Prospero","Miranda",
  "Antony","Cleopatra","Cordelia","King Lear","Iago","Horatio",
  "Ghost","Titania","Oberon","Falstaff","Portia","Shylock",
  "Beatrice","Benedick","Viola","Malvolio","Brutus","Cassius",
]);

class SPLError extends Error {}

function romanToInt(s) {
  s = s.toUpperCase();
  const vals = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
  let total = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = vals[s[i]];
    if (v < prev) total -= v; else { total += v; prev = v; }
  }
  return total;
}

function wordsOf(text) {
  text = text.replace(/'s\b/g, "").replace(/-/g, " ");
  text = text.replace(/[^a-zA-Z\s]/g, " ");
  return text.split(/\s+/).map(w => w.toLowerCase()).filter(Boolean);
}

// ---- Value expressions ----
class ConstExpr { constructor(v){ this.v=v; } eval(){ return this.v; } }
class SelfExpr  { eval(interp, speaker){ return interp.values[speaker]; } }
class YouExpr   { eval(interp, speaker, addressee){ return interp.values[addressee]; } }
class NameExpr  { constructor(name){ this.name=name; } eval(interp){ return interp.values[this.name]; } }

class BinOp {
  constructor(op, a, b){ this.op=op; this.a=a; this.b=b; }
  eval(interp, speaker, addressee){
    const a = this.a.eval(interp, speaker, addressee);
    const b = this.b.eval(interp, speaker, addressee);
    switch(this.op){
      case "sum": return a + b;
      case "difference": return a - b;
      case "product": return a * b;
      case "quotient": {
        if (b === 0) throw new SPLError("division by zero");
        const q = Math.floor(Math.abs(a) / Math.abs(b));
        return ((a < 0) === (b < 0)) ? q : -q;
      }
      case "remainder": {
        if (b === 0) throw new SPLError("division by zero");
        let q = Math.floor(Math.abs(a) / Math.abs(b));
        q = ((a < 0) === (b < 0)) ? q : -q;
        return a - q * b;
      }
    }
    throw new SPLError("unknown binop " + this.op);
  }
}

class UnOp {
  constructor(op, a){ this.op=op; this.a=a; }
  eval(interp, speaker, addressee){
    const a = this.a.eval(interp, speaker, addressee);
    switch(this.op){
      case "square": return a*a;
      case "cube": return a*a*a;
      case "twice": return 2*a;
      case "sqrt": {
        if (a < 0) throw new SPLError("square root of negative number");
        let r = Math.floor(Math.sqrt(a));
        while ((r+1)*(r+1) <= a) r++;
        while (r*r > a) r--;
        return r;
      }
    }
    throw new SPLError("unknown unop " + this.op);
  }
}

class ValueParser {
  constructor(tokens, charnames){ this.toks=tokens; this.i=0; this.charnames=charnames; }
  peek(){ return this.i < this.toks.length ? this.toks[this.i] : null; }
  next(){ const t=this.peek(); this.i++; return t; }
  expect(word){ const t=this.next(); if (t!==word) throw new SPLError(`expected '${word}', got '${t}'`); }

  parse(){ return this.parseValue(); }

  parseValue(){
    let t = this.peek();
    if (t === null) throw new SPLError("expected value, got end of sentence");

    if (t === "nothing"){ this.next(); return new ConstExpr(0); }

    if (t === "the"){
      this.next();
      const kw = this.next();
      if (kw === "sum"){ this.expect("of"); const a=this.parseValue(); this.expect("and"); const b=this.parseValue(); return new BinOp("sum",a,b); }
      if (kw === "difference"){ this.expect("between"); const a=this.parseValue(); this.expect("and"); const b=this.parseValue(); return new BinOp("difference",a,b); }
      if (kw === "product"){ this.expect("of"); const a=this.parseValue(); this.expect("and"); const b=this.parseValue(); return new BinOp("product",a,b); }
      if (kw === "quotient"){
        const nxt = this.next();
        if (nxt !== "between" && nxt !== "of") throw new SPLError("expected 'between'/'of' after quotient");
        const a=this.parseValue(); this.expect("and"); const b=this.parseValue();
        return new BinOp("quotient", a, b);
      }
      if (kw === "remainder"){
        this.expect("of"); this.expect("the"); this.expect("quotient");
        const nxt = this.next();
        if (nxt !== "between" && nxt !== "of") throw new SPLError("expected 'between'/'of' after quotient");
        const a=this.parseValue(); this.expect("and"); const b=this.parseValue();
        return new BinOp("remainder", a, b);
      }
      if (kw === "square"){
        if (this.peek() === "root"){ this.next(); this.expect("of"); const a=this.parseValue(); return new UnOp("sqrt", a); }
        this.expect("of"); const a=this.parseValue(); return new UnOp("square", a);
      }
      if (kw === "cube"){ this.expect("of"); const a=this.parseValue(); return new UnOp("cube", a); }
      throw new SPLError("unknown arithmetic keyword: " + kw);
    }

    if (t === "twice"){ this.next(); const a=this.parseValue(); return new UnOp("twice", a); }

    if (REFLEXIVE_2ND.has(t)){ this.next(); return new YouExpr(); }
    if (REFLEXIVE_1ST.has(t)){ this.next(); return new SelfExpr(); }
    if (SECOND_PERSON.has(t)){ this.next(); return new YouExpr(); }
    if (FIRST_PERSON.has(t)){ this.next(); return new SelfExpr(); }

    for (const name of this.charnames){
      if (t === name.toLowerCase()){ this.next(); return new NameExpr(name); }
    }

    if (t === "a" || t === "an"){ this.next(); t = this.peek(); }
    if (POSSESSIVES.has(t)){ this.next(); t = this.peek(); }
    let mult = 1;
    while (ADJECTIVES.has(t)){ mult *= 2; this.next(); t = this.peek(); }
    if (NOUNS.has(t)){
      this.next();
      const base = NICE_NOUNS.has(t) ? 1 : -1;
      return new ConstExpr(mult * base);
    }
    throw new SPLError("could not parse value at token: " + t);
  }
}

// ---- Sentences ----
class AssignSentence {
  constructor(expr){ this.expr=expr; }
  exec(interp, speaker, addressee){ interp.values[addressee] = this.expr.eval(interp, speaker, addressee); return null; }
}
class OutputNumSentence {
  exec(interp, speaker, addressee){ interp.out(String(interp.values[addressee])); return null; }
}
class OutputCharSentence {
  exec(interp, speaker, addressee){
    let v = interp.values[addressee] % 0x110000;
    if (v < 0) v += 0x110000;
    interp.out(String.fromCodePoint(v));
    return null;
  }
}
class InputNumSentence {
  async exec(interp, speaker, addressee){ interp.values[addressee] = await interp.inputSource.readNumber(); return null; }
}
class InputCharSentence {
  async exec(interp, speaker, addressee){ interp.values[addressee] = await interp.inputSource.readChar(); return null; }
}
class CompareSentence {
  constructor(subjectExpr, expr){ this.subjectExpr=subjectExpr; this.expr=expr; }
  exec(interp, speaker, addressee){
    const lhs = this.subjectExpr.eval(interp, speaker, addressee);
    const rhs = this.expr.eval(interp, speaker, addressee);
    interp.lastCmp = (lhs === rhs);
    return null;
  }
}
class GotoSentence {
  constructor(kind, number){ this.kind=kind; this.number=number; }
  exec(interp){ return this.kind === "scene" ? interp.sceneLabels[this.number] : interp.actLabels[this.number]; }
}
class ConditionalSentence {
  constructor(polarity, inner){ this.polarity=polarity; this.inner=inner; }
  async exec(interp, speaker, addressee){
    if (interp.lastCmp === this.polarity) return await interp.execSentenceObj(this.inner, speaker, addressee);
    return null;
  }
}

function parseSentence(text, charnames){
  let stripped = text.trim();
  const low = stripped.toLowerCase();
  let polarity = null;
  if (low.startsWith("if so,")){ polarity = true; stripped = stripped.slice(6); }
  else if (low.startsWith("if not,")){ polarity = false; stripped = stripped.slice(7); }

  const toks = wordsOf(stripped);
  if (toks.length === 0) throw new SPLError("empty sentence");

  const sent = parseCoreSentence(toks, charnames);
  if (polarity !== null) return new ConditionalSentence(polarity, sent);
  return sent;
}

function arrEq(a,b){ return a.length===b.length && a.every((v,i)=>v===b[i]); }

function parseCoreSentence(toks, charnames){
  if (arrEq(toks, ["open","your","heart"])) return new OutputNumSentence();
  if (arrEq(toks, ["speak","your","mind"])) return new OutputCharSentence();
  if (arrEq(toks, ["listen","to","your","heart"])) return new InputNumSentence();
  if (arrEq(toks, ["open","your","mind"])) return new InputCharSentence();

  if (toks[0] === "let" || toks[0] === "we"){
    let kind = null, targetIdx = null;
    for (let i=0;i<toks.length;i++){
      if (toks[i]==="scene" || toks[i]==="act"){ kind=toks[i]; targetIdx=i+1; break; }
    }
    if (kind===null || targetIdx===null || targetIdx>=toks.length) throw new SPLError("malformed goto sentence: "+toks.join(" "));
    const number = romanToInt(toks[targetIdx]);
    return new GotoSentence(kind, number);
  }

  if (toks[0]==="am" || toks[0]==="art" || toks[0]==="is"){
    if (toks.length < 5) throw new SPLError("malformed comparison: "+toks.join(" "));
    const subjTok = toks[1];
    let subjectExpr;
    if (FIRST_PERSON.has(subjTok) || REFLEXIVE_1ST.has(subjTok)) subjectExpr = new SelfExpr();
    else if (SECOND_PERSON.has(subjTok) || REFLEXIVE_2ND.has(subjTok)) subjectExpr = new YouExpr();
    else {
      let matched = null;
      for (const name of charnames) if (subjTok === name.toLowerCase()) { matched = name; break; }
      if (matched===null) throw new SPLError("unsupported comparison subject: "+subjTok);
      subjectExpr = new NameExpr(matched);
    }
    if (toks[2]!=="as" || !ADJECTIVES.has(toks[3]) || toks[4]!=="as") throw new SPLError("expected 'as <adjective> as' in comparison: "+toks.join(" "));
    const rest = toks.slice(5);
    const expr = new ValueParser(rest, charnames).parse();
    return new CompareSentence(subjectExpr, expr);
  }

  if (SECOND_PERSON.has(toks[0])){
    let i=1;
    if (i<toks.length && BE_VERBS.has(toks[i])) i++;
    if (i+2<toks.length && toks[i]==="as" && ADJECTIVES.has(toks[i+1]) && toks[i+2]==="as") i+=3;
    const rest = toks.slice(i);
    const vp = new ValueParser(rest, charnames);
    const expr = vp.parse();
    if (vp.i !== rest.length) throw new SPLError("trailing tokens in assignment: "+rest.slice(vp.i).join(" "));
    return new AssignSentence(expr);
  }

  throw new SPLError("could not classify sentence: "+toks.join(" "));
}

// ---- File-level parsing ----
function splitSentences(text){
  const pieces = text.match(/[^.!?]+[.!?]/g) || [];
  const consumed = pieces.join("");
  const tail = text.replace(/[^.!?]+[.!?]/g, "").trim();
  const result = pieces.map(p=>p.trim()).filter(Boolean);
  if (tail) result.push(tail);
  return result;
}

function parseNameList(text, charnames){
  text = text.trim().split(",").join("|").split(" and ").join("|");
  const parts = text.split("|").map(p=>p.trim()).filter(Boolean);
  const names = [];
  for (const p of parts){
    let found = null;
    for (const name of charnames) if (p.toLowerCase()===name.toLowerCase()){ found=name; break; }
    if (found===null) throw new SPLError("unknown character in stage direction: "+p);
    names.push(found);
  }
  return names;
}

function parseFile(text){
  const paragraphs = text.trim().split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  if (paragraphs.length < 2) throw new SPLError("expected a title paragraph and a Dramatis Personae paragraph");

  let idx = 0;
  idx++; // title ignored

  const dpPara = paragraphs[idx++];
  const charnames = [];
  for (const rawLine of dpPara.split("\n")){
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z ]+?),/);
    if (!m) throw new SPLError("bad dramatis personae line: "+line);
    const name = m[1].trim();
    if (!RECOGNIZED_NAMES.has(name)) throw new SPLError("unrecognized Shakespeare character name: "+name);
    charnames.push(name);
  }

  const ops = [];
  const sceneLabels = {};
  const actLabels = {};

  for (; idx < paragraphs.length; idx++){
    const para = paragraphs[idx];
    const firstLine = para.split("\n")[0].trim();

    let m = firstLine.match(/^Act\s+([IVXLCDM]+)\s*:/i);
    if (m){ actLabels[romanToInt(m[1])] = ops.length; continue; }

    m = firstLine.match(/^Scene\s+([IVXLCDM]+)\s*:/i);
    if (m){ sceneLabels[romanToInt(m[1])] = ops.length; continue; }

    if (firstLine.startsWith("[")){
      const content = para.trim();
      if (!(content.startsWith("[") && content.endsWith("]"))) throw new SPLError("malformed stage direction: "+content);
      const inner = content.slice(1,-1).trim();
      const low = inner.toLowerCase();
      if (low.startsWith("enter")){
        ops.push(["enter", parseNameList(inner.slice(5), charnames)]);
      } else if (low.startsWith("exeunt")){
        const rest = inner.slice(6).trim();
        ops.push(["exeunt", rest ? parseNameList(rest, charnames) : null]);
      } else if (low.startsWith("exit")){
        ops.push(["exit", parseNameList(inner.slice(4), charnames)]);
      } else {
        throw new SPLError("unknown stage direction: "+inner);
      }
      continue;
    }

    const lines = para.split("\n");
    const header = lines[0].trim();
    m = header.match(/^([A-Za-z ]+):$/);
    if (!m) throw new SPLError("expected an Act/Scene header, a stage direction, or a 'Name:' line, got: "+header);
    const speaker = m[1].trim();
    if (!charnames.includes(speaker)) throw new SPLError("undeclared character speaking: "+speaker);
    const restText = lines.slice(1).map(l=>l.trim()).join(" ");
    for (const sentText of splitSentences(restText)){
      const sent = parseSentence(sentText, charnames);
      ops.push(["sentence", [speaker, sent]]);
    }
  }

  return { charnames, ops, sceneLabels, actLabels };
}

// ---- Interpreter ----
class Interpreter {
  constructor(charnames, ops, sceneLabels, actLabels, inputSource, outputFn){
    this.values = {};
    for (const n of charnames) this.values[n] = 0;
    this.stage = new Set();
    this.lastCmp = false;
    this.ops = ops;
    this.sceneLabels = sceneLabels;
    this.actLabels = actLabels;
    this.inputSource = inputSource;
    this.outputFn = outputFn;
    this.outChunks = [];
  }
  out(s){ if (this.outputFn) this.outputFn(s); else this.outChunks.push(s); }
  getOutput(){ return this.outChunks.join(""); }

  async execSentenceObj(sent, speaker, addressee){
    return await sent.exec(this, speaker, addressee);
  }

  async run(maxSteps=2000000){
    let ip = 0, steps = 0;
    const n = this.ops.length;
    while (ip < n){
      steps++;
      if (steps > maxSteps) throw new SPLError("too many steps (possible infinite loop)");
      const [kind, data] = this.ops[ip];
      if (kind === "enter"){ for (const nm of data) this.stage.add(nm); ip++; }
      else if (kind === "exit"){ for (const nm of data) this.stage.delete(nm); ip++; }
      else if (kind === "exeunt"){
        if (data===null) this.stage = new Set(); else for (const nm of data) this.stage.delete(nm);
        ip++;
      } else if (kind === "sentence"){
        const [speaker, sent] = data;
        const others = [...this.stage].filter(x=>x!==speaker);
        if (others.length !== 1) throw new SPLError(`line spoken by ${speaker} requires exactly one other character on stage (found ${others.length}): ${others}`);
        const addressee = others[0];
        const jump = await this.execSentenceObj(sent, speaker, addressee);
        ip = (jump !== null && jump !== undefined) ? jump : ip+1;
      } else {
        throw new SPLError("unknown op kind: "+kind);
      }
    }
    return this.getOutput();
  }
}

if (typeof module !== "undefined") {
  module.exports = { parseFile, Interpreter, SPLError };
}
