/**
 * Service for running comprehensive diagnostics
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { ServerManager } from "./ServerManager";
import { SSHConfigManager } from "./SSHConfigManager";

export class DiagnosticsService {
  /**
   * Run comprehensive diagnostics
   */
  static async diagnoseConnection(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Diagnostics");
    outputChannel.show();

    try {
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("SageMaker Connection Diagnostics");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("");

      // 1. Check code wrapper
      outputChannel.appendLine("1. Checking code wrapper...");
      const codeWrapperIssue = await CodeWrapperChecker.checkCodeWrapperIssue();
      if (codeWrapperIssue.hasIssue) {
        outputChannel.appendLine(`   ❌ ${codeWrapperIssue.message}`);
      } else {
        outputChannel.appendLine(`   ✅ ${codeWrapperIssue.message}`);
      }
      outputChannel.appendLine("");

      // 2. Check PATH configuration
      outputChannel.appendLine("2. Checking PATH configuration...");
      try {
        const { stdout } = await ExecUtils.execute(
          "powershell -Command \"$env:Path -split ';' | Select-String -Pattern '$env:USERPROFILE'\""
        );
        if (stdout.trim()) {
          outputChannel.appendLine("   ✅ User profile is in PATH");
          const { stdout: pathCheck } = await ExecUtils.execute(
            "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pathParts = $userPath -split ';'; if ($pathParts[0] -eq $env:USERPROFILE) { Write-Output 'START' } else { Write-Output 'NOT_START' }\""
          );
          if (pathCheck.trim() === "START") {
            outputChannel.appendLine("   ✅ User profile is at START of PATH");
          } else {
            outputChannel.appendLine("   ⚠️  User profile is in PATH but not at the start");
          }
        } else {
          outputChannel.appendLine("   ❌ User profile NOT in PATH");
        }
      } catch {
        outputChannel.appendLine("   ⚠️  Could not check PATH");
      }
      outputChannel.appendLine("");

      // 3. Check which 'code' command is found
      outputChannel.appendLine("3. Checking which 'code' command is found...");
      const codePath = await ExecUtils.findCommand("code");
      if (codePath) {
        outputChannel.appendLine(`   ✅ Found: ${codePath}`);
        if (codePath.includes(process.env.USERPROFILE || "")) {
          outputChannel.appendLine("   ✅ Using wrapper from user profile");
        } else if (codePath.toLowerCase().includes("cursor")) {
          outputChannel.appendLine("   ✅ Points to Cursor");
        } else if (codePath.toLowerCase().includes("code.exe") || codePath.toLowerCase().includes("vs code")) {
          outputChannel.appendLine("   ❌ Using VS Code instead of wrapper!");
        }
      } else {
        outputChannel.appendLine("   ❌ 'code' command not found in PATH");
      }
      outputChannel.appendLine("");

      // 4. Check Cursor installation
      outputChannel.appendLine("4. Checking Cursor installation...");
      const cursorExe = CodeWrapperChecker.getCursorExePath();
      if (fs.existsSync(cursorExe)) {
        outputChannel.appendLine(`   ✅ Cursor found at: ${cursorExe}`);
      } else {
        outputChannel.appendLine("   ⚠️  Cursor not found at expected location");
      }
      outputChannel.appendLine("");

      // 5. Check Remote-SSH extension
      outputChannel.appendLine("5. Remote-SSH Extension Check...");
      const remoteSSH = await PrerequisitesChecker.checkRemoteSSHExtension();
      if (remoteSSH.installed) {
        outputChannel.appendLine("   ✅ Remote-SSH extension is installed");
        outputChannel.appendLine(`      Version: ${remoteSSH.extensionId} (${remoteSSH.type})`);
      } else {
        outputChannel.appendLine("   ❌ Remote-SSH extension NOT installed");
        outputChannel.appendLine("      This extension is REQUIRED for remote connections!");
      }
      outputChannel.appendLine("");

      // 6. Check SSH config
      outputChannel.appendLine("6. Checking SSH config...");
      const sshConfigPath = SSHConfigManager.getSSHConfigPath();
      if (fs.existsSync(sshConfigPath)) {
        outputChannel.appendLine("   ✅ SSH config exists");
        const content = fs.readFileSync(sshConfigPath, "utf8");
        if (content.includes("sm_") || content.includes("sagemaker")) {
          outputChannel.appendLine("   ✅ Found SageMaker SSH entries");
        } else {
          outputChannel.appendLine("   ⚠️  No SageMaker SSH entries found");
          outputChannel.appendLine("      AWS Toolkit will create these when connecting");
        }
      } else {
        outputChannel.appendLine("   ⚠️  SSH config not found (will be created automatically)");
      }
      outputChannel.appendLine("");

      // 7. Check server status
      outputChannel.appendLine("7. Checking local server status...");
      const serverInfo = await ServerManager.checkServerStatus();
      if (serverInfo.running) {
        outputChannel.appendLine(`   ✅ Server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
      } else {
        outputChannel.appendLine("   ❌ Server is NOT running");
        if (serverInfo.error) {
          outputChannel.appendLine(`      Error: ${serverInfo.error}`);
        }
      }
      outputChannel.appendLine("");

      // 8. Check ARN conversion fix
      outputChannel.appendLine("8. Checking ARN conversion fix...");
      const connectScriptPath = ServerManager.getConnectionScriptPath();
      if (fs.existsSync(connectScriptPath)) {
        const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
        if (scriptContent.includes("Convert app ARN to space ARN")) {
          outputChannel.appendLine("   ✅ ARN conversion fix is applied");
        } else {
          outputChannel.appendLine("   ❌ ARN conversion fix NOT applied");
          outputChannel.appendLine("      Run: SageMaker: Fix ARN Conversion");
        }
      } else {
        outputChannel.appendLine("   ⚠️  Connection script not found (server hasn't started yet)");
      }
      outputChannel.appendLine("");

      // 9. Check mapping file
      outputChannel.appendLine("9. Checking profile mapping file...");
      const mappingFile = path.join(process.env.USERPROFILE || "", ".aws", ".sagemaker-space-profiles");
      if (fs.existsSync(mappingFile)) {
        outputChannel.appendLine("   ✅ Mapping file exists");
        try {
          const mappingContent = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
          const spaceArns = Object.keys(mappingContent.localCredential || {});
          outputChannel.appendLine(`      Found ${spaceArns.length} profile(s)`);
        } catch {
          outputChannel.appendLine("   ⚠️  Mapping file exists but could not parse");
        }
      } else {
        outputChannel.appendLine("   ⚠️  Mapping file not found (will be created when server starts)");
      }
      outputChannel.appendLine("");

      outputChannel.appendLine("========================================");
      outputChannel.appendLine("Diagnostics Complete");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("");

      // Recommendations
      outputChannel.appendLine("Recommendations:");
      if (codeWrapperIssue.hasIssue) {
        outputChannel.appendLine("1. Fix code wrapper: SageMaker: Fix Code Wrapper");
      }
      if (!serverInfo.running) {
        outputChannel.appendLine("2. Start server: SageMaker: Start Local Server");
      }
      if (fs.existsSync(connectScriptPath)) {
        const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
        if (!scriptContent.includes("Convert app ARN to space ARN")) {
          outputChannel.appendLine("3. Apply ARN conversion fix: SageMaker: Fix ARN Conversion");
        }
      }
      outputChannel.appendLine("4. Or apply all fixes: SageMaker: Apply All Fixes");

      vscode.window
        .showInformationMessage("Diagnostics complete. Check output panel for details.", "Apply All Fixes", "Fix Issues")
        .then((selection) => {
          if (selection === "Apply All Fixes") {
            vscode.commands.executeCommand("sagemaker-remote.applyAllFixes");
          } else if (selection === "Fix Issues") {
            vscode.window
              .showQuickPick(["Fix Code Wrapper", "Fix ARN Conversion", "Fix SSH Config", "Start Server"])
              .then((choice) => {
                if (choice === "Fix Code Wrapper") {
                  vscode.commands.executeCommand("sagemaker-remote.fixCodeWrapper");
                } else if (choice === "Fix ARN Conversion") {
                  vscode.commands.executeCommand("sagemaker-remote.fixArnConversion");
                } else if (choice === "Fix SSH Config") {
                  vscode.commands.executeCommand("sagemaker-remote.fixSshConfig");
                } else if (choice === "Start Server") {
                  vscode.commands.executeCommand("sagemaker-remote.startServer");
                }
              });
          }
        });
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("SageMaker Diagnostics");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Diagnostics failed: ${error.message}`);
    }
  }
}

