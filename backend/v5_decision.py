#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
舍得决策层 - v5 版本 - AI 六维分析

流程：拍照 → AI 识物(v3) → 答 4 个问题 → 本模块出六维分 + 建议 + 理由
     → 用户在 /v5/decision/choose (v0.4.0) 四选一 → 30 天观察箱

六维（0~100，越高越支持"留下"）：
    usage     使用频率
    duplicate 是否重复/有替代
    need      实际需求
    rebuy     重新购买意愿
    space     占用空间
    emotion   情感价值

@Version: 5.0 (shede v0.3.0)
"""

import json
import re
from configparser import ConfigParser
from datetime import datetime, date, timedelta
from typing import Dict, Any

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
DECISION_MODEL = config.get('zhipu', 'decision_model', fallback='glm-4-flash').strip()

db_manager = DatabaseManager()

# 四个问题的定义（前端直接渲染，保证前后端枚举一致）
QUESTIONS = [
    {
        "key": "usage_answer",
        "title": "最近一次用它是什么时候？",
        "options": [
            {"value": "recent", "label": "这周用过"},
            {"value": "month", "label": "这个月用过"},
            {"value": "long", "label": "半年内用过"},
            {"value": "never", "label": "想不起来了"},
        ],
    },
    {
        "key": "rebuy_answer",
        "title": "如果现在没有它，你会再买一个吗？",
        "options": [
            {"value": "yes", "label": "会，用得上"},
            {"value": "unsure", "label": "说不好"},
            {"value": "no", "label": "不会"},
        ],
    },
    {
        "key": "replace_answer",
        "title": "你手边有别的东西能替代它吗？",
        "options": [
            {"value": "none", "label": "没有，只此一个"},
            {"value": "has", "label": "有别的能顶"},
            {"value": "broken", "label": "它坏了/不能用了"},
        ],
    },
    {
        "key": "emotion_answer",
        "title": "想到要扔掉它，你心里是什么感觉？",
        "options": [
            {"value": "high", "label": "舍不得，它有故事"},
            {"value": "mid", "label": "有点感觉，但还好"},
            {"value": "low", "label": "没什么感觉"},
        ],
    },
]

# 回答 -> 维度分（规则版评分，AI 不可用时用；也是 AI 输出的兜底）
_SCORE_MAP = {
    "usage": {"recent": 90, "month": 65, "long": 35, "never": 10},
    "rebuy": {"yes": 85, "unsure": 55, "no": 20},
    "replace": {"none": 80, "has": 40, "broken": 30},
    "emotion": {"high": 85, "mid": 55, "low": 20},
}

WEIGHTS = {"usage": 0.25, "need": 0.20, "rebuy": 0.15,
           "duplicate": 0.15, "space": 0.10, "emotion": 0.15}

DIM_LABELS = {"usage": "平时用得多吗", "duplicate": "有没有能顶替的", "need": "真的需要它吗",
              "rebuy": "没了会再买吗", "space": "它占地方吗", "emotion": "舍不得它吗"}


class AnalyzeRequest(BaseModel):
    openid: str = Field(..., description="微信小程序 openid")
    item_id: int = Field(..., description="物品 id")
    usage_answer: str = Field("never")
    rebuy_answer: str = Field("unsure")
    replace_answer: str = Field("none")
    emotion_answer: str = Field("mid")


class ChooseRequest(BaseModel):
    openid: str = Field(..., description="微信小程序 openid")
    item_id: int = Field(..., description="物品 id")
    decision: str = Field(..., description="keep / observe / sell / gift / recycle / discard")


# 用户四选一 -> 三态流转
DECISIONS = {
    "keep":    {"status": "resolved", "channel": None,      "text": "已留下"},
    "observe": {"status": "observing", "channel": None,     "text": "已放入 30 天观察箱"},
    "sell":    {"status": "resolved", "channel": "sell",    "text": "已标记为出售"},
    "gift":    {"status": "resolved", "channel": "gift",    "text": "已标记为转赠"},
    "recycle": {"status": "resolved", "channel": "recycle", "text": "已标记为回收"},
    "discard": {"status": "resolved", "channel": "trash",   "text": "已标记为丢弃"},
}

OBSERVE_DAYS = 30


def _verdict_of(score: int) -> str:
    if score >= 65:
        return "keep"
    if score >= 40:
        return "observe"
    return "dispose"


def _rule_dims(req: AnalyzeRequest) -> Dict[str, int]:
    """规则版六维：没有可用 AI 时保证 demo 也能出结果（打分逻辑对用户可见、可解释）"""
    usage = _SCORE_MAP["usage"].get(req.usage_answer, 35)
    rebuy = _SCORE_MAP["rebuy"].get(req.rebuy_answer, 55)
    duplicate = _SCORE_MAP["replace"].get(req.replace_answer, 50)
    emotion = _SCORE_MAP["emotion"].get(req.emotion_answer, 55)
    # need / space 无法从 4 个回答里直接推出，用相邻维度近似（space 取中性 50）
    need = round(rebuy * 0.6 + usage * 0.4)
    return {"usage": usage, "duplicate": duplicate, "need": need,
            "rebuy": rebuy, "space": 50, "emotion": emotion}


def _rule_reason(dims: Dict[str, int]) -> str:
    parts = []
    if dims["usage"] <= 35:
        parts.append("很久没用了")
    elif dims["usage"] >= 65:
        parts.append("最近还在用")
    if dims["duplicate"] <= 40:
        parts.append("手边有东西能替代它")
    if dims["emotion"] >= 85:
        parts.append("但它承载了不少回忆，舍不得也正常")
    elif dims["emotion"] <= 20:
        parts.append("你心里对它其实没什么牵挂")
    if not parts:
        parts.append("各方面都不算极端，难怪你会纠结")
    return "，".join(parts) + "。"


def _weighted(dims: Dict[str, int]) -> int:
    total = sum(dims.get(k, 50) * w for k, w in WEIGHTS.items())
    return max(0, min(100, int(round(total))))


def _ai_dims(req: AnalyzeRequest, item: Dict[str, Any]) -> tuple[Dict[str, int], str, str]:
    """返回 (dims, reason, source)；AI 不可用/解析失败 → 规则版"""
    if MOCK_AI:
        dims = _rule_dims(req)
        return dims, _rule_reason(dims), "rule"

    try:
        from zhipuai import ZhipuAI

        prompt = """你是「舍得」断舍离助手。根据用户对一件旧物的回答，给出六个维度的打分和一句建议理由。

