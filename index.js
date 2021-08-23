// @ts-check

const { context, getOctokit } = require('@actions/github')
const core = require('@actions/core');
const Codeowners = require('codeowners');
const {readFileSync} = require("fs");

// Effectively the main function
async function run() {
  core.info("Running version 1.5.4")

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
  const cwd = core.getInput('cwd') || process.cwd()
  const octokit = getOctokit(process.env.GITHUB_TOKEN)
  const pr = context.payload.pull_request
  const thisRepo = { owner: context.repo.owner, repo: context.repo.repo }

  core.info(`\nLooking at PR: '${pr.title}' to see if the changed files all fit inside one set of code-owners to make a comment`)

  const co = new Codeowners(cwd);
  core.info(`Code-owners file found at: ${co.codeownersFilePath}`)

  const changedFiles = await getPRChangedFiles(octokit, thisRepo, pr.number)
  core.info(`Changed files: \n - ${changedFiles.join("\n - ")}`)

  const codeowners = findCodeOwnersForChangedFiles(changedFiles, cwd)
  core.info(`Code-owners: \n - ${codeowners.users.join("\n - ")}`)
  core.info(`Labels: \n - ${codeowners.labels.join("\n - ")}`)

  if (!codeowners.users.length) {
    console.log("This PR does not have any code-owners")
    process.exit(0)
  }

  // Determine who has access to merge every file in this PR
  const ownersWhoHaveAccessToAllFilesInPR = []
  codeowners.users.forEach(owner => {
    const filesWhichArentOwned = getFilesNotOwnedByCodeOwner(owner, changedFiles, cwd)
    if (filesWhichArentOwned.length === 0) ownersWhoHaveAccessToAllFilesInPR.push(owner)
  })

  if (!ownersWhoHaveAccessToAllFilesInPR.length) {
    console.log("This PR does not have any code-owners who own all of the files in the PR")
    listFilesWithOwners(changedFiles, cwd)

    const labelToAdd = core.getInput('if_no_maintainers_add_label')
    if (labelToAdd) {
      const labelConfig = { name: labelToAdd, color: Math.random().toString(16).slice(2, 8) }
      await createOrAddLabel(octokit, { ...thisRepo, id: pr.number }, labelConfig)
    }

    const assignees = core.getInput('if_no_maintainers_assign')
    if (assignees) {
      const usernames = assignees.split(" ").map(u => u.replace("@", "").trim())
      await octokit.issues.addAssignees({ ...thisRepo, issue_number: pr.number, assignees: usernames})
    }

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

This section of the codebase is owned by ${owners} - if they write a comment saying "LGTM" then it will be merged.
${ourSignature}`

  await octokit.issues.createComment({ ...thisRepo, issue_number: pr.number, body: message });

  // Add labels
  for (const label of codeowners.labels) {
    const labelConfig = { name: label, color: Math.random().toString(16).slice(2, 8) }
    await createOrAddLabel(octokit, { ...thisRepo, id: pr.number }, labelConfig)
  }
}

/**
 * @param {string[]} files
 */
function pathListToMarkdown(files) {
  return files.map(i => `* [\`${i}\`](https://github.com/${context.repo.owner}/${context.repo.repo}/tree/HEAD${i})`).join("\n");
}

async function mergeIfLGTMAndHasAccess() {
  const body = context.payload.comment ? context.payload.comment.body : context.payload.review.body
  if (!body) {
    // For debugging #8
    console.log(JSON.stringify(context))
  }

  if (!body || !body.toLowerCase().includes("lgtm")) {
    console.log("Comment does not include LGTM ('looks good to me') so not merging")
    process.exit(0)
  }

  // Setup
  const cwd = core.getInput('cwd') || process.cwd()
  const octokit = getOctokit(process.env.GITHUB_TOKEN)
  const thisRepo = { owner: context.repo.owner, repo: context.repo.repo }
  const issue = context.payload.issue || context.payload.pull_request
  const sender = context.payload.sender.login

  core.info(`\n\nLooking at the ${context.eventName} from ${sender} in '${issue.title}' to see if we can merge`)

  const changedFiles = await getPRChangedFiles(octokit, thisRepo, issue.number)
  core.info(`Changed files: \n - ${changedFiles.join("\n - ")}`)

  const filesWhichArentOwned = getFilesNotOwnedByCodeOwner("@" + sender, changedFiles, cwd)
  if (filesWhichArentOwned.length !== 0) {
    console.log(`@${sender} does not have access to merge \n - ${filesWhichArentOwned.join("\n - ")}\n`)
    listFilesWithOwners(changedFiles, cwd)
    await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Sorry @${sender}, you don't have access to merge:\n${pathListToMarkdown(filesWhichArentOwned)}` });
    return
  }

  // Don't try merge unmergable stuff
  const prInfo = await octokit.pulls.get({ ...thisRepo, pull_number: issue.number })
  if (!prInfo.data.mergeable) {
    await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Sorry @${sender}, this PR has merge conflicts. They'll need to be fixed before this can be merged.` });
    return
  }

  if (prInfo.data.state.toLowerCase() !== "open") {
    await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Sorry @${sender}, this PR isn't open.` });
    return
  }

  // Don't merge red PRs
  const statusInfo = await octokit.repos.listCommitStatusesForRef({ ...thisRepo, ref: prInfo.data.head.sha })
  const failedStatus = statusInfo.data
    // Check only the most recent for a set of duplicated statuses
    .filter(
      (thing, index, self) =>
        index === self.findIndex((t) => t.target_url === thing.target_url)
    )
    .find(s => s.state !== "success")

  if (failedStatus) {
    await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Sorry @${sender}, this PR could not be merged because it wasn't green. Blocked by [${failedStatus.context}](${failedStatus.target_url}): '${failedStatus.description}'.` });
    return
  }

  core.info(`Creating comments and merging`)
  try {
    // @ts-ignore
    await octokit.pulls.merge({ ...thisRepo, pull_number: issue.number, merge_method: core.getInput('merge_method') || 'merge' });
    await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `Merging because @${sender} is a code-owner of all the changes - thanks!` });
  } catch (error) {
    core.info(`Merging (or commenting) failed:`)
    core.error(error)
    core.setFailed("Failed to merge")

    const linkToCI = `https://github.com/${thisRepo.owner}/${thisRepo.repo}/runs/${process.env.GITHUB_RUN_ID}?check_suite_focus=true`
    await octokit.issues.createComment({ ...thisRepo, issue_number: issue.number, body: `There was an issue merging, maybe try again ${sender}. <a href="${linkToCI}">Details</a>` });
  }
}

