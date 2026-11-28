import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');

const BUILTIN_CALLS = new Set([
  'exists',
  'existsAfter',
  'get',
  'getAfter',
  'path',
  'debug',
  'int',
  'float',
  'string',
  'bool',
  'timestamp',
  'duration',
  'latlng',
  'list',
  'map',
  'set',
  'hashing',
  'math',
  'rules',
]);

const RESERVED_IDENTS = new Set([
  'rules_version',
  'service',
  'match',
  'allow',
  'if',
  'function',
  'let',
  'return',
  'true',
  'false',
  'null',
  'is',
  'in',
  'request',
  'resource',
  'read',
  'write',
  'get',
  'list',
  'create',
  'update',
  'delete',
  'exists',
  'existsAfter',
  'getAfter',
  'path',
  'math',
  'hashing',
  'timestamp',
  'duration',
  'latlng',
  'int',
  'float',
  'string',
  'bool',
  'map',
  'list',
  'set',
  'debug',
]);

/**
 * Tokenizes Firestore Rules while preserving line/column metadata and ignoring
 * comments so braces/identifiers inside strings or comments never pollute scope analysis.
 */
export function tokenizeFirestoreRules(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = source.length;

  const advance = (count = 1) => {
    for (let k = 0; k < count && i < n; k += 1) {
      if (source[i] === '\n') {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }
      i += 1;
    }
  };

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance(1);
      continue;
    }

    if (ch === '/' && next === '/') {
      advance(2);
      while (i < n && source[i] !== '\n') {
        advance(1);
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      advance(2);
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        advance(1);
      }
      if (i < n) advance(2);
      continue;
    }

    if (ch === '\'' || ch === '"') {
      const startLine = line;
      const startCol = col;
      const quote = ch;
      let raw = quote;
      advance(1);
      while (i < n) {
        const cur = source[i];
        raw += cur;
        if (cur === '\\' && i + 1 < n) {
          advance(1);
          raw += source[i];
          advance(1);
          continue;
        }
        advance(1);
        if (cur === quote) break;
      }
      tokens.push({ type: 'STRING', value: raw, line: startLine, col: startCol });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      const startLine = line;
      const startCol = col;
      let ident = '';
      while (
        i < n &&
        ((source[i] >= 'a' && source[i] <= 'z') ||
          (source[i] >= 'A' && source[i] <= 'Z') ||
          (source[i] >= '0' && source[i] <= '9') ||
          source[i] === '_')
      ) {
        ident += source[i];
        advance(1);
      }
      tokens.push({ type: 'IDENT', value: ident, line: startLine, col: startCol });
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      const startLine = line;
      const startCol = col;
      let num = '';
      while (i < n && ((source[i] >= '0' && source[i] <= '9') || source[i] === '.')) {
        num += source[i];
        advance(1);
      }
      tokens.push({ type: 'NUMBER', value: num, line: startLine, col: startCol });
      continue;
    }

    const twoChar = ch + (next || '');
    if (
      twoChar === '==' ||
      twoChar === '!=' ||
      twoChar === '<=' ||
      twoChar === '>=' ||
      twoChar === '&&' ||
      twoChar === '||'
    ) {
      tokens.push({ type: 'OP', value: twoChar, line, col });
      advance(2);
      continue;
    }

    tokens.push({ type: 'PUNCT', value: ch, line, col });
    advance(1);
  }

  return tokens;
}

function readBalancedStatementExpr(tokens, startIdx, stopAtSemi) {
  const exprTokens = [];
  let idx = startIdx;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.value === '{') braceDepth += 1;
    else if (tok.value === '}') {
      if (braceDepth === 0) break;
      braceDepth -= 1;
    } else if (tok.value === '(') parenDepth += 1;
    else if (tok.value === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (tok.value === '[') bracketDepth += 1;
    else if (tok.value === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (stopAtSemi && tok.value === ';' && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      idx += 1;
      break;
    }
    exprTokens.push(tok);
    idx += 1;
  }
  return { exprTokens, nextIdx: idx };
}

