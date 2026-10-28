create index if not exists share_trading_accounts_owner_id_id_idx
  on share_trading_accounts (owner_id, id);

create index if not exists share_trading_accounts_institution_id_idx
  on share_trading_accounts (institution_id);

create index if not exists stock_import_batches_owner_id_id_idx
  on stock_import_batches (owner_id, id);
