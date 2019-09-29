const {getPossibleRootsForFolders} = require(".")

test("one file", () =>{
  expect(getPossibleRootsForFolders(["/file1.txt"])).toEqual(["/"])
  expect(getPossibleRootsForFolders(["/two/file1.txt"])).toEqual(["/", "/two"])
})

test("many files", () =>{
  expect(getPossibleRootsForFolders(["/two/file1.txt"])).toEqual(["/", "/two"])
  expect(getPossibleRootsForFolders(["/two/three/four.ts", "/two/thing.js"])).toEqual(["/", "/two"])
  expect(getPossibleRootsForFolders(["/two/three/four.ts", "/two/three/five.js"])).toEqual(["/", "/two"])
})

test("always round to real folders ", () =>{
  expect(getPossibleRootsForFolders(["/three/three/four.ts", "/two/thing.js"])).toEqual(["/"])
})

test("always round to real folders to the  to the ", () =>{
  expect(getPossibleRootsForFolders(["/two/three/four.ts", "/two/thre"])).toEqual(["/", "/two"])
})
