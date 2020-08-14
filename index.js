// @ts-check

const { context, getOctokit } = require('@actions/github')
const core = require('@actions/core');
const Codeowners = require('codeowners');

// Effectively the main function
async function run() {
  core.info("Running version 1.2.1")

  // Tell folks they can merge
  if (context.eventName === "pull_request_target") {
    commentOnMergablePRs()
  }

  // Merge if they say they have access
  if (context.eventName === "issue_comment" || context.eventName === "pull_request_review") {
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

  core.info(`\n\nLooking at PR: '${pr.title}' to see if the changed files all fit inside one set of code-owners to make a comment`)
  
  const co = new Codeowners(cwd);
  core.info(`Code-owners file found at: ${co.codeownersFilePath}`)

  const changedFiles = await getPRChangedFiles(octokit, thisRepo, pr.number)
  core.info(`Changed files: \n\n - ${changedFiles.join("\n - ")}`)

  const codeowners = findCodeOwnersForChangedFiles(changedFiles, cwd)
  core.info(`Code-owners: \n\n - ${codeowners.join("\n - ")}`)

  if (!codeowners.length) {
    console.log("This PR does not have any code-owners")
    process.exit(0)
  }

  // Determine who has access to merge every file in this PR
  const ownersWhoHaveAccessToAllFilesInPR = []
  codeowners.forEach(owner => {
    const filesWhichArentOwned = getFilesNotOwnedByCodeOwner(owner, changedFiles, cwd)
    if (filesWhichArentOwned.length === 0) ownersWhoHaveAccessToAllFilesInPR.push(owner)
  })

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
  if (context.eventName !== "issue_comment" && context.eventName !== "pull_request_review") {
    throw new Error("This GH action can only run when the workflow specifies `pull_request_target` in the `on:`.")
  }

  const body = context.payload.comment ? context.payload.comment.body : context.payload.review.body
  if (!body.toLowerCase().includes("lgtm")) {
    console.log("Comment does not include LGTM ('looks good to me') so not merging")
    process.exit(0)
  }
  
  // Setup
  const cwd = "."
  const octokit = getOctokit(process.env.GITHUB_TOKEN)
  const thisRepo = { owner: context.repo.owner, repo: context.repo.repo }
  const issue = context.payload.issue || context.payload.pull_request
  const sender = context.payload.sender.login

  core.info(`\n\nLooking at the ${context.eventName} from ${sender} in '${issue.title}' to see if we can merge`)
  
  const changedFiles = await getPRChangedFiles(octokit, thisRepo, issue.number)
  core.info(`Changed files: \n - ${changedFiles.join("\n - ")}`)

  const filesWhichArentOwned = getFilesNotOwnedByCodeOwner("@" + sender, changedFiles, cwd)
  if (filesWhichArentOwned.length !== 0) {
    console.log(`@${sender} does not have access to merge \n - ${filesWhichArentOwned.join("\n - ")}`)
    process.exit(0)
  }

  core.info(`Creating comments and merging`)
  await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Merging because @${sender} is a code-owner of all the changes - thanks!` });
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
  console.log(cwd, codeowners.codeownersFilePath)
  
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
