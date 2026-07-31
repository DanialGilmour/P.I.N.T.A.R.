# 📡 P.I.N.T.A.R. 
**Predictive Intelligence for Network Tower Allocation & Risk-assessment**

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![Docker](https://img.shields.io/badge/Docker-Enabled-informational)
![FastAPI](https://img.shields.io/badge/FastAPI-0.103.0-009688)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3.0-F7931E)
![Status](https://img.shields.io/badge/Status-Active_Development-success)

Developed by **Team Bolehla**, Project P.I.N.T.A.R. is a multi-objective machine learning pipeline designed to resolve spatial optimization challenges in telecommunications infrastructure. 

Finding the ideal location for a network tower requires balancing competing priorities. P.I.N.T.A.R. utilizes a data-driven approach to evaluate proposed installation sites by weighing two critical factors: **maximum potential coverage** (population density and existing facilities) and **geographical risk mitigation** (terrain stability, water bodies, and landslide vulnerability). 

By generating a ranked risk-and-coverage matrix, P.I.N.T.A.R. identifies the safest, most highly optimized locations for tower deployment, ensuring communities stay connected without compromising on infrastructure safety.

---

## 🏗️ System Architecture

Our solution is decoupled into a data engineering pipeline, a dual-model ML processing core, and a containerized deployment interface.

```mermaid
graph TD;
    subgraph Data Sources
        A[Terrain/Geospatial Data] --> C(Data Preprocessing / ETL)
        B[Demographic/Facilities Data] --> C
    end

    subgraph ML Pipeline
        C --> D[Risk Predictor: XGBoost/RF]
        C --> E[Coverage Optimizer: K-Means/DBSCAN]
        D --> F{Decision Engine / Ranking}
        E --> F
    end

    subgraph Deployment

    ├── data/                   # Raw and processed datasets (ignored by git)
├── models/                 # Saved model binaries (.pkl, .joblib)
├── notebooks/              # Jupyter notebooks for EDA and model prototyping
├── src/                    # Source code for the ML pipeline
│   ├── data_prep/          # ETL scripts
│   ├── features/           # Feature engineering logic
│   ├── risk_model/         # XGBoost/RF training and inference
│   └── coverage_model/     # Clustering algorithms
├── app/                    # Deployment application
│   ├── main.py             # FastAPI application
│   └── dashboard.py        # Streamlit dashboard
├── Dockerfile              # Docker configuration for the application
├── docker-compose.yml      # Multi-container orchestration
├── requirements.txt        # Python dependencies
└── README.md               # Project documentation
        F --> G[FastAPI REST Endpoint]
        G --> H[Streamlit Dashboard / UI]
    end
