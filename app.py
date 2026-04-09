from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
import json
import re
import os
import math
from collections import Counter, defaultdict
from datetime import datetime

app = Flask(__name__)

# ─── IN-MEMORY WATCHLIST (demo) ───────────────────────────────────────────────
WATCHLIST = []

# ─── DATA LOADING & CLEANING ─────────────────────────────────────────────────

def load_and_clean():
    df = pd.read_csv("startup_data.csv", encoding="utf-8-sig")

    # Rename columns
    df.columns = ["sr_no", "date", "startup_name", "industry",
                  "sub_vertical", "city", "investors", "investment_type",
                  "amount_usd", "remarks"]

    # Parse date
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["quarter"] = df["date"].dt.quarter

    # Clean amount
    def parse_amount(val):
        if pd.isna(val):
            return np.nan
        val = str(val).replace(",", "").strip()
        try:
            return float(val)
        except:
            return np.nan

    df["amount"] = df["amount_usd"].apply(parse_amount)

    # Normalize investment type
    def normalize_type(t):
        if pd.isna(t):
            return "Unknown"
        t = str(t).lower().replace("\n", " ").replace("\\n", " ").strip()
        if "private equity" in t: return "Private Equity"
        if "seed" in t or "angel" in t: return "Seed / Angel"
        if "series a" in t: return "Series A"
        if "series b" in t: return "Series B"
        if "series c" in t: return "Series C"
        if "series d" in t: return "Series D"
        if "debt" in t: return "Debt Funding"
        if "grant" in t: return "Grant"
        if "pre-series" in t or "pre series" in t: return "Pre-Series A"
        return "Other"

    df["stage"] = df["investment_type"].apply(normalize_type)

    # Stage ordinal for scoring
    stage_order = {"Seed / Angel": 1, "Pre-Series A": 2, "Series A": 3,
                   "Series B": 4, "Series C": 5, "Series D": 6,
                   "Private Equity": 7, "Debt Funding": 2, "Grant": 1,
                   "Other": 2, "Unknown": 0}
    df["stage_ordinal"] = df["stage"].map(stage_order).fillna(0)

    # Normalize industry
    def normalize_industry(ind):
        if pd.isna(ind): return "Unknown"
        ind = str(ind).strip().lower()
        if "ecommerce" in ind or "e-commerce" in ind or "e commerce" in ind: return "E-Commerce"
        if "consumer internet" in ind: return "Consumer Internet"
        if "tech" in ind and "fin" not in ind and "ed" not in ind and "health" not in ind: return "Technology"
        if "health" in ind or "medical" in ind: return "Healthcare"
        if "finance" in ind or "fintech" in ind: return "FinTech"
        if "education" in ind or "edtech" in ind or "e-tech" in ind: return "EdTech"
        if "logistic" in ind or "supply chain" in ind: return "Logistics"
        if "food" in ind or "beverage" in ind: return "Food & Beverage"
        if "transport" in ind: return "Transportation"
        if "real estate" in ind or "realestate" in ind: return "Real Estate"
        if "saas" in ind or "enterprise" in ind: return "SaaS / Enterprise"
        if "media" in ind or "entertainment" in ind: return "Media & Entertainment"
        if "travel" in ind or "hospitality" in ind: return "Travel & Hospitality"
        if "agri" in ind or "farm" in ind: return "AgriTech"
        if "insur" in ind: return "InsurTech"
        if "auto" in ind or "electric vehicle" in ind: return "AutoTech"
        return ind.title()

    df["industry_clean"] = df["industry"].apply(normalize_industry)

    # Clean city
    df["city"] = df["city"].fillna("Unknown").str.strip().str.title()
    df["city"] = df["city"].replace({"Bangalore": "Bengaluru", "Bengaluru ": "Bengaluru",
                                      "New Delhi": "Delhi", "Gurgaon": "Gurugram",
                                      "Mumbai ": "Mumbai", "Noida ": "Noida"})

    # Drop rows with no startup name
    df = df[df["startup_name"].notna()]
    df["startup_name"] = df["startup_name"].str.strip()

    # Investor count per deal
    df["investor_count"] = df["investors"].apply(
        lambda x: len(str(x).split(",")) if pd.notna(x) else 0
    )

    return df