function parseMatchHeader(tokens, matchTokenIdx) {
  let idx = matchTokenIdx + 1;
  const headerTokens = [];
  const wildcards = [];

  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.value === '{') {
      const prev = tokens[idx - 1];
      const isWildcardOpen = prev && prev.value === '/';
      if (!isWildcardOpen) {
        break;
      }
      headerTokens.push(tok);
      idx += 1;
      const wcTok = tokens[idx];
      if (wcTok && wcTok.type === 'IDENT') {
        wildcards.push(wcTok.value);
      }
      while (idx < tokens.length && tokens[idx].value !== '}') {
        headerTokens.push(tokens[idx]);
        idx += 1;
      }
      if (idx < tokens.length) {
        headerTokens.push(tokens[idx]);
        idx += 1;
      }
      continue;
    }
    if (tok.value === '$') {
      headerTokens.push(tok);
      idx += 1;
      if (tokens[idx]?.value === '(') {
        let pDepth = 0;
        while (idx < tokens.length) {
          if (tokens[idx].value === '(') pDepth += 1;
          else if (tokens[idx].value === ')') pDepth -= 1;
          headerTokens.push(tokens[idx]);
          idx += 1;
          if (pDepth === 0) break;
        }
      }
      continue;
    }
    headerTokens.push(tok);
    idx += 1;
  }

  const rawPath = headerTokens
    .map((t) => t.value)
    .join('')
    .trim();

  return {
    rawPath,
    wildcards,
    bodyOpenIdx: idx,
  };
}

function parseFunctionDecl(tokens, fnTokenIdx, parentMatch) {
  let idx = fnTokenIdx + 1;
  const nameTok = tokens[idx];
  const name = nameTok.value;
  const startLine = tokens[fnTokenIdx].line;
  idx += 1;

  const params = [];
  if (tokens[idx]?.value === '(') {
    idx += 1;
    while (idx < tokens.length && tokens[idx].value !== ')') {
      if (tokens[idx].type === 'IDENT') {
        params.push(tokens[idx].value);
      }
      idx += 1;
    }
    if (tokens[idx]?.value === ')') idx += 1;
  }

  if (tokens[idx]?.value === '{') idx += 1;

  const locals = [];
  const bodyTokens = [];
  let braceDepth = 1;

  while (idx < tokens.length && braceDepth > 0) {
    const tok = tokens[idx];
    if (tok.value === '{') {
      braceDepth += 1;
      bodyTokens.push(tok);
      idx += 1;
      continue;
    }
    if (tok.value === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) {
        const endLine = tok.line;
        idx += 1;
        return {
          fn: {
            name,
            params,
            locals,
            startLine,
            endLine,
            matchNode: parentMatch,
            bodyTokens,
          },
          nextIdx: idx,
        };
      }
      bodyTokens.push(tok);
      idx += 1;
      continue;
    }
    if (braceDepth === 1 && tok.type === 'IDENT' && tok.value === 'let') {
      const nextTok = tokens[idx + 1];
      if (nextTok && nextTok.type === 'IDENT') {
        locals.push(nextTok.value);
      }
    }
    bodyTokens.push(tok);
    idx += 1;
  }

  throw new Error(`Unclosed function ${name} starting at line ${startLine}`);
}

