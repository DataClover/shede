#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
舍得决策层 - v5 处理建议（出售文案 / 转赠渠道 / 回收指引）

用途：用户选了 sell / gift / recycle / discard 之后，给一条**能照着做**的下一步，
不是空洞的"建议处理掉"。文案与渠道按分类走规则表；填了真实智谱 key 时改由
glm-4-flash 生成更贴物品的文案（失败自动回退规则版）。

@Version: 5.0 (shede v0.5.0)
"""

import json
import re
from configparser import ConfigParser
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from common_db import DatabaseManager

router = APIRouter()

config = ConfigParser()
config.read('config.ini', encoding='utf-8')
_ZHIPU_KEY = config.get('zhipu', 'zhipu_api_key', fallback='').strip()
MOCK_AI = (
    config.get('demo', 'mock_ai', fallback='0').strip().lower() in ('1', 'true', 'yes', 'on')
    or _ZHIPU_KEY in ('', 'YOUR API KEY', 'YOUR_API_KEY')
)
GEN_MODEL = config.get('zhipu', 'decision_model', fallback='glm-4-flash').strip()

db_manager = DatabaseManager()

# 分类 -> (二手估价区间元, 回收提示)
PRICE_TABLE = {
    "电子产品": ((30, 300), "有电池的电子产品别扔垃圾桶，交给电子废弃物回收点或校园回收活动"),
    "衣服": ((5, 40), "旧衣投放到小区/校园旧衣回收箱，成色好的可捐赠"),
    "书籍": ((3, 20), "教材可低价转让给低年级，其余走旧书回收或图书漂流角"),
    "厨具": ((5, 50), "能用的厨具送同宿舍或宿管，坏了按金属/其他垃圾分类"),
    "箱包": ((10, 80), "箱包在二手平台好出手，成色新可先问身边同学"),
    "公仔": ((5, 40), "毛绒玩具可转赠或捐给儿童公益，破损的按其他垃圾处理"),
    "其他": ((5, 50), "先问同宿舍同学是否需要，再挂二手平台"),
}

SELL_PLATFORM = ["闲鱼", "转转", "学校二手群"]
GIFT_TARGET = ["同宿舍/同班同学", "宿舍楼群 / 班级群", "校园公益捐赠点"]


class SuggestRequest(BaseModel):
    openid: str = Field(...)
    item_id: int = Field(...)
    channel: str = Field("", description="sell / gift / recycle / discard，留空则按已有 decision 推断")


def _user_id(openid: str) -> int:
    try:
        return db_manager.get_user_id_by_openid(openid)
    except ValueError:
        raise HTTPException(status_code=404, detail="用户不存在，请先登录")


def _item(item_id: int) -> Dict[str, Any]:
    r = db_manager.execute_query(
        "SELECT item_id, user_id, title, description, category, decision, dispose_channel, "
        "ai_score, ai_verdict FROM items_detail WHERE item_id = ?", (item_id,), fetch_one=True)
    if not r:
        raise HTTPException(status_code=404, detail="物品不存在")
    return dict(r)


def _price_range(category: str, score: int) -> tuple:
    lo, hi = PRICE_TABLE.get(category or "其他", PRICE_TABLE["其他"])[0]
    # 保留价值分越高（越值得留）→ 二手成色越好，估价往区间上沿走
    factor = 0.6 + (score / 100.0) * 0.6 if score else 0.8
    return int(round(lo * factor)), int(round(hi * factor))


def _rule_suggest(item: Dict[str, Any], channel: str) -> Dict[str, Any]:
    title = item.get("title") or "闲置物品"
    desc = (item.get("description") or "").strip()
    cat = item.get("category") or "其他"
    score = int(item.get("ai_score") or 0)

    if channel == "sell":
        lo, hi = _price_range(cat, score)
        return {
            "channel": "sell",
            "title_text": "闲置转卖：%s，成色良好，自提优先" % title,
            "body_text": (desc or "%s，正常使用痕迹，功能完好。" % title)
                         + " 宿舍自提，可小刀，介意勿拍。",
            "price_range": [lo, hi],
            "platforms": SELL_PLATFORM,
            "tips": ["拍 3 张实拍图（正面/细节/瑕疵），比网图好卖",
                     "标价先按区间中上沿挂，留出让价空间",
                     "写清自提地点，减少沟通成本"],
        }
    if channel == "gift":
        return {
            "channel": "gift",
            "title_text": "免费送：%s，自取" % title,
            "body_text": "%s，我用不上了，看谁需要直接拿去。" % (desc or title),
            "platforms": GIFT_TARGET,
            "tips": ["先问同宿舍同学，省事也快",
                     "成色好的可捐给公益点，别直接丢",
                     "送之前留张合照/说明，免得对方不好意思收"],
        }
    if channel == "recycle":
        return {
            "channel": "recycle",
            "title_text": "%s 回收指引" % title,
            "body_text": PRICE_TABLE.get(cat, PRICE_TABLE["其他"])[1] + "。",
            "platforms": ["校园/小区回收点", "旧衣回收箱", "电子废弃物回收活动"],
            "tips": ["先清空个人信息（电子设备恢复出厂）",
                     "拆下能单独回收的部件（电池、线材）",
                     "确认回收点开放时间再跑一趟"],
        }
    return {
        "channel": "discard",
        "title_text": "%s 丢弃前检查" % title,
        "body_text": "确认无法转赠/回收后再丢弃，尽量按分类投放。",
        "platforms": ["宿舍垃圾桶", "小区分类投放点"],
        "tips": ["确认没有可转赠的价值",
                 "电子产品、电池不要混进生活垃圾",
                 "数据清理：纸质文件撕碎、设备恢复出厂"],
    }


def _ai_suggest(item: Dict[str, Any], channel: str, base: Dict[str, Any]) -> Dict[str, Any]:
    """AI 版本：只改写文案与 tips，价格/渠道仍用规则表（避免编造价格）"""
    if MOCK_AI:
        return base
    try:
        from zhipuai import ZhipuAI

        prompt = """你是校园二手流转助手。为下面这件旧物写一条%s文案。

