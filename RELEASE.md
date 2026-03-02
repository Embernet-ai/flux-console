# Flux Console Release Process

This document describes the release process for **Flux Console**, part of the [Embernet](https://Embernet.ai) platform, powered by [Fireballz.ai](https://fireballz.ai).

**Repository:** [embernet-ai/flux-console](https://github.com/embernet-ai/flux-console)  
**Support:** [helpdesk@fireballz.ai](mailto:helpdesk@fireballz.ai)

---

## Pre-Release Checklist

1. Ensure versions are updated in:
   - `./package.json`
   - `./projects/flux-console-lib/package.json`
2. Update `release-notes.md` with a description and links to changes
3. Create a PR to the `main` branch with the above changes
4. Obtain approval and ensure all CI checks pass before merging

---

## Releasing the flux-console-lib Shared Library

1. Create a new Release in GitHub with the following format:
   - **Tag:** `flux-console-lib-vX.X.X`
   - **Release name:** `flux-console-lib-vX.X.X`
2. Copy the relevant contents from `release-notes.md` into the release description
3. Publish the release

---

## Releasing the Flux Console Application

1. Create a new Release in GitHub with the following format:
   - **Tag:** `flux-console-vX.X.X`
   - **Release name:** `flux-console-vX.X.X`
2. Copy the relevant contents from `release-notes.md` into the release description
3. Publish the release

---

## Post-Release

- Navigate to the **Actions** tab in GitHub and monitor for any failures triggered by the release
- Verify that published artifacts are available and correct

---

For questions or issues, contact [helpdesk@fireballz.ai](mailto:helpdesk@fireballz.ai).
