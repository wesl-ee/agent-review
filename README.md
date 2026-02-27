agent-review
============

Locally review code from a coding agent before committing upstream. Enables
infinite **human-in-the-loop** iteration over agent-produced code for better
code overall :)

![agent-review ui](./img/readme-1.jpeg)

Prerequisites
-------------

Ensure these packages / daemons are installed locally:

- node + npm + typescript
- Docker daemon + cli
- git

Installation
------------

Preferred (npm):

```bash
npm install -g agent-review
agent-review --help
```

From source:

```
git clone git@github.com:wesl-ee/agent-review.git
cd agent-review
npm install
npm link

# verify
agent-review --help
```

Release flow (npm + git tag):

```bash
npm version patch   # or minor/major
git push --follow-tags
npm publish
```

Workflow
--------

Below is a snippet from my AGENTS.MD file. Tailor to your needs.

```
## agent-review
- use if I request to review your code. to start: agent-review trigger . provide the URL
- to review / reply: agent-review comments <review-id>, agent-review resolve <review-id> <comment-id>
```

LICENSE
-------

MIT License (available under `/LICENSE`)
