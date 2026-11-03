#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
舍得决策层 - v5 观察箱（30 天冷静期）

设计要点：不用微信订阅消息（需正式 AppID + 逐次授权），改成
**小程序内到期卡片 + 首页红点** —— 打开就有，不依赖推送能力。

三态看板的计数也从这里取（/v5/observe/overview）。

@Version: 5.0 (shede v0.4.0)
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from common_db import DatabaseManager

router = APIRouter()
db_manager = DatabaseManager()

OBSERVE_DAYS = 30


class UseRequest(BaseModel):
    openid: str = Field(..., description="微信小程序 openid")
    item_id: int = Field(..., description="物品 id")


def _user_id(openid: str) -> int:
    try:
        return db_manager.get_user_id_by_openid(openid)
    except ValueError:
        raise HTTPException(status_code=404, detail="用户不存在，请先登录")


def _owned_item(item_id: int, user_id: int) -> Dict[str, Any]:
    item = db_manager.execute_query(
        "SELECT item_id, user_id, title, category, image_filename, status, decision, "
        "observe_until, observe_used_count, last_used_at FROM items_detail WHERE item_id = ?",
        (item_id,), fetch_one=True)
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    item = dict(item)
    if item.get("user_id") not in (None, user_id):
        raise HTTPException(status_code=403, detail="无权操作该物品")
    return item


def _days_left(observe_until: Any) -> int:
    if not observe_until:
        return 0
    try:
        end = datetime.strptime(str(observe_until)[:10], "%Y-%m-%d").date()
    except ValueError:
        return 0
    return (end - date.today()).days


def _decorate(item: Dict[str, Any]) -> Dict[str, Any]:
    left = _days_left(item.get("observe_until"))
    item["days_left"] = left
    item["expired"] = bool(item.get("observe_until")) and left <= 0
    return item


@router.get("/v5/observe/list")
async def observe_list(openid: str, status: str = "observing"):
    """按三态筛选物品；默认仍返回观察中的物品。"""
    if status not in ("pending", "observing"):
        raise HTTPException(status_code=400, detail="status 仅支持 pending 或 observing")
    user_id = _user_id(openid)
    order_by = "observe_until ASC" if status == "observing" else "created_at DESC"
    rows = db_manager.execute_query(
        "SELECT item_id, title, category, image_filename, observe_until, "
        "observe_used_count, last_used_at, ai_verdict, ai_score "
        "FROM items_detail WHERE status = ? AND (user_id = ? OR user_id IS NULL) "
        "ORDER BY " + order_by,
        (status, user_id)) or []
    items = [_decorate(dict(r)) for r in rows]
    return {
        "status": "success",
        "message": "获取成功",
        "data": {
            "count": len(items),
            "due_count": sum(1 for i in items if i["expired"]),
            "items": items,
        },
    }


@router.get("/v5/observe/due")
async def observe_due(openid: str):
    """到期该处理的（首页卡片 + 红点数据源）"""
    user_id = _user_id(openid)
    rows = db_manager.execute_query(
        "SELECT item_id, title, image_filename, observe_until, observe_used_count "
        "FROM items_detail WHERE status = 'observing' AND (user_id = ? OR user_id IS NULL) "
        "AND observe_until IS NOT NULL AND date(observe_until) <= date('now') "
        "ORDER BY observe_until ASC",
        (user_id,)) or []
    items = [_decorate(dict(r)) for r in rows]
    return {
        "status": "success",
        "message": "有 %d 件物品到期了" % len(items) if items else "暂无到期物品",
        "data": {"count": len(items), "items": items},
    }


@router.post("/v5/observe/use")
async def observe_use(req: UseRequest):
    """观察期内「我用到了」——计数 +1，用来判断到底该不该留"""
    user_id = _user_id(req.openid)
    item = _owned_item(req.item_id, user_id)
    if item.get("status") != "observing":
        raise HTTPException(status_code=400, detail="该物品不在观察箱里")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_manager.execute_update(
        "UPDATE items_detail SET observe_used_count = observe_used_count + 1, "
        "last_used_at = ? WHERE item_id = ?",
        (now, req.item_id))

    used = int(item.get("observe_used_count") or 0) + 1
    days_left = _days_left(item.get("observe_until"))
    if used >= 3:
        hint = "观察期内已经用到 %d 次，建议直接留下。" % used
    elif used >= 1:
        hint = "用到 %d 次了，继续观察看看还剩多少天。" % used
    else:
        hint = "记下了，这个月再看看还会不会用它。"
    return {
        "status": "success",
        "message": "已记录一次使用",
        "data": {"item_id": req.item_id, "observe_used_count": used,
                 "last_used_at": now, "days_left": days_left, "hint": hint},
    }


@router.get("/v5/observe/overview")
async def overview(openid: str):
    """三态看板计数（v1.0.0 首页直接用）"""
    user_id = _user_id(openid)

    def count(where: str, params=()) -> int:
        r = db_manager.execute_query(
            "SELECT COUNT(*) AS c FROM items_detail WHERE (user_id = ? OR user_id IS NULL) "
            "AND " + where, (user_id,) + tuple(params), fetch_one=True)
        return int(r["c"]) if r else 0

    due = db_manager.execute_query(
        "SELECT COUNT(*) AS c FROM items_detail WHERE (user_id = ? OR user_id IS NULL) "
        "AND status = 'observing' AND observe_until IS NOT NULL "
        "AND date(observe_until) <= date('now')", (user_id,), fetch_one=True)

    data = {
        "pending": count("status = 'pending'"),
        "observing": count("status = 'observing'"),
        "resolved": count("status = 'resolved'"),
        "observed_kept": count("decision = 'keep'"),
        "observed_sold": count("decision IN ('sell','gift','recycle','discard')"),
        "due_count": int(due["c"]) if due else 0,
        "observe_days": OBSERVE_DAYS,
    }
    data["total"] = data["pending"] + data["observing"] + data["resolved"]
    return {"status": "success", "message": "获取成功", "data": data}