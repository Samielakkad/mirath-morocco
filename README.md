# 🇲🇦 Mirath Morocco: Professional Estate Division Tool

[![AI + LegalTech](https://img.shields.io/badge/AI%20%2B-LegalTech-8A2BE2)](#)

**Mirath Morocco** is a high-precision, legally compliant land division application designed for Moroccan inheritance (Moudawana) and Land Registry (Conservation Foncière) standards.

## 🚀 Professional Features

### 1. Weighted Value Engine (Péréquation)
Unlike basic tools that divide land by area alone, Mirath Morocco uses a **Coefficient System**.
- **Value Zones:** Draw zones over the map (e.g., Road Access [x1.5], Rocky Soil [x0.7]).
- **Formula:** $S_{total\_w} = \sum (S_i \times C_i)$ ensures heirs receive equal **value**, not just equal square meters.

### 2. Smart Geometry (Access-First Slicing)
- **Road Connectivity:** Every generated sub-plot is optimized to touch a designated "Access Road".
- **Right-of-Way:** If a plot cannot touch a road, the system flags the need for a "Servitude de passage".

### 3. Legal Compliance Layer (Law 34-94)
- **Agricultural vs. Urban:** Toggle between land types to apply different legal constraints.
- **Minimum Lot Size:** Automatically checks if a share is too small to be legally divided (e.g., 5ha for agricultural land).
- **Soulte Suggestions:** If a plot is too small to divide, the system suggests compensatory payments (Soulte) from other heirs.

### 4. Advanced Inheritance Logic
- **Awl & Radd:** Handles pro-rata share reductions and surplus redistributions.
- **Manasakhah:** Support for nested deaths (inheritance within inheritance).

### 5. Professional Output
- **Plan de Partage PDF:** Generates a formal report including:
  - List of heirs and legal shares.
  - GPS coordinates of all vertices.
  - Soulte calculation table.
  - High-resolution map visualization.

## 🛠 Technical Stack
- **React + Vite + TypeScript**
- **Google Maps API:** For high-resolution satellite imagery and geometry.
- **Turf.js:** For advanced geospatial analysis and polygon slicing.
- **Supabase:** For secure data persistence and estate collaboration.
- **jsPDF + html2canvas:** For professional report generation.

## ⚠️ Limitations & Honest Disclaimer
- **Not a Legal Document:** While this tool follows the Moudawana, it is for **simulation and planning only**. Final division must be validated by an Adoul and registered with the Conservation Foncière.
- **Satellite Accuracy:** GPS coordinates are derived from Google Maps; for legal registration, a certified Topographical Engineer must perform a field survey.
- **Complex Slicing:** The current geometric slicer uses a simplified algorithm. Complex concave polygons may require manual adjustment by a professional.
- **Soil Quality:** Coefficients are user-defined. A professional soil analysis is recommended for accurate valuation.
