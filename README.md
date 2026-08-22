# DocuMind Agent

A small, read-only AI agent that diagnoses problems in the DocuMind cluster.
Ask it a plain-English question about the app's health; it decides which
real Kubernetes tools to call, runs them against the live cluster, and
answers based on what it actually found. Part of the
[DocuMind platform](https://github.com/qezman/DocuMind-Infrastructure); see that
repo's README for the full system overview and architecture.

## Stack

Fastify + TypeScript on Node 22, Gemini for function-calling.

## What's here

- **routes/diagnose.ts** - the tool-calling loop. Sends the question to
  Gemini with four available tools, executes whichever ones it picks, feeds
  the results back, and repeats (up to 5 turns) until it has an answer.
- **tools/k8s.ts** - the actual tools: `listPods`, `getPodLogs`,
  `describePod` (all via `kubectl`), and `queryLoki` (direct HTTP query
  against Loki). Every function here is a read - there's no write, delete,
  or restart tool for the model to call, and pod names are validated
  against Kubernetes' naming rules before they ever reach a shell command.

## Why read-only matters

The agent's Kubernetes RBAC role (`documind-gitops/manifests/agent/rbac.yaml`)
only grants `get`/`list` on `pods` and `pods/log` in one namespace - nothing
else. Even if the model picks a bad tool or gets confused, the worst case is
a wrong diagnosis, not a damaged cluster. It reports; a human still acts.

## Local dev

```bash
pnpm install
export GEMINI_API_KEY=...
pnpm dev   # tsx watch, needs a working kubeconfig for kubectl calls to work
```

## Deploy

`.github/workflows/deploy.yml` builds the Docker image on every push to
`main`, authenticates to AWS via GitHub OIDC (no stored credentials), pushes
to ECR, then patches the image tag into `documind-gitops`'s
`manifests/agent/deployment.yaml`. Unlike backend/frontend this ships as a
plain `Deployment`, not an Argo Rollouts canary - it's internal-only and
runs a single replica, so a staged rollout wouldn't mean much.