DF = load_and_clean()

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def safe_json(obj):
    if isinstance(obj, dict):
        return {k: safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [safe_json(i) for i in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj) if not np.isnan(obj) else None
    if isinstance(obj, pd.Timestamp):
        return str(obj)
    return obj

def apply_filters(df, filters):
    """Apply filters to dataframe."""
    if not filters:
        return df
    if filters.get("industries"):
        df = df[df["industry_clean"].isin(filters["industries"])]
    if filters.get("cities"):
        df = df[df["city"].isin(filters["cities"])]
    if filters.get("stages"):
        df = df[df["stage"].isin(filters["stages"])]
    if filters.get("year_min"):
        df = df[df["year"] >= filters["year_min"]]
    if filters.get("year_max"):
        df = df[df["year"] <= filters["year_max"]]
    if filters.get("funding_min"):
        df = df[df["amount"] >= filters["funding_min"]]
    if filters.get("funding_max"):
        df = df[df["amount"] <= filters["funding_max"]]
    return df

# ─── SCORING ENGINE ───────────────────────────────────────────────────────────

def compute_startup_scores(df):
    """ML-inspired multi-dimensional scoring for each startup."""
    grouped = df.groupby("startup_name").agg(
        total_funding=("amount", "sum"),
        rounds=("amount", "count"),
        max_stage=("stage_ordinal", "max"),
        avg_stage=("stage_ordinal", "mean"),
        investor_count=("investor_count", "sum"),
        latest_year=("year", "max"),
        earliest_year=("year", "min"),
        industry=("industry_clean", "first"),
        city=("city", "first"),
        stage=("stage", "last"),
        investors=("investors", "first")
    ).reset_index()

    # Normalize features to 0-100
    def norm(series):
        mn, mx = series.min(), series.max()
        if mx == mn:
            return pd.Series([50] * len(series))
        return ((series - mn) / (mx - mn) * 100).clip(0, 100)

    # Growth score: funding amount + stage progression + recent activity
    grouped["funding_norm"] = norm(np.log1p(grouped["total_funding"]))
    grouped["stage_norm"] = norm(grouped["max_stage"])
    grouped["recency"] = norm(grouped["latest_year"])
    grouped["investor_norm"] = norm(grouped["investor_count"])
    grouped["rounds_norm"] = norm(grouped["rounds"])
    grouped["funding_velocity"] = grouped["total_funding"] / (
        (grouped["latest_year"] - grouped["earliest_year"]).clip(lower=1)
    )
    grouped["velocity_norm"] = norm(np.log1p(grouped["funding_velocity"]))

    # Growth Potential (higher = better growth trajectory)
    grouped["growth_score"] = (
        grouped["funding_norm"] * 0.25 +
        grouped["stage_norm"] * 0.20 +
        grouped["recency"] * 0.20 +
        grouped["velocity_norm"] * 0.20 +
        grouped["rounds_norm"] * 0.15
    ).round(1)

    # Risk Score (higher = higher risk)
    # High risk: early stage, low funding, few investors, old last activity
    grouped["risk_score"] = (
        (100 - grouped["stage_norm"]) * 0.25 +
        (100 - grouped["funding_norm"]) * 0.20 +
        (100 - grouped["investor_norm"]) * 0.15 +
        (100 - grouped["recency"]) * 0.20 +
        (100 - grouped["rounds_norm"]) * 0.20
    ).round(1)

    # Investability Index (composite)
    grouped["investability"] = (
        grouped["growth_score"] * 0.6 +
        (100 - grouped["risk_score"]) * 0.4
    ).round(1)

    # Market momentum per industry
    industry_momentum = df[df["amount"].notna()].groupby("industry_clean").agg(
        total=("amount", "sum"),
        count=("amount", "count"),
        recent=("year", "max")
    )
    industry_momentum["momentum"] = norm(
        np.log1p(industry_momentum["total"]) * industry_momentum["count"] *
        (industry_momentum["recent"] - 2014)
    )
    grouped["market_momentum"] = grouped["industry"].map(
        industry_momentum["momentum"]
    ).fillna(50).round(1)

    # Risk category
    def risk_cat(r):
        if r < 30: return "Low"
        if r < 50: return "Medium"
        if r < 70: return "High"
        return "Critical"
    grouped["risk_category"] = grouped["risk_score"].apply(risk_cat)

    return grouped

SCORES = compute_startup_scores(DF[DF["amount"].notna()])

# ─── INDUSTRY GROWTH RATES (historical approximation) ────────────────────────

def compute_industry_growth():
    """Compute YoY growth rates per industry from data."""
    df = DF[DF["amount"].notna() & DF["year"].notna()].copy()
    result = {}
    for ind in df["industry_clean"].unique():
        ind_df = df[df["industry_clean"] == ind]
        yearly = ind_df.groupby("year")["amount"].sum().sort_index()
        if len(yearly) >= 2:
            growth_rates = yearly.pct_change().dropna()
            avg_growth = growth_rates.mean()
            result[ind] = round(float(avg_growth * 100), 1)
        else:
            result[ind] = 15.0  # default
    return result

INDUSTRY_GROWTH = compute_industry_growth()

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return render_template("index.html")

# ── DASHBOARD KPIs ────────────────────────────────────────────────────────────

@app.route("/api/kpis")
def kpis():
    df = DF.copy()
    # Apply query params as filters
    filters = {}
    if request.args.get("industries"):
        filters["industries"] = request.args.get("industries").split(",")
    if request.args.get("cities"):
        filters["cities"] = request.args.get("cities").split(",")
    if request.args.get("stages"):
        filters["stages"] = request.args.get("stages").split(",")
    if request.args.get("year_min"):
        filters["year_min"] = int(request.args.get("year_min"))
    if request.args.get("year_max"):
        filters["year_max"] = int(request.args.get("year_max"))
    df = apply_filters(df, filters)

    total_startups = int(df["startup_name"].nunique())
    total_funding = df["amount"].sum()
    total_investors = len(set(
        inv.strip()
        for invs in df["investors"].dropna()
        for inv in str(invs).split(",")
    ))
    avg_funding = df["amount"].mean()
    median_funding = df["amount"].median()
    top_industry = df.groupby("industry_clean")["amount"].sum().idxmax() if len(df) > 0 else "N/A"
    top_city = df["city"].value_counts().idxmax() if len(df) > 0 else "N/A"
    total_deals = int(df["amount"].notna().sum())

    # YoY growth
    yearly = df[df["year"].notna()].groupby("year")["amount"].sum().sort_index()
    yoy_growth = 0
    if len(yearly) >= 2:
        last_two = yearly.tail(2)
        if last_two.iloc[0] > 0:
            yoy_growth = round(((last_two.iloc[1] - last_two.iloc[0]) / last_two.iloc[0]) * 100, 1)

    return jsonify({
        "total_startups": total_startups,
        "total_funding_cr": round(total_funding / 1e7, 1) if not np.isnan(total_funding) else 0,
        "total_investors": total_investors,
        "avg_funding_cr": round(avg_funding / 1e7, 2) if not np.isnan(avg_funding) else 0,
        "median_funding_cr": round(median_funding / 1e7, 2) if not np.isnan(median_funding) else 0,
        "top_industry": top_industry,
        "top_city": top_city,
        "total_deals": total_deals,
        "yoy_growth": yoy_growth
    })

# ── CHART DATA ────────────────────────────────────────────────────────────────

@app.route("/api/funding_by_year")
def funding_by_year():
    df = DF[DF["year"].notna() & DF["amount"].notna()]
    grp = df.groupby("year")["amount"].agg(["sum", "count"]).reset_index()
    grp.columns = ["year", "total", "deals"]
    grp = grp.sort_values("year")
    # Compute YoY growth
    grp["yoy"] = grp["total"].pct_change().fillna(0).apply(lambda x: round(x * 100, 1))
    return jsonify({
        "years": grp["year"].astype(int).tolist(),
        "totals": [round(v / 1e7, 2) for v in grp["total"].tolist()],
        "deals": grp["deals"].tolist(),
        "yoy_growth": grp["yoy"].tolist()
    })

@app.route("/api/industry_breakdown")
def industry_breakdown():
    df = DF[DF["amount"].notna()]
    grp = df.groupby("industry_clean").agg(
        total=("amount", "sum"),
        count=("amount", "count"),
        avg=("amount", "mean")
    ).sort_values("total", ascending=False).head(12)
    return jsonify({
        "industries": grp.index.tolist(),
        "amounts": [round(v / 1e7, 2) for v in grp["total"].tolist()],
        "counts": grp["count"].tolist(),
        "averages": [round(v / 1e7, 2) for v in grp["avg"].tolist()]
    })

@app.route("/api/stage_distribution")
def stage_distribution():
    df = DF[DF["amount"].notna()]
    grp = df.groupby("stage").agg(
        count=("amount", "count"),
        total=("amount", "sum"),
        avg=("amount", "mean")
    ).sort_values("count", ascending=False)
    return jsonify({
        "stages": grp.index.tolist(),
        "counts": grp["count"].tolist(),
        "totals": [round(v / 1e7, 2) for v in grp["total"].tolist()],
        "averages": [round(v / 1e7, 2) for v in grp["avg"].tolist()]
    })

@app.route("/api/top_cities")
def top_cities():
    df = DF[DF["amount"].notna()]
    grp = df.groupby("city").agg(
        total=("amount", "sum"),
        count=("amount", "count")
    ).sort_values("total", ascending=False).head(12)
    return jsonify({
        "cities": grp.index.tolist(),
        "amounts": [round(v / 1e7, 2) for v in grp["total"].tolist()],
        "counts": grp["count"].tolist()
    })

@app.route("/api/top_investors")
def top_investors():
    investor_data = defaultdict(lambda: {"count": 0, "total": 0})
    for _, row in DF[DF["investors"].notna()].iterrows():
        for inv in str(row["investors"]).split(","):
            inv = inv.strip()
            if inv and len(inv) > 1:
                investor_data[inv]["count"] += 1
                if pd.notna(row["amount"]):
                    investor_data[inv]["total"] += row["amount"]
    top = sorted(investor_data.items(), key=lambda x: x[1]["count"], reverse=True)[:15]
    return jsonify({
        "investors": [t[0] for t in top],
        "counts": [t[1]["count"] for t in top],
        "totals": [round(t[1]["total"] / 1e7, 2) for t in top]
    })

@app.route("/api/monthly_trend")
def monthly_trend():
    df = DF[DF["year"].notna() & DF["month"].notna() & DF["amount"].notna()]
    df = df[df["year"] >= 2018]
    df2 = df.copy()
    df2["ym"] = df2["year"].astype(int).astype(str) + "-" + df2["month"].astype(int).apply(lambda x: f"{x:02d}")
    grp = df2.groupby("ym").agg(
        total=("amount", "sum"),
        count=("amount", "count")
    ).reset_index().sort_values("ym")
    return jsonify({
        "months": grp["ym"].tolist(),
        "amounts": [round(v / 1e7, 2) for v in grp["total"].tolist()],
        "counts": grp["count"].tolist()
    })

@app.route("/api/top_startups")
def top_startups():
    df = DF[DF["amount"].notna()]
    grp = df.groupby("startup_name").agg(
        total_funding=("amount", "sum"),
        rounds=("amount", "count"),
        industry=("industry_clean", "first"),
        city=("city", "first"),
        stage=("stage", "last"),
        investors=("investors", "first"),
        latest_year=("year", "max")
    ).sort_values("total_funding", ascending=False).head(20).reset_index()

    result = []
    for _, row in grp.iterrows():
        score_row = SCORES[SCORES["startup_name"] == row["startup_name"]]
        inv_idx = round(float(score_row["investability"].iloc[0]), 1) if len(score_row) > 0 else 0
        result.append({
            "name": row["startup_name"],
            "funding_cr": round(row["total_funding"] / 1e7, 2),
            "rounds": int(row["rounds"]),
            "industry": row["industry"],
            "city": row["city"],
            "stage": row["stage"],
            "year": int(row["latest_year"]) if pd.notna(row["latest_year"]) else "N/A",
            "investability": inv_idx,
            "investors": str(row["investors"])[:60] + "…" if len(str(row["investors"])) > 60 else str(row["investors"])
        })
    return jsonify(result)

# ── RECOMMENDATIONS (enhanced) ────────────────────────────────────────────────

@app.route("/api/recommendations")
def recommendations():
    top = SCORES.sort_values("investability", ascending=False).head(12)
    result = []
    for rank, (_, row) in enumerate(top.iterrows(), 1):
        result.append({
            "rank": rank,
            "name": row["startup_name"],
            "investability": round(float(row["investability"]), 1),
            "growth_score": round(float(row["growth_score"]), 1),
            "risk_score": round(float(row["risk_score"]), 1),
            "risk_category": row["risk_category"],
            "market_momentum": round(float(row["market_momentum"]), 1),
            "funding_cr": round(row["total_funding"] / 1e7, 2),
            "rounds": int(row["rounds"]),
            "industry": row["industry"],
            "city": row["city"],
            "stage": row["stage"],
            "year": int(row["latest_year"]) if pd.notna(row["latest_year"]) else "N/A",
            "investors": str(row["investors"])[:70] + "…" if len(str(row["investors"])) > 70 else str(row["investors"])
        })
    return jsonify(result)

# ── RISK SCORES ───────────────────────────────────────────────────────────────

@app.route("/api/risk_scores")
def risk_scores():
    top = SCORES.sort_values("investability", ascending=False).head(50)
    result = []
    for _, row in top.iterrows():
        result.append({
            "name": row["startup_name"],
            "growth_score": round(float(row["growth_score"]), 1),
            "risk_score": round(float(row["risk_score"]), 1),
            "investability": round(float(row["investability"]), 1),
            "market_momentum": round(float(row["market_momentum"]), 1),
            "risk_category": row["risk_category"],
            "funding_cr": round(row["total_funding"] / 1e7, 2),
            "rounds": int(row["rounds"]),
            "industry": row["industry"],
            "city": row["city"],
            "stage": row["stage"],
            "funding_norm": round(float(row["funding_norm"]), 1),
            "stage_norm": round(float(row["stage_norm"]), 1),
            "recency": round(float(row["recency"]), 1),
            "investor_norm": round(float(row["investor_norm"]), 1),
            "velocity_norm": round(float(row["velocity_norm"]), 1)
        })
    return jsonify(result)

@app.route("/api/risk_distribution")
def risk_distribution():
    cats = SCORES["risk_category"].value_counts()
    return jsonify({
        "categories": cats.index.tolist(),
        "counts": cats.values.tolist()
    })

# ── STARTUP PROFILE ───────────────────────────────────────────────────────────

@app.route("/api/startup_profile/<name>")
def startup_profile(name):
    df = DF[DF["startup_name"].str.lower() == name.lower()]
    if df.empty:
        return jsonify({"error": "Not found"}), 404

    score_row = SCORES[SCORES["startup_name"].str.lower() == name.lower()]
    timeline = []
    for _, row in df.sort_values("date").iterrows():
        timeline.append({
            "date": str(row["date"].date()) if pd.notna(row["date"]) else "Unknown",
            "amount_cr": round(row["amount"] / 1e7, 2) if pd.notna(row["amount"]) else 0,
            "stage": row["stage"],
            "investors": str(row["investors"]) if pd.notna(row["investors"]) else "Undisclosed"
        })

    profile = {
        "name": df["startup_name"].iloc[0],
        "industry": df["industry_clean"].iloc[0],
        "sub_vertical": str(df["sub_vertical"].iloc[0]) if pd.notna(df["sub_vertical"].iloc[0]) else "N/A",
        "city": df["city"].iloc[0],
        "total_funding_cr": round(df["amount"].sum() / 1e7, 2) if df["amount"].notna().any() else 0,
        "rounds": int(df["amount"].notna().sum()),
        "current_stage": df["stage"].iloc[-1],
        "first_funded": str(df["date"].min().date()) if df["date"].notna().any() else "N/A",
        "last_funded": str(df["date"].max().date()) if df["date"].notna().any() else "N/A",
        "timeline": timeline,
        "all_investors": list(set(
            inv.strip() for invs in df["investors"].dropna()
            for inv in str(invs).split(",") if inv.strip()
        ))
    }

    if len(score_row) > 0:
        sr = score_row.iloc[0]
        profile["scores"] = {
            "growth_score": round(float(sr["growth_score"]), 1),
            "risk_score": round(float(sr["risk_score"]), 1),
            "investability": round(float(sr["investability"]), 1),
            "market_momentum": round(float(sr["market_momentum"]), 1),
            "risk_category": sr["risk_category"],
            "funding_norm": round(float(sr["funding_norm"]), 1),
            "stage_norm": round(float(sr["stage_norm"]), 1),
            "recency": round(float(sr["recency"]), 1),
            "investor_norm": round(float(sr["investor_norm"]), 1),
            "velocity_norm": round(float(sr["velocity_norm"]), 1)
        }

    return jsonify(profile)

# ── INVESTOR NETWORK ──────────────────────────────────────────────────────────

@app.route("/api/investor_network")
def investor_network():
    inv_startups = defaultdict(set)
    for _, row in DF[DF["investors"].notna()].iterrows():
        for inv in str(row["investors"]).split(","):
            inv = inv.strip()
            if inv and len(inv) > 2:
                inv_startups[inv].add(row["startup_name"])

    # Only top investors
    top_investors = sorted(inv_startups.items(), key=lambda x: len(x[1]), reverse=True)[:30]
    inv_map = {inv: sups for inv, sups in top_investors}
    inv_names = [inv for inv, _ in top_investors]

    nodes = []
    for inv in inv_names:
        nodes.append({
            "id": inv,
            "deals": len(inv_map[inv]),
            "type": "investor"
        })

    edges = []
    edge_set = set()
    for i, inv1 in enumerate(inv_names):
        for j, inv2 in enumerate(inv_names):
            if i >= j:
                continue
            shared = inv_map[inv1] & inv_map[inv2]
            if shared:
                key = tuple(sorted([inv1, inv2]))
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": inv1,
                        "target": inv2,
                        "shared": len(shared),
                        "startups": list(shared)[:5]
                    })

    return jsonify({"nodes": nodes, "edges": edges})

