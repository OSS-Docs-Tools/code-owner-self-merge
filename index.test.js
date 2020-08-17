const { getFilesNotOwnedByCodeOwner, findCodeOwnersForChangedFiles } = require(".");

test("determine who owns a set of files", () => {
  const noFiles = findCodeOwnersForChangedFiles(["root-codeowners/one.two.js"], "./test-code-owners-repo");
  expect(noFiles).toEqual(["@two"]);

  const filesNotInCodeowners = findCodeOwnersForChangedFiles(["root-codeowners/one.two.ts"], "./test-code-owners-repo");
  expect(filesNotInCodeowners).toEqual([]);
});

test("real world", () => {
  const changed = ["/packages/tsconfig-reference/copy/pt/options/files.md"];
  const filesNotInCodeowners = findCodeOwnersForChangedFiles(changed, ".");
  expect(filesNotInCodeowners).toEqual(["@khaosdoctor", "@danilofuchs", "@orta"]);
});

test("real world 2", () => {
  const changed = ["/packages/typescriptlang-org/src/copy/pt/index.ts", "/packages/typescriptlang-org/src/copy/pt/nav.ts"];
  const filesNotInCodeowners = findCodeOwnersForChangedFiles(changed, ".");
  expect(filesNotInCodeowners).toEqual(["@khaosdoctor", "@danilofuchs", "@orta"]);
});

test("deciding if someone has access to merge", () => {
  const noFiles = getFilesNotOwnedByCodeOwner("@two", ["root-codeowners/one.two.js"], "./test-code-owners-repo");
  expect(noFiles).toEqual([]);

  const filesNotInCodeowners = getFilesNotOwnedByCodeOwner("@two", ["random-path/file.ts"], "./test-code-owners-repo");
  expect(filesNotInCodeowners).toEqual(["random-path/file.ts"]);
});