export function parseFirestoreRulesTree(source) {
  const tokens = tokenizeFirestoreRules(source);
  const allMatches = [];
  const allFunctions = [];
  const allAllows = [];

  let matchIdSeq = 0;
  function createMatchNode(rawPath, wildcards, parent, startLine) {
    matchIdSeq += 1;
    const node = {
      id: `match_${matchIdSeq}`,
      rawPath,
      fullPath: parent ? `${parent.fullPath}${rawPath}` : rawPath,
      wildcards,
      inheritedWildcards: new Set([
        ...(parent ? Array.from(parent.inheritedWildcards) : []),
        ...wildcards,
      ]),
      parent,
      children: [],
      functions: [],
      allows: [],
      startLine,
      endLine: null,
    };
    if (parent) parent.children.push(node);
    allMatches.push(node);
    return node;
  }

  function parseMatchBlock(startIdx, parentMatch) {
    const matchTok = tokens[startIdx];
    const { rawPath, wildcards, bodyOpenIdx } = parseMatchHeader(tokens, startIdx);
    const matchNode = createMatchNode(rawPath, wildcards, parentMatch, matchTok.line);
    let idx = bodyOpenIdx + 1; // skip '{'

    while (idx < tokens.length) {
      const tok = tokens[idx];
      if (tok.value === '}') {
        matchNode.endLine = tok.line;
        return { node: matchNode, nextIdx: idx + 1 };
      }
      if (tok.type === 'IDENT' && tok.value === 'match') {
        const res = parseMatchBlock(idx, matchNode);
        idx = res.nextIdx;
        continue;
      }
      if (tok.type === 'IDENT' && tok.value === 'function') {
        const res = parseFunctionDecl(tokens, idx, matchNode);
        matchNode.functions.push(res.fn);
        allFunctions.push(res.fn);
        idx = res.nextIdx;
        continue;
      }
      if (tok.type === 'IDENT' && tok.value === 'allow') {
        const allowStart = tok.line;
        const ops = [];
        idx += 1;
        while (idx < tokens.length && tokens[idx].value !== ':' && tokens[idx].value !== ';') {
          if (tokens[idx].type === 'IDENT') ops.push(tokens[idx].value);
          idx += 1;
        }
        if (tokens[idx]?.value === ':') idx += 1;
        if (tokens[idx]?.type === 'IDENT' && tokens[idx].value === 'if') idx += 1;
        const { exprTokens, nextIdx } = readBalancedStatementExpr(tokens, idx, true);
        const allowNode = {
          ops,
          startLine: allowStart,
          endLine: exprTokens.at(-1)?.line ?? allowStart,
          matchNode,
          exprTokens,
        };
        matchNode.allows.push(allowNode);
        allAllows.push(allowNode);
        idx = nextIdx;
        continue;
      }
      idx += 1;
    }

    throw new Error(`Unclosed match ${rawPath} at line ${matchTok.line}`);
  }

  let idx = 0;
  let rootDocumentsMatch = null;
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.type === 'IDENT' && tok.value === 'match') {
      const res = parseMatchBlock(idx, null);
      if (!rootDocumentsMatch) rootDocumentsMatch = res.node;
      idx = res.nextIdx;
      continue;
    }
    idx += 1;
  }

  return {
    rootDocumentsMatch,
    allMatches,
    allFunctions,
    allAllows,
  };
}

function extractCallAndFreeIdents(tokensList, knownFnNames) {
  const calledFns = new Set();
  const freeIdents = new Set();
  let pathExprParenDepth = 0;
  let inPath = false;

  for (let i = 0; i < tokensList.length; i += 1) {
    const tok = tokensList[i];
    const prev = tokensList[i - 1];
    const next = tokensList[i + 1];

    // Path literals like /databases/$(database)/documents/$(var)
    if (tok.value === '$') {
      inPath = true;
      if (next?.value === '(') pathExprParenDepth = 0;
    }
    if (inPath) {
      if (tok.value === '(') pathExprParenDepth += 1;
      else if (tok.value === ')') {
        pathExprParenDepth -= 1;
        if (pathExprParenDepth <= 0) inPath = false;
      }
    }

    if (tok.type !== 'IDENT') continue;

    // Property access (obj.prop) is not a standalone scope identifier or helper call
    if (prev && prev.value === '.') continue;

    if (next && next.value === '(') {
      if (!BUILTIN_CALLS.has(tok.value) && !RESERVED_IDENTS.has(tok.value)) {
        if (knownFnNames.has(tok.value)) {
          calledFns.add(tok.value);
        }
      }
      continue;
    }

    if (!RESERVED_IDENTS.has(tok.value)) {
      freeIdents.add(tok.value);
    }
  }

  return { calledFns, freeIdents };
}

