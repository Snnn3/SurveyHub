# Issue #24: Release persistence and rollback evidence

**Observed:** 2026-11-22 (UTC)  
**Service:** [SurveyHub demo](https://s7c512824-4d7hbszvwq-as.a.run.app)  
**Evidence fixture:** one synthetic survey and response; no credentials or personal data are recorded.

## Reviewed release path

- Feature change: [PR #52](https://github.com/Snnn3/SurveyHub/pull/52), merged into `cloud-staging` at `31c19ead6d249752ffc2ac96039594a2bef30b08`. [Staging CI run #45002527391](https://github.com/Snnn3/SurveyHub/actions/runs/45002527391) passed.
- Release: [PR #53](https://github.com/Snnn3/SurveyHub/pull/53), approved and merged from `cloud-staging` to `main` at `32787b85499a2860ba5ba9093d254f03d325dfc5`.
- [Release B run #45004438708](https://github.com/Snnn3/SurveyHub/actions/runs/45004438708) passed CI, E2E, image build, migration, deploy, and public smoke checks. Migration execution `s7c512824-migrate-xxz7d` completed at 08:51:32.260496 UTC, before revision `s7c512824-00008-m4w` received traffic at 08:51:47.7099598 UTC.

## Persistence exercise

The table records the source commit, immutable Artifact Registry OCI index digest, the Linux amd64 image manifest Cloud Run used, revision, and the workflow for each step. Each receipt request returned HTTP `200` with response ID `7be3b23f-0795-4a14-81bb-37e89b0e00ea`, survey ID `a3f734ec-9e19-458b-ba65-0f6ceaebb24b`, submission time `2026-11-22T08:04:14.937Z`, and one saved answer. Health returned HTTP `200` with `database: up`.

| Step | Source commit | Image index digest | Linux amd64 manifest digest | Revision at 100% traffic | Workflow and receipt observation (UTC) |
|---|---|---|---|---|---|
| Release A baseline before B | `73e576ea718f57dfb91535006a442011cf8974a8` | `sha256:6756d5858b8aef01a105db977302f4763be67a331328beaeeea46ebec1f57ded` | `sha256:fdbfd9f844b37f36873cb993ced06e3cd24db148e5c61b46ce1def29a7f38d6c` | `s7c512824-00006-s5d` | [#45001744637](https://github.com/Snnn3/SurveyHub/actions/runs/45001744637); 08:14:20.879 |
| Release B | `32787b85499a2860ba5ba9093d254f03d325dfc5` | `sha256:e8194685914e6e3a299658710016043b044e355589480e973737bb24901c944c` | `sha256:72c56f73bbc1ba1c010b5c530c7931ed9589bb969bdd39946f530d01fc4c1e3d` | `s7c512824-00008-m4w` | [#45004438708](https://github.com/Snnn3/SurveyHub/actions/runs/45004438708); 08:53:16.585 |
| Rollback to A | `73e576ea718f57dfb91535006a442011cf8974a8` | `sha256:6756d5858b8aef01a105db977302f4763be67a331328beaeeea46ebec1f57ded` | `sha256:fdbfd9f844b37f36873cb993ced06e3cd24db148e5c61b46ce1def29a7f38d6c` | `s7c512824-00009-4cg` | [#45004908880](https://github.com/Snnn3/SurveyHub/actions/runs/45004908880); 08:54:41.528 |
| Roll forward to B (final) | `32787b85499a2860ba5ba9093d254f03d325dfc5` | `sha256:e8194685914e6e3a299658710016043b044e355589480e973737bb24901c944c` | `sha256:72c56f73bbc1ba1c010b5c530c7931ed9589bb969bdd39946f530d01fc4c1e3d` | `s7c512824-00010-mwj` | [#45005017118](https://github.com/Snnn3/SurveyHub/actions/runs/45005017118); 08:58:19.750 |

The A baseline was deliberately re-established immediately before the new B release by running the original A image. The synthetic response was created after A's original deployment, so its presence during that historical deployment is not claimed. The new baseline run and all three later receipt checks returned the same fixture.

A Git comparison of the exact A and B commits showed no Prisma schema or migration files changed between them ([compare](https://github.com/Snnn3/SurveyHub/compare/73e576ea718f57dfb91535006a442011cf8974a8...32787b85499a2860ba5ba9093d254f03d325dfc5)). Release B's migration completed before updating the service. The rollback to A and roll forward to B each used the existing image-only workflow, skipped migrations, and passed the public smoke checks. No reverse migration was run.

## Final live verification

At 08:58:19.750 UTC on 2026-11-22, a read-only Cloud Run check confirmed that revision `s7c512824-00010-mwj` received 100% traffic, used the Release B Linux amd64 digest above, and served the `Lab 5 Deployment Demo` footer. The authenticated receipt and database health checks returned:

```json
{
  "revision": "s7c512824-00010-mwj",
  "traffic": 100,
  "image": "asia-southeast1-docker.pkg.dev/cpe-se-course-2026/s7c512824/s7c512824@sha256:72c56f73bbc1ba1c010b5c530c7931ed9589bb969bdd39946f530d01fc4c1e3d",
  "appFooterSource": "Lab 5 Deployment Demo"
}
{
  "receipt": 200,
  "responseId": "7be3b23f-0795-4a14-81bb-37e89b0e00ea",
  "surveyId": "a3f734ec-9e19-458b-ba65-0f6ceaebb24b",
  "submittedAt": "2026-11-22T08:04:14.937Z",
  "answerCount": 1,
  "health": 200,
  "observedAt": "2026-11-22T08:58:19.750Z"
}
```

These checks used the public app and the existing demo respondent login flow. Passwords, bearer tokens, secret values, and account owner details were not written to the repository.