物品：%s
描述：%s
分类：%s

只返回 JSON：{"title_text": "不超过 20 字", "body_text": "30~60 字，口语化，不浮夸",
"tips": ["可执行提示 1", "可执行提示 2"]}
不要编造价格，不要写"买它"这类推销话术。""" % (
            {"sell": "出售", "gift": "转赠", "recycle": "回收", "discard": "丢弃"}.get(channel, "处理"),
            item.get("title", ""), (item.get("description") or "")[:120],
            item.get("category") or "未分类")

        client = ZhipuAI(api_key=_ZHIPU_KEY)
        resp = client.chat.completions.create(
            model=GEN_MODEL, messages=[{"role": "user", "content": prompt}], temperature=0.7)
        text = resp.choices[0].message.content or ""
        data = None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            m = re.search(r'\{[\s\S]*\}', text)
            if m:
                data = json.loads(m.group(0))
        if not isinstance(data, dict):
            return base
        out = dict(base)
        if data.get("title_text"):
            out["title_text"] = str(data["title_text"])[:40]
        if data.get("body_text"):
            out["body_text"] = str(data["body_text"])[:200]
        if isinstance(data.get("tips"), list) and data["tips"]:
            out["tips"] = [str(t)[:60] for t in data["tips"][:3]]
        out["source"] = "ai"
        return out
    except Exception:
        return base


def _channel_of(item: Dict[str, Any], channel: str) -> str:
    ch = (channel or item.get("dispose_channel") or "").strip()
    if not ch:
        ch = {"sell": "sell", "gift": "gift", "recycle": "recycle", "discard": "discard"}.get(
            item.get("decision") or "", "")
    if ch not in ("sell", "gift", "recycle", "discard"):
        raise HTTPException(status_code=400,
                            detail="请先选择处理方式（sell/gift/recycle/discard）")
    return ch


@router.post("/v5/dispose/suggest")
async def dispose_suggest(req: SuggestRequest):
    """生成处理建议并写回 items_detail.dispose_suggest / dispose_channel"""
    user_id = _user_id(req.openid)
    item = _item(req.item_id)
    if item.get("user_id") not in (None, user_id):
        raise HTTPException(status_code=403, detail="无权操作该物品")

    channel = _channel_of(item, req.channel)
    base = _rule_suggest(item, channel)
    base.setdefault("source", "rule")
    out = _ai_suggest(item, channel, base)

    db_manager.execute_update(
        "UPDATE items_detail SET dispose_channel = ?, dispose_suggest = ? WHERE item_id = ?",
        (channel, json.dumps(out, ensure_ascii=False), req.item_id))

    return {"status": "success", "message": "已生成处理建议",
            "data": {"item_id": req.item_id, "title": item.get("title", ""),
                     "suggest": out}}


@router.get("/v5/dispose/plan")
async def dispose_plan(openid: str, item_id: int):
    """读回已生成的处理建议"""
    user_id = _user_id(openid)
    item = _item(item_id)
    if item.get("user_id") not in (None, user_id):
        raise HTTPException(status_code=403, detail="无权查看该物品")
    raw = db_manager.execute_query(
        "SELECT dispose_channel, dispose_suggest FROM items_detail WHERE item_id = ?",
        (item_id,), fetch_one=True)
    raw = dict(raw) if raw else {}
    suggest = None
    if raw.get("dispose_suggest"):
        try:
            suggest = json.loads(raw["dispose_suggest"])
        except (TypeError, ValueError):
            suggest = None
    return {"status": "success", "message": "获取成功",
            "data": {"item_id": item_id, "title": item.get("title", ""),
                     "channel": raw.get("dispose_channel"), "suggest": suggest}}