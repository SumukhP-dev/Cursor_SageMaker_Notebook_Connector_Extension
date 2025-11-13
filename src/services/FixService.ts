/**
 * Service for applying fixes to common issues
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";
import { ServerManager } from "./ServerManager";
import { SSHConfigManager } from "./SSHConfigManager";

export class FixService {
  /**
   * Fix ARN conversion in the PowerShell connection script
   */
  static async fixArnConversion(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("Fix ARN Conversion");
    outputChannel.show();

    try {
      outputChannel.appendLine("Fixing ARN conversion in sagemaker_connect.ps1...\n");

      const connectScriptPath = ServerManager.getConnectionScriptPath();

      if (!fs.existsSync(connectScriptPath)) {
        outputChannel.appendLine("❌ Connection script not found!");
        outputChannel.appendLine("   The script is created by AWS Toolkit when the server starts.");
        outputChannel.appendLine("   Please start the server first: SageMaker: Start Local Server");
        vscode.window.showErrorMessage("Connection script not found. Start the server first.");
        return;
      }

      let scriptContent = fs.readFileSync(connectScriptPath, "utf8");

      // Check if fix already applied
      if (scriptContent.includes("Convert app ARN to space ARN")) {
        outputChannel.appendLine("✅ Fix already applied!");
        vscode.window.showInformationMessage("ARN conversion fix is already applied.");
        return;
      }

      // Create backup
      const backupPath = `${connectScriptPath}.backup.${Date.now()}`;
      fs.copyFileSync(connectScriptPath, backupPath);
      outputChannel.appendLine(`✅ Created backup: ${backupPath}`);

      // ARN conversion code
      const arnConversionCode = [
        "",
        "# Convert app ARN to space ARN if needed (server only accepts space ARNs)",
        "if ($AWS_RESOURCE_ARN -match '^arn:aws:sagemaker:([^:]+):(\\d+):app/([^/]+)/([^/]+)/.*$') {",
        "    $region = $matches[1]",
        "    $account = $matches[2]",
        "    $domain = $matches[3]",
        "    $space = $matches[4]",
        '    $AWS_RESOURCE_ARN = "arn:aws:sagemaker:" + $region + ":" + $account + ":space/" + $domain + "/" + $space',
        '    Write-Host "Converted app ARN to space ARN: $AWS_RESOURCE_ARN"',
        "}",
        "",
      ].join("\n");

      // Find the line where AWS_RESOURCE_ARN is set
      const arnPattern =
        /(\$AWS_RESOURCE_ARN = \$matches\[2\] -replace '_\._', ':' -replace '__', '\/'\s*\n)/;

      if (scriptContent.match(arnPattern)) {
        scriptContent = scriptContent.replace(arnPattern, `$1${arnConversionCode}`);
        fs.writeFileSync(connectScriptPath, scriptContent, "utf8");
        outputChannel.appendLine("✅ Added ARN conversion logic!");
        outputChannel.appendLine("   The script will now convert app ARNs to space ARNs automatically");
        vscode.window.showInformationMessage("ARN conversion fix applied successfully!");
      } else {
        outputChannel.appendLine("❌ Could not find insertion point in script");
        outputChannel.appendLine("   The script format may have changed");
        vscode.window.showErrorMessage("Could not apply fix. Script format may have changed.");
      }
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("Fix ARN Conversion");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
    }
  }

  /**
   * Fix code wrapper for Cursor compatibility
   */
  static async fixCodeWrapper(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("Fix Code Wrapper");
    outputChannel.show();

    try {
      outputChannel.appendLine("Fixing code wrapper...\n");

      const workspaceFolders = vscode.workspace.workspaceFolders;
      let scriptPath = "";

      if (workspaceFolders && workspaceFolders.length > 0) {
        scriptPath = path.join(
          workspaceFolders[0].uri.fsPath,
          "scripts",
          "fix_cursor_code_command.ps1"
        );
      }

      if (!scriptPath || !fs.existsSync(scriptPath)) {
        outputChannel.appendLine("❌ Fix script not found!");
        outputChannel.appendLine("   Creating code wrapper manually...");

        const codeWrapperPath = path.join(process.env.USERPROFILE || "", "code.cmd");
        const cursorExe = CodeWrapperChecker.getCursorExePath();
        const codeWrapperContent = `@echo off
setlocal

set "FOLDER_URI="
set "NEXT_IS_URI=0"

:parse_args
if "%~1"=="" goto execute
if "%NEXT_IS_URI%"=="1" (
    set "FOLDER_URI=%~1"
    set "NEXT_IS_URI=0"
    shift
    goto parse_args
)
if /i "%~1"=="--folder-uri" (
    set "NEXT_IS_URI=1"
    shift
    goto parse_args
)
set "ARGS=%ARGS% %~1"
shift
goto parse_args

:execute
if defined FOLDER_URI (
    "${cursorExe.replace(/\\/g, "\\\\")}" %FOLDER_URI%
) else (
    "${cursorExe.replace(/\\/g, "\\\\")}" %ARGS%
)
`;

        fs.writeFileSync(codeWrapperPath, codeWrapperContent, "utf8");
        outputChannel.appendLine(`✅ Created code wrapper at: ${codeWrapperPath}`);

        // Add to PATH if not already there
        outputChannel.appendLine("   Checking PATH...");
        try {
          const { stdout } = await ExecUtils.execute(
            "powershell -Command \"$env:Path -split ';' | Select-String -Pattern '$env:USERPROFILE'\""
          );
          if (!stdout.trim()) {
            outputChannel.appendLine("   ⚠️  User profile not in PATH. Adding...");
            await ExecUtils.execute(
              `powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + '$env:USERPROFILE', 'User')"`
            );
            outputChannel.appendLine("   ✅ Added to PATH");
            outputChannel.appendLine("   ⚠️  You may need to restart Cursor for PATH changes to take effect");
          } else {
            outputChannel.appendLine("   ✅ User profile already in PATH");
          }
        } catch {
          outputChannel.appendLine("   ⚠️  Could not modify PATH automatically");
          outputChannel.appendLine("   Please add %USERPROFILE% to your PATH manually");
        }

        vscode.window.showInformationMessage("Code wrapper created! You may need to restart Cursor.");
      } else {
        // Run the fix script
        outputChannel.appendLine(`Running fix script: ${scriptPath}`);
        const terminal = vscode.window.createTerminal("Fix Code Wrapper");
        terminal.sendText(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
        terminal.show();
        vscode.window.showInformationMessage("Running code wrapper fix script. Check terminal for output.");
      }
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("Fix Code Wrapper");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
    }
  }

  /**
   * Fix SSH config issues
   */
  static async fixSSHConfig(): Promise<void> {
    await SSHConfigManager.fixSSHConfig();
  }

  /**
   * Apply all fixes at once
   */
  static async applyAllFixes(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("Apply All Fixes");
    outputChannel.show();

    try {
      outputChannel.appendLine("Applying all fixes...\n");
      outputChannel.appendLine("This will:");
      outputChannel.appendLine("1. Fix code wrapper");
      outputChannel.appendLine("2. Fix ARN conversion");
      outputChannel.appendLine("3. Fix SSH config");
      outputChannel.appendLine("");

      const result = await vscode.window.showWarningMessage(
        "Apply all fixes? This will modify your configuration files.",
        "Apply All",
        "Cancel"
      );

      if (result !== "Apply All") {
        outputChannel.appendLine("Cancelled by user");
        return;
      }

      // 1. Fix code wrapper
      outputChannel.appendLine("1. Fixing code wrapper...");
      await this.fixCodeWrapper();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 2. Fix ARN conversion
      outputChannel.appendLine("\n2. Fixing ARN conversion...");
      await this.fixArnConversion();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Fix SSH config
      outputChannel.appendLine("\n3. Fixing SSH config...");
      await this.fixSSHConfig();

      outputChannel.appendLine("\n========================================");
      outputChannel.appendLine("✅ All fixes applied!");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("");
      outputChannel.appendLine("Next steps:");
      outputChannel.appendLine("1. Restart Cursor (if code wrapper was fixed)");
      outputChannel.appendLine("2. Start server: SageMaker: Start Local Server");
      outputChannel.appendLine("3. Connect: SageMaker: Connect to SageMaker");

      vscode.window
        .showInformationMessage("All fixes applied! You may need to restart Cursor.", "Restart Cursor", "Start Server")
        .then((selection) => {
          if (selection === "Restart Cursor") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          } else if (selection === "Start Server") {
            vscode.commands.executeCommand("sagemaker-remote.startServer");
          }
        });
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("Apply All Fixes");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Failed to apply fixes: ${error.message}`);
    }
  }
}

