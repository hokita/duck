//! Generic external button sources: a hand-edited sources.json maps
//! directories of JSON files onto deck pages. All parsing and path/argv
//! resolution happens on the Rust side so the WebView never supplies paths
//! or commands.

// Until the source commands land in lib.rs, nothing outside the tests calls
// into this module.
#![allow(dead_code)]

use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct SourcesConfig {
    pub sources: Vec<SourceConfig>,
}

#[derive(Debug, Deserialize)]
pub struct SourceConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub path: String,
    pub button: ButtonMapping,
}

#[derive(Debug, Deserialize)]
pub struct ButtonMapping {
    pub title: String,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub status: Option<StatusMapping>,
    pub action: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct StatusMapping {
    pub field: String,
    pub map: HashMap<String, String>,
}

pub fn parse_sources_config(raw: &str) -> Result<SourcesConfig, String> {
    let config: SourcesConfig =
        serde_json::from_str(raw).map_err(|error| error.to_string())?;
    for source in &config.sources {
        if source.source_type != "json-directory" {
            return Err(format!(
                "unsupported source type \"{}\" (only \"json-directory\" is supported)",
                source.source_type
            ));
        }
    }
    Ok(config)
}

/// Expands a leading `~` and any `$VAR` references from the environment.
/// Applied only to trusted config values (path, action template elements) —
/// never to values substituted from watched files.
pub fn expand_config_value(value: &str) -> String {
    let mut expanded = value.to_string();
    if let Some(rest) = expanded.strip_prefix("~") {
        if rest.is_empty() || rest.starts_with('/') {
            if let Ok(home) = std::env::var("HOME") {
                expanded = format!("{home}{rest}");
            }
        }
    }
    let mut result = String::with_capacity(expanded.len());
    let mut chars = expanded.char_indices().peekable();
    while let Some((index, ch)) = chars.next() {
        if ch != '$' {
            result.push(ch);
            continue;
        }
        let name_start = index + 1;
        let mut name_end = name_start;
        while let Some(&(next_index, next_ch)) = chars.peek() {
            if next_ch.is_ascii_alphanumeric() || next_ch == '_' {
                name_end = next_index + next_ch.len_utf8();
                chars.next();
            } else {
                break;
            }
        }
        let name = &expanded[name_start..name_end];
        match std::env::var(name) {
            Ok(value) if !name.is_empty() => result.push_str(&value),
            _ => result.push_str(&expanded[index..name_end]),
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    const CLAUDE_EXAMPLE: &str = r#"{
      "sources": [{
        "name": "Claude Code",
        "type": "json-directory",
        "path": "~/.local/state/claude-monitor/sessions",
        "button": {
          "title": "{tmux_session}",
          "subtitle": "{message}",
          "status": {
            "field": "status",
            "map": {
              "working": "working",
              "completed": "done",
              "input_required": "warning",
              "permission_required": "warning",
              "error": "error",
              "idle": "idle"
            }
          },
          "action": ["$HOME/bin/claude-monitor-open", "{tmux_session}", "{tmux_pane}"]
        }
      }]
    }"#;

    #[test]
    fn parses_a_full_source_config() {
        let config = parse_sources_config(CLAUDE_EXAMPLE).expect("should parse");
        assert_eq!(config.sources.len(), 1);
        let source = &config.sources[0];
        assert_eq!(source.name, "Claude Code");
        assert_eq!(source.source_type, "json-directory");
        assert_eq!(source.path, "~/.local/state/claude-monitor/sessions");
        assert_eq!(source.button.title, "{tmux_session}");
        assert_eq!(source.button.subtitle.as_deref(), Some("{message}"));
        let status = source.button.status.as_ref().expect("status mapping");
        assert_eq!(status.field, "status");
        assert_eq!(status.map.get("completed").map(String::as_str), Some("done"));
        let action = source.button.action.as_ref().expect("action template");
        assert_eq!(action.len(), 3);
    }

    #[test]
    fn rejects_malformed_json() {
        assert!(parse_sources_config("{not json").is_err());
    }

    #[test]
    fn rejects_unknown_source_type() {
        let raw = r#"{"sources":[{"name":"x","type":"http","path":"/tmp","button":{"title":"t"}}]}"#;
        let error = parse_sources_config(raw).unwrap_err();
        assert!(error.contains("http"), "error should name the bad type: {error}");
    }

    #[test]
    fn rejects_missing_required_fields() {
        let raw = r#"{"sources":[{"name":"x","type":"json-directory","path":"/tmp"}]}"#;
        assert!(parse_sources_config(raw).is_err());
    }

    #[test]
    fn expands_leading_tilde_and_env_vars() {
        let home = std::env::var("HOME").expect("HOME set in test env");
        assert_eq!(expand_config_value("~/state"), format!("{home}/state"));
        assert_eq!(expand_config_value("$HOME/bin/open"), format!("{home}/bin/open"));
        assert_eq!(expand_config_value("plain/path"), "plain/path");
    }

    #[test]
    fn leaves_unset_env_vars_untouched() {
        assert_eq!(
            expand_config_value("$DUCK_DEFINITELY_UNSET_VAR/x"),
            "$DUCK_DEFINITELY_UNSET_VAR/x"
        );
    }
}
