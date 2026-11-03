# -*- coding: utf-8 -*-
"""确保数据库存在，并把旧库就地迁移到当前 schema（无损：只做 ADD COLUMN，不删数据）。

历史问题：仓库自带的 data/database.sqlite 是旧 schema，缺 users_summary.item_limit
→ 接口报 500 no such column: item_limit。早期版本的处理是"改名旧库 + 重建空库"，
会丢数据；现在改为 ALTER TABLE ADD COLUMN 就地补齐，并且每次启动都幂等执行。
"""
import os
import sqlite3
import sys

DB = os.path.join("data", "database.sqlite")

# 表 -> [(列名, 列定义)]，顺序即补列顺序；已存在的列会被跳过
COLUMNS = {
    "users_summary": [
        # 列定义与 db_init 保持一致（可空性不一致会触发不必要的表重建）
        ("item_limit", "INTEGER DEFAULT 30"),
        ("ads_watched_count", "INTEGER DEFAULT 0"),
        ("last_ad_watched_at", "DATETIME DEFAULT NULL"),
    ],
    "bags_summary": [
        ("user_id", "INTEGER DEFAULT NULL"),
    ],
    "items_detail": [
        # 上游原始列（旧库可能缺）
        ("user_id", "INTEGER DEFAULT NULL"),
        ("box_id", "INTEGER DEFAULT NULL"),
        ("bag_id", "INTEGER DEFAULT NULL"),
        ("sort_id", "INTEGER NOT NULL DEFAULT 0"),
        ("description", "TEXT DEFAULT ''"),
        ("category", "VARCHAR(100) DEFAULT ''"),
        ("image_filename", "VARCHAR(255) DEFAULT ''"),
        # ===== 舍得 (shede) 决策层 v0.2.0 =====
        ("status", "TEXT NOT NULL DEFAULT 'pending'"),
        ("usage_answer", "TEXT DEFAULT NULL"),
        ("rebuy_answer", "TEXT DEFAULT NULL"),
        ("replace_answer", "TEXT DEFAULT NULL"),
        ("emotion_answer", "TEXT DEFAULT NULL"),
        ("ai_verdict", "TEXT DEFAULT NULL"),
        ("ai_score", "INTEGER DEFAULT NULL"),
        ("ai_reason", "TEXT DEFAULT NULL"),
        ("ai_dims", "TEXT DEFAULT NULL"),
        ("decision", "TEXT DEFAULT NULL"),
        ("decided_at", "TEXT DEFAULT NULL"),
        ("observe_until", "TEXT DEFAULT NULL"),
        ("observe_used_count", "INTEGER NOT NULL DEFAULT 0"),
        ("last_used_at", "TEXT DEFAULT NULL"),
        ("dispose_channel", "TEXT DEFAULT NULL"),
        ("dispose_suggest", "TEXT DEFAULT NULL"),
        ("disposed_at", "TEXT DEFAULT NULL"),
    ],
}

INDEXES = [
    ("idx_items_status", "items_detail(user_id, status)"),
    ("idx_items_observe", "items_detail(status, observe_until)"),
]


def columns(conn, table):
    try:
        return {r[1] for r in conn.execute("PRAGMA table_info('%s')" % table)}
    except sqlite3.Error:
        return set()


def target_schema():
    """用一个临时空库拿到 db_init 定义的最新 schema（列可空性 / DDL / 索引）。"""
    import contextlib
    import io
    import re
    import tempfile
    from db_init import DatabaseInitializer

    tmpdir = tempfile.mkdtemp(prefix="shede_schema_")
    tmp_db = os.path.join(tmpdir, "schema.sqlite")
    with contextlib.redirect_stdout(io.StringIO()):      # 静默 db_init 的建表日志
        DatabaseInitializer(tmp_db).create_database()
    conn = sqlite3.connect(tmp_db)
    try:
        out = {}
        for (table,) in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
            info = list(conn.execute("PRAGMA table_info('%s')" % table))
            out[table] = {
                # name -> {nn: 1=NOT NULL, dflt: 默认值字面量, type: 声明类型}
                "cols": {r[1]: {"nn": r[3], "dflt": r[4], "type": (r[2] or "").upper()}
                         for r in info},
                "order": [r[1] for r in info],
                "ddl": conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                    (table,)).fetchone()[0],
                "indexes": [r[0] for r in conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? "
                    "AND sql IS NOT NULL", (table,))],
            }
    finally:
        conn.close()
    return out


