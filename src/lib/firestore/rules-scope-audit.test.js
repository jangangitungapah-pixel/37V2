import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFirestoreRulesScope } from '../../../scripts/audit-firestore-rules-scope.mjs';

describe('Firestore Rules Scope Audit Scanner', () => {
  it('ignores comments, strings, and map literals while detecting localized vs root helpers accurately', () => {
    const sampleRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSharedRole() {
      return request.auth != null;
    }

    // Comment mentioning fake braces { } and function bogus() {} and match /fake/{id}
    /* Block comment
       match /commented/{cid} {
         function fakeInComment() { return true; }
       }
    */
    function singleMatchHelper(payload) {
      let note = "string with { braces } function inString() {}";
      return payload.note != note && isSharedRole();
    }

    function unusedDeadHelper() {
      return true;
    }

    match /orders/{orderId} {
      allow get: if singleMatchHelper(resource.data)
        && isValidNestedDoc({});

      match /items/{itemId} {
        function isValidItem() {
          return itemId != '' && orderId != '' && isSharedRole();
        }
        allow create: if isValidItem();
      }
    }

    match /customers/{customerId} {
      allow get: if isSharedRole();
    }

    function isValidNestedDoc(m) {
      return m is map;
    }
  }
}
`;

    const report = analyzeFirestoreRulesScope(sampleRules);
    expect(report.metrics.collectionLevelMatchCount).toBe(2);
    expect(report.metrics.nestedMatchCount).toBe(1);
    expect(report.metrics.unusedHelpersCount).toBe(1);
    expect(report.unusedHelpers.map((h) => h.name)).toEqual(['unusedDeadHelper']);
    expect(report.localizableRootCandidates.map((h) => h.name)).toEqual([
      'singleMatchHelper',
      'isValidNestedDoc',
    ]);
    expect(report.metrics.multiSubtreeHelpersCount).toBe(1);
    expect(report.multiSubtreeHelpers.map((h) => h.name)).toEqual(['isSharedRole']);
    expect(report.scopeResolutionErrors).toHaveLength(0);
    expect(report.outOfScopeWildcardErrors).toHaveLength(0);
  });

  it('flags out-of-scope wildcard references and unreachable child helper calls', () => {
    const badRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function usesOutOfScopeWildcard() {
      return invoiceId != '';
    }

    match /bookings/{bookingId} {
      allow get: if usesOutOfScopeWildcard() && onlyInSibling();
    }

    match /invoices/{invoiceId} {
      function onlyInSibling() {
        return invoiceId != '';
      }
      allow get: if onlyInSibling();
    }
  }
}
`;

    const report = analyzeFirestoreRulesScope(badRules);
    expect(report.outOfScopeWildcardErrors.length).toBeGreaterThan(0);
    expect(report.outOfScopeWildcardErrors[0].wildcard).toBe('invoiceId');
    expect(report.scopeResolutionErrors.length).toBe(1);
    expect(report.scopeResolutionErrors[0].calleeName).toBe('onlyInSibling');
  });

  it('passes strict scope remediation checks on the repository firestore.rules', () => {
    const rulesSource = readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const report = analyzeFirestoreRulesScope(rulesSource);

    expect(report.metrics.lfNormalizedUtf8Bytes).toBeLessThan(262144);
    expect(report.metrics.collectionLevelMatchCount).toBe(43);
    expect(report.metrics.nestedMatchCount).toBe(4);
    expect(report.metrics.totalMatchesExcludingRoot).toBe(47);
    expect(report.metrics.rootHelpersCount).toBe(30);
    expect(report.metrics.localizedHelpersCount).toBe(171);
    expect(report.metrics.totalHelpers).toBe(201);
    expect(report.metrics.localizableRootCandidatesCount).toBe(0);
    expect(report.metrics.unusedHelpersCount).toBe(0);
    expect(report.metrics.scopeResolutionErrorCount).toBe(0);
    expect(report.metrics.outOfScopeWildcardErrorCount).toBe(0);
    expect(report.metrics.duplicateNameErrorCount).toBe(0);
  });
});
