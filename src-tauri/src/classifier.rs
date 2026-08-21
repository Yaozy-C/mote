pub struct Classification {
    pub kind: &'static str,
    pub title: String,
    pub detail: String,
}

pub fn classify(content: &str) -> Classification {
    let trimmed = content.trim();
    let line_count = trimmed.lines().count();

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Classification {
            kind: "url",
            title: truncate(trimmed, 80),
            detail: "URL".into(),
        };
    }

    if is_hex_color(trimmed) {
        return Classification {
            kind: "color",
            title: trimmed.to_uppercase(),
            detail: "Color".into(),
        };
    }

    if looks_like_html(trimmed) {
        return Classification {
            kind: "html",
            title: truncate(trimmed.lines().next().unwrap_or(trimmed), 52),
            detail: format!(
                "HTML · {line_count} {}",
                if line_count == 1 { "line" } else { "lines" }
            ),
        };
    }

    if looks_like_code(trimmed) {
        let language = detect_language(trimmed);
        return Classification {
            kind: "code",
            title: truncate(trimmed.lines().next().unwrap_or(trimmed), 52),
            detail: format!(
                "{language} · {line_count} {}",
                if line_count == 1 { "line" } else { "lines" }
            ),
        };
    }

    Classification {
        kind: "text",
        title: truncate(trimmed.lines().next().unwrap_or(trimmed), 58),
        detail: format!("Text · {} characters", trimmed.chars().count()),
    }
}

fn is_hex_color(value: &str) -> bool {
    matches!(value.len(), 4 | 7 | 9)
        && value.starts_with('#')
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

fn looks_like_html(value: &str) -> bool {
    value.starts_with('<') && value.ends_with('>') && value.contains("</")
}

fn looks_like_code(value: &str) -> bool {
    value.contains("fn ")
        || value.contains("const ")
        || value.contains("function ")
        || value.contains("=>")
        || (value.contains('{') && value.contains('}'))
}

fn detect_language(value: &str) -> &'static str {
    if value.contains("fn ") || value.contains("let mut") {
        "Rust Code"
    } else if value.contains("function ") || value.contains("const ") || value.contains("=>") {
        "JavaScript"
    } else {
        "Code"
    }
}

fn truncate(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let prefix: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{prefix}…")
    } else {
        prefix
    }
}

#[cfg(test)]
mod tests {
    use super::classify;

    #[test]
    fn classifies_common_clipboard_values() {
        assert_eq!(classify("https://example.com").kind, "url");
        assert_eq!(classify("#FFB347").kind, "color");
        assert_eq!(classify("fn main() {}").kind, "code");
        assert_eq!(classify("<div>Hi</div>").kind, "html");
        assert_eq!(classify("Hello Mote").kind, "text");
    }
}
