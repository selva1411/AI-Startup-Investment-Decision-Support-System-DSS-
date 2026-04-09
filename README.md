# VentureIQ — AI Startup Investment DSS
## How to Run

### Step 1 — Install Python (if not already installed)
Download Python 3.9+ from https://python.org

### Step 2 — Install dependencies
Open your terminal / command prompt in this folder and run:

```
pip install flask pandas numpy scikit-learn matplotlib seaborn
```

### Step 3 — Place your dataset
Make sure `startup_data.csv` is in the same folder as `app.py`
(It is already included in this zip)

### Step 4 — Run the app
```
python app.py
```

### Step 5 — Open in browser
Go to: http://localhost:5000

---

## Features
- 📊 **Dashboard** — KPI cards + 4 interactive charts
- 📈 **Analysis** — Monthly trend, top investors, top 20 startups table
- ⭐ **AI Picks** — Scored recommendations based on funding + stage + recency
- 🔍 **Search** — Live search any startup by name
- ⚖️ **Compare** — Side-by-side comparison of up to 4 startups

## Dataset
Uses your Indian startup funding dataset (2015–2020, 3044 records)
