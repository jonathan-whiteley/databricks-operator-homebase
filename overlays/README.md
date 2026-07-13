# Workspace overlays

`app.yaml` and `resources/app.yml` at the repo root are not subject to DAB
target overrides — they're plain files included in the bundle as-is. So
when a target needs workspace-specific values (a different catalog/schema,
a different Lakebase auth path, different `/apps` launcher URLs), we keep
a full copy here and the deployer swaps it in before invoking setup.sh.

The repo root currently holds the **fevm** (DEFAULT-workspace) config.
Overlays for other workspaces live under `overlays/<target>/`.

## Available overlays

- `overlays/dais/app.yaml`            → copy over `/app.yaml`
- `overlays/dais/resources-app.yml`   → copy over `/resources/app.yml`

## Deploying to dais

```bash
cp overlays/dais/app.yaml app.yaml
cp overlays/dais/resources-app.yml resources/app.yml

LHM_CATALOG=retail_consumer_goods \
LHM_SCHEMA=tth_ops_homebase \
DAB_TARGET=dais \
bash scripts/setup.sh

# When done, restore the fevm-flavoured root files:
git checkout HEAD -- app.yaml resources/app.yml
```

The dais Lakebase needs a one-time manual provisioning step (Postgres role
for the App SP with `databricks_superuser` membership) before the first
deploy — see the lengthy comments in `overlays/dais/app.yaml` and
`overlays/dais/resources-app.yml` for the why. After that, deploys are
just the copy + setup.sh dance.
