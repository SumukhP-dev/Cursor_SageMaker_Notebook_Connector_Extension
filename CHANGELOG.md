# Change Log

All notable changes to the Cursor SageMaker Notebook Connector extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2024-12-XX

### Added
- Migration check that detects if the old "SageMaker Remote Connection" extension is installed and prompts users to uninstall it
- Migration notice in README directing users from the old extension

## [1.2.0] - 2024-12-XX

### Changed
- **Renamed extension** from "SageMaker Remote Connection" to "Cursor SageMaker Notebook Connector" to better reflect its purpose
- Updated package name to `cursor-sagemaker-notebook-connector`
- Enhanced description to emphasize Cursor and SageMaker notebook connectivity
- Updated all documentation and references to reflect the new name

## [1.1.0] - 2024-12-XX

### Added
- Enhanced SSH config debugging with automatic detection of common issues:
  - VS Code vs Cursor path mismatches (critical issue detection)
  - `%n` vs `%h` ProxyCommand parameter issues
  - Missing environment variables in ProxyCommand
  - `sm_*` wildcard host configuration issues

### Improved
- Streamlined Quick Start process:
  - Removed excessive waiting steps for better user experience
  - More efficient server readiness checks
  - Clearer next steps guidance after setup
- Enhanced error detection in SSH config debugging:
  - Automatic detection of wrong editor paths (Code vs Cursor)
  - Detection of incorrect ProxyCommand parameters
  - Better validation of PowerShell script paths

### Fixed
- Fixed TypeScript compilation errors in QuickStartService (PowerShell string escaping)
- Fixed SSH config fix function to handle VS Code to Cursor path conversions
- Improved error messages and diagnostics output

## [1.0.1] - 2024-12-XX

### Fixed
- Fixed publisher name to match OpenVSX account (SumukhP-dev)

## [1.0.0] - 2024-12-XX

### Added
- Initial release of Cursor SageMaker Notebook Connector extension (formerly SageMaker Remote Connection)
- One-click connection to SageMaker Studio JupyterLab notebooks via Remote-SSH
- Automatic prerequisites checking (AWS CLI, Remote-SSH, AWS Toolkit)
- Automatic setup wizard for configuring SSH and connection parameters
- Quick Start command for automated connection process
- Connection status monitoring and server health checks
- Comprehensive diagnostics and troubleshooting tools
- Auto-fix capabilities for common issues:
  - Code wrapper fixes for Cursor compatibility
  - ARN conversion (App ARN → Space ARN)
  - SSH config formatting and syntax fixes
- SSH config debugging and analysis
- Local server management and startup
- Support for Windows with PowerShell
- Configuration settings for Space ARN, region, and SSH host alias

### Features
- 🔌 Easy Connection: One-click connection to SageMaker Studio spaces
- ✅ Prerequisites Check: Automatically verifies all required tools
- 🛠️ Auto Setup: Configures SSH and installs missing components
- 📊 Status Monitoring: Check connection status and server health
- 🔧 Troubleshooting Tools: Comprehensive diagnostics and fix commands
- 🚀 Quick Start: Automated connection process
- 🐛 Debug Tools: SSH config debugging and connection diagnostics
- 🔄 Auto-Fix: Automatic fixes for common issues