# ── PORTFOLIO SIMULATOR ───────────────────────────────────────────────────────

@app.route("/api/portfolio_simulate", methods=["POST"])
def portfolio_simulate():
    data = request.json
    portfolio = data.get("portfolio", [])  # [{name, amount_cr}]

    if not portfolio:
        return jsonify({"error": "Empty portfolio"}), 400

    results = []
    total_invested = 0
    total_projected = 0

    for item in portfolio:
        name = item.get("name", "")
        amount = float(item.get("amount_cr", 0))
        total_invested += amount

        score_row = SCORES[SCORES["startup_name"].str.lower() == name.lower()]
        df_rows = DF[DF["startup_name"].str.lower() == name.lower()]

        if df_rows.empty:
            continue

        industry = df_rows["industry_clean"].iloc[0]
        growth_rate = INDUSTRY_GROWTH.get(industry, 15) / 100
        investability = float(score_row["investability"].iloc[0]) if len(score_row) > 0 else 50
        risk = float(score_row["risk_score"].iloc[0]) if len(score_row) > 0 else 50

        # Project returns over 5 years
        projections = []
        val = amount
        for yr in range(1, 6):
            multiplier = 1 + growth_rate * (investability / 50)
            # Add some variance based on risk
            risk_adj = 1 - (risk / 200)  # higher risk slightly reduces returns
            val = val * multiplier * risk_adj
            projections.append(round(val, 2))

        roi = round(((projections[-1] - amount) / amount) * 100, 1) if amount > 0 else 0
        total_projected += projections[-1]

        results.append({
            "name": name,
            "invested_cr": amount,
            "industry": industry,
            "risk_category": score_row["risk_category"].iloc[0] if len(score_row) > 0 else "Unknown",
            "investability": round(investability, 1),
            "projected_5yr_cr": projections[-1],
            "roi_pct": roi,
            "yearly_projections": projections
        })

    # Diversification analysis
    industries = Counter()
    stages = Counter()
    cities = Counter()
    for item in portfolio:
        df_rows = DF[DF["startup_name"].str.lower() == item["name"].lower()]
        if not df_rows.empty:
            industries[df_rows["industry_clean"].iloc[0]] += 1
            stages[df_rows["stage"].iloc[-1]] += 1
            cities[df_rows["city"].iloc[0]] += 1

    return jsonify({
        "startups": results,
        "total_invested_cr": round(total_invested, 2),
        "total_projected_5yr": round(total_projected, 2),
        "portfolio_roi": round(((total_projected - total_invested) / total_invested) * 100, 1) if total_invested > 0 else 0,
        "diversification": {
            "industries": dict(industries),
            "stages": dict(stages),
            "cities": dict(cities)
        }
    })

