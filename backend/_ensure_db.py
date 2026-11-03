# -*- coding: utf-8 -*-
"""确保数据库存在且 schema 与代码一致（旧版 database.sqlite 缺 item_limit 会导致 500）"""
import os
import sqlite3
import sys

DB = os.path.join("data", "database.sqlite")
NEEDED = {
    "users_summary": {"item_limit", "ads_watched_count", "last_ad_watched_at"},
    "bags_summary": {"user_id"},
    "items_detail": {"user_id", "box_id", "bag_id", "image_filename"},
}


def columns(conn, table):
    try:
        return {r[1] for r in conn.execute("PRAGMA table_info('%s')" % table)}
    except sqlite3.Error:
        return set()


def main():
    os.makedirs("data", exist_ok=True)
    stale = False
    if os.path.exists(DB):
        try:
            conn = sqlite3.connect(DB)
            for table, need in NEEDED.items():
                have = columns(conn, table)
                missing = need - have
                if missing:
                    stale = True
                    print("  schema outdated: %s missing %s" % (table, sorted(missing)))
            conn.close()
        except sqlite3.Error as e:
            stale = True
            print("  cannot open database: %s" % e)

    if stale:
        bak = DB + ".old"
        if os.path.exists(bak):
            os.remove(bak)
        os.rename(DB, bak)
        print("  old database moved to %s" % bak)

    if not os.path.exists(DB):
        from db_init import DatabaseInitializer
        DatabaseInitializer(DB).create_database()
        print("  database created: %s" % DB)
    else:
        print("  database ok: %s" % DB)


if __name__ == "__main__":
    main()
