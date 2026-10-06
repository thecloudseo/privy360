import {
  assertSameTenantContext,
  TenantContextDeniedError,
  type TrustedTenantContext,
} from "./tenant-context.ts";

export type TenantSqlExecutor = {
  query(sql: string, parameters: readonly unknown[]): Promise<unknown>;
};

export type TenantTransactionDatabase<TTransaction extends TenantSqlExecutor> =
  {
    transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  };

export async function withTenantTransaction<
  TTransaction extends TenantSqlExecutor,
  TResult,
>(
  database: TenantTransactionDatabase<TTransaction>,
  context: TrustedTenantContext | undefined,
  work: (transaction: TTransaction) => Promise<TResult>,
  parentContext?: TrustedTenantContext,
): Promise<TResult> {
  if (!context) throw new TenantContextDeniedError();
  assertSameTenantContext(parentContext, context);
  return database.transaction(async (transaction) => {
    await transaction.query(
      "select set_config('privy360.tenant_id', $1, true)",
      [context.tenantId],
    );
    return work(transaction);
  });
}