# ── ROI CALCULATOR ────────────────────────────────────────────────────────────

@app.route("/api/roi_calculator", methods=["POST"])
def roi_calculator():
    data = request.json
    startup_name = data.get("startup", "")
    investment_cr = float(data.get("amount_cr", 1))
    years = int(data.get("years", 5))

    df_rows = DF[DF["startup_name"].str.lower() == startup_name.lower()]
    if df_rows.empty:
        return jsonify({"error": "Startup not found"}), 404

    industry = df_rows["industry_clean"].iloc[0]
    base_growth = INDUSTRY_GROWTH.get(industry, 15) / 100

    score_row = SCORES[SCORES["startup_name"].str.lower() == startup_name.lower()]
    investability = float(score_row["investability"].iloc[0]) if len(score_row) > 0 else 50

    # Three scenarios
    scenarios = {}
    for scenario, factor in [("bear", 0.5), ("base", 1.0), ("bull", 1.8)]:
        projections = []
        val = investment_cr
        for yr in range(1, years + 1):
            growth = base_growth * factor * (investability / 50)
            val = val * (1 + growth)
            projections.append(round(val, 2))
        irr = round(((projections[-1] / investment_cr) ** (1 / years) - 1) * 100, 1)
        scenarios[scenario] = {
            "projections": projections,
            "final_value": projections[-1],
            "roi_pct": round(((projections[-1] - investment_cr) / investment_cr) * 100, 1),
            "irr": irr
        }

    return jsonify({
        "startup": startup_name,
        "industry": industry,
        "investment_cr": investment_cr,
        "years": years,
        "industry_growth_rate": INDUSTRY_GROWTH.get(industry, 15),
        "scenarios": scenarios
    })

