// @ts-check

const github = require('@actions/github');
const core = require('@actions/core');
const Codeowners = require('codeowners');

async function run() {
  
  /** @type {import("@octokit/webhooks").WebhookPayloadPullRequestReview} */
  // @ts-ignore
  const payload = github.context.payload
  if (!validate(payload)) {
    return
  }
  
  const token = core.getInput('GITHUB_TOKEN');
  const octokit = new github.GitHub(token);

  const pr = payload.pull_request;
  const repo = pr.base.repo
  const review = payload.review

  const repoDeets = { owner: repo.owner.login, repo: repo.name }
  const fileStrings = await getPRChangedFiles(octokit, repoDeets)
  
  const filesWhichArentOwned = getFilesNotOwnedByCodeOwner(review.user.login, fileStrings)

  if (filesWhichArentOwned.length > 0) {
    core.info("Bailing because not all files were covered by the codeowners for this review")
    core.info(`Missing: ${filesWhichArentOwned.join(", ")}`)
    return
  }
  
  await commentAndMerge(octokit, repoDeets, pr, review);
}

async function commentAndMerge (octokit, repoDeets, pr, review) {
  await octokit.issues.createComment({ ...repoDeets, issue_number: pr.number, body: `Merging because @${review.user.login} is a code-owner of all the changes - thanks!` });
  await octokit.pulls.merge({ ...repoDeets, pull_number: pr.number });
}

function getFilesNotOwnedByCodeOwner(owner, files, cwd) {
  const filesWhichArentOwned = []
  const codeowners = new Codeowners(cwd);
  
  for (const file of files) {
    let owners = codeowners.getOwner(file);
    console.log(owners)
    if (!owners.includes(owner)) {
      filesWhichArentOwned.push(file)
    }
  }

  return filesWhichArentOwned
}

async function getPRChangedFiles(octokit, repoDeets) {
  // https://developer.github.com/v3/pulls/#list-pull-requests-files
  const options = octokit.pulls.listFiles.endpoint.merge(repoDeets);
  
  /** @type { import("@octokit/rest").PullsListFilesResponseItem[]} */
  const files = await octokit.paginate(options)
  const fileStrings = files.map(f => `/${f.filename}`)
  return fileStrings
}

function validate(payload) {
  if (payload.action !== "review") {
    throw new Error("This only works on reviews")
  }

  const review = payload.review

  if (review.state !== "APPROVED"){
    core.info("Skipping due to this review not being a green")
    return false
  }

  const hasAccessRoles = ["COLLABORATOR", "OWNER", "MEMBER"]
  if (hasAccessRoles.includes(review.author_association)) {
    core.info("Skipping because review author has write access")
    // return
  }
}


// @ts-ignore
if (!module.parent) {
  run()
}

module.exports = {
  getFilesNotOwnedByCodeOwner,
}
