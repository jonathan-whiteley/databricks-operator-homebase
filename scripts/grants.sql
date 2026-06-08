-- scripts/grants.sql
-- UC grants the App SP needs to read demo data.
-- envsubst fills ${APP_SP_ID}, ${LHM_CATALOG}, ${LHM_SCHEMA}.
GRANT USE CATALOG ON CATALOG ${LHM_CATALOG} TO `${APP_SP_ID}`
GRANT USE SCHEMA  ON SCHEMA  ${LHM_CATALOG}.${LHM_SCHEMA} TO `${APP_SP_ID}`
GRANT SELECT      ON SCHEMA  ${LHM_CATALOG}.${LHM_SCHEMA} TO `${APP_SP_ID}`