/**
 *
 * @param {string} owner
 * @param {string[]} files
 * @param {string} cwd
 */
function getFilesNotOwnedByCodeOwner(owner, files, cwd) {
  const filesWhichArentOwned = []
  const codeowners = new Codeowners(cwd);

  for (const file of files) {
    const relative = file.startsWith("/") ? file.slice(1) : file
    let owners = codeowners.getOwner(relative);
    if (!owners.includes(owner)) {
      filesWhichArentOwned.push(file)
    }
  }

  return filesWhichArentOwned
}

/**
 *
 * @param {string[]} files
 * @param {string} cwd
 */
function listFilesWithOwners(files, cwd) {
  const codeowners = new Codeowners(cwd);
  console.log("\nKnown code-owners for changed files:")
  for (const file of files) {
    const relative = file.startsWith("/") ? file.slice(1) : file
    let owners = codeowners.getOwner(relative);
    console.log(`- ${file} (${new Intl.ListFormat().format(owners)})`)
  }
  console.log("\n> CODEOWNERS file:")
  console.log(readFileSync(codeowners.codeownersFilePath, "utf8"))
}

function findCodeOwnersForChangedFiles(changedFiles, cwd)  {
  const owners = new Set()
  const labels = new Set()
  const codeowners = new Codeowners(cwd);

  for (const file of changedFiles) {
    const relative = file.startsWith("/") ? file.slice(1) : file
    const filesOwners = codeowners.getOwner(relative);
    filesOwners.forEach(o => {
      if (o.startsWith("@")) owners.add(o)
      if (o.startsWith("[")) labels.add(o.slice(1, o.length-1))
    })
  }

  return {
    users: Array.from(owners),
    labels: Array.from(labels)
  }
}

async function getPRChangedFiles(octokit, repoDeets, prNumber) {
  // https://developer.github.com/v3/pulls/#list-pull-requests-files
  const options = octokit.pulls.listFiles.endpoint.merge({...repoDeets, pull_number: prNumber });

  /** @type { import("@octokit/types").PullsListFilesResponseData} */
  const files = await octokit.paginate(options)
  const fileStrings = files.map(f => `/${f.filename}`)
  return fileStrings
}

async function createOrAddLabel(octokit, repoDeets, labelConfig) {
  let label = null
    const existingLabels = await octokit.paginate('GET /repos/:owner/:repo/labels', { owner: repoDeets.owner, repo: repoDeets.repo })
    label = existingLabels.find(l => l.name == labelConfig.name)

  // Create the label if it doesn't exist yet
  if (!label) {
    await octokit.issues.createLabel({
      owner: repoDeets.owner,
      repo: repoDeets.repo,
      name: labelConfig.name,
      color: labelConfig.color,
      description: labelConfig.description,
    })
  }

  await octokit.issues.addLabels({
    owner: repoDeets.owner,
    repo: repoDeets.repo,
    issue_number: repoDeets.id,
    labels: [labelConfig.name],
  })
}

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

// Bail correctly
process.on('uncaughtException', function (err) {
  core.setFailed(err.message)
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
})
