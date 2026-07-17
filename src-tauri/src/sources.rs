//! Generic external button sources: a hand-edited sources.json maps
//! directories of JSON files onto deck pages. All parsing and path/argv
//! resolution happens on the Rust side so the WebView never supplies paths
//! or commands.

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

/// Statuses the deck UI understands (DeckButtonStatus in src/deck/models).
const VALID_STATUSES: [&str; 6] = ["idle", "active", "working", "done", "warning", "error"];

/// Replaces `{field}` placeholders with the file's top-level values. Strings
/// are inserted as-is, numbers and bools stringified; missing or non-scalar
/// fields become the empty string. Unclosed braces stay literal.
pub fn substitute(template: &str, file: &serde_json::Value) -> String {
    let mut result = String::with_capacity(template.len());
    let mut rest = template;
    while let Some(open) = rest.find('{') {
        result.push_str(&rest[..open]);
        let Some(close) = rest[open..].find('}') else {
            result.push_str(&rest[open..]);
            return result;
        };
        let field = &rest[open + 1..open + close];
        match file.get(field) {
            Some(serde_json::Value::String(text)) => result.push_str(text),
            Some(serde_json::Value::Number(number)) => result.push_str(&number.to_string()),
            Some(serde_json::Value::Bool(flag)) => result.push_str(&flag.to_string()),
            _ => {}
        }
        rest = &rest[open + close + 1..];
    }
    result.push_str(rest);
    result
}

/// Looks up the file's status field in the configured map; the mapped value
/// must be a valid DeckButtonStatus or the status is omitted entirely.
pub fn map_status(mapping: &StatusMapping, file: &serde_json::Value) -> Option<String> {
    let value = file.get(&mapping.field)?.as_str()?;
    let mapped = mapping.map.get(value)?;
    VALID_STATUSES.contains(&mapped.as_str()).then(|| mapped.clone())
}

pub fn button_from_file(
    source_index: usize,
    file_stem: &str,
    mapping: &ButtonMapping,
    file: &serde_json::Value,
) -> serde_json::Value {
    let button_id = format!("s{source_index}:{file_stem}");
    let mut button = serde_json::json!({
        "id": button_id,
        "title": substitute(&mapping.title, file),
    });
    if let Some(subtitle) = &mapping.subtitle {
        button["subtitle"] = substitute(subtitle, file).into();
    }
    if let Some(icon) = &mapping.icon {
        button["icon"] = substitute(icon, file).into();
    }
    if let Some(status) = mapping.status.as_ref().and_then(|m| map_status(m, file)) {
        button["status"] = status.into();
    }
    if mapping.action.is_some() {
        // The WebView echoes this payload back to activate_source_button; the
        // argv itself is re-resolved from disk there, never sent to the UI.
        button["action"] = serde_json::json!({
            "type": "custom",
            "actionId": "source:activate",
            "payload": {
                "sourceId": format!("s{source_index}"),
                "buttonId": button["id"].clone(),
            }
        });
    }
    button
}

/// Reads every `*.json` file in the source's directory (sorted by filename)
/// into deck buttons. Malformed files and an unreadable directory yield fewer
/// buttons rather than an error, so one bad file can't blank the deck.
pub fn page_from_source(source_index: usize, source: &SourceConfig) -> serde_json::Value {
    let dir = expand_config_value(&source.path);
    let mut paths: Vec<std::path::PathBuf> = std::fs::read_dir(&dir)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok().map(|e| e.path()))
                .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
                .collect()
        })
        .unwrap_or_default();
    paths.sort();

    let buttons: Vec<serde_json::Value> = paths
        .iter()
        .filter_map(|path| {
            let stem = path.file_stem()?.to_str()?;
            let raw = std::fs::read_to_string(path).ok()?;
            let file: serde_json::Value = serde_json::from_str(&raw).ok()?;
            Some(button_from_file(source_index, stem, &source.button, &file))
        })
        .collect();

    serde_json::json!({
        "id": format!("s{source_index}"),
        "name": source.name,
        "buttons": buttons,
    })
}