# ── HEATMAP DATA ──────────────────────────────────────────────────────────────

@app.route("/api/heatmap_data")
def heatmap_data():
    df = DF[DF["amount"].notna() & DF["year"].notna() & DF["month"].notna()]
    top_industries = df.groupby("industry_clean")["amount"].sum().sort_values(ascending=False).head(8).index.tolist()
    df = df[df["industry_clean"].isin(top_industries)]

    pivot = df.groupby(["industry_clean", "month"])["amount"].sum().unstack(fill_value=0)
    months = [f"{m:02d}" for m in range(1, 13)]
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    data = []
    for ind in top_industries:
        row = []
        for m in range(1, 13):
            val = pivot.loc[ind, m] / 1e7 if ind in pivot.index and m in pivot.columns else 0
            row.append(round(float(val), 2))
        data.append(row)

    return jsonify({
        "industries": top_industries,
        "months": month_names,
        "data": data
    })

# ── FUNDING FUNNEL ────────────────────────────────────────────────────────────

@app.route("/api/funding_funnel")
def funding_funnel():
    stage_order = ["Seed / Angel", "Pre-Series A", "Series A", "Series B",
                   "Series C", "Series D", "Private Equity"]
    df = DF[DF["amount"].notna()]
    result = []
    for stage in stage_order:
        sdf = df[df["stage"] == stage]
        if len(sdf) > 0:
            result.append({
                "stage": stage,
                "deals": int(len(sdf)),
                "total_cr": round(sdf["amount"].sum() / 1e7, 2),
                "avg_cr": round(sdf["amount"].mean() / 1e7, 2),
                "startups": int(sdf["startup_name"].nunique())
            })
    return jsonify(result)

