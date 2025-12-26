# IITC Plugin: Field Closer Assistant

![IITC](https://img.shields.io/badge/IITC-Plugin-blue.svg) ![License](https://img.shields.io/badge/License-GPL%203.0-green)


**An intelligent planning tool for Ingress agents.**

This IITC (Ingress Intel Total Conversion) plugin scans your current map view to identify strategic link opportunities. It exhaustively searches for "Field Closers" (links that create triangles) and "Open Links" (safe connections that don't cross existing links), providing a detailed, actionable list to help you build fields efficiently.

## 🤝 Acknowledgements

This project was born from the need to automate complex fielding strategies. It is inspired by the classic **Portal List** plugin and builds upon logic from my own "Enhanced Portal List" tool.

**Author:** Enrique H. (kyke31)  
**Co-Author / AI Partner:** Google Gemini

---

## 🚀 Installation

### Prerequisites
1.  **IITC-CE:** Ensure you have [IITC-CE](https://iitc.app/) installed on your browser (desktop or mobile).
2.  **Userscript Manager:** You will need a plugin manager like **Tampermonkey** (Chrome/Edge) or **Violentmonkey** (Firefox).

### How to Install
1.  Create a new file in your Userscript manager.
2.  Copy the full code from the `field_closer_assistant.user.js` file.
3.  Paste it into the new file and save.
4.  Reload the Ingress Intel Map.

---

## 🛠️ Functionality & Features

The **Field Closer Assistant** adds a button to your IITC toolbox. When clicked, it opens a modern, dark-themed dashboard that offers the following capabilities:

### 1. Automated Link Scanning
* **Exhaustive Search:** The plugin mathematically checks every possible connection between portals visible in your current map view.
* **Crossing Detection:** It automatically filters out any links that would cross existing links, ensuring every suggestion is physically possible.

### 2. Categorized Results
The analysis separates results into two clear categories:
* **Field Closers:** High-priority links that will immediately complete a triangle (create a Control Field).
* **Possible Connections:** "Open links" that are safe to throw but do not immediately close a field.

### 3. Actionable Status & "Mods Needed"
The table provides specific instructions for every link:
* **Link:** The path is clear, and portals are ready.
* **Fully deploy (Source/Target):** Warns you if a portal is missing resonators.
* **Upgrade:** Calculates if the portals are too low level for the distance required.
* **Mods Needed:** A dedicated column checks if the Source (S) or Target (T) portals have empty mod slots. It displays exactly how many mods need to be installed (e.g., `S:2 | T:1`).

### 4. Visual Interaction
* **Hover Highlights:** Hovering your mouse over any portal name in the list will instantly draw a **pulsing magenta circle** around that portal on the map, making it easy to locate specific targets in a dense area.
* **Click to Pan:** Clicking a portal name centers the map on that portal.

### 5. Smart Data Handling
* **Lazy Loading:** To respect API limits and browser performance, portal details (resonators/mods) are only fetched when necessary and are queued intelligently.
* **Title Sanitization:** Removes special characters from portal titles to ensure clean, readable text.

### 6. Export Data
* **CSV Export:** Includes a button to download the entire analysis as a `.csv` file. This includes coordinates and direct Google Maps links for every portal, allowing you to import your plan into external routing tools.

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

You are free to copy, distribute, and modify this software, provided that any modifications are also open-sourced under the same license.
