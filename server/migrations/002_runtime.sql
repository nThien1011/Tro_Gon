CREATE TABLE IF NOT EXISTS runtime_config (
  id TINYINT PRIMARY KEY CHECK (id=1), demoData BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;
INSERT IGNORE INTO runtime_config (id) VALUES (1);
CREATE TABLE IF NOT EXISTS login_failures (
  contactHash CHAR(64) PRIMARY KEY, attempts INT UNSIGNED NOT NULL, expiresAt DATETIME(3) NOT NULL,
  INDEX ix_login_expiry (expiresAt)
) ENGINE=InnoDB;