# ── YOY GROWTH ANALYSIS ──────────────────────────────────────────────────────

@app.route("/api/yoy_growth")
def yoy_growth():
    df = DF[DF["amount"].notna() & DF["year"].notna()]
    yearly = df.groupby("year").agg(
        total=("amount", "sum"),
        deals=("amount", "count"),
        startups=("startup_name", "nunique")
    ).sort_index()

    yearly["funding_growth"] = yearly["total"].pct_change().fillna(0) * 100
    yearly["deal_growth"] = yearly["deals"].pct_change().fillna(0) * 100

    return jsonify({
        "years": yearly.index.astype(int).tolist(),
        "funding_growth": [round(v, 1) for v in yearly["funding_growth"].tolist()],
        "deal_growth": [round(v, 1) for v in yearly["deal_growth"].tolist()],
        "total_funding_cr": [round(v / 1e7, 2) for v in yearly["total"].tolist()],
        "deals": yearly["deals"].tolist(),
        "startups": yearly["startups"].tolist()
    })

# ── FILTERS ───────────────────────────────────────────────────────────────────

@app.route("/api/filters")
def filters():
    return jsonify({
        "industries": sorted(DF["industry_clean"].unique().tolist()),
        "cities": sorted(DF["city"].value_counts().head(20).index.tolist()),
        "stages": sorted(DF["stage"].unique().tolist()),
        "year_range": [int(DF["year"].min()), int(DF["year"].max())] if DF["year"].notna().any() else [2015, 2023]
    })