/// Builds the argv for a source's action: `~`/`$VAR` expansion runs on the
/// trusted template elements first, then `{field}` substitution inserts file
/// values — so values read from watched files are never env-expanded and land
/// as single argv elements.
pub fn resolve_action(
    source: &SourceConfig,
    file: &serde_json::Value,
) -> Result<Vec<String>, String> {
    let template = source
        .button
        .action
        .as_ref()
        .ok_or_else(|| format!("source \"{}\" has no action", source.name))?;
    if template.is_empty() {
        return Err(format!("source \"{}\" has an empty action", source.name));
    }
    Ok(template
        .iter()
        .map(|element| substitute(&expand_config_value(element), file))
        .collect())
}

pub fn load_config_from(path: &std::path::Path) -> Result<Option<SourcesConfig>, String> {
    match std::fs::read_to_string(path) {
        Ok(raw) => parse_sources_config(&raw).map(Some),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn pages_from_config(config: &SourcesConfig) -> Vec<serde_json::Value> {
    config
        .sources
        .iter()
        .enumerate()
        .map(|(index, source)| page_from_source(index, source))
        .collect()
}

/// Re-resolves a button press from disk. The WebView only names a source and
/// button id; the file is re-read and the argv rebuilt here so the UI can
/// never supply a path or command.
pub fn resolve_button_action(
    config: &SourcesConfig,
    source_id: &str,
    button_id: &str,
) -> Result<Vec<String>, String> {
    let index: usize = source_id
        .strip_prefix('s')
        .and_then(|raw| raw.parse().ok())
        .ok_or_else(|| format!("invalid source id \"{source_id}\""))?;
    let source = config
        .sources
        .get(index)
        .ok_or_else(|| format!("unknown source \"{source_id}\""))?;
    let stem = button_id
        .strip_prefix(&format!("{source_id}:"))
        .ok_or_else(|| format!("button \"{button_id}\" is not in source \"{source_id}\""))?;
    if stem.contains('/') || stem.contains("..") || stem.contains('\\') {
        return Err(format!("invalid button id \"{button_id}\""));
    }
    let path = std::path::Path::new(&expand_config_value(&source.path))
        .join(format!("{stem}.json"));
    let raw = std::fs::read_to_string(&path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let file: serde_json::Value =
        serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    resolve_action(source, &file)
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("sources.json"))
        .map_err(|error| error.to_string())
}

/// Returns the configured source pages, or None when no sources.json exists
/// (the frontend then falls back to its built-in provider).
#[tauri::command]
pub fn list_source_pages(
    app: tauri::AppHandle,
) -> Result<Option<Vec<serde_json::Value>>, String> {
    let Some(config) = load_config_from(&config_path(&app)?)? else {
        return Ok(None);
    };
    Ok(Some(pages_from_config(&config)))
}

#[tauri::command]
pub fn activate_source_button(
    app: tauri::AppHandle,
    source_id: String,
    button_id: String,
) -> Result<(), String> {
    let config = load_config_from(&config_path(&app)?)?
        .ok_or_else(|| "no sources configured".to_string())?;
    let argv = resolve_button_action(&config, &source_id, &button_id)?;
    let child = std::process::Command::new(&argv[0])
        .args(&argv[1..])
        .spawn()
        .map_err(|error| format!("failed to spawn {}: {error}", argv[0]))?;
    // Reap the child off-thread so it neither blocks the command nor lingers
    // as a zombie.
    std::thread::spawn(move || {
        let _ = { child }.wait_with_output();
    });
    Ok(())
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

    fn session_file() -> serde_json::Value {
        serde_json::json!({
            "tmux_session": "duck",
            "message": "Bash",
            "status": "completed",
            "count": 3,
            "flag": true,
            "nested": {"a": 1}
        })
    }

    #[test]
    fn substitutes_scalar_fields_into_templates() {
        let file = session_file();
        assert_eq!(substitute("{tmux_session}", &file), "duck");
        assert_eq!(substitute("run {count} ({flag})", &file), "run 3 (true)");
    }

    #[test]
    fn substitutes_missing_and_non_scalar_fields_as_empty() {
        let file = session_file();
        assert_eq!(substitute("[{absent}]", &file), "[]");
        assert_eq!(substitute("[{nested}]", &file), "[]");
    }

    #[test]
    fn leaves_unclosed_braces_literal() {
        assert_eq!(substitute("brace { only", &session_file()), "brace { only");
    }

    fn status_mapping() -> StatusMapping {
        StatusMapping {
            field: "status".into(),
            map: std::collections::HashMap::from([
                ("completed".to_string(), "done".to_string()),
                ("weird".to_string(), "sparkly".to_string()),
            ]),
        }
    }

    #[test]
    fn maps_status_through_the_configured_map() {
        assert_eq!(
            map_status(&status_mapping(), &session_file()),
            Some("done".to_string())
        );
    }

    #[test]
    fn omits_status_when_unmapped_missing_or_invalid() {
        let mapping = status_mapping();
        // File value not present in the map.
        let unmapped = serde_json::json!({"status": "mystery"});
        assert_eq!(map_status(&mapping, &unmapped), None);
        // Field missing from the file.
        assert_eq!(map_status(&mapping, &serde_json::json!({})), None);
        // Map target is not a valid DeckButtonStatus.
        let invalid_target = serde_json::json!({"status": "weird"});
        assert_eq!(map_status(&mapping, &invalid_target), None);
    }

    fn claude_source() -> SourceConfig {
        parse_sources_config(CLAUDE_EXAMPLE)
            .expect("example parses")
            .sources
            .remove(0)
    }

    #[test]
    fn builds_a_deck_button_from_a_file() {
        let source = claude_source();
        let button = button_from_file(0, "corgi-30", &source.button, &session_file());
        assert_eq!(button["id"], "s0:corgi-30");
        assert_eq!(button["title"], "duck");
        assert_eq!(button["subtitle"], "Bash");
        assert_eq!(button["status"], "done");
        assert_eq!(button["action"]["type"], "custom");
        assert_eq!(button["action"]["actionId"], "source:activate");
        assert_eq!(button["action"]["payload"]["sourceId"], "s0");
        assert_eq!(button["action"]["payload"]["buttonId"], "s0:corgi-30");
        assert!(button.get("icon").is_none());
    }

    #[test]
    fn omits_action_when_source_has_no_action_template() {
        let mut source = claude_source();
        source.button.action = None;
        let button = button_from_file(0, "corgi-30", &source.button, &session_file());
        assert!(button.get("action").is_none());
    }

    #[test]
    fn page_from_source_scans_sorted_and_skips_malformed() {
        let dir = tempfile::tempdir().expect("tempdir");
        let write = |name: &str, content: &str| {
            std::fs::write(dir.path().join(name), content).expect("write file");
        };
        write("b.json", r#"{"tmux_session":"beta","message":"m","status":"working"}"#);
        write("a.json", r#"{"tmux_session":"alpha","message":"m","status":"completed"}"#);
        write("broken.json", "{not json");
        write("notes.txt", "ignored");

        let mut source = claude_source();
        source.path = dir.path().to_string_lossy().into_owned();
        let page = page_from_source(0, &source);

        assert_eq!(page["id"], "s0");
        assert_eq!(page["name"], "Claude Code");
        let buttons = page["buttons"].as_array().expect("buttons array");
        assert_eq!(buttons.len(), 2);
        assert_eq!(buttons[0]["id"], "s0:a");
        assert_eq!(buttons[0]["title"], "alpha");
        assert_eq!(buttons[0]["status"], "done");
        assert_eq!(buttons[1]["id"], "s0:b");
        assert_eq!(buttons[1]["status"], "working");
    }

    #[test]
    fn page_from_source_with_missing_directory_has_no_buttons() {
        let mut source = claude_source();
        source.path = "/nonexistent/duck-source-dir".into();
        let page = page_from_source(3, &source);
        assert_eq!(page["id"], "s3");
        assert_eq!(page["buttons"].as_array().map(Vec::len), Some(0));
    }

    #[test]
    fn resolves_action_argv_with_config_expansion_and_file_substitution() {
        let home = std::env::var("HOME").expect("HOME set in test env");
        let file = serde_json::json!({"tmux_session": "duck", "tmux_pane": "%20"});
        let argv = resolve_action(&claude_source(), &file).expect("argv");
        assert_eq!(
            argv,
            vec![format!("{home}/bin/claude-monitor-open"), "duck".into(), "%20".into()]
        );
    }

    #[test]
    fn never_expands_env_vars_coming_from_file_values() {
        let file = serde_json::json!({"tmux_session": "$HOME", "tmux_pane": "; rm -rf x"});
        let argv = resolve_action(&claude_source(), &file).expect("argv");
        // File values must stay literal single argv elements.
        assert_eq!(argv[1], "$HOME");
        assert_eq!(argv[2], "; rm -rf x");
    }

    #[test]
    fn resolve_action_fails_without_an_action_template() {
        let mut source = claude_source();
        source.button.action = None;
        assert!(resolve_action(&source, &serde_json::json!({})).is_err());
    }

    #[test]
    fn load_config_from_missing_file_is_none() {
        let dir = tempfile::tempdir().expect("tempdir");
        let result = load_config_from(&dir.path().join("sources.json"));
        assert!(matches!(result, Ok(None)));
    }

    #[test]
    fn load_config_from_reads_and_validates() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("sources.json");
        std::fs::write(&path, CLAUDE_EXAMPLE).expect("write config");
        let config = load_config_from(&path).expect("loads").expect("some config");
        assert_eq!(config.sources.len(), 1);

        std::fs::write(&path, "{broken").expect("write config");
        assert!(load_config_from(&path).is_err());
    }

    #[test]
    fn pages_from_config_yields_one_page_per_source() {
        let mut config = parse_sources_config(CLAUDE_EXAMPLE).expect("parses");
        let mut second = claude_source();
        second.name = "Other".into();
        config.sources.push(second);
        let pages = pages_from_config(&config);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0]["id"], "s0");
        assert_eq!(pages[1]["id"], "s1");
        assert_eq!(pages[1]["name"], "Other");
    }

    fn dir_with_session(content: &str) -> (tempfile::TempDir, SourcesConfig) {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("corgi-30.json"), content).expect("write file");
        let mut config = parse_sources_config(CLAUDE_EXAMPLE).expect("parses");
        config.sources[0].path = dir.path().to_string_lossy().into_owned();
        (dir, config)
    }

    #[test]
    fn resolve_button_action_re_reads_the_file_from_disk() {
        let (_dir, config) =
            dir_with_session(r#"{"tmux_session":"duck","tmux_pane":"%20"}"#);
        let argv =
            resolve_button_action(&config, "s0", "s0:corgi-30").expect("argv");
        assert_eq!(argv[1], "duck");
        assert_eq!(argv[2], "%20");
    }

    #[test]
    fn resolve_button_action_rejects_unknown_ids() {
        let (_dir, config) =
            dir_with_session(r#"{"tmux_session":"duck","tmux_pane":"%20"}"#);
        assert!(resolve_button_action(&config, "s9", "s9:corgi-30").is_err());
        assert!(resolve_button_action(&config, "s0", "s0:missing-file").is_err());
        assert!(resolve_button_action(&config, "nonsense", "nonsense:x").is_err());
        // Button id must belong to the named source.
        assert!(resolve_button_action(&config, "s0", "s1:corgi-30").is_err());
    }

    #[test]
    fn resolve_button_action_rejects_path_traversal_stems() {
        let (_dir, config) =
            dir_with_session(r#"{"tmux_session":"duck","tmux_pane":"%20"}"#);
        assert!(resolve_button_action(&config, "s0", "s0:../corgi-30").is_err());
        assert!(resolve_button_action(&config, "s0", "s0:a/b").is_err());
    }
}
