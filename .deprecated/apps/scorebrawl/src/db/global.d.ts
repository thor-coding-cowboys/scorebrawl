export type {};

declare global {
  var dbCache: PostgresJsDatabase<typeof schema>;
}