# ── AUTOCOMPLETE ──────────────────────────────────────────────────────────────

@app.route("/api/autocomplete")
def autocomplete():
    q = request.args.get("q", "").strip().lower()
    if len(q) < 1:
        return jsonify([])
    matches = DF[DF["startup_name"].str.lower().str.contains(q, na=False)]["startup_name"].unique()[:10]
    return jsonify(matches.tolist())

# ── SEARCH (enhanced) ─────────────────────────────────────────────────────────

@app.route("/api/search")
def search():
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify([])
    df = DF[DF["startup_name"].str.lower().str.contains(q, na=False)]
    grp = df.groupby("startup_name").agg(
        total_funding=("amount", "sum"),
        rounds=("amount", "count"),
        industry=("industry_clean", "first"),
        city=("city", "first"),
        stage=("stage", "last"),
        investors=("investors", "first"),
        year=("year", "max"),
        sub_vertical=("sub_vertical", "first")
    ).reset_index().head(12)

    result = []
    for _, row in grp.iterrows():
        score_row = SCORES[SCORES["startup_name"] == row["startup_name"]]
        result.append({
            "name": row["startup_name"],
            "funding_cr": round(row["total_funding"] / 1e7, 2) if not np.isnan(row["total_funding"]) else 0,
            "rounds": int(row["rounds"]),
            "industry": row["industry"],
            "city": row["city"],
            "stage": row["stage"],
            "year": int(row["year"]) if pd.notna(row["year"]) else "N/A",
            "sub_vertical": str(row["sub_vertical"]) if pd.notna(row["sub_vertical"]) else "N/A",
            "investors": str(row["investors"]),
            "investability": round(float(score_row["investability"].iloc[0]), 1) if len(score_row) > 0 else 0,
            "risk_category": score_row["risk_category"].iloc[0] if len(score_row) > 0 else "Unknown"
        })
    return jsonify(result)

# ── COMPARE (enhanced) ────────────────────────────────────────────────────────

