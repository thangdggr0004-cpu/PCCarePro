use serde::{Deserialize, Serialize};
use crate::commands::exec;

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerPlan {
    pub active: String,
    pub plans: Vec<PowerPlanEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerPlanEntry {
    pub name: String,
    pub guid: String,
    pub is_active: bool,
}

/// Get current power plan and list all available plans
pub fn get_power_plan() -> Result<PowerPlan, String> {
    let output = exec::run_cmd_quiet("powercfg", &["/list"]);

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut plans = Vec::new();
    let mut active = String::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.starts_with("Power Scheme GUID:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let guid = parts[2].to_string();
                let name = parts[3..].join(" ");
                let is_active = line.contains("*");
                let clean_name = name.trim_end_matches(" *").to_string();
                if is_active {
                    active = clean_name.clone();
                }
                plans.push(PowerPlanEntry {
                    name: clean_name,
                    guid,
                    is_active,
                });
            }
        }
    }

    Ok(PowerPlan { active, plans })
}

/// Set active power plan by name (partial match)
pub fn set_power_plan(plan_name: &str) -> Result<(), String> {
    let plan = get_power_plan()?;

    let target = plan
        .plans
        .iter()
        .find(|p| p.name.to_lowercase().contains(&plan_name.to_lowercase()))
        .ok_or_else(|| format!("Power plan '{}' not found", plan_name))?;

    let output = exec::run_cmd_quiet("powercfg", &["/setactive", &target.guid]);

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to set power plan: {}", stderr))
    }
}
