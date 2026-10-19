#!/bin/sh
set -eu
# Restrict generated app passwords to characters safe in this one-time SQL script.
case "$MYSQL_APP_PASSWORD" in
  ''|*[!A-Za-z0-9_-]*) echo 'APP_DB_PASSWORD must use only letters, digits, _ or -' >&2; exit 1;;
esac
if [ "${#MYSQL_APP_PASSWORD}" -lt 32 ]; then echo 'APP_DB_PASSWORD must have at least 32 characters' >&2; exit 1; fi
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<EOSQL
CREATE USER 'trogon_app'@'%' IDENTIFIED BY '$MYSQL_APP_PASSWORD';
GRANT SELECT,INSERT,UPDATE,DELETE ON trogon.* TO 'trogon_app'@'%';
EOSQL
