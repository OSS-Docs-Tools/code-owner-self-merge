// @ts-check

const github = require('@actions/github');
const core = require('@actions/core');
const Codeowners = require('codeowners');

async function run() {
  
  /** @type {import("@octokit/webhooks").WebhookPayloadPullRequestReview} */
  // @ts-ignore
  const payload = github.context.payload
  if (payload.action !== "review") {
    throw new Error("This only works on reviews")
  }
  
  const token = core.getInput('GITHUB_TOKEN');
  const octokit = new github.GitHub(token);

  const pr = payload.pull_request;
  const repo = pr.base.repo
  const review = payload.review

  if (review.state !== "APPROVED"){
    return
  }

  const repoDeets = { owner: repo.owner.login, repo: repo.name }

  // https://developer.github.com/v3/pulls/#list-pull-requests-files
  const options = octokit.pulls.listFiles.endpoint.merge(repoDeets);
  
  /** @type { import("@octokit/rest").PullsListFilesResponseItem[]} */
  const files = await octokit.paginate(options)
  const fileStrings = files.map(f => `/${f.filename}`)
  
  const filesWhichArentOwned = []
  const codeowners = new Codeowners();
  for (const file of fileStrings) {
    let owners = codeowners.getOwner(file);
    if (!owners.includes(review.user.login)) {
      filesWhichArentOwned.push(file)
    }
  }
  
  if (filesWhichArentOwned.length > 0) {
    core.info("Bailing because not all files were covered by the codeowners for this review")
    core.info(`Missing: ${filesWhichArentOwned.join(", ")}`)
    return
  }
  
  await octokit.issues.createComment({...repoDeets, issue_number: pr.number, body: `Merging because @${review.user.login} is a code-owner of all the changes - thanks!`})
  await octokit.pulls.merge({ ...repoDeets, pull_number: pr.number })
}

// const possibleRoots = getPossibleRootsForFolders(fileStrings)

// /**
//  * Taking a set of files and finding the set of common denominator folders
//  * @param {string[]} strings 
//  */
// const getPossibleRootsForFolders = (strings) => {
//   const dirs = strings.map(s => dirname(s))
//   const roots = sharedCommonSubstring(dirs)
//   if (roots === "/") return ["/"]
  
//   const possibleOptions = roots.split("/").map(r => `/${r}`)

//   return possibleOptions.filter(p => {
//     if (p === "/") return true
//     // See if any of the strings have /path/to/the/folder in it
//     return strings.find(s => s.startsWith(p + "/"))
//   })
// }

// // https://stackoverflow.com/questions/1916218/find-the-longest-common-starting-substring-in-a-set-of-strings 
// function sharedCommonSubstring(array){
//   var A = array.concat().sort(), 
//   a1= A[0], a2= A[A.length-1], L= a1.length, i= 0;
//   while(i<L && a1.charAt(i)=== a2.charAt(i)) i++;
//   return a1.substring(0, i);
// }

// @ts-ignore
if (!module.parent) {
  run()
}
