ALTER TABLE rooms
  ADD COLUMN electricityBillingMode ENUM('metered','fixed') NOT NULL DEFAULT 'metered',
  ADD COLUMN waterBillingMode ENUM('metered','fixed') NOT NULL DEFAULT 'metered',
  ADD COLUMN electricityMonthlyFee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN waterMonthlyFee BIGINT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE invoices
  ADD COLUMN electricityBillingMode ENUM('metered','fixed') NOT NULL DEFAULT 'metered',
  ADD COLUMN waterBillingMode ENUM('metered','fixed') NOT NULL DEFAULT 'metered',
  ADD COLUMN electricityMonthlyFee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN waterMonthlyFee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN electricityReadingId VARCHAR(64) NULL,
  ADD COLUMN waterReadingId VARCHAR(64) NULL;

CREATE TABLE notifications (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64) NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(300) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  href VARCHAR(500) NOT NULL,
  createdAt VARCHAR(30) NOT NULL,
  readAt VARCHAR(30) NULL,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX ix_notifications_user_created (userId, createdAt),
  INDEX ix_notifications_unread (userId, readAt)
) ENGINE=InnoDB;

CREATE TABLE meter_readings (
  id VARCHAR(64) PRIMARY KEY,
  roomId VARCHAR(64) NOT NULL,
  tenancyId VARCHAR(64) NOT NULL,
  tenantId VARCHAR(64) NOT NULL,
  submittedBy VARCHAR(64) NOT NULL,
  kind ENUM('electricity','water') NOT NULL,
  period VARCHAR(7) NOT NULL,
  previous DECIMAL(15,3) UNSIGNED NOT NULL,
  value DECIMAL(15,3) UNSIGNED NOT NULL,
  photo VARCHAR(600) NOT NULL,
  ocrValue DECIMAL(15,3) UNSIGNED NULL,
  ocrConfidence DECIMAL(5,2) UNSIGNED NULL,
  ocrText VARCHAR(500) NULL,
  status ENUM('pending','accepted','rejected','superseded') NOT NULL DEFAULT 'pending',
  createdAt VARCHAR(30) NOT NULL,
  reviewedAt VARCHAR(30) NULL,
  reviewedBy VARCHAR(64) NULL,
  reason VARCHAR(500) NULL,
  acceptedKey VARCHAR(160) GENERATED ALWAYS AS (CASE WHEN status='accepted' THEN CONCAT(roomId, ':', period, ':', kind) ELSE NULL END) STORED,
  UNIQUE KEY uq_meter_accepted (acceptedKey),
  FOREIGN KEY (roomId) REFERENCES rooms(id),
  FOREIGN KEY (tenancyId) REFERENCES tenancies(id),
  FOREIGN KEY (tenantId) REFERENCES users(id),
  FOREIGN KEY (submittedBy) REFERENCES users(id),
  FOREIGN KEY (reviewedBy) REFERENCES users(id),
  INDEX ix_meter_room_period (roomId, period, kind),
  INDEX ix_meter_tenant (tenantId),
  CONSTRAINT ck_meter_order CHECK (value >= previous),
  CONSTRAINT ck_ocr_confidence CHECK (ocrConfidence <= 100)
) ENGINE=InnoDB;