@app.route("/api/compare", methods=["POST"])
def compare():
    names = request.json.get("startups", [])
    result = []
    for name in names:
        df = DF[DF["startup_name"].str.lower() == name.lower()]
        if df.empty:
            continue
        total = df["amount"].sum()
        score_row = SCORES[SCORES["startup_name"].str.lower() == name.lower()]
        entry = {
            "name": df["startup_name"].iloc[0],
            "funding_cr": round(total / 1e7, 2) if not np.isnan(total) else 0,
            "rounds": int(df["amount"].count()),
            "industry": df["industry_clean"].iloc[0],
            "city": df["city"].iloc[0],
            "stage": df["stage"].iloc[-1],
            "investors": str(df["investors"].iloc[0])
        }
        if len(score_row) > 0:
            sr = score_row.iloc[0]
            entry["growth_score"] = round(float(sr["growth_score"]), 1)
            entry["risk_score"] = round(float(sr["risk_score"]), 1)
            entry["investability"] = round(float(sr["investability"]), 1)
            entry["market_momentum"] = round(float(sr["market_momentum"]), 1)
            entry["risk_category"] = sr["risk_category"]
        result.append(entry)
    return jsonify(result)

# ── WATCHLIST ─────────────────────────────────────────────────────────────────

@app.route("/api/watchlist", methods=["GET"])
def get_watchlist():
    result = []
    for name in WATCHLIST:
        score_row = SCORES[SCORES["startup_name"] == name]
        df_rows = DF[DF["startup_name"] == name]
        if not df_rows.empty and len(score_row) > 0:
            sr = score_row.iloc[0]
            result.append({
                "name": name,
                "industry": sr["industry"],
                "city": sr["city"],
                "stage": sr["stage"],
                "funding_cr": round(sr["total_funding"] / 1e7, 2),
                "investability": round(float(sr["investability"]), 1),
                "risk_category": sr["risk_category"]
            })
    return jsonify(result)

@app.route("/api/watchlist", methods=["POST"])
def add_watchlist():
    name = request.json.get("name", "")
    if name and name not in WATCHLIST:
        WATCHLIST.append(name)
    return jsonify({"success": True, "watchlist": WATCHLIST})

@app.route("/api/watchlist", methods=["DELETE"])
def remove_watchlist():
    name = request.json.get("name", "")
    if name in WATCHLIST:
        WATCHLIST.remove(name)
    return jsonify({"success": True, "watchlist": WATCHLIST})

# ── INDUSTRY GROWTH RATES ────────────────────────────────────────────────────

@app.route("/api/industry_growth_rates")
def industry_growth_rates():
    return jsonify(INDUSTRY_GROWTH)

# ── GLOBAL STATS FOR HERO ────────────────────────────────────────────────────

@app.route("/api/hero_stats")
def hero_stats():
    total_funding = DF["amount"].sum()
    return jsonify({
        "total_startups": int(DF["startup_name"].nunique()),
        "total_funding_cr": round(total_funding / 1e7, 0) if not np.isnan(total_funding) else 0,
        "total_investors": len(set(
            inv.strip()
            for invs in DF["investors"].dropna()
            for inv in str(invs).split(",")
        )),
        "total_deals": int(DF["amount"].notna().sum()),
        "industries_covered": int(DF["industry_clean"].nunique()),
        "cities_covered": int(DF["city"].nunique())
    })

# ── QUARTERLY DATA ────────────────────────────────────────────────────────────

@app.route("/api/quarterly")
def quarterly():
    df = DF[DF["year"].notna() & DF["quarter"].notna() & DF["amount"].notna()]
    df2 = df.copy()
    df2["yq"] = df2["year"].astype(int).astype(str) + " Q" + df2["quarter"].astype(int).astype(str)
    grp = df2.groupby("yq").agg(
        total=("amount", "sum"),
        count=("amount", "count")
    ).reset_index().sort_values("yq")
    return jsonify({
        "quarters": grp["yq"].tolist(),
        "amounts": [round(v / 1e7, 2) for v in grp["total"].tolist()],
        "counts": grp["count"].tolist()
    })

# ── SECTOR COMPARISON ─────────────────────────────────────────────────────────

@app.route("/api/sector_comparison")
def sector_comparison():
    df = DF[DF["amount"].notna()]
    result = []
    for ind in df["industry_clean"].value_counts().head(10).index:
        ind_df = df[df["industry_clean"] == ind]
        result.append({
            "industry": ind,
            "total_cr": round(ind_df["amount"].sum() / 1e7, 2),
            "deals": int(len(ind_df)),
            "avg_cr": round(ind_df["amount"].mean() / 1e7, 2),
            "unique_startups": int(ind_df["startup_name"].nunique()),
            "top_city": ind_df["city"].value_counts().idxmax() if len(ind_df) > 0 else "N/A",
            "growth_rate": INDUSTRY_GROWTH.get(ind, 0)
        })
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True, port=5000)

