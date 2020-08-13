A GitHub action that lets code-owners merge PRs via a comment.

This action uses the standardized structure of [a CODEOWNERS file](https://github.blog/2017-07-06-introducing-code-owners/) to handle the access controls. 

## A simple example

So, with this file at: `.github/CODEOWNERS`:

```sh
README.md @orta
```

If a PR contained _only_ a change to the `README.md` - this action would say that "@orta has the ability to merge by commenting 'LGTM'".

Then, when/if this happens the GitHub Action will merge for you.

## A real-world example

`.github/CODEOWNERS`:

```sh
# Collaborators for Japanese Translation of the Website
packages/playground-examples/copy/ja/** @sasurau4 @Quramy @Naturalclar @Takepepe @orta
packages/tsconfig-reference/copy/ja/** @sasurau4 @Quramy @Naturalclar @Takepepe @orta
packages/typescriptlang-org/src/copy/ja/** @sasurau4 @Quramy @Naturalclar @Takepepe @orta
packages/documentation/copy/ja/** @sasurau4 @Quramy @Naturalclar @Takepepe @orta
```

This allows any of `@sasurau4`, `@Quramy`,  `@Naturalclar`, `@Takepepe` or `@orta` to merge PRs which affect their areas of the translation process in the TypeScript Website repo.

## Setting It Up

You want a unique workflow file, e.g. `.github/workflows/codeowners-merge.yml`

```yml
name: Codeowners merging
on:
  pull_request_target:
  issue_comment: { types: created }

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v1
      - name: Run Codeowners merge check
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        uses:  orta/code-owner-self-merge@v1
```

Then you should be good to go.

### Security

We force the use of [`pull_request_target`](https://github.blog/2020-08-03-github-actions-improvements-for-fork-and-pull-request-workflows/) as a workflow event to ensure that someone cannot change the CODEOWNER files at the same time as having that change be used to validate if they can merge.
