import pandas as pd
import numpy as np
import random

np.random.seed(42)
random.seed(42)

startups = [
    "TechNova", "HealthBridge", "FinEdge", "EduSpark", "GreenWave",
    "DataPulse", "CloudNest", "BioSync", "AgriTech Pro", "RetailAI",
    "CyberShield", "MediFlow", "PayQuick", "LearnPath", "SolarGen",
    "RoboCore", "InsureBot", "FoodChain", "TravelMind", "SpaceVenture",
    "NanoMed", "SmartCity", "CryptoBase", "VoiceAI", "DroneFleet",
    "EduBot", "CleanEnergy", "HealthAI", "FinTechX", "AutoDrive",
    "QuantumAI", "BioGene", "LogiSmart", "MarketBot", "CyberAI",
    "MediScan", "GreenTech", "RoboFarm", "InsureTech", "FoodAI",
    "TravelBot", "SpaceX2", "NanoBot", "SmartHome", "CryptoVault",
    "VoiceBot", "DroneAI", "EduTech", "CleanBot", "HealthBot"
]

industries = ["Technology", "Healthcare", "Finance", "Education", "CleanEnergy",
              "E-Commerce", "Biotech", "AgriTech", "RealEstate", "Transportation"]

countries = ["USA", "UK", "India", "Germany", "Canada", "Australia",
             "Singapore", "France", "Israel", "Brazil"]

stages = ["Seed", "Series A", "Series B", "Series C", "Series D", "IPO"]

investors = ["Sequoia Capital", "Andreessen Horowitz", "Tiger Global", "SoftBank",
             "Accel Partners", "Kleiner Perkins", "Benchmark", "GV", "NEA",
             "Insight Partners", "General Catalyst", "Founders Fund"]

rows = []
for i in range(500):
    startup = random.choice(startups) + f"_{i}"
    industry = random.choice(industries)
    country = random.choice(countries)
    stage = random.choice(stages)
    year = random.randint(2015, 2023)
    investor = random.choice(investors)

    stage_multiplier = {"Seed": 1, "Series A": 3, "Series B": 8, "Series C": 20, "Series D": 50, "IPO": 150}
    base = stage_multiplier[stage]
    funding = round(random.uniform(base * 0.5, base * 2.5) * 1_000_000, 2)

    growth = round(random.uniform(5, 300), 2) if stage in ["Series A", "Series B", "Series C"] else round(random.uniform(1, 50), 2)
    employees = random.randint(5, 5000)
    valuation = round(funding * random.uniform(3, 15), 2)

    rows.append({
        "startup_name": startup,
        "industry": industry,
        "country": country,
        "funding_amount_usd": funding,
        "funding_round": stage,
        "investor_name": investor,
        "year": year,
        "growth_rate": growth,
        "num_employees": employees,
        "valuation_usd": valuation
    })

df = pd.DataFrame(rows)
# Introduce some missing values
df.loc[df.sample(frac=0.05).index, "funding_amount_usd"] = np.nan
df.loc[df.sample(frac=0.03).index, "investor_name"] = np.nan

df.to_csv("/home/claude/startup_dss/startup_data.csv", index=False)
print(f"Dataset created: {len(df)} rows")
print(df.head())
