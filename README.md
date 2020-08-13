A GitHub action that lets code-owners merge code via GitHub issue comments.

```yml
name: Example Workflow
on:
  pull_request_target:
  issue_comment: { types: created }

jobs:
  build:

    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v1
    - name: Runs this workflow
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      uses:  orta/code-organizer-merge-on-green@master


```
