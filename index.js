// @ts-check

const { GitHub } = require('@actions/github')
const core = require('@actions/core');
const Codeowners = require('codeowners');

async function run() {
  const octokit = new GitHub(process.env.SEARCH_GITHUB_TOKEN);
  
  // const repoDeets = { owner: github.context.repo.owner, repo: github.context.repo.repo }
  const repoDeets = { owner: "facebook", repo: "jest" }

  const query = searchQuery(`${repoDeets.owner}/${repoDeets.repo}`)
  const searchResponse = await octokit.graphql(query, {})

  for (const pr of searchResponse.search.nodes) {
    core.info(`\n\nLooking at PR: ${pr.title}`)
    
    // PR = { title: string, number: number, reviews: { nodes: { author: {login: string }[] } }
    console.log(pr)
    
    const changedFiles = await getPRChangedFiles(octokit, repoDeets, pr.number)
    console.log("Checking for "  + JSON.stringify(changedFiles))
    
    for (const review of pr.reviews.nodes) {
      const reviewer = review.author.login
          
      const hasAccessRoles = ["COLLABORATOR", "OWNER", "MEMBER"]
      const hasAccess = hasAccessRoles.includes(review.author_association)
      const filesWhichArentOwned = getFilesNotOwnedByCodeOwner(reviewer, changedFiles)
      if (hasAccess) {
        core.info(`- ${reviewer}: Skipping because they have access to merge`)
      } else if (filesWhichArentOwned.length > 0) {
        core.info(`- ${reviewer}: Bailing because not all files were covered by the codeowners for this review`)
        core.info(`  Missing: ${filesWhichArentOwned.join(", ")}`)
      } else {
        core.info(`- ${reviewer}: Accepting as needing to merge`)
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
const searchQuery = (repo) => `
query Search {
  search(first: 100, query: "repo:${repo}  is:pr is:open review:approved", type: ISSUE) {
    nodes {
      ... on PullRequest {
        title
        number
        reviews(first: 10, states: APPROVED) {
          nodes {
            authorAssociation
            author {
              login
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

// @ts-ignore
if (!module.parent) {
  try {
    run()
  } catch (error) {
    core.setFailed(error.message)
    throw error
  }
}

process.on('uncaughtException', function (error) {
  core.setFailed(error.message)
})


module.exports = {
  getFilesNotOwnedByCodeOwner,
}
