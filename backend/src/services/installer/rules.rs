use super::*;

pub fn should_include_library(rules: &[Rule], current_os: &str) -> bool {
    let mut allowed = false;

    for rule in rules {
        let matches = match &rule.os {
            Some(os) => os.name.as_deref() == Some(current_os),
            None => true,
        };

        if matches {
            allowed = rule.action == "allow";
        }
    }

    allowed
}
