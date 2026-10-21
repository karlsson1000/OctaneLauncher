use super::*;

impl InstanceManager {
    pub(super) fn should_use_quickplay(version: &str) -> bool {
        let base_version = if version.contains("fabric-loader") {
            version.split('-').last().unwrap_or(version)
        } else if version.contains("-forge-") {
            version.split("-forge-").next().unwrap_or(version)
        } else if version.contains('-') {
            version.split('-').next().unwrap_or(version)
        } else {
            version
        };

        let parts: Vec<&str> = base_version.split('.').collect();

        if parts.len() >= 3 {
            if let (Ok(major), Ok(minor), Ok(patch)) =
                (parts[0].parse::<u32>(), parts[1].parse::<u32>(), parts[2].parse::<u32>())
            {
                if major == 1 && minor == 20 && patch >= 5 {
                    return true;
                }
                if major == 1 && minor > 20 {
                    return true;
                }
                if major > 1 {
                    return true;
                }
            }
        } else if parts.len() == 2 {
            if let (Ok(major), Ok(minor)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                if major == 1 && minor > 20 {
                    return true;
                }
                if major > 1 {
                    return true;
                }
            }
        }

        false
    }
}
