use super::*;

pub(super) fn process_arguments_args(args: &[serde_json::Value], current_os: &str) -> Vec<String> {
    let mut result = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => {
                if !s.is_empty() {
                    result.push(s.clone());
                }
            }
            serde_json::Value::Object(obj) => {
                let should_include = if let Some(rules_val) = obj.get("rules") {
                    if let Ok(rules) = serde_json::from_value::<Vec<Rule>>(rules_val.clone()) {
                        should_include_library(&rules, current_os)
                    } else {
                        true
                    }
                } else {
                    true
                };

                if should_include {
                    if let Some(value) = obj.get("value") {
                        match value {
                            serde_json::Value::String(s) => result.push(s.clone()),
                            serde_json::Value::Array(arr) => {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        if !s.is_empty() {
                                            result.push(s.to_string());
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            _ => {}
        }
    }
    result
}

pub(super) fn substitute_arg(arg: &str, subs: &[(&str, &str)]) -> String {
    let mut result = arg.to_string();
    for (from, to) in subs {
        result = result.replace(from, to);
    }
    result
}

pub(super) fn split_java_args(input: &str) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut quote_char: Option<char> = None;

    for ch in input.chars() {
        match quote_char {
            Some(q) => {
                if ch == q {
                    quote_char = None;
                } else {
                    current.push(ch);
                }
            }
            None => {
                if ch == '"' || ch == '\'' {
                    quote_char = Some(ch);
                } else if ch.is_whitespace() {
                    if !current.is_empty() {
                        args.push(std::mem::take(&mut current));
                    }
                } else {
                    current.push(ch);
                }
            }
        }
    }

    if !current.is_empty() {
        args.push(current);
    }

    args
}
