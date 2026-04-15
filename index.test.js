import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getFilesNotOwnedByCodeOwner, findCodeOwnersForChangedFiles, githubLoginIsInCodeowners, hasValidLgtmSubstring } from "./index.js";

test("determine who owns a set of files", () => {
  const noFiles = findCodeOwnersForChangedFiles(["root-codeowners/one.two.js"], "./test-code-owners-repo");
  assert.deepStrictEqual(noFiles.users, ["@two"]);

  const filesNotInCodeowners = findCodeOwnersForChangedFiles(["root-codeowners/one.two.ts"], "./test-code-owners-repo");
  assert.deepStrictEqual(filesNotInCodeowners.users, []);
});

test("real world", () => {
  const changed = ["/packages/tsconfig-reference/copy/pt/options/files.md"];
  const filesNotInCodeowners = findCodeOwnersForChangedFiles(changed, ".");
  assert.deepStrictEqual(filesNotInCodeowners.users, ["@khaosdoctor", "@danilofuchs", "@orta"]);
});

test("real world 2", () => {
  const changed = ["/packages/typescriptlang-org/src/copy/pt/index.ts", "/packages/typescriptlang-org/src/copy/pt/nav.ts"];
  const filesNotInCodeowners = findCodeOwnersForChangedFiles(changed, ".");
  assert.deepStrictEqual(filesNotInCodeowners.users, ["@khaosdoctor", "@danilofuchs", "@orta"]);
});

test("real world with labels", () => {
  // spanish has [] labels in the CODEOWNERS
  const changed = ["/packages/typescriptlang-org/src/copy/es/index.ts", "/packages/typescriptlang-org/src/copy/es/nav.ts"];
  const filesNotInCodeowners = findCodeOwnersForChangedFiles(changed, ".");
  assert.deepStrictEqual(filesNotInCodeowners.labels, ["translate", "es"]);
});

test("deciding if someone has access to merge", () => {
  const noFiles = getFilesNotOwnedByCodeOwner("@two", ["root-codeowners/one.two.js"], "./test-code-owners-repo");
  assert.deepStrictEqual(noFiles, []);

  const filesNotInCodeowners = getFilesNotOwnedByCodeOwner("@two", ["random-path/file.ts"], "./test-code-owners-repo");
  assert.deepStrictEqual(filesNotInCodeowners, ["random-path/file.ts"]);
});

describe("githubLoginIsInCodeowners", () => {
  test("allows folks found in the codeowners", () => {
    const ortaIn = githubLoginIsInCodeowners("orta", ".");
    assert.strictEqual(ortaIn, true);
  });
  test("ignores case", () => {
    const ortaIn = githubLoginIsInCodeowners("OrTa", ".");
    assert.strictEqual(ortaIn, true);
  });
  test("denies other accounts", () => {
    const noDogMan = githubLoginIsInCodeowners("dogman", ".");
    assert.strictEqual(noDogMan, false);
  });
  test("denies subsets of existing accounts", () => {
    const noOrt = githubLoginIsInCodeowners("ort", ".");
    assert.strictEqual(noOrt, false);
  });
});

describe("hasValidLgtmSubstring", () => {
  test("allows lgtm", () => {
    const isValidSubstring = hasValidLgtmSubstring("this lgtm!");
    assert.strictEqual(isValidSubstring, true);
  });
  test("denies lgtm but", () => {
    const isValidSubstring = hasValidLgtmSubstring("this lgtm but");
    assert.strictEqual(isValidSubstring, false);
  });
  test("denies lgtm but with comma", () => {
    const isValidSubstring = hasValidLgtmSubstring("this lgtm, but");
    assert.strictEqual(isValidSubstring, false);
  });
  test("denies lgtm in double quotes", () => {
    const isValidSubstring = hasValidLgtmSubstring("\"lgtm\"");
    assert.strictEqual(isValidSubstring, false);
  });
  test("denies lgtm in single quotes", () => {
    const isValidSubstring = hasValidLgtmSubstring("'lgtm");
    assert.strictEqual(isValidSubstring, false);
  });
  test("denies lgtm in inline code blocks", () => {
    const isValidSubstring = hasValidLgtmSubstring("lgtm`");
    assert.strictEqual(isValidSubstring, false);
  });
});