物品：{title}
描述：{desc}
分类：{category}

用户回答：
- 最近一次使用：{usage}
- 会再买一个吗：{rebuy}
- 有别的东西能替代它吗：{replace}
- 情感/纪念价值：{emotion}

请只返回 JSON，格式：
{{"dims": {{"usage": 0-100, "duplicate": 0-100, "need": 0-100, "rebuy": 0-100, "space": 0-100, "emotion": 0-100}},
  "reason": "不超过 40 字的中文理由，直接说人话，不要输出道德劝诫"}}

打分含义：分数越高越支持「留下」。space 分越高表示越不占地方。""".format(
            title=item.get("title", ""), desc=(item.get("description") or "")[:120],
            category=item.get("category") or "未分类",
            usage=req.usage_answer, rebuy=req.rebuy_answer,
            replace=req.replace_answer, emotion=req.emotion_answer)

        client = ZhipuAI(api_key=_ZHIPU_KEY)
        resp = client.chat.completions.create(
            model=DECISION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        text = resp.choices[0].message.content or ""
        data = None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            m = re.search(r'\{[\s\S]*\}', text)
            if m:
                data = json.loads(m.group(0))
        if not isinstance(data, dict):
            raise ValueError("AI 未返回 JSON")

        raw = data.get("dims") or {}
        dims = {}
        for k in WEIGHTS:
            try:
                dims[k] = max(0, min(100, int(float(raw.get(k, 50)))))
            except (TypeError, ValueError):
                dims[k] = 50
        reason = str(data.get("reason") or "").strip()[:120] or _rule_reason(dims)
        return dims, reason, "ai"
    except Exception as e:                     # AI 任何异常都不该让用户卡住
        dims = _rule_dims(req)
        return dims, _rule_reason(dims) + "（AI 不可用，已用规则打分）", "rule(%s)" % type(e).__name__


def _get_item(item_id: int) -> Dict[str, Any]:
    item = db_manager.execute_query(
        "SELECT item_id, user_id, box_id, bag_id, title, description, category, "
        "image_filename, status, ai_verdict, ai_score, ai_reason, ai_dims, "
        "decision, observe_until FROM items_detail WHERE item_id = ?",
        (item_id,), fetch_one=True)
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    return dict(item)


def _user_id(openid: str) -> int:
    try:
        return db_manager.get_user_id_by_openid(openid)
    except ValueError:
        raise HTTPException(status_code=404, detail="用户不存在，请先登录")


@router.get("/v5/decision/questions")
async def get_questions():
    """决策前的固定问卷（前端渲染，枚举值与后端打分逻辑一一对应）"""
    return {"status": "success", "message": "获取成功",
            "data": {"questions": QUESTIONS, "dim_labels": DIM_LABELS}}


@router.post("/v5/decision/analyze")
async def analyze(req: AnalyzeRequest):
    """六维分析：写回 items_detail.ai_* 四列，status 保持 pending 等用户四选一"""
    user_id = _user_id(req.openid)
    item = _get_item(req.item_id)
    if item.get("user_id") not in (None, user_id):
        raise HTTPException(status_code=403, detail="无权操作该物品")

    for key, field in (("usage_answer", "usage"), ("rebuy_answer", "rebuy"),
                       ("replace_answer", "replace"), ("emotion_answer", "emotion")):
        if getattr(req, key) not in _SCORE_MAP[field]:
            raise HTTPException(status_code=400, detail="参数取值非法: %s" % key)

    dims, reason, source = _ai_dims(req, item)
    score = _weighted(dims)
    verdict = _verdict_of(score)

    db_manager.execute_update(
        "UPDATE items_detail SET usage_answer = ?, rebuy_answer = ?, replace_answer = ?, "
        "emotion_answer = ?, ai_verdict = ?, ai_score = ?, ai_reason = ?, ai_dims = ?, "
        "status = CASE WHEN status = 'pending' THEN 'pending' ELSE status END "
        "WHERE item_id = ?",
        (req.usage_answer, req.rebuy_answer, req.replace_answer, req.emotion_answer,
         verdict, score, reason, json.dumps(dims, ensure_ascii=False), req.item_id))

    advice = {
        "keep": "留着吧，它还在为你工作。",
        "observe": "先放进 30 天观察箱，到期还没用上再处理。",
        "dispose": "可以考虑处理掉了：卖掉、送人或回收。",
    }[verdict]

    return {
        "status": "success",
        "message": "分析完成",
        "data": {
            "item_id": req.item_id,
            "title": item.get("title", ""),
            "answers": {"usage": req.usage_answer, "rebuy": req.rebuy_answer,
                        "replace": req.replace_answer, "emotion": req.emotion_answer},
            "dims": dims,
            "dim_labels": DIM_LABELS,
            "score": score,
            "verdict": verdict,
            "reason": reason,
            "advice": advice,
            "source": source,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
    }


@router.get("/v5/decision/item")
async def decision_item(openid: str, item_id: int):
    """物品详情页用：返回基础信息 + 已有的 AI 结论 + 三态/观察信息"""
    user_id = _user_id(openid)
    item = _get_item(item_id)
    if item.get("user_id") not in (None, user_id):
        raise HTTPException(status_code=403, detail="无权查看该物品")

    dims = None
    if item.get("ai_dims"):
        try:
            dims = json.loads(item["ai_dims"])
        except (TypeError, ValueError):
            dims = None

    return {
        "status": "success",
        "message": "获取成功",
        "data": {
            "item": {k: v for k, v in item.items() if k != "ai_dims"},
            "dims": dims,
            "dim_labels": DIM_LABELS,
            "status_text": {"pending": "待决策", "observing": "观察中",
                            "resolved": "已处理"}.get(item.get("status"), "待决策"),
        },
    }


@router.post("/v5/decision/choose")
async def choose(req: ChooseRequest):
    """用户四选一：写下 decision，并把 status 推到 observing / resolved。

    keep       → resolved（已留下，不再提醒）
    observe    → observing（30 天观察箱，写 observe_until）
    sell/gift/recycle/discard → resolved（dispose_channel 记渠道，disposed_at 记时间）
    """
    user_id = _user_id(req.openid)
    item = _get_item(req.item_id)
    if item.get("user_id") not in (None, user_id):
        raise HTTPException(status_code=403, detail="无权操作该物品")

    spec = DECISIONS.get(req.decision)
    if not spec:
        raise HTTPException(status_code=400,
                            detail="decision 取值非法，可选: " + " / ".join(DECISIONS))

    now = datetime.now()
    observe_until = (date.today() + timedelta(days=OBSERVE_DAYS)).isoformat() \
        if req.decision == "observe" else None
    disposed_at = now.strftime("%Y-%m-%d %H:%M:%S") if spec["channel"] else None

    db_manager.execute_update(
        "UPDATE items_detail SET decision = ?, decided_at = ?, status = ?, "
        "observe_until = ?, dispose_channel = COALESCE(?, dispose_channel), "
        "disposed_at = COALESCE(?, disposed_at), observe_used_count = "
        "CASE WHEN ? = 'observe' THEN 0 ELSE observe_used_count END "
        "WHERE item_id = ?",
        (req.decision, now.strftime("%Y-%m-%d %H:%M:%S"), spec["status"],
         observe_until, spec["channel"], disposed_at, req.decision, req.item_id))

    return {
        "status": "success",
        "message": spec["text"],
        "data": {
            "item_id": req.item_id,
            "title": item.get("title", ""),
            "decision": req.decision,
            "status": spec["status"],
            "status_text": {"pending": "待决策", "observing": "观察中",
                            "resolved": "已处理"}[spec["status"]],
            "observe_until": observe_until,
            "observe_days": OBSERVE_DAYS if req.decision == "observe" else None,
            "dispose_channel": spec["channel"],
            "decided_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        },
    }