def relax_not_null(conn, target, table):
    """重建表：① 把"目标 schema 允许为空、旧库却是 NOT NULL"的列放开；
    ② 反过来，旧库可空而目标 NOT NULL 的列（如 user_id），搬数据时补默认值。"""
    cur = list(conn.execute("PRAGMA table_info('%s')" % table))
    if not cur:
        return False
    have = {r[1]: r[3] for r in cur}          # name -> notnull
    tgt = target.get(table)
    if not tgt:
        return False

    relax = [c for c, meta in tgt["cols"].items() if meta["nn"] == 0 and have.get(c) == 1]
    tighten = [c for c, meta in tgt["cols"].items() if meta["nn"] == 1 and have.get(c) == 0]
    if not relax:
        return False            # 没有要放开的约束就不重建（tighten 只在重建时顺手处理）

    import re
    new = table + "__new"
    ddl_new = re.sub(r"CREATE TABLE\s+(IF NOT EXISTS\s+)?%s\s*\(" % re.escape(table),
                     "CREATE TABLE %s (" % new, tgt["ddl"], count=1, flags=re.I)
    cols = [c for c in tgt["order"] if c in have]      # 只搬两边都有的列
    # 目标 NOT NULL 但旧表可空的列 → COALESCE 到目标默认值，避免重建时 NOT NULL 报错
    exprs = []
    for c in cols:
        meta = tgt["cols"][c]
        if meta["nn"] == 1 and have.get(c, 0) == 0:
            lit = meta["dflt"] if meta["dflt"] is not None else (
                "0" if meta["type"].startswith("INT") else "''")
            exprs.append("COALESCE(%s, %s)" % (c, lit))
        else:
            exprs.append(c)

    conn.execute("PRAGMA foreign_keys=OFF")
    conn.execute('DROP TABLE IF EXISTS "%s"' % new)     # 上次中断留下的半成品
    conn.execute(ddl_new)
    conn.execute("INSERT INTO %s (%s) SELECT %s FROM %s"
                 % (new, ",".join(cols), ",".join(exprs), table))
    conn.execute("DROP TABLE %s" % table)
    conn.execute("ALTER TABLE %s RENAME TO %s" % (new, table))
    for sql in tgt["indexes"]:
        conn.execute(sql)
    conn.commit()
    nn_cols = [c for c in cols if tgt["cols"][c]["nn"] == 1]
    left = 0
    if nn_cols:
        left = conn.execute(
            "SELECT count(*) FROM %s WHERE %s"
            % (table, " OR ".join("%s IS NULL" % c for c in nn_cols))).fetchone()[0]
    print("  ~ %s rebuilt: relaxed[%s] backfilled[%s] rows=%d notnull-null-left=%d"
          % (table, ",".join(relax) or "-", ",".join(tighten) or "-",
             conn.execute("SELECT count(*) FROM %s" % table).fetchone()[0], left))
    return True


def main():
    os.makedirs("data", exist_ok=True)
    from db_init import DatabaseInitializer

    # 1) 全新的库：直接按最新 schema 建表
    fresh = not os.path.exists(DB)
    if fresh:
        DatabaseInitializer(DB).create_database()
        print("  database created: %s" % DB)

    # 2) 已有库：先就地补列（幂等、不丢数据）。
    #    顺序很关键 —— db_init 会为旧表建索引（如 bags_summary(user_id)），
    #    旧表缺列时那一步会抛 no such column，所以必须先 ALTER 再跑 db_init。
    conn = sqlite3.connect(DB)
    added = 0
    try:
        for table, cols in COLUMNS.items():
            have = columns(conn, table)
            if not have:
                continue
            for name, decl in cols:
                if name in have:
                    continue
                conn.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, name, decl))
                print("  + %s.%s" % (table, name))
                added += 1
        conn.commit()

        # 2.5) 旧库里被 NOT NULL 卡死的列（如 items_detail.bag_id）放开成可空：
        #      舍得 B 路线下物品不挂在储物袋上，旧库这条约束会直接拒插入。
        if not fresh:
            tgt = target_schema()
            for table in COLUMNS:
                relax_not_null(conn, tgt, table)
    finally:
        conn.close()

    # 3) 补建缺失的表 / 索引（CREATE ... IF NOT EXISTS，不动已有数据）
    DatabaseInitializer(DB).create_database()
    if not fresh:
        print("  database exists: %s" % DB)

    # 4) 决策层索引兜底（表刚补列时 db_init 已建，这里幂等确认）
    conn = sqlite3.connect(DB)
    try:
        for idx, target in INDEXES:
            conn.execute("CREATE INDEX IF NOT EXISTS %s ON %s" % (idx, target))
        conn.commit()
    finally:
        conn.close()

    print("  schema ok: %d column(s) added" % added)
    return 0


if __name__ == "__main__":
    sys.exit(main())