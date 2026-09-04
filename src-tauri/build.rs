fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        build_macos_capture_engine();
    }
    tauri_build::build()
}

fn build_macos_capture_engine() {
    use std::{env, path::PathBuf, process::Command};

    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest directory"));
    let output = PathBuf::from(env::var("OUT_DIR").expect("build output directory"));
    let library = output.join("libmote_long_screenshot.a");
    let mut objects = Vec::new();
    for name in ["MoteLongScreenshot", "MoteScreenshotSelector"] {
        let source = manifest.join(format!("native/macos/{name}.m"));
        let object = output.join(format!("{name}.o"));
        println!("cargo:rerun-if-changed={}", source.display());
        let status = Command::new("xcrun")
            .args(["--sdk", "macosx", "clang", "-c"])
            .arg(&source)
            .args(["-o", object.to_str().expect("capture object path"), "-fobjc-arc", "-fblocks", "-fmodules", "-mmacosx-version-min=14.0", "-Wno-deprecated-declarations"])
            .arg(format!("-fmodules-cache-path={}", output.join("module-cache").display()))
            .status()
            .expect("run clang for the macOS capture engine");
        assert!(status.success(), "macOS capture engine compilation failed");
        objects.push(object);
    }

    let status = Command::new("xcrun")
        .args(["ar", "rcs"])
        .arg(&library)
        .args(&objects)
        .status()
        .expect("archive the macOS capture engine");
    assert!(status.success(), "macOS capture engine archive failed");

    println!("cargo:rustc-link-search=native={}", output.display());
    println!("cargo:rustc-link-lib=static=mote_long_screenshot");
    for framework in [
        "AppKit",
        "CoreGraphics",
        "Foundation",
        "ImageIO",
        "ScreenCaptureKit",
        "UniformTypeIdentifiers",
    ] {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
}
