// @ts-check

const { context, getOctokit } = require('@actions/github')
const core = require('@actions/core');
const Codeowners = require('codeowners');

// Effectively the main function
async function run() {
  console.log("Starting with ", context)

  // Tell folks they can merge
  if (context.eventName === "pull_request_target") {
    commentOnMergablePRs()
  }

  // Merge if they say they have access
  if (context.eventName === "issue_comment") {
    mergeIfLGTMAndHasAccess()
  } 
}

async function commentOnMergablePRs() {
  if (context.eventName !== "pull_request_target") {
    throw new Error("This function can only run when the workflow specifies `pull_request_target` in the `on:`.")
  }
  
  // Setup
  const cwd = "."
  const octokit = getOctokit(process.env.GITHUB_TOKEN)
  const pr = context.payload.pull_request
  const thisRepo = { owner: context.repo.owner, repo: context.repo.repo }

  core.info(`\n\nLooking at PR: '${pr.title}' for codeowners`)
  
  const changedFiles = await getPRChangedFiles(octokit, thisRepo, pr.number)
  console.log("changed files", changedFiles)
  const codeowners = findCodeOwnersForChangedFiles(changedFiles, cwd)
  console.log("owners for PR", codeowners)

  const co = new Codeowners(cwd);
  console.log(co.codeownersFilePath, co.codeownersDirectory)

  if (!codeowners.length) {
    console.log("This PR does not have any code-owners")
    process.exit(0)
  }

  // Determine who has access to merge every file in this PR
  const ownersWhoHaveAccessToAllFilesInPR = []
  codeowners.forEach(owner => {
    const filesWhichArentOwned = getFilesNotOwnedByCodeOwner(owner, changedFiles, cwd)
    if (filesWhichArentOwned.length === 0) ownersWhoHaveAccessToAllFilesInPR.push(owner)
  });

  if(!ownersWhoHaveAccessToAllFilesInPR.length) {
    console.log("This PR does not have any code-owners who own all of the files in the PR")
    process.exit(0)
  }

  const ourSignature = "<!-- Message About Merging -->"
  const comments = await octokit.issues.listComments({ ...thisRepo, issue_number: pr.number })
  const existingComment = comments.data.find(c => c.body.includes(ourSignature))
  if (existingComment) {
    console.log("There is an existing comment")
    process.exit(0)
  }

  const owners = new Intl.ListFormat().format(ownersWhoHaveAccessToAllFilesInPR);
  const message = `Thanks for the PR! 

This section of the codebase is owner by ${owners} - if they write a comment saying "LGTM" then it will be merged.
${ourSignature}`

  await octokit.issues.createComment({ ...thisRepo, issue_number: pr.number, body: message });
}


async function mergeIfLGTMAndHasAccess() {
  if (context.eventName !== "issue_comment") {
    throw new Error("This GH action can only run when the workflow specifies `pull_request_target` in the `on:`.")
  }
  console.log("body", context.payload.comment.body.toLowerCase())
  if (!context.payload.comment.body.toLowerCase().includes("lgtm")) {
    console.log("Comment does not include LGTM ('looks good to me') so not merging")
    process.exit(0)
  }
  
  
  // Setup
  const cwd = "."
  const octokit = getOctokit(process.env.GITHUB_TOKEN)
  const thisRepo = { owner: context.repo.owner, repo: context.repo.repo }
  const issue = context.payload.issue

  core.info(`\n\nLooking at PR: ${issue.title} to see if we can merge`)
  
  const changedFiles = await getPRChangedFiles(octokit, thisRepo, issue.number)

  const filesWhichArentOwned = getFilesNotOwnedByCodeOwner("@" + issue.user.login, changedFiles, cwd)
  if (filesWhichArentOwned.length !== 0) {
    const missing = new Intl.ListFormat().format(filesWhichArentOwned);

    console.log(`${issue.user.login} does not have access to merge ${missing}`)
    process.exit(0)
  }

  await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Merging because @${issue.user.login} is a code-owner of all the changes - thanks!` });
  await octokit.pulls.merge({ ...thisRepo, pull_number: issue.number });
}

function getFilesNotOwnedByCodeOwner(owner, files, cwd) {
  const filesWhichArentOwned = []
  const codeowners = new Codeowners(cwd);
  
  for (const file of files) {
    let owners = codeowners.getOwner(file);
    if (!owners.includes(owner)) {
      filesWhichArentOwned.push(file)
    }
  }

  return filesWhichArentOwned
}

function findCodeOwnersForChangedFiles(changedFiles, cwd)  {
  const owners = new Set()
  const codeowners = new Codeowners(cwd);
  
  for (const file of changedFiles) {
    const filesOwners = codeowners.getOwner(file);
    filesOwners.forEach(o => owners.add(o))
  }

  return Array.from(owners)
}

async function getPRChangedFiles(octokit, repoDeets, prNumber) {
  // https://developer.github.com/v3/pulls/#list-pull-requests-files
  const options = octokit.pulls.listFiles.endpoint.merge({...repoDeets, pull_number: prNumber });
  
  /** @type { import("@octokit/rest").PullsListFilesResponseItem[]} */
  const files = await octokit.paginate(options)
  const fileStrings = files.map(f => `/${f.filename}`)
  return fileStrings
}

process.on('uncaughtException', function (error) {
  core.setFailed(error.message)
})

module.exports = {
  getFilesNotOwnedByCodeOwner,
  findCodeOwnersForChangedFiles
}

// @ts-ignore
if (!module.parent) {
  try {
    run()
  } catch (error) {
    core.setFailed(error.message)
    throw error
  }
}
