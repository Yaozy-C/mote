#[cfg(target_os = "macos")]
mod native {
    use std::{
        ffi::CString,
        os::raw::{c_char, c_int},
        path::Path,
    };

    unsafe extern "C" {
        fn mote_screen_capture_preflight() -> bool;
        fn mote_screen_capture_request() -> bool;
        fn mote_accessibility_request() -> bool;
        fn mote_capture_long_screenshot(
            bundle_id: *const c_char,
            output_path: *const c_char,
            max_steps: c_int,
            error: *mut c_char,
            error_length: usize,
        ) -> c_int;
    }

    pub fn screen_capture_ready() -> bool {
        unsafe { mote_screen_capture_preflight() }
    }

    pub fn request_screen_capture() -> bool {
        unsafe { mote_screen_capture_request() }
    }

    pub fn request_accessibility() -> bool {
        unsafe { mote_accessibility_request() }
    }

    pub fn capture(bundle_id: &str, output_path: &Path, max_steps: u32) -> Result<(), String> {
        let bundle = CString::new(bundle_id)
            .map_err(|_| "The target application identifier is invalid.".to_string())?;
        let output = CString::new(output_path.to_string_lossy().as_bytes())
            .map_err(|_| "The screenshot output path is invalid.".to_string())?;
        let mut error = vec![0_i8; 1024];
        let status = unsafe {
            mote_capture_long_screenshot(
                bundle.as_ptr(),
                output.as_ptr(),
                max_steps.clamp(1, 80) as c_int,
                error.as_mut_ptr(),
                error.len(),
            )
        };
        if status == 0 {
            return Ok(());
        }
        let message = unsafe { std::ffi::CStr::from_ptr(error.as_ptr()) }
            .to_string_lossy()
            .trim()
            .to_string();
        Err(if message.is_empty() {
            format!("The scrolling screenshot stopped with error {status}.")
        } else {
            message
        })
    }
}

#[cfg(target_os = "macos")]
pub use native::{capture, request_accessibility, request_screen_capture, screen_capture_ready};

#[cfg(not(target_os = "macos"))]
pub fn screen_capture_ready() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn request_screen_capture() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn request_accessibility() -> bool {
    cfg!(target_os = "windows")
}

#[cfg(not(target_os = "macos"))]
pub fn capture(
    _bundle_id: &str,
    _output_path: &std::path::Path,
    _max_steps: u32,
) -> Result<(), String> {
    Err("Scrolling screenshots are currently available on macOS.".into())
}
