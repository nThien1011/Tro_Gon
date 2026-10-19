CREATE TABLE IF NOT EXISTS app_state (
  id TINYINT PRIMARY KEY CHECK (id = 1), version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  siteName VARCHAR(300) NOT NULL DEFAULT 'TrọGọn', supportEmail VARCHAR(254) NOT NULL DEFAULT '',
  electricityRate BIGINT UNSIGNED NOT NULL DEFAULT 3500,
  waterRate BIGINT UNSIGNED NOT NULL DEFAULT 18000, serviceFee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  maintenance BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;
INSERT IGNORE INTO app_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(300) NOT NULL,
  email VARCHAR(254) NULL, phone VARCHAR(20) NULL,
  role ENUM('admin','owner','tenant') NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar VARCHAR(600) NULL, bankBin VARCHAR(6) NULL, bankAccount VARCHAR(25) NULL, bankName VARCHAR(150) NULL,
  emailVerified BOOLEAN NOT NULL DEFAULT FALSE, phoneVerified BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_user_email (email), UNIQUE KEY uq_user_phone (phone),
  CONSTRAINT ck_user_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS credentials (
  userId VARCHAR(64) PRIMARY KEY, salt VARCHAR(128) NOT NULL, hash VARCHAR(256) NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS buildings (
  id VARCHAR(64) PRIMARY KEY, ownerId VARCHAR(64) NOT NULL, name VARCHAR(300) NOT NULL,
  address VARCHAR(300) NOT NULL, area VARCHAR(200) NOT NULL, city VARCHAR(200) NOT NULL,
  cityCode VARCHAR(10) NULL, districtCode VARCHAR(10) NULL, wardCode VARCHAR(10) NULL,
  district VARCHAR(200) NULL, ward VARCHAR(200) NULL,
  lat DOUBLE NULL, lng DOUBLE NULL, description TEXT NOT NULL,
  FOREIGN KEY (ownerId) REFERENCES users(id), INDEX ix_building_owner (ownerId),
  INDEX ix_building_region (cityCode,districtCode,wardCode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY, buildingId VARCHAR(64) NOT NULL, name VARCHAR(80) NOT NULL,
  area DECIMAL(12,3) NOT NULL CHECK (area > 0), capacity INT UNSIGNED NOT NULL CHECK (capacity > 0),
  rent BIGINT UNSIGNED NOT NULL, electricityRate BIGINT UNSIGNED NOT NULL, waterRate BIGINT UNSIGNED NOT NULL,
  serviceFee BIGINT UNSIGNED NOT NULL, deposit BIGINT UNSIGNED NOT NULL,
  electricity DECIMAL(18,3) NOT NULL CHECK (electricity >= 0), water DECIMAL(18,3) NOT NULL CHECK (water >= 0),
  status ENUM('available','occupied','maintenance') NOT NULL, amenities JSON NOT NULL, images JSON NOT NULL,
  FOREIGN KEY (buildingId) REFERENCES buildings(id), UNIQUE KEY uq_room_name (buildingId,name),
  INDEX ix_room_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS listings (
  id VARCHAR(64) PRIMARY KEY, roomId VARCHAR(64) NOT NULL, title VARCHAR(180) NOT NULL, description TEXT NOT NULL,
  status ENUM('draft','pending','published','rejected','hidden') NOT NULL,
  createdAt VARCHAR(32) NOT NULL, reason VARCHAR(300) NULL,
  FOREIGN KEY (roomId) REFERENCES rooms(id), UNIQUE KEY uq_listing_room (roomId), INDEX ix_listing_status (status,createdAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenancies (
  id VARCHAR(64) PRIMARY KEY, roomId VARCHAR(64) NOT NULL, tenantId VARCHAR(64) NOT NULL,
  startDate DATE NOT NULL, endDate DATE NOT NULL, active BOOLEAN NOT NULL,
  people INT UNSIGNED NOT NULL CHECK (people > 0), note TEXT NOT NULL,
  activeRoom VARCHAR(64) GENERATED ALWAYS AS (IF(active,roomId,NULL)) STORED,
  activeTenant VARCHAR(64) GENERATED ALWAYS AS (IF(active,tenantId,NULL)) STORED,
  UNIQUE KEY uq_active_room (activeRoom), UNIQUE KEY uq_active_tenant (activeTenant),
  FOREIGN KEY (roomId) REFERENCES rooms(id), FOREIGN KEY (tenantId) REFERENCES users(id),
  CONSTRAINT ck_tenancy_dates CHECK (endDate >= startDate)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY, roomId VARCHAR(64) NOT NULL, tenantId VARCHAR(64) NOT NULL,
  tenantName VARCHAR(300) NULL, roomName VARCHAR(80) NULL, buildingName VARCHAR(300) NULL,
  period CHAR(7) NOT NULL, oldElectricity DECIMAL(18,3) NOT NULL, newElectricity DECIMAL(18,3) NOT NULL,
  oldWater DECIMAL(18,3) NOT NULL, newWater DECIMAL(18,3) NOT NULL,
  electricityRate BIGINT UNSIGNED NOT NULL, waterRate BIGINT UNSIGNED NOT NULL,
  rent BIGINT UNSIGNED NOT NULL, serviceFee BIGINT UNSIGNED NOT NULL,
  electricityPhoto VARCHAR(600) NULL, waterPhoto VARCHAR(600) NULL,
  status ENUM('draft','issued','cancelled') NOT NULL,
  paymentStatus ENUM('unpaid','pending','paid') NOT NULL, paymentNote VARCHAR(500) NULL,
  createdAt VARCHAR(32) NOT NULL, dueDate DATE NOT NULL, paidAt VARCHAR(32) NULL,
  bankBin VARCHAR(6) NULL, bankAccount VARCHAR(25) NULL, bankName VARCHAR(150) NULL,
  openPeriod CHAR(7) GENERATED ALWAYS AS (IF(status <> 'cancelled',period,NULL)) STORED,
  UNIQUE KEY uq_invoice_period (roomId,openPeriod),
  FOREIGN KEY (roomId) REFERENCES rooms(id), FOREIGN KEY (tenantId) REFERENCES users(id),
  CONSTRAINT ck_invoice_meters CHECK (newElectricity >= oldElectricity AND newWater >= oldWater),
  INDEX ix_invoice_tenant (tenantId), INDEX ix_invoice_payment (paymentStatus)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(64) PRIMARY KEY, listingId VARCHAR(64) NOT NULL, tenantId VARCHAR(64) NOT NULL,
  date VARCHAR(32) NOT NULL, note TEXT NOT NULL, status ENUM('pending','confirmed','completed','cancelled') NOT NULL,
  FOREIGN KEY (listingId) REFERENCES listings(id), FOREIGN KEY (tenantId) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rental_requests (
  id VARCHAR(64) PRIMARY KEY, roomId VARCHAR(64) NOT NULL, tenantId VARCHAR(64) NOT NULL,
  date DATE NOT NULL, people INT UNSIGNED NOT NULL CHECK (people > 0), note TEXT NOT NULL,
  status ENUM('pending','accepted','rejected','cancelled','completed') NOT NULL,
  openRoom VARCHAR(64) GENERATED ALWAYS AS (IF(status IN ('pending','accepted'),roomId,NULL)) STORED,
  UNIQUE KEY uq_open_request (tenantId,openRoom),
  FOREIGN KEY (roomId) REFERENCES rooms(id), FOREIGN KEY (tenantId) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY, listingId VARCHAR(64) NOT NULL, ownerId VARCHAR(64) NOT NULL, tenantId VARCHAR(64) NOT NULL,
  FOREIGN KEY (listingId) REFERENCES listings(id), FOREIGN KEY (ownerId) REFERENCES users(id), FOREIGN KEY (tenantId) REFERENCES users(id),
  UNIQUE KEY uq_conversation (listingId,tenantId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY, conversationId VARCHAR(64) NOT NULL, senderId VARCHAR(64) NOT NULL,
  body TEXT NOT NULL, createdAt VARCHAR(32) NOT NULL,
  FOREIGN KEY (conversationId) REFERENCES conversations(id), FOREIGN KEY (senderId) REFERENCES users(id),
  INDEX ix_messages_conversation (conversationId,createdAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(64) PRIMARY KEY, authorId VARCHAR(64) NOT NULL, roomId VARCHAR(64) NULL,
  title VARCHAR(300) NOT NULL, content TEXT NOT NULL, category ENUM('repair','report') NOT NULL,
  status ENUM('open','in_progress','resolved') NOT NULL, createdAt VARCHAR(32) NOT NULL, response TEXT NULL,
  FOREIGN KEY (authorId) REFERENCES users(id), FOREIGN KEY (roomId) REFERENCES rooms(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS favorites (
  userId VARCHAR(64) NOT NULL, listingId VARCHAR(64) NOT NULL, PRIMARY KEY (userId,listingId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (listingId) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY, actorId VARCHAR(64) NOT NULL, action VARCHAR(100) NOT NULL, createdAt VARCHAR(32) NOT NULL,
  FOREIGN KEY (actorId) REFERENCES users(id), INDEX ix_audit_date (createdAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  tokenHash CHAR(64) PRIMARY KEY, userId VARCHAR(64) NOT NULL,
  expiresAt DATETIME(3) NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE, INDEX ix_session_expiry (expiresAt), INDEX ix_session_user (userId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  userId VARCHAR(64) NOT NULL, requestKey VARCHAR(80) NOT NULL, requestHash CHAR(64) NOT NULL,
  response JSON NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(userId,requestKey), FOREIGN KEY(userId) REFERENCES users(id), INDEX ix_idempotency_date(createdAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media (
  id CHAR(36) PRIMARY KEY, ownerId VARCHAR(64) NOT NULL, filename VARCHAR(80) NOT NULL,
  mimeType VARCHAR(40) NOT NULL, size INT UNSIGNED NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (ownerId) REFERENCES users(id), INDEX ix_media_owner(ownerId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_challenges (
  id CHAR(36) PRIMARY KEY, userId VARCHAR(64) NOT NULL,
  purpose ENUM('verify_email','verify_phone','reset_password') NOT NULL, contact VARCHAR(254) NOT NULL,
  codeHash CHAR(64) NOT NULL, attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expiresAt DATETIME(3) NOT NULL, usedAt DATETIME(3) NULL,
  FOREIGN KEY(userId) REFERENCES users(id), INDEX ix_challenge_user(userId,purpose), INDEX ix_challenge_expiry(expiresAt)
) ENGINE=InnoDB;