function isAncestorOrSame(ancestor, node) {
  let cur = node;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

function findLowestCommonAncestor(matchNodes) {
  if (matchNodes.length === 0) return null;
  let lca = matchNodes[0];
  for (let i = 1; i < matchNodes.length; i += 1) {
    const candidate = matchNodes[i];
    while (lca && !isAncestorOrSame(lca, candidate)) {
      lca = lca.parent;
    }
  }
  return lca;
}

function resolveVisibleFunction(name, fromMatchNode, fnByScopeAndName) {
  let cur = fromMatchNode;
  while (cur) {
    const key = `${cur.id}::${name}`;
    if (fnByScopeAndName.has(key)) {
      return fnByScopeAndName.get(key);
    }
    cur = cur.parent;
  }
  return null;
}

export function analyzeFirestoreRulesScope(source) {
  const tree = parseFirestoreRulesTree(source);
  const { rootDocumentsMatch, allMatches, allFunctions, allAllows } = tree;

  const knownFnNames = new Set(allFunctions.map((f) => f.name));
  const fnByScopeAndName = new Map();
  const duplicateNamesInSameScope = [];
  for (const fn of allFunctions) {
    const key = `${fn.matchNode.id}::${fn.name}`;
    if (fnByScopeAndName.has(key)) {
      duplicateNamesInSameScope.push({ name: fn.name, scope: fn.matchNode.fullPath, line: fn.startLine });
    }
    fnByScopeAndName.set(key, fn);
  }

  const allDeclaredWildcards = new Set();
  for (const m of allMatches) {
    for (const wc of m.wildcards) {
      allDeclaredWildcards.add(wc);
    }
  }

  const fnRecords = new Map();
  const scopeResolutionErrors = [];

  for (const fn of allFunctions) {
    const { calledFns, freeIdents } = extractCallAndFreeIdents(fn.bodyTokens, knownFnNames);
    const localAndParamSet = new Set([...fn.params, ...fn.locals]);
    const wildcardRefs = [];
    const outOfScopeWildcards = [];

    for (const ident of freeIdents) {
      if (localAndParamSet.has(ident)) continue;
      if (allDeclaredWildcards.has(ident)) {
        wildcardRefs.push(ident);
        if (!fn.matchNode.inheritedWildcards.has(ident)) {
          outOfScopeWildcards.push({
            fnName: fn.name,
            wildcard: ident,
            declaredScope: fn.matchNode.fullPath,
            line: fn.startLine,
          });
        }
      }
    }

    const directCallees = [];
    for (const calleeName of calledFns) {
      const target = resolveVisibleFunction(calleeName, fn.matchNode, fnByScopeAndName);
      if (!target) {
        scopeResolutionErrors.push({
          callerType: 'function',
          callerName: fn.name,
          callerScope: fn.matchNode.fullPath,
          line: fn.startLine,
          calleeName,
        });
      } else {
        directCallees.push(target);
      }
    }

    fnRecords.set(fn, {
      fn,
      name: fn.name,
      declaredScope: fn.matchNode.fullPath,
      declaredInRoot: fn.matchNode === rootDocumentsMatch,
      startLine: fn.startLine,
      endLine: fn.endLine,
      params: fn.params,
      wildcardRefs,
      outOfScopeWildcards,
      usesRequest: freeIdents.has('request'),
      usesResource: freeIdents.has('resource'),
      directCallees,
      directCallerFns: new Set(),
      directCallerAllows: [],
      reachingAllowMatches: new Set(),
      reachingCollectionSubtrees: new Set(),
    });
  }

  const collectionSubtreeOfMatch = (matchNode) => {
    let cur = matchNode;
    while (cur && cur.parent && cur.parent !== rootDocumentsMatch) {
      cur = cur.parent;
    }
    return cur === rootDocumentsMatch ? null : cur;
  };

  for (const allowNode of allAllows) {
    const { calledFns, freeIdents } = extractCallAndFreeIdents(allowNode.exprTokens, knownFnNames);
    for (const ident of freeIdents) {
      if (allDeclaredWildcards.has(ident) && !allowNode.matchNode.inheritedWildcards.has(ident)) {
        scopeResolutionErrors.push({
          callerType: 'allow',
          callerScope: allowNode.matchNode.fullPath,
          line: allowNode.startLine,
          wildcardOutOfScope: ident,
        });
      }
    }
    for (const calleeName of calledFns) {
      const target = resolveVisibleFunction(calleeName, allowNode.matchNode, fnByScopeAndName);
      if (!target) {
        scopeResolutionErrors.push({
          callerType: 'allow',
          callerScope: allowNode.matchNode.fullPath,
          line: allowNode.startLine,
          calleeName,
        });
      } else {
        fnRecords.get(target).directCallerAllows.push(allowNode);
      }
    }
  }

  for (const rec of fnRecords.values()) {
    for (const callee of rec.directCallees) {
      fnRecords.get(callee).directCallerFns.add(rec.fn);
    }
  }

  // Propagate transitive reachability from every allow statement into callees
  const queue = [];
  for (const rec of fnRecords.values()) {
    for (const allowNode of rec.directCallerAllows) {
      rec.reachingAllowMatches.add(allowNode.matchNode);
      const subtree = collectionSubtreeOfMatch(allowNode.matchNode);
      if (subtree) rec.reachingCollectionSubtrees.add(subtree);
      queue.push(rec);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const rec of fnRecords.values()) {
      if (rec.reachingAllowMatches.size === 0) continue;
      for (const callee of rec.directCallees) {
        const calleeRec = fnRecords.get(callee);
        const prevSize = calleeRec.reachingAllowMatches.size;
        for (const m of rec.reachingAllowMatches) calleeRec.reachingAllowMatches.add(m);
        for (const s of rec.reachingCollectionSubtrees) calleeRec.reachingCollectionSubtrees.add(s);
        if (calleeRec.reachingAllowMatches.size !== prevSize) {
          changed = true;
        }
      }
    }
  }

  const helperInventory = [];
  for (const rec of fnRecords.values()) {
    const matchNodes = Array.from(rec.reachingAllowMatches);
    const lcaMatch = findLowestCommonAncestor(matchNodes);
    const recommendedScope = rec.reachingAllowMatches.size === 0
      ? 'UNUSED'
      : (lcaMatch ? lcaMatch.fullPath : rootDocumentsMatch.fullPath);

    const hasOutOfScopeWildcardAtRecommended = Boolean(
      lcaMatch && rec.wildcardRefs.some((wc) => !lcaMatch.inheritedWildcards.has(wc)),
    );

    helperInventory.push({
      name: rec.name,
      startLine: rec.startLine,
      endLine: rec.endLine,
      declaredScope: rec.declaredScope,
      declaredInRoot: rec.declaredInRoot,
      directCallerFnCount: rec.directCallerFns.size,
      directCallerAllowCount: rec.directCallerAllows.length,
      directCalleeCount: rec.directCallees.length,
      directCallees: rec.directCallees.map((c) => c.name),
      directCallerFns: Array.from(rec.directCallerFns).map((f) => f.name),
      reachingAllowCount: rec.reachingAllowMatches.size,
      reachingMatches: matchNodes.map((m) => m.fullPath).sort(),
      reachingSubtreeCount: rec.reachingCollectionSubtrees.size,
      reachingSubtrees: Array.from(rec.reachingCollectionSubtrees).map((s) => s.fullPath).sort(),
      recommendedScope,
      wildcardRefs: rec.wildcardRefs,
      outOfScopeWildcards: rec.outOfScopeWildcards,
      hasOutOfScopeWildcardAtRecommended,
      canLocalizeFromRoot:
        rec.declaredInRoot &&
        lcaMatch !== null &&
        lcaMatch !== rootDocumentsMatch &&
        !hasOutOfScopeWildcardAtRecommended,
    });
  }

  const collectionLevelMatches = allMatches.filter((m) => m.parent === rootDocumentsMatch);
  const nestedMatches = allMatches.filter((m) => m.parent && m.parent !== rootDocumentsMatch);
  const rootHelpers = helperInventory.filter((h) => h.declaredInRoot);
  const localizedHelpers = helperInventory.filter((h) => !h.declaredInRoot);
  const unusedHelpers = helperInventory.filter((h) => h.reachingAllowCount === 0);
  const localizableRootCandidates = helperInventory.filter((h) => h.canLocalizeFromRoot);
  const multiSubtreeHelpers = helperInventory.filter((h) => h.reachingSubtreeCount > 1);
  const outOfScopeWildcardErrors = helperInventory.flatMap((h) => h.outOfScopeWildcards);

  const helpersPerMatch = {};
  for (const m of allMatches) {
    if (m.functions.length > 0) {
      helpersPerMatch[m.fullPath] = m.functions.map((f) => f.name);
    }
  }

  const utf8LfBytes = Buffer.byteLength(source.replace(/\r\n/g, '\n'), 'utf8');
  const rawBytes = Buffer.byteLength(source, 'utf8');

  return {
    metrics: {
      rawDiskUtf8Bytes: rawBytes,
      lfNormalizedUtf8Bytes: utf8LfBytes,
      totalMatchesExcludingRoot: allMatches.length - (rootDocumentsMatch ? 1 : 0),
      collectionLevelMatchCount: collectionLevelMatches.length,
      nestedMatchCount: nestedMatches.length,
      totalHelpers: allFunctions.length,
      rootHelpersCount: rootHelpers.length,
      localizedHelpersCount: localizedHelpers.length,
      unusedHelpersCount: unusedHelpers.length,
      localizableRootCandidatesCount: localizableRootCandidates.length,
      multiSubtreeHelpersCount: multiSubtreeHelpers.length,
      scopeResolutionErrorCount: scopeResolutionErrors.length,
      outOfScopeWildcardErrorCount: outOfScopeWildcardErrors.length,
      duplicateNameErrorCount: duplicateNamesInSameScope.length,
    },
    helpersPerMatch,
    unusedHelpers: unusedHelpers.map((h) => ({ name: h.name, startLine: h.startLine, declaredScope: h.declaredScope })),
    localizableRootCandidates: localizableRootCandidates.map((h) => ({
      name: h.name,
      startLine: h.startLine,
      recommendedScope: h.recommendedScope,
      reachingMatches: h.reachingMatches,
    })),
    multiSubtreeHelpers: multiSubtreeHelpers.map((h) => ({
      name: h.name,
      declaredScope: h.declaredScope,
      reachingSubtreeCount: h.reachingSubtreeCount,
      reachingSubtrees: h.reachingSubtrees,
    })),
    scopeResolutionErrors,
    outOfScopeWildcardErrors,
    duplicateNamesInSameScope,
    helperInventory,
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const targetArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const rulesPath = targetArg ? path.resolve(process.cwd(), targetArg) : DEFAULT_RULES_PATH;
  const source = readFileSync(rulesPath, 'utf8');
  const report = analyzeFirestoreRulesScope(source);

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const m = report.metrics;
  console.log('=== FIRESTORE RULES SCOPE AUDIT ===');
  console.log(`Source LF UTF-8 bytes        : ${m.lfNormalizedUtf8Bytes} (limit < 262144)`);
  console.log(`Source disk UTF-8 bytes      : ${m.rawDiskUtf8Bytes}`);
  console.log(`Collection matches (top)     : ${m.collectionLevelMatchCount}`);
  console.log(`Nested subcollection matches : ${m.nestedMatchCount}`);
  console.log(`Total match blocks (ex root) : ${m.totalMatchesExcludingRoot}`);
  console.log(`Total helper functions       : ${m.totalHelpers}`);
  console.log(`Root-scoped helpers          : ${m.rootHelpersCount}`);
  console.log(`Localized helpers            : ${m.localizedHelpersCount}`);
  console.log(`Multi-subtree shared helpers : ${m.multiSubtreeHelpersCount}`);
  console.log(`Localizable root candidates  : ${m.localizableRootCandidatesCount}`);
  console.log(`Unused helper declarations   : ${m.unusedHelpersCount}`);
  console.log(`Scope resolution errors      : ${m.scopeResolutionErrorCount}`);
  console.log(`Wildcard out-of-scope errors : ${m.outOfScopeWildcardErrorCount}`);

  if (report.unusedHelpers.length > 0) {
    console.log('\nUnused helpers:');
    for (const h of report.unusedHelpers) {
      console.log(`  - ${h.name} (line ${h.startLine}, scope ${h.declaredScope})`);
    }
  }

  if (report.localizableRootCandidates.length > 0) {
    console.log('\nRoot helpers reachable from a single valid match subtree:');
    for (const h of report.localizableRootCandidates) {
      console.log(`  - ${h.name} (line ${h.startLine}) -> ${h.recommendedScope}`);
    }
  }

  if (report.scopeResolutionErrors.length > 0 || report.outOfScopeWildcardErrors.length > 0) {
    console.log('\nScope/Wildcard Errors:');
    console.log(JSON.stringify({
      scopeResolutionErrors: report.scopeResolutionErrors,
      outOfScopeWildcardErrors: report.outOfScopeWildcardErrors,
      duplicateNamesInSameScope: report.duplicateNamesInSameScope,
    }, null, 2));
  }

  const hasStrictFailure =
    m.scopeResolutionErrorCount > 0 ||
    m.outOfScopeWildcardErrorCount > 0 ||
    m.duplicateNameErrorCount > 0 ||
    m.unusedHelpersCount > 0 ||
    m.localizableRootCandidatesCount > 0;

  if (args.has('--check') && hasStrictFailure) {
    process.exitCode = 1;
  } else if (
    m.scopeResolutionErrorCount > 0 ||
    m.outOfScopeWildcardErrorCount > 0 ||
    m.duplicateNameErrorCount > 0
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('audit-firestore-rules-scope.mjs'))) {
  main();
}
