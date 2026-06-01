-- scripts/grants.sql
-- UC grants the App SP needs to read demo data. envsubst fills ${APP_SP_ID}.
GRANT USE CATALOG ON CATALOG jdub_demo TO `${APP_SP_ID}`
GRANT USE SCHEMA  ON SCHEMA  jdub_demo.lakehouse_market TO `${APP_SP_ID}`
GRANT SELECT      ON SCHEMA  jdub_demo.lakehouse_market TO `${APP_SP_ID}`
