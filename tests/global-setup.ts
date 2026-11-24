import pg from "pg";
import { migrate } from "../scripts/migrate";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://sc:sc@127.0.0.1:5432/swisschalets_test";
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await c.end();
  await migrate(url);
}
