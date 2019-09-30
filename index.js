// @ts-check

const github = require('@actions/github');
const core = require('@actions/core');
const Codeowners = require('codeowners');

async function run() {
  const token = core.getInput('GITHUB_TOKEN');
  const octokit = new github.GitHub(token);
  
  // const repoDeets = { owner: github.context.repo.owner, repo: github.context.repo.repo }
  const repoDeets = { owner: "facebook", repo: "jest" }

  const query = searchQuery(`${repoDeets.owner}/${repoDeets.repo}`)
  const searchResponse = await octokit.graphql(query, {})

  for (const edge of searchResponse.search.edges) {
    const pr = edge.node
    core.info(`\n\nLooking at PR: ${pr.title}`)

    // PR = { title: string, number: number, reviews: { nodes: { author: {login: string }[] } }
    console.log(pr)

    const fileStrings = await getPRChangedFiles(octokit, repoDeets, pr.number)
    
    const reviewers = pr.reviews.nodes.map(r => r.node.author.login)
    for (const reviewer of reviewers) {

      const filesWhichArentOwned = getFilesNotOwnedByCodeOwner(reviewer, fileStrings)

      if (filesWhichArentOwned.length > 0) {
        core.info("Bailing because not all files were covered by the codeowners for this review")
        core.info(`Missing: ${filesWhichArentOwned.join(", ")}`)
      } else {
        await commentAndMerge(octokit, repoDeets, pr, reviewer);
      }
    }
  };
}

async function commentAndMerge (octokit, repoDeets, pr, reviewer) {
  await octokit.issues.createComment({ ...repoDeets, issue_number: pr.number, body: `Merging because @${reviewer} is a code-owner of all the changes - thanks!` });
  await octokit.pulls.merge({ ...repoDeets, pull_number: pr.number });
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

// If you have more than 100 approved + open PRs, you're welcome to make this paginate
const searchQuery = (repo) => `{
  search(first: 100, query: "repo:${repo}  is:pr is:open review:approved", type: ISSUE) {
    edges {
      node {
        ... on PullRequest {
          title
          number
          reviews(first: 10, states: APPROVED) {
            nodes {
              author {
                login
              }
            }
          }
        }
      }
    }
  }
}`


async function getPRChangedFiles(octokit, repoDeets, prNumber) {
  // https://developer.github.com/v3/pulls/#list-pull-requests-files
  const options = octokit.pulls.listFiles.endpoint.merge({...repoDeets, pull_number: prNumber });
  
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
