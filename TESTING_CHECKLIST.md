# Computer Vision Portfolio — Advanced Testing Checklist

Use this QA checklist to verify all interactive modes, batch pipelines, model comparisons, and analytics features.

---

## 1. Single Image Mode & Inspection
- [x] **Split Slider Inspection**: Drag the split slider left and right across an annotated image. Verify smooth masking with zero latency.
- [x] **Keyboard Slider Controls**: Focus the slider and tap Left/Right arrow keys. Verify slider shifts by 5% increments. Tap Home (0%) and End (100%).
- [x] **Side-by-Side Toggle**: Click *"Side-by-Side"*. Verify original and annotated images display side-by-side on desktop and stacked on mobile.
- [x] **Dynamic Confidence Slider**: Drag slider between 5% and 95%. Verify bounding boxes disappear/reappear in real time without network calls.
- [x] **Dynamic Confidence Color**: Verify slider track transitions from red to amber to emerald as confidence increases.
- [x] **Class Isolation**: Click on a class row (e.g. *"Car"*). Verify only that class's bounding boxes remain visible. Click again or click *"Reset filter"* to restore.
- [x] **Architecture Switcher**: Change dropdown architecture from *"Farai's FPN-DomainNet"* to *"YOLOv8x Benchmark"* or *"Mask R-CNN"*. Verify inference updates accordingly.

---

## 2. Batch Processing Pipeline
- [x] **Multi-File Selection**: Drop 3–5 images into the batch drag-and-drop zone. Verify all files appear in the queue with correct names and file sizes.
- [x] **Sequential Execution**: Click *"Analyze All"*. Verify progress bar updates step-by-step (`"Processing item 2: ..."`).
- [x] **Per-Item Status**: Verify each card transitions from *"queued"* to *"analyzing"* to *"done"* with latency and detected object count badges.
- [x] **ZIP Export**: Click *"Download All (ZIP)"*. Unpack the downloaded `.zip` file and confirm it contains annotated PNG files and a valid `batch_summary.json`.
- [x] **Remove Single Item**: Click the delete icon on an individual queued or processed item. Verify it removes cleanly without affecting other items.
- [x] **Clear All Batch**: Click the trash icon in the batch toolbar. Verify all items and temporary object URLs are revoked.

---

## 3. Model Comparison (Side-by-Side)
- [x] **Model Candidate Selection**: Select Model A (*Farai's FPN-DomainNet*) and Model B (*YOLOv8x* or *Mask R-CNN*).
- [x] **Benchmark Execution**: Click *"Execute Benchmark"*. Verify both models run and display their annotated outputs side-by-side.
- [x] **Performance Cards**: Check the 3 KPI cards (*Throughput Winner*, *Certainty Winner*, *Object Recall*). Confirm speedup percentages and latency comparisons are accurate.
- [x] **Discrepancy Breakdown Table**: Verify the table lists all detected classes with Model A count, Model B count, and difference highlights (+X Model A or +Y Model B).

---

## 4. Analytics & Data Export
- [x] **Aggregate KPIs**: View *"Total Images Analyzed"*, *"Average Latency"*, and *"Total Objects Detected"*. Verify numbers match the gallery scans.
- [x] **Class Frequency Chart**: Verify bar chart reflects relative frequencies of detected classes with corresponding class colors.
- [x] **Latency Log**: Verify recent scans table displays timestamps, model architecture, and execution latencies in milliseconds.
- [x] **CSV Export**: Click *"Export CSV"*. Verify downloaded `.csv` opens cleanly in Excel or Google Sheets.
- [x] **JSON Export**: Click *"Export JSON"*. Verify downloaded `.json` contains valid JSON with schema metadata.

---

## 5. Gallery Filtering & Sorting
- [x] **Search Filter**: Type a query into the gallery search bar (e.g. `"dog"` or `"traffic"`). Confirm matching cards filter instantly.
- [x] **Class Dropdown**: Filter by a specific class (e.g. `"Person"`). Confirm only scans containing that class are shown.
- [x] **Density Range Filter**: Select `"6 – 10 objects"`. Confirm only scans with 6–10 detections are displayed.
- [x] **Sorting Options**: Sort by `"Highest Object Count"` and `"Lowest Latency (Speed)"`. Confirm cards reorder immediately.
- [x] **Confirmation Modals**: Verify clicking delete on a card prompts confirmation. Verify *"Clear History"* prompts confirmation.

---

## 6. Keyboard Shortcuts & Floating Action Navigation
- [x] **Shortcuts Modal**: Press `?` on the keyboard or click the FAB *"Shortcuts"* button. Confirm shortcut modal appears.
- [x] **Spacebar Trigger**: Press `Spacebar` while on the single image tab. Confirm inference executes.
- [x] **Save Shortcut**: Press `S` on the keyboard. Confirm annotated image downloads.
- [x] **Compare Shortcut**: Press `C` on the keyboard. Confirm view toggles between Single and Model Comparison mode.
- [x] **Floating Action Button (FAB)**: Click the `+` FAB at bottom right. Confirm radial menu opens with links to Single, Batch, Compare, Analytics, and Scroll-to-Top.
