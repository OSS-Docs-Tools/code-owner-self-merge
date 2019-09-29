const {getFilesNotOwnedByCodeOwner} = require(".")

// To run these tests, clone https://github.com/orta/test-code-owners-repo
// and make it a sibling repo

const check = (a, b, c) => expect(getFilesNotOwnedByCodeOwner(a, b, "../test/test-code-owners-repo")).toEqual(c)

test("test code owners", () =>{
  check("@two", ["root-codeowners/one.two.js"],  [])
})

