use crate::commands::exec;

/// Hard-coded Windows power scheme GUIDs (language-independent), parity with
/// the Electron `apply-power-plan` handler (electron.cjs L1589).
const GUID_BALANCED: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
const GUID_HIGH_PERFORMANCE: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
const GUID_POWER_SAVER: &str = "a1841308-3541-4fab-bc81-f71556f20b4a";
const GUID_ULTIMATE: &str = "e9a42b02-d5df-448d-aa00-03f14749eb61";
const GUID_GAMING: &str = "2e2e98c4-30a1-4e5e-8dd5-8f5bf71f42f2";

const GUID_USB_SUBSYSTEM: &str = "2a737441-1930-4402-8d77-b2bebba308a3";
const GUID_USB_SELECTIVE_SUSPEND: &str = "48e6b7a6-50f5-4782-a5d4-53bb8f07e226";
const GUID_PCIEXPRESS_SUBSYSTEM: &str = "501a4d13-42af-4429-9fd1-a8218c268e20";
const GUID_PCIE_LINK_STATE_PM: &str = "ee12f906-d277-404b-b6da-e5fa1a576df5";

fn run_powercfg(args: &[&str]) -> Result<(), String> {
    let output = exec::run_cmd_quiet("powercfg", args);
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn power_list_has(guid: &str) -> Result<bool, String> {
    let output = exec::run_cmd_quiet("powercfg", &["/list"]);
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_lowercase().contains(&guid.to_lowercase()))
}

/// Set active power scheme by hard-coded GUID (parity with Electron `apply-power-plan`).
pub fn set_power_plan(plan_name: &str) -> Result<(), String> {
    match plan_name {
        "balanced" => run_powercfg(&["/setactive", GUID_BALANCED]),
        "performance" => run_powercfg(&["/setactive", GUID_HIGH_PERFORMANCE]),
        "battery" => run_powercfg(&["/setactive", GUID_POWER_SAVER]),
        "ultimate" => {
            if !power_list_has(GUID_ULTIMATE)? {
                run_powercfg(&["/duplicatescheme", GUID_ULTIMATE])?;
            }
            run_powercfg(&["/setactive", GUID_ULTIMATE])
        }
        "gaming" => {
            if !power_list_has(GUID_GAMING)? {
                run_powercfg(&["/duplicatescheme", GUID_HIGH_PERFORMANCE, GUID_GAMING])?;
                run_powercfg(&[
                    "/changename",
                    GUID_GAMING,
                    "ThienPhatTech Gaming",
                    "Optimized for gaming: max CPU, low latency",
                ])?;
            }
            run_powercfg(&["/setactive", GUID_GAMING])?;
            run_powercfg(&[
                "/setacvalueindex",
                GUID_GAMING,
                GUID_USB_SUBSYSTEM,
                GUID_USB_SELECTIVE_SUSPEND,
                "0",
            ])?;
            run_powercfg(&[
                "/setacvalueindex",
                GUID_GAMING,
                GUID_PCIEXPRESS_SUBSYSTEM,
                GUID_PCIE_LINK_STATE_PM,
                "0",
            ])?;
            run_powercfg(&["/setactive", GUID_GAMING])
        }
        _ => Err(format!("Unknown power plan mode: {}", plan_name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guid_constants_match_electron() {
        assert_eq!(GUID_BALANCED, "381b4222-f694-41f0-9685-ff5bb260df2e");
        assert_eq!(GUID_HIGH_PERFORMANCE, "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
        assert_eq!(GUID_POWER_SAVER, "a1841308-3541-4fab-bc81-f71556f20b4a");
        assert_eq!(GUID_ULTIMATE, "e9a42b02-d5df-448d-aa00-03f14749eb61");
        assert_eq!(GUID_GAMING, "2e2e98c4-30a1-4e5e-8dd5-8f5bf71f42f2");
        assert_eq!(GUID_USB_SUBSYSTEM, "2a737441-1930-4402-8d77-b2bebba308a3");
        assert_eq!(
            GUID_USB_SELECTIVE_SUSPEND,
            "48e6b7a6-50f5-4782-a5d4-53bb8f07e226"
        );
        assert_eq!(GUID_PCIEXPRESS_SUBSYSTEM, "501a4d13-42af-4429-9fd1-a8218c268e20");
        assert_eq!(GUID_PCIE_LINK_STATE_PM, "ee12f906-d277-404b-b6da-e5fa1a576df5");
    }

    #[test]
    fn test_unknown_mode_is_error() {
        assert!(set_power_plan("not_a_real_mode").is_err());
    }
}