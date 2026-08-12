CREATE TYPE "ExchangeStatus" AS ENUM ('CREATED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('NEW', 'PROCESS', 'UNDERPAID', 'SUCCESS', 'OVERPAID', 'FAIL');

CREATE TABLE "exchange_orders" (
  "id" TEXT NOT NULL,
  "direction" TEXT,
  "amount" DECIMAL(18,8) NOT NULL,
  "from_currency" TEXT NOT NULL,
  "to_currency" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "contact" TEXT,
  "from_account" TEXT,
  "payment_id" TEXT,
  "payment_url" TEXT,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'NEW',
  "exchange_status" "ExchangeStatus" NOT NULL DEFAULT 'CREATED',
  "to_amount" DECIMAL(30,12) NOT NULL,
  "idempotency_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exchange_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "amount" DECIMAL(18,8) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'NEW',
  "external_id" TEXT,
  "raw_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admins" (
  "id" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'admin',
  "permissions" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "from" "ExchangeStatus",
  "to" "ExchangeStatus" NOT NULL,
  "actor" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exchange_orders_payment_id_key" ON "exchange_orders"("payment_id");
CREATE UNIQUE INDEX "exchange_orders_idempotency_hash_key" ON "exchange_orders"("idempotency_hash");
CREATE INDEX "exchange_orders_exchange_status_idx" ON "exchange_orders"("exchange_status");
CREATE INDEX "exchange_orders_payment_status_idx" ON "exchange_orders"("payment_status");
CREATE INDEX "exchange_orders_created_at_idx" ON "exchange_orders"("created_at");
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");
CREATE UNIQUE INDEX "payments_external_id_key" ON "payments"("external_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE UNIQUE INDEX "admins_login_key" ON "admins"("login");
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "exchange_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "exchange_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
