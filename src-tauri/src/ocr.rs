use std::{
    path::{Path, PathBuf},
    sync::mpsc::{self, Sender},
    thread,
};

use ocr_rs::OcrEngine;
use tauri::{AppHandle, Emitter};

use crate::database::Database;

#[derive(Debug)]
struct OcrJob {
    id: i64,
    image_paths: Vec<String>,
}

#[derive(Clone)]
pub struct OcrQueue {
    sender: Sender<OcrJob>,
}

impl OcrQueue {
    pub fn enqueue(&self, id: i64, image_paths: Vec<String>) {
        if !image_paths.is_empty() {
            let _ = self.sender.send(OcrJob { id, image_paths });
        }
    }
}

pub fn spawn(app: AppHandle, database: Database, model_dir: PathBuf) -> OcrQueue {
    let (sender, receiver) = mpsc::channel::<OcrJob>();
    let queue = OcrQueue { sender };
    let worker_queue = queue.clone();
    let worker_database = database.clone();

    thread::Builder::new()
        .name("mote-ocr-worker".into())
        .spawn(move || {
            let det = model_dir.join("PP-OCRv5_mobile_det_fp16.mnn");
            let rec = model_dir.join("PP-OCRv5_mobile_rec_fp16.mnn");
            let keys = model_dir.join("ppocr_keys_v5.txt");
            let engine = match create_engine(&det, &rec, &keys) {
                Ok(engine) => engine,
                Err(error) => {
                    eprintln!("Mote could not initialize local OCR: {error}");
                    for job in receiver {
                        let _ = worker_database.update_ocr(job.id, None, "failed", None, false);
                        let _ = app.emit("mote://clipboard-changed", ());
                    }
                    return;
                }
            };

            for job in receiver {
                let _ = worker_database.update_ocr(job.id, None, "processing", None, false);
                let _ = app.emit("mote://clipboard-changed", ());
                let outcome = job
                    .image_paths
                    .iter()
                    .map(|path| {
                        image::open(path)
                            .map_err(|error| error.to_string())
                            .and_then(|image| {
                                engine.recognize(&image).map_err(|error| error.to_string())
                            })
                    })
                    .collect::<Result<Vec<_>, _>>();
                match outcome {
                    Ok(image_results) => {
                        let text = image_results
                            .iter()
                            .map(|results| {
                                results
                                    .iter()
                                    .map(|value| value.text.trim())
                                    .filter(|value| !value.is_empty())
                                    .collect::<Vec<_>>()
                                    .join("\n")
                            })
                            .filter(|value| !value.is_empty())
                            .collect::<Vec<_>>()
                            .join("\n\n");
                        let result_count = image_results.iter().map(Vec::len).sum::<usize>();
                        let confidence = (result_count > 0).then(|| {
                            image_results
                                .iter()
                                .flatten()
                                .map(|value| value.confidence as f64)
                                .sum::<f64>()
                                / result_count as f64
                        });
                        let status = if text.is_empty() { "empty" } else { "ready" };
                        let text_value = (!text.is_empty()).then_some(text.as_str());
                        let _ = worker_database.update_ocr(
                            job.id,
                            text_value,
                            status,
                            confidence,
                            looks_like_formula(&text),
                        );
                    }
                    Err(error) => {
                        eprintln!("Mote OCR failed for record {}: {error}", job.id);
                        let _ = worker_database.update_ocr(job.id, None, "failed", None, false);
                    }
                }
                let _ = app.emit("mote://clipboard-changed", ());
            }
        })
        .expect("failed to spawn OCR worker");

    if let Ok(items) = database.pending_ocr_images(50) {
        for (id, image_paths) in items {
            worker_queue.enqueue(id, image_paths);
        }
    }
    queue
}

fn create_engine(det: &Path, rec: &Path, keys: &Path) -> Result<OcrEngine, String> {
    for path in [det, rec, keys] {
        if !path.exists() {
            return Err(format!("missing OCR resource: {}", path.display()));
        }
    }
    OcrEngine::new(det, rec, keys, None).map_err(|error| error.to_string())
}

fn looks_like_formula(text: &str) -> bool {
    const MATH_MARKERS: [&str; 21] = [
        "=", "∑", "√", "∫", "±", "≤", "≥", "≠", "≈", "∞", "→", "^", "_", "\\frac", "\\sum", " + ",
        " × ", " ÷ ", "²", "³", "₁",
    ];
    MATH_MARKERS.iter().any(|marker| text.contains(marker))
}

#[cfg(test)]
mod tests {
    use super::{looks_like_formula, OcrEngine};

    #[test]
    fn detects_formula_like_text_without_claiming_structure() {
        assert!(looks_like_formula("E = mc^2"));
        assert!(looks_like_formula("x1 + x2"));
        assert!(!looks_like_formula("A normal sentence."));
    }

    #[test]
    #[ignore = "runs the bundled PP-OCRv5 models"]
    fn bundled_models_recognize_a_real_product_screenshot() {
        let crate_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let model_dir = crate_dir.join("models");
        let engine = OcrEngine::new(
            model_dir.join("PP-OCRv5_mobile_det_fp16.mnn"),
            model_dir.join("PP-OCRv5_mobile_rec_fp16.mnn"),
            model_dir.join("ppocr_keys_v5.txt"),
            None,
        )
        .expect("bundled OCR models should load");
        let image = image::open(crate_dir.join("../public/assets/source-reference.png"))
            .expect("source reference image should load");
        let results = engine
            .recognize(&image)
            .expect("bundled OCR models should run inference");
        assert!(results.iter().any(|value| !value.text.trim().is_empty()));
    }
}